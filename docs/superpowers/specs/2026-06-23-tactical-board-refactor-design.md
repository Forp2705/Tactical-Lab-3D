# Refactor de la Pizarra táctica — Diseño

> Fecha: 2026-06-23 · Rama: `refactor/tactical-board` · Baseline: commit `b36cdef`

## Objetivo

`src/board/TacticalBoardView.tsx` es un monolito de **1912 líneas** con un componente
principal de ~1024 líneas y **29 hooks**. Repite el smell que el masterplan ya critica en
`LineupLab3D.tsx` y `PostMatchAnalysisView.tsx`. Este refactor lo descompone y reordena su
estado **sin cambiar comportamiento ni UX**.

## Premisas

- **Refactor interno puro.** Comportamiento y UX idénticos. Cualquier cambio visible es un bug.
- Los 5 tests de board existentes (`board`, `boardProductPayload`, `boardRenderer`,
  `boardStore`, `boardWorkflowPolish`) quedan verdes en **cada** paso.
- `npm run type-check && npm run build && npm test` al cierre de cada paso.

## Decisiones tomadas

1. **Alcance: rediseño completo** — estado del editor al store + reducer.
2. **Persistencia: plegar el "workspace" dentro del schema `TacticalBoard`** y eliminar
   localStorage (`readWorkspace`/`writeWorkspace`). Una sola fuente de verdad vía Dexie.

## Frontera de estado (núcleo del rediseño)

Hoy el estado vive mezclado en 26 `useState`. Se separa en tres capas con destinos distintos:

| Capa | Qué incluye | Dónde vive | ¿Persiste? |
|---|---|---|---|
| **Canónico** | board, escenas, objetos, flechas, zonas | Zustand store (ya está) | Sí (Dexie) |
| **Workspace** | roster, problem, exercise, layers, currentView, teamAFormation | se pliega al modelo `TacticalBoard` | Sí (Dexie). localStorage **eliminado** |
| **Sesión de edición** | tool, color, lineWidth, zoom, selection, drawStart, drag, draft, editingPlayerId, status, undo/redo (history/future) | `useReducer` local en `useBoardEditor` | **No** — efímero, nunca al snapshot |

- El canónico + workspace van al **store** (persistido).
- El efímero de UI va a un **reducer local**, no al store global (no contamina el snapshot
  Dexie ni la migración).
- Las **mutaciones** del board (formaciones, asignar jugador, editar objeto, borrar selección,
  ops de escena) se centralizan como **funciones puras** `(board, args) => board`, testeables
  sin React.

## Descomposición de archivos

```
src/board/
  boardModel.ts            (existe; +campos workspace en el schema + createDefaultBoard)
  boardMutations.ts        NUEVO — transforms puros: applyFormation, assignPlayerToPitch,
                           updateObject/Arrow/Zone, deleteSelection, scene ops
  boardEditorReducer.ts    NUEVO — reducer del estado de sesión + undo/redo
  useBoardEditor.ts        NUEVO — hook que une store + reducer + mutaciones; API limpia a la vista
  boardGeometry.ts         NUEVO — helpers puros (clamp, distance, scaleY, pointFromSvgEvent, endpointPoint…)
  TacticalBoardView.tsx    queda como shell de layout (~150 líneas)
  components/
    BoardToolbar.tsx       herramientas, color, grosor, zoom, undo/redo
    BoardCanvas.tsx        TacticalPitch + BoardObjectNode (ya son funciones; se promueven)
    BoardRosterPanel.tsx   roster, draft editor, formaciones
    BoardProblemPanel.tsx  problema táctico + exercise builder
    BoardScenesBar.tsx     tabs de escenas, add/dup/delete/reorder
    BoardInspector.tsx     propiedades del objeto/flecha/zona seleccionada
    BoardAiPanel.tsx       payload IA, aiInterpretation, readiness, export
```

`readWorkspace`/`writeWorkspace` se borran.

## Schema + migración

- `TacticalBoardSchema` gana un objeto `workspace` opcional:
  `{ roster, problem, exercise, layers, currentView, teamAFormation }`.
- `createDefaultBoard` lo inicializa con defaults.
- **Migración mínima en `db.ts`**: boards sin `workspace` reciben el default al cargar
  (patrón ya existente). El roster se siembra desde `team.players` solo si viene vacío
  (misma regla del `useEffect` actual), ahora en una acción `hydrateBoardRoster`.
- El snapshot ya incluye `tacticalBoards`; el workspace viaja dentro del board. **No** hace
  falta campo nuevo en `snapshotFromState`/`saveSnapshot`.

## Secuencia (cada paso compila + tests verdes)

0. ✅ Commit del board actual a rama `refactor/tactical-board` (baseline `b36cdef`).
1. Extraer mutaciones puras a `boardMutations.ts` + geometría a `boardGeometry.ts` **+ tests**.
2. Schema `workspace` + migración + matar localStorage. Correr `migration.test.ts` + `boardStore.test.ts`.
3. `boardEditorReducer.ts` + `useBoardEditor.ts` **+ test del reducer** (undo/redo, selección).
4. Cablear la vista al hook; extraer sub-componentes uno a uno a `components/`.
5. `TacticalBoardView.tsx` queda como shell.

## Tests

- Nuevos: `boardMutations.test.ts`, `boardGeometry.test.ts`, `boardEditorReducer.test.ts`.
- Existentes (5 de board + `migration`) verdes en todo momento.
- `type-check && build` al cierre de cada paso.

## Riesgos

- **Migración de persistencia**: todo campo nuevo del board necesita default en carga; respetar
  el patrón existente y cubrir con `migration.test.ts`.
- **Acoplar más al store global**: el efímero de UI NO va al store; queda en el reducer local.
- **Regresión visual**: sin tests de snapshot visual; mitigar con extracción incremental y
  verificación manual del flujo de la Pizarra al cierre.
