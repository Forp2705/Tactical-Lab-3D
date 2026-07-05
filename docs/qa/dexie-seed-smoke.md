# QA — Ritual atomico de seeds Dexie (smoke de persistencia)

> **Alcance**: este documento es para smokes manuales / scripts Playwright del staff QA.
> No es tooling de producto y no debe importarse ni referenciarse desde `src/`.

## 1. Por que existe este ritual

Durante el smoke de cierre de W6 (2026-07), verificaciones de seeds en Dexie dieron
**falsos negativos dos veces**: el QA seedeo un `selectedExerciseId` retirado en la DB,
pero re-chequeo el DOM/DB **despues de varias navegaciones extra**. Para entonces la app
ya habia re-persistido su propio estado sobre el seed, y el chequeo tardio leyo un valor
que parecia una regresion ("el fallback silencioso volvio") cuando en realidad el seed
nunca llego vivo al momento del assert.

El mecanismo concreto esta en `src/app/App.tsx` (efecto de autosave):

- La app persiste el snapshot completo del store **cada 8 segundos**
  (`window.setInterval(handleSave, 8000)`).
- Ademas hace flush inmediato en `visibilitychange` (pestana oculta / backgrounded)
  y en `pagehide`.

Consecuencias directas para cualquier smoke:

1. **El seed puede morir ANTES del reload.** Si la pagina de la app esta viva cuando
   escribis el seed, su proximo tick de autosave (≤8 s) re-escribe `latest` con el estado
   en memoria del store y pisa tu seed. Esto se reprodujo en vivo durante la validacion
   de este documento: un gap de ~20 s entre seed y reload alcanzo para que el tick
   restaurara el valor previo y el read-back post-reload diera falso negativo.
2. **El seed puede morir DESPUES del assert.** Cualquier interaccion posterior
   (navegar, clickear, cambiar de pestana) muta el store y el proximo tick / flush
   persiste ese nuevo estado. El seed no es un estado permanente: es una ventana.

La secuencia atomica (seed → reload → assert inmediato, sin ninguna otra interaccion en
el medio) reprodujo el estado honesto de forma confiable en todas las corridas. Esto es
un artefacto de **metodologia de test**, no un bug de la app.

## 2. Donde vive la persistencia (nombres reales)

Definidos en `src/state/db.ts`:

| Cosa | Valor |
| --- | --- |
| DB IndexedDB (Dexie) | `tactical-lab-3d` |
| Object store | `snapshots` (primary key: `key`) |
| Fila del snapshot principal | `key = "latest"` |
| Forma de la fila | `{ key: string, value: <snapshot>, savedAt: number }` |
| Backup automatico pre-migracion | `key = "backup:latest"` |
| Campo del ejemplo canonico | `value.selectedExerciseId` (string, top-level del snapshot) |

Notas:

- El snapshot se valida con Zod al cargar (`loadSnapshot` en `src/state/db.ts`), con
  recuperacion tolerante campo por campo. Aun asi, **el seed canonico es
  read-modify-write sobre la fila existente**, no construir un snapshot a mano: mutar la
  fila real conserva `version`, evita disparar migraciones/backup y no depende de la
  forma completa del contrato.
- El store (`loadSnapshot` en `src/state/useAppStore.ts`) hace spread del snapshot sin
  re-resolver `selectedExerciseId`: un id dangling entra tal cual y la UI muestra estado
  honesto (aviso explicito), no un fallback silencioso.

## 3. El ritual atomico

Los pasos (b), (c) y (d) van **pegados**, en ese orden, sin nada en el medio:

1. **(a) Precondicion**: la app tiene que haber corrido al menos una vez ≥8 s (o haber
   pasado por un flush) para que exista la fila `latest`. Si no existe, el snippet de
   seed falla a proposito con un error claro — no la fabriques a mano.
2. **(b) Seed** via `page.evaluate` contra IndexedDB: leer la fila `latest`, mutar la
   clave objetivo, escribir la fila de vuelta.
3. **(c) Reload inmediato**: `await page.reload()` como instruccion siguiente al seed.
   En un script Playwright ambos pasos corren con milisegundos de separacion, muy por
   debajo de la ventana de 8 s. Si estas operando a mano (DevTools, MCP, etc.),
   dispara el reload desde el mismo `evaluate` del seed
   (`setTimeout(() => location.reload(), 0)` al final) para no depender de tu latencia.
4. **(d) Assert INMEDIATO** del estado esperado — DB y/o DOM — como primera accion
   post-reload. Nada de clicks, navegaciones ni esperas extra antes del assert.
5. **(e) Recien despues** del assert, cualquier interaccion adicional que pida el smoke.
   A partir de ahi el valor en DB vuelve a ser propiedad del autosave de la app y ya no
   es evidencia de nada.

## 4. Snippets canonicos (Playwright)

Validados en vivo el 2026-07-05 contra `npm run dev` (ver §6). Ejemplo real:
`selectedExerciseId`, DB `tactical-lab-3d`, store `snapshots`, fila `latest`.

### 4.1 Seed (read-modify-write de la fila `latest`)

```ts
// SEED_ID: un id real del catalogo (caso positivo) o un id inexistente
// (caso "ejercicio retirado", el escenario W5/W6 de estado honesto).
const SEED_ID = "rondo-4v2-dos-zonas";

const seeded = await page.evaluate(async (seedId) => {
  return await new Promise((resolve, reject) => {
    const open = indexedDB.open("tactical-lab-3d");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("snapshots", "readwrite");
      const store = tx.objectStore("snapshots");
      const getReq = store.get("latest");
      getReq.onsuccess = () => {
        const row = getReq.result;
        if (!row || typeof row.value !== "object" || row.value === null) {
          db.close();
          reject(
            new Error(
              "No existe snapshot 'latest': usar la app >8s antes de seedear",
            ),
          );
          return;
        }
        const previous = row.value.selectedExerciseId;
        row.value.selectedExerciseId = seedId;
        const putReq = store.put(row);
        putReq.onsuccess = () => {
          db.close();
          resolve({ previous, seeded: seedId });
        };
        putReq.onerror = () => {
          db.close();
          reject(putReq.error);
        };
      };
      getReq.onerror = () => {
        db.close();
        reject(getReq.error);
      };
    };
  });
}, SEED_ID);

// (c) RELOAD: instruccion inmediatamente siguiente. Sin awaits de otra cosa,
// sin screenshots, sin logs largos en el medio.
await page.reload();
```

### 4.2 Read-back post-reload (primera accion tras el reload)

```ts
const snapshot = await page.evaluate(async () => {
  const row = await new Promise((resolve, reject) => {
    const open = indexedDB.open("tactical-lab-3d");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("snapshots", "readonly");
      const req = tx.objectStore("snapshots").get("latest");
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    };
  });
  return {
    selectedExerciseId: row?.value?.selectedExerciseId ?? null,
    savedAt: row?.savedAt ?? null,
  };
});

// El assert de DB, ANTES de tocar nada:
expect(snapshot.selectedExerciseId).toBe(SEED_ID);
```

### 4.3 Assert de DOM (complementario, tambien inmediato)

```ts
// Caso positivo (id real): el panel de detalle muestra ese ejercicio.
await expect(
  page.getByRole("heading", { name: "Rondo 4v2 a dos zonas con cambio vertical" }),
).toBeVisible();

// Caso dangling (id retirado): estado honesto, aviso explicito en Biblioteca.
await expect(
  page.getByText("ya no esta disponible en el catalogo"),
).toBeVisible();
```

## 5. Anti-patrones (todos observados o reproducidos en la practica)

- **Chequear tarde, despues de navegar.** Es el falso negativo original de W6: cada
  navegacion re-renderiza, puede re-resolver estado y el autosave lo persiste. Un assert
  que llega despues de eso mide la app, no tu seed.
- **Dejar gap entre seed y reload.** Con la pagina viva, el tick de 8 s pisa el seed
  antes del reload (reproducido en vivo: gap de ~20 s → seed muerto al llegar el
  reload). Seed y reload van pegados; operando a mano, reload desde el propio evaluate.
- **Asumir que el seed persiste indefinidamente.** Post-assert, el autosave vuelve a ser
  dueno de la fila `latest` (tick de 8 s + flush por `visibilitychange`/`pagehide` —
  incluso cambiar de pestana dispara un flush). Un re-chequeo tardio del seed no es
  evidencia valida en ningun sentido.
- **Operaciones destructivas sobre el perfil** (borrar la DB, `indexedDB.deleteDatabase`,
  limpiar el profile del navegador del usuario) para "empezar limpio". Para estado
  virgen, usar un contexto fresco de Playwright (profile propio y descartable); para
  estado dirigido, usar este ritual de seed sobre ese contexto.

## 6. Evidencia de validacion en vivo (2026-07-05)

Corrido contra `npm run dev` (Vite, puerto 5174) con Playwright, en `main` (`e21dd1e`):

- **Caso dangling**: seed `selectedExerciseId = "w7-qa-sentinel-retirado"` (previo:
  `"rondo-4v2-salida"`) + reload atomico → read-back inmediato devolvio el sentinel; el
  DOM mostro el aviso honesto "El ejercicio seleccionado ya no esta disponible en el
  catalogo…". El sentinel sobrevivio incluso al primer tick de autosave post-reload
  (`savedAt` = seed + ~8.4 s), confirmando que el store no re-resuelve en silencio.
- **Caso positivo**: seed `selectedExerciseId = "rondo-4v2-dos-zonas"` + reload atomico →
  read-back inmediato devolvio ese id y el panel de detalle mostro "Rondo 4v2 a dos
  zonas con cambio vertical", sin aviso de no-disponible.
- **Reproduccion del falso negativo** (por que el ritual es atomico): mismo seed pero con
  ~20 s entre seed y reload → un tick de autosave de la pagina viva re-escribio
  `"rondo-4v2-salida"` antes del reload y el read-back post-reload ya no contenia el
  seed.
