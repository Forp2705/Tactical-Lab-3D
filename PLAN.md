# PLAN — fix/w1-session-persistence (mc-19 FIX 2b+2c)

Base: `origin/main` @ `1bad717`. Gate mc-99 obligatorio al merge. No push, no PR en esta pasada.

## 2b — Bloques de sesion con ejercicios propios no aparecen

**Causa:** `SessionBlockCard` (`src/sessions/SessionsView.tsx:444`) y `recomputeFallback`
(`:930`) resuelven el ejercicio solo contra `catalog`. Los ejercicios creados desde
pizarra/blanco/duplicado/importado viven en `state.exerciseVariants`, nunca en `catalog`.
El patron correcto ya existe en el mismo archivo (`:92-97`, `drawerExercises`).

**Cambio:**
- `SessionBlockCard`: agregar selector `useAppStore((state) => state.exerciseVariants)` y
  resolver `exercise` contra `[...catalog, ...exerciseVariants]` en vez de solo `catalog`.
- `recomputeFallback`: agregar parametro `exerciseVariants: Exercise[]` y resolver el
  `exercise` de cada bloque contra `[...catalog, ...exerciseVariants]`; actualizar el unico
  call site (linea 72, dentro de `SessionsView`) para pasar `exerciseVariants` desde el
  store.
- Sin refactor adicional del componente ni de la firma publica mas alla de este parametro.

**Validacion:** manual (Playwright) — crear pizarra, "Crear bloque desde esta escena", ir a
Sesion, confirmar que la tarjeta aparece. Test unitario nuevo en `tests/` que agrega un
`Session["blocks"]` referenciando un `exerciseVariants[0].id` y afirma que
`recomputeFallback` (y opcionalmente un test de render minimo) lo resuelve.

## 2c — Flush de snapshot en cierre/cambio de pestana

**Causa:** unico autosave es `window.setInterval(handleSave, 8000)` en `src/app/App.tsx:238`.
Nada dispara guardado al cerrar/ocultar la pestana antes de ese intervalo.

**Cambio (`src/app/App.tsx`):**
- Reusar el `handleSave` ya definido dentro del `useEffect` existente (no crear un tercer
  camino de snapshot; no tocar `snapshotFromState`/duplicacion con `AppShell.tsx`, fuera de
  scope).
- Agregar dos listeners dentro del mismo `useEffect` (mismo cleanup que ya limpia el
  `setInterval`):
  - `visibilitychange` -> si `document.visibilityState === "hidden"`, llamar `handleSave()`.
    Mecanismo primario (fiable en pestanas en background/mobile).
  - `pagehide` -> llamar `handleSave()` sin condicion. Backup para el caso de cierre directo.
- **No** se agrega `beforeunload`: `saveSnapshot` es async (Dexie/IndexedDB) y un handler de
  `beforeunload` no puede esperar esa promesa de forma confiable. No prometer en ningun copy
  que "cerrar nunca pierde trabajo".

**Test (enmienda mc-99, declarada):**
- Agregar `fake-indexeddb` como devDependency **pinneada** (version exacta `6.2.5`) en
  `package.json`/`package-lock.json`. Es la unica dependencia nueva permitida en este scope.
- Test nuevo `tests/snapshotRoundtrip.test.ts`: importar `fake-indexeddb/auto` (instala
  `indexedDB`/`IDBKeyRange` en globalThis) ANTES de importar `src/state/db`, luego
  `saveSnapshot(x)` -> `loadSnapshot()` y afirmar que el resultado es equivalente a `x`
  (recorrido real via Dexie, hoy sin cobertura).
- Si `vite.config.ts` necesita `test.environment`/`setupFiles` adicionales para este test
  puntual, cambio minimo (por archivo via comentario `@vitest-environment` si alcanza, o
  config global si no) y documentado en el commit.
- **Timebox 60-90 min.** Si Dexie x fake-indexeddb no logra un round-trip limpio en Node en
  ese tiempo, se entrega el fix de producto igual y el test se reduce a una version mas
  simple (unit test que verifica que los listeners de `visibilitychange`/`pagehide` llaman a
  `handleSave`, sin pasar por Dexie real). El round-trip real queda documentado como riesgo
  residual en el `worker_done`, no bloquea el fix.

## Scope estricto (nada mas se toca)

- `src/sessions/SessionsView.tsx` (2b)
- `src/app/App.tsx` (2c, solo el flush)
- `package.json` + `package-lock.json` (solo `fake-indexeddb` pinneada)
- `vite.config.ts` (solo si el test de round-trip lo exige)
- tests nuevos en `tests/`
- NO se toca `src/state/db.ts` ni `src/state/useAppStore.ts`.

## Commits

1. `PLAN.md` (este archivo), antes de cualquier codigo.
2. Commit 2b (SessionsView.tsx + test).
3. Commit 2c (App.tsx flush + fake-indexeddb dep + test + vite.config.ts si aplica).

## Validacion final

```
npm run type-check && npm run build && npm test -- --run
npm test -- --run tests/snapshot.test.ts tests/migration.test.ts tests/board*.test.ts
```

Manual (Playwright si aplica):
1. Pizarra -> "Crear bloque desde esta escena" -> Sesion: la tarjeta aparece.
2. Editar algo, ocultar/cambiar pestana inmediatamente, recargar: el cambio sobrevive.
