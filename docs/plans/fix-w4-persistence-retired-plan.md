# W4 — Validacion de persistencia tras el delete de 10 ejercicios (mc-19)

Validado contra `git checkout --detach 9577da4` (branch feat/w4-delete-generated de
mc-22, no mergeado). Id retirado usado en toda la validacion:
`posesion-6v3-hombre-libre` (reemplazo curado: `posesion-6v3-pivote`).

## Resumen

4 de 5 caminos OK sin cambios. 1 camino (selectedExerciseId del snapshot / viewer)
confirma la sospecha del gate mc-10 y recibe un fallback minimo con aviso visible,
en branch propio `fix/w4-persistence-retired` cortado desde `9577da4`.

## Camino 1 — session.blocks[].exerciseId

**OK, cubierto por el guard de mc-22.** Evidencia:

- `src/sessions/SessionsView.tsx:465-471` — `SessionBlockCard` retorna temprano si
  `[...catalog, ...exerciseVariants].find(id)` no resuelve, y muestra tarjeta
  "Ejercicio retirado del catalogo" con boton "Quitar bloque" y, si hay tombstone,
  "Reemplazar por <curado>" (linea 516-525) que llama
  `updateSessionBlock(block.id, { exerciseId: replacement.id })`.
- `tests/retiredExercises.test.ts` (preexistente, del branch de mc-22) ya cubre:
  - los 10 tombstones existen y sus keys no estan en catalog (linea 20-28);
  - `recomputeFallback` con un bloque de id retirado no throwea y computa carga 0
    en vez de carga fantasma (linea 53-64);
  - reemplazar por el tombstone recalcula carga real (linea 66-81).
- Corri la suite completa sobre 9577da4: **607 pass** (ver seccion Validacion).

No hizo falta repro viva adicional — la logica que alimenta el guard (resolucion
via catalog+variants, tombstone lookup) es la misma que exercitan los tests, y el
componente en si es JSX puro sobre esa logica (sin estado propio que agregue
riesgo).

## Camino 2 — selectedExerciseId del snapshot (vista/visor)

**Confirma la sospecha del gate mc-10. Aplique fallback minimo.**

Evidencia del bug (antes del fix), `src/state/useAppStore.ts:1804-1808`:

```ts
export function getExerciseById(id: string) {
  return (
    findExercise(id, useAppStore.getState().exerciseVariants) ?? catalog[0]
  );
}
```

`findExercise` (linea 2177) busca en `variants` y despues en `catalog`; si no
encuentra nada devuelve `undefined`, y `getExerciseById` lo pisa con `catalog[0]`
sin ninguna senal. Call-sites que dependen de esto con un `selectedExerciseId`
retirado en el snapshot:

- `src/app/App.tsx:290` (`ViewerWorkspace`) — el visor abre `catalog[0]` (que HOY
  es `pressing-portero-recibe`, primer elemento del catalog curado tras el
  delete) en vez del ejercicio que el staff tenia seleccionado. Este es el mas
  grave: mete al coach a entrenar/mostrar una escena distinta a la que cree que
  eligio, sin ningun indicio.
- `src/home/HomeView.tsx:60` y `436-442` — la card "seguir donde quedaste"
  muestra titulo/fase/principio de `catalog[0]` en vez de avisar que el
  ejercicio ya no existe.
- `src/ui/AppShell.tsx:64` — probablemente breadcrumb/header, mismo patron.
- `src/library/LibraryView.tsx:153` — panel de detalle "seleccionado" en
  Biblioteca.

**Fix aplicado (solo el sitio mas grave, el visor):** en
`src/app/App.tsx`, `ViewerWorkspace` ya no usa `getExerciseById` a ciegas.
Resuelve contra `getAllExercises()` (catalog + variants) para saber si el id
realmente existe, y si no existe (y no hay `viewerExerciseOverride` activo)
muestra un `alert-row warn` (mismo componente visual que usan las alertas del
microciclo en `SessionsView.tsx:361`) con el titulo del ejercicio que se esta
mostrando en su lugar. Nunca lanza excepcion, nunca deja el visor en blanco —
sigue mostrando algo reproducible, pero ahora **visible**, no silencioso.

La logica de resolucion se extrajo a una funcion pura y exportada
(`resolveViewerSelection`) para poder testearla sin renderizar Three.js/R3F —
mismo patron que `recomputeFallback` exportado de `SessionsView.tsx` para el
test de camino 1.

**Alcance de lo NO tocado (riesgo residual documentado, no fix — ver seccion
Riesgos):** `HomeView.tsx`, `AppShell.tsx`, `LibraryView.tsx` comparten el mismo
patron de fallback silencioso via `getExerciseById`, pero son paneles de
texto/preview (no abren una escena 3D para entrenar), y `AiView.tsx` esta
explicitamente fuera de alcance (restriccion "no tocar IA" del brief). Arreglar
los 3 restantes es el mismo patron de una linea cada uno, pero encararlos ahora
hubiera ampliado el diff mas alla del "cambio minimo" pedido y del unico sitio
que el gate senalo como sospecha concreta. Propuesta: mismo patron
(`alert-row warn` + chequeo contra `getAllExercises()`), item chico para picotear
en una wave futura si se decide priorizarlo.

## Camino 3 — Variantes locales (exerciseVariants)

**OK, no aplica el riesgo planteado.** Evidencia:

- `cloneExerciseVariant` (`src/state/useAppStore.ts:1896-1946`) hace un deep
  clone COMPLETO del `Exercise` fuente al crear la variante, con un id nuevo
  (`${source.id}__variant__${Date.now()}`, linea 1902). La variante resultante
  no guarda ningun campo `baseId`/referencia de vuelta al id fuente — es un
  `Exercise` autonomo desde el momento en que se crea.
- `ExerciseSchema` (`src/data/schemas.ts`) no tiene ningun campo tipo
  `baseId`/`sourceId` en la variante — confirmado por grep, el unico campo
  `exerciseId` en todo `schemas.ts` es `SessionBlockSchema.exerciseId` (camino
  1).
- `findExercise` (linea 2177) busca primero en `variants` por igualdad exacta de
  `id`, asi que una variante con id
  `posesion-6v3-hombre-libre__variant__171...` sigue resolviendo por su propio
  id literal aunque el catalog ya no tenga `posesion-6v3-hombre-libre` — nunca
  necesita "mirar atras" al padre.
- Al hidratar (`loadSnapshot` en `db.ts`, `exerciseVariants: z.array(ExerciseSchema)`)
  cada variante se valida como `Exercise` completo e independiente; no hay
  ningun paso de resolucion contra el catalog que pueda fallar.

Conclusion: borrar un ejercicio del catalog no puede romper una variante local
existente, porque la variante nunca dependio de que el original siguiera
existiendo.

## Camino 4 — Microciclo / otros campos con exerciseId

**OK, no hay otro campo.** Evidencia:

- `grep -n "exerciseId" src/data/schemas.ts` devuelve una sola coincidencia:
  `SessionBlockSchema.exerciseId` (linea 222) — ya cubierto en camino 1.
- `MicrocycleSchema` (`src/data/schemas.ts:283-297`) solo guarda `sessionId`
  (opcional) por dia — el microciclo referencia una Session completa, y esa
  Session es la que trae `blocks[].exerciseId`. No hay doble indireccion nueva
  que auditar.
- Encontre 2 campos adicionales con id de ejercicio que el brief no listaba
  explicitamente, los reviso igual porque tocan persistencia:
  - `libraryFavoriteIds: string[]` (`db.ts:207`) y
    `libraryRecentOpens: { exerciseId, at }[]` (`db.ts:111-114,208`). Uso en
    `src/library/LibraryView.tsx:54-73`: ambos se usan SOLO para filtrar por
    membership (`Set.has(exercise.id)`) sobre la lista real de
    `[...visibleCatalog, ...exerciseVariants]`. Un id retirado en favoritos o
    recientes simplemente deja de matchear — el ejercicio desaparece de esas
    listas sin error ni sustitucion incorrecta. Comportamiento aceptable, no
    requiere fix.

## Camino 5 — loadSnapshot/migracion (db.ts)

**OK, sin throw de Zod y sin descartar el resto del estado.** Evidencia:

- Ningun schema en `db.ts`/`schemas.ts` valida existencia-en-catalog de un
  `exerciseId` — `SessionBlockSchema.exerciseId` y
  `LibraryRecentOpenSnapshotSchema.exerciseId` son `z.string()` liso, sin
  `.refine()` contra el catalog. Un snapshot con un id retirado parsea igual de
  bien que uno con un id vigente.
- `loadSnapshot` (`db.ts:372-393`) hace `AppSnapshotSchema.safeParse(raw)`
  sobre el snapshot completo; con un id retirado en `session.blocks` o
  `selectedExerciseId`, `full.success` sigue siendo `true` (no hay razon de
  schema para que falle), asi que no dispara `needsRecovery` ni el camino de
  `backupSnapshot`/`recoverSnapshot` — carga directo, sin perder nada.
- `migrateSnapshot` (`db.ts:424-466`) solo rellena defaults para campos
  ausentes (favoritos, tags, boards, etc.); no toca `selectedExerciseId` ni
  `session.blocks` mas que pasarlos tal cual.
- `useAppStore.ts` `loadSnapshot` action (linea 1644-1686) hace
  `{...current, ...snapshot}` — copia `selectedExerciseId` y `session` tal cual
  del snapshot al store, sin ninguna resolucion contra el catalog en el momento
  de la carga. La resolucion (y por lo tanto el riesgo del camino 2) ocurre
  recien en el render, no en la carga.

Repro viva minima (logica, no IndexedDB real — Dexie/safeParse ya estan
cubiertos en 9577da4 por `tests/snapshot.test.ts`,
`tests/snapshotBackupRecovery.test.ts` y `tests/snapshotRoundtrip.test.ts`,
ninguno de los cuales toque): confirmado por lectura de codigo + el hecho de
que ningun campo de `snapshotShape` tiene `.refine()` contra `catalog`. No hizo
falta test nuevo para este camino: es una propiedad estructural del schema
(ausencia de `.refine`), no un comportamiento con casos borde para exercitar.

## Fix — branch fix/w4-persistence-retired

Cortado desde `9577da4` (detras del branch de mc-22, antes de mergear).

Archivos tocados:
- `src/app/App.tsx` — `ViewerWorkspace` resuelve el ejercicio via
  `resolveViewerSelection` (nueva funcion pura exportada) en vez de
  `getExerciseById` directo; agrega banner `alert-row warn` cuando el id
  seleccionado no resuelve.
- `tests/viewerSelectionFallback.test.ts` (nuevo) — cubre
  `resolveViewerSelection`: id retirado -> `missing: true` + exercise =
  catalog[0]; id vigente -> `missing: false`; override activo -> siempre
  `missing: false` sin importar el id.

## Validacion

- `npm run type-check` — ver output en worker_done.
- `npm run build` — ver output en worker_done.
- `npm test -- --run` — base del branch de mc-22 (9577da4) es 607 pass; con el
  fix debe ser 607 + los nuevos tests de `viewerSelectionFallback.test.ts`.

## Riesgos

- Residual: `HomeView.tsx`, `AppShell.tsx`, `LibraryView.tsx` siguen con
  fallback silencioso a `catalog[0]` via `getExerciseById` para
  `selectedExerciseId` retirado. Menor severidad que el visor (texto/preview,
  no abre escena 3D), documentado arriba, no incluido en este fix para
  mantenerlo minimo.
- `catalog[0]` como fallback es implicito al orden del array `catalog` — hoy es
  `pressing-portero-recibe` porque es el primer curado en
  `src/data/exercises/catalog.ts`, pero eso puede cambiar si se reordena el
  catalog. El banner ahora dice explicitamente CUAL exercise se esta mostrando,
  asi que el riesgo de "orden implicito" deja de ser silencioso aunque siga
  existiendo como mecanismo.
- No mergee con el branch de mc-22 (`feat/w4-delete-generated`) — este fix vive
  cortado desde `9577da4` y debe rebasearse/mergearse detras de ese branch
  cuando el gate de producto lo apruebe, tal como pide el brief.
