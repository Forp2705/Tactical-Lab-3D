# PLAN — W3: gemelo JSON del escenario + label de formacion en undo

Branch: `fix/w3-scenario-twin-undo` desde `origin/main` (4ec67c4).

## T1 — Gemelo JSON del flujo escenario (P0, deuda del gate W2B)

`TacticalBoardAiPanel.tsx`, bloque `rombo-scenario-coach-answer`
(~linea 257-284): en modo `question`, hoy pinta
`JSON.stringify(coachAnswer.response, null, 2)` crudo en un `<pre>`. Mismo
patron ya aplicado en el bloque free-state (gate mc-99 anterior): render de
`selectedQuestions[]` como lista sobria (`question` + `whyItMatters`
opcional como subtitulo).

Reuso de clases (pedido explicito del brief, mc-18 ya estilo
`rombo-freestate-coach-questions` en W2 #19): mismas clases CSS, sin
duplicar reglas. El contenedor sigue siendo `rombo-scenario-coach-answer`
(no se toca), solo cambia que adentro use `<ul
className="rombo-freestate-coach-questions">` en vez del `<pre>` para el
caso `question`.

Verificado: el modo `advice` del escenario ya renderiza texto plano
(`coachAnswer.response.advice.tacticalReading`), no hay otro
`JSON.stringify` visible al DT dentro de `rombo-scenario-coach-answer`. El
`JSON.stringify(payload, null, 2)` de la seccion "Avanzado" (export de
payload) es una feature de exportacion explicita, no una respuesta del
coach — fuera de alcance de este ticket, no tocado.

## T2 — Label de formacion no re-sincroniza en undo (P1, residual FIX 2a)

Causa: `teamAFormation` vive en el reducer local de `useBoardEditor`
(`state.workspace.teamAFormation`), hidratado desde `board.workspace` SOLO
una vez por `board.id` (guard agregado en el hotfix P0 de w1 para cortar el
loop hydrate<->persist). `undo`/`redo` restauran el board en el STORE
(`updateTacticalBoard`) pero nunca tocan ese estado local espejado — el
guard de hidratacion (por id, no por contenido) lo deja intacto a
proposito, asi que el dropdown queda mostrando la formacion nueva aunque
los tokens ya volvieron a la vieja.

Fix elegido: **sincronizar en undo/redo** (no "raiz" via
derivar-siempre-de-board, que cambiaria la fuente de verdad de
`teamAFormation` en todos sus consumidores — roster panel, canvas,
`assignPlayerToPitch` — y arriesgaria reintroducir el parpadeo que el
hotfix evito). Diff minimo:

1. `boardEditorReducer.ts`: accion nueva
   `{ type: "forceRehydrate"; workspace: BoardWorkspaceState }` — reemplaza
   `workspace` sin condicion (a diferencia de `"hydrate"`, que bailea si el
   `boardId` ya coincide) y limpia `dirty`. Undo/redo restauran contenido
   del MISMO board (el id no cambia), asi que el guard por-id de `"hydrate"`
   nunca dispararia para este caso — hace falta una accion sin ese guard.
2. `useBoardEditor.ts`: expone `rehydrateWorkspace(fromBoard)` que
   despacha `forceRehydrate` con `resolveBoardWorkspace(fromBoard, players)`.
3. `useBoardActions.ts`: `undo`/`redo` llaman
   `rehydrateWorkspace(previous)` / `rehydrateWorkspace(next)` — usan el
   objeto YA restaurado que tienen en el closure (`previous`/`next`), NO el
   prop `board` (que todavia apunta al valor viejo hasta el proximo render
   — leer de `board` ahi seria un closure stale y no arreglaria nada).

Test a nivel reducer (state, mas barato que renderizar el hook):
`tests/boardEditorReducer.test.ts` — `forceRehydrate` reemplaza
`teamAFormation` (y el resto del workspace) incondicionalmente y limpia
`dirty`, sin importar `hydratedBoardId`.

## T3 — No romper lo ganado

- `tests/board*` completos + los render tests de mc-20
  (`boardRenderCrashClass`) verdes.
- En vivo: canario de formacion (editar rol -> cambiar formacion -> el rol
  sobrevive via `mergeFormationTokens`; undo restaura TODO incluido el
  label del dropdown), flujo escenario completo (Subir el bloque ->
  consultar -> question-mode renderiza lista, no JSON), flujo free-state
  intacto (no tocado por este branch salvo verificacion).

## Archivos

- `src/board/components/TacticalBoardAiPanel.tsx` (T1)
- `src/board/boardEditorReducer.ts`, `src/board/useBoardEditor.ts`,
  `src/board/useBoardActions.ts` (T2)
- `tests/boardEditorReducer.test.ts` (T2, nuevo caso)

Nada de `api/`, `CoachAgent.ts`, refactor de theme.

## Validacion

```
npm run type-check
npm run build
npm test -- --run
npm test -- --run tests/board*.test.ts
```

Guard EOL antes de cada commit.
