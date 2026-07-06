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
| Campo de la vista activa | `value.view` (enum interno, top-level del snapshot) |

Valores de `value.view` (enum en `src/state/db.ts`): `home`, `library`, `viewer`,
`team`, `sessions`, `video`, `ai`, `player`, `board`. **Son ids internos, no los labels
del nav**: "Biblioteca" (bajo el grupo colapsado "Avanzado") es `library`, "Pizarra" es
`board`, "Evolucion" es `team`, "Diagnostico" es `ai`.

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
   seed falla a proposito con un error claro — no la fabriques a mano. En un contexto
   Playwright fresco, primero hay que resolver el chooser de primer arranque
   ("Explorar demo" / "Empezar desde cero"); para este smoke usar "Explorar demo",
   que es el modo con catalogo.
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

### 4.3 Assert de DOM (deterministico: seedear tambien `value.view`)

Los textos de este assert solo se renderizan en ciertas vistas: el panel de detalle
con el `<h2>` del titulo vive en Biblioteca (`view = "library"`), y el aviso de
no-disponible existe en Biblioteca y en Cancha 3D (`"viewer"`). La app restaura al
recargar la **ultima vista persistida** (`value.view`, misma fila `latest`), asi que si
la ultima vista fue otra (p.ej. Pizarra), el assert DOM inmediato no encuentra nada
aunque el seed y el read-back de DB (4.2) sean correctos — y navegar a Biblioteca
despues del reload violaria el ritual atomico (falso negativo real de mc-20 en W7).

La solucion es deterministica: el seed de 4.1 ya es read-modify-write sobre la fila
`latest`, y `value.view` vive en esa misma fila. Fijar **ambos campos en el mismo
write** hace que el reload aterrice directo en Biblioteca, sin navegacion posterior.
El store aplica `view` del snapshot tal cual (spread en `loadSnapshot`,
`src/state/useAppStore.ts`), sin re-resolverla — verificado en vivo (§6).

En el seed de 4.1, junto a la linea que muta `selectedExerciseId`, agregar:

```ts
row.value.selectedExerciseId = seedId;
row.value.view = "library"; // vista que renderiza los textos del assert DOM
```

Y el assert DOM, inmediato post-reload igual que 4.2:

```ts
// Caso positivo (id real): el panel de detalle de Biblioteca muestra ese ejercicio.
// OJO strict mode: en "library" el titulo aparece dos veces (card <h3> de la grilla
// + <h2> del panel de detalle); anclar al panel con level: 2.
await expect(
  page.getByRole("heading", {
    level: 2,
    name: "Rondo 4v2 a dos zonas con cambio vertical",
  }),
).toBeVisible();

// Caso dangling (id retirado): estado honesto, aviso explicito en el panel.
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

Assert DOM deterministico (4.3 con seed de `value.view`), corrido el 2026-07-05 contra
`npm run dev` (puerto 5173) en `main` (`55150a0`), partiendo en ambas rutas de la
precondicion real de mc-20 (ultima vista persistida = Pizarra, `view = "board"`):

- **Caso dangling**: seed `{ selectedExerciseId: "w8-qa-sentinel-retirado", view:
  "library" }` en un solo write + reload atomico → read-back inmediato devolvio ambos
  campos seedeados y el DOM mostro el aviso honesto en el panel de detalle de
  Biblioteca **sin ninguna navegacion post-reload** (1 solo match del texto).
- **Caso positivo**: seed `{ selectedExerciseId: "rondo-4v2-dos-zonas", view:
  "library" }` + reload atomico → read-back inmediato correcto y el `<h2>` del panel
  mostro "Rondo 4v2 a dos zonas con cambio vertical", sin aviso de no-disponible.
  Confirmado en vivo el duplicado de strict mode: `getByRole("heading", { name })` sin
  `level` matcheo 2 elementos (card de la grilla + panel); con `level: 2`, exactamente 1.
- **Por que era no-deterministico antes**: con `view = "board"` persistida y seed solo de
  `selectedExerciseId`, el reload aterriza en Pizarra y ninguno de los dos textos del
  assert DOM existe en el DOM, con DB perfectamente seedeada (el hallazgo original de
  mc-20 consumiendo este doc).
