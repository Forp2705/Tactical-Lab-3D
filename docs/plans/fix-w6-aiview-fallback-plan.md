# W6 — AiView: ultimo call site del fallback silencioso

## Hallazgo (paso 1 del brief)

Un unico call site en `src/ai/AiView.tsx:138`:

```ts
const selectedExercise = getExerciseById(selectedExerciseId);
```

`getExerciseById` (`src/state/useAppStore.ts:1817-1821`) cae a `catalog[0]` en
silencio si el id no resuelve (mismo patron ya corregido en W4/W5 para
viewer/Home/AppShell/Library).

Uso de `selectedExercise` dentro de AiView.tsx:

- linea 207: `currentExercise: selectedExercise?.title ?? "Sin ejercicio"`
  dentro de `cockpitContext` (useMemo).
- `cockpitContext.currentExercise` se renderiza en un solo lugar:
  `ContextRow` "Ejercicio actual" dentro de `ActiveContextPanel`, adentro del
  `<details>` "Avanzado" (linea 910).

**Chequeo del camino al coach (ATENCION del brief):** `buildCoachRuntimeContext`
(linea 643-742) arma el `CoachAgentRuntimeContext` que via
`requestCoachTurn` (`coachAgentClient.ts`) llega a `/api/coach-agent`. Ese
objeto NO incluye ningun campo de ejercicio/currentExercise — trae
workspaceMode, team, teamIdentity, shapeContext, teamModel, gameModel,
opponentScout, videoEvidence, manualObservations, savedLineups,
lineupLabShapes/Transitions, availableSquad/unavailableSquad. Confirmado con
grep sobre `coachAgentClient.ts` (0 matches para "exercise").

**Conclusion: `selectedExercise` NO participa del payload al coach.** Es
puramente un valor de display en un ContextRow secundario. El riesgo del
brief (coach recibe otro ejercicio como contexto sin que el DT lo sepa) NO
existe hoy en este call site — se documenta igual porque el brief pide
verificarlo explicitamente, no asumirlo.

Ademas: el `?? "Sin ejercicio"` en linea 207 es defensive dead code —
`getExerciseById` nunca devuelve `undefined` (cae a `catalog[0]`), y
`selectedExerciseId` se inicializa siempre a `catalog[0]?.id ?? ""`
(`useAppStore.ts:757`), nunca vacio en la practica.

## Fix

1. Importar `catalog` desde `@/data` (ya importa `getSelectableCatalog`,
   falta el catalog completo — es el que usan Home/Library, no el subset de
   `getSelectableCatalog` que es para motores de sesion).
2. Leer `exerciseVariants` del store en el componente principal (no estaba
   suscripto ahi, solo en `AdviceResult`).
3. Reemplazar la linea 138 por
   `resolveExerciseSelection(selectedExerciseId, [...catalog, ...exerciseVariants])`,
   exponiendo `missing`.
4. En el `useMemo` de `cockpitContext` (linea ~207), cambiar
   `currentExercise: selectedExercise?.title ?? "Sin ejercicio"` por un
   label honesto cuando `missing` es true, mismo texto que ya usa HomeView
   para el caso equivalente en texto plano: `"Ejercicio retirado del
   catalogo"` (no la variante banner de Library — el slot de destino es un
   `ContextRow` de una sola linea dentro de un panel secundario, no un panel
   de detalle con botones mutadores; el patron correcto para ese *tipo* de
   slot es el que ya uso HomeView para su SessionCard/list-row, no el
   `alert-row warn` de Library).
5. Sin tocar CoachAgent/prompt/endpoint — no hace falta, confirmado en el
   paso 1.

## Tests

Extender `tests/viewerSelectionFallback.test.ts` con un describe adicional
para el call site de AiView, documentando que es el ultimo conocido y que
resuelve con el mismo helper (mismo catalog+variants que Home/Library).

## Verificacion viva

Playwright: cargar la app, forzar un `selectedExerciseId` retirado en el
store (via `page.evaluate` sobre el store expuesto o IndexedDB), abrir
Diagnostico (AiView), expandir "Avanzado", confirmar que "Ejercicio actual"
muestra el label honesto y no un titulo de catalog[0] sin marca. Interceptar
el fetch a `/api/coach-agent` al apretar "Consultar Coach" (sin key real,
solo mirar el body del request) y confirmar que no contiene el ejercicio.

## Restricciones respetadas

Solo `src/ai/AiView.tsx` + `tests/viewerSelectionFallback.test.ts`. No se
toca `CoachAgent.ts`, `CoachAgentPrompt`, `CoachSchemas`, `coachAgentClient`,
`api/` ni memoria. No se ajusta el helper compartido (`viewerSelection.ts`)
porque no hace falta ningun cambio de logica ahi.
