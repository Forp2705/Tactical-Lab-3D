# VALIDATION — Ola 2 render tests (mc-20)
Base: `origin/main` = `10bcbc4` (post-hotfix PR #12) · Fecha: 2026-07-02 · Branch: `test/w2-board-render-tests` (sin push)

## CORRECCION (gate mc-99 W2A, task_92fe08d8fdbc)

El gate de mc-99 encontro que `tests/useBoardEditorHydratePersist.test.tsx`
(T3) pasaba 4/4 **incluso contra el codigo pre-hotfix** (commit `6e68557`,
padre de `7d1ef66`): el harness original nunca cerraba el circuito
persist->rerender (yo llamaba `rerender()` manualmente, en vez de dejar que
`persistWorkspace` disparara la re-renderizacion real via `setState`), asi
que el header original afirmaba falsamente que el test fijaba el bug P0.

Corregido investigando empiricamente en un worktree descartable (permitido
por el brief de correccion: la regla de no tocar `src/**` aplica a esta
rama, no a copias de verificacion desechables). Con el circuito realmente
cerrado (`persistWorkspace` alimenta un `useState` real, no un `rerender()`
guionado), probado con escritura simple, escritura doble (el patron real de
`applyOwnFormation`: edicion local + commit externo de escena en el mismo
evento) y con churn de `players`: **el hook aislado se asienta limpio en las
DOS versiones del codigo** (pre y post hotfix) — ni una sola vez goteo en un
loop, ni una vez llamo `persistWorkspace` mas de una vez. Conclusion: el
crash real requiere la topologia completa de componentes/suscripciones
(`useBoardActions` se suscribe con `useAppStore()` SIN selector — se
re-renderiza en CUALQUIER escritura del store entero — mientras el padre
`TacticalBoardView` deriva `board` via selectores separados de
`tacticalBoards`/`activeBoardId`; la interaccion de esos dos canales de
suscripcion independientes es lo que produce la divergencia, no algo que
viva dentro de `useBoardEditor` en aislamiento). Ese nivel YA esta cubierto,
de forma verificada, por `tests/boardRenderCrashClass.test.tsx` (T2).

**T3 fue reescrito y re-etiquetado honestamente**: ya no afirma prevenir el
crash P0. Ahora se declara lo que realmente prueba (contrato de estado de
`useBoardEditor` en aislamiento: hidrata una vez, persiste solo si hay
edicion real, el churn de identidad puro nunca dispara un persist de mas) y
dice explicitamente que NO es sustituto de T2 para el crash. El header del
archivo documenta el hallazgo completo. Ver seccion "Que se agrego" y Riesgo
#3 actualizados abajo.

## Que se agrego

- `jsdom` 29.1.1 pinneado en devDependencies (unica dependencia nueva).
- `tests/boardRenderCrashClass.test.tsx` (T2, `// @vitest-environment jsdom`):
  monta `TacticalBoardView` real con el store real (`useAppStore`), crea un
  board, selecciona una ficha propia vinculada a roster, edita su Rol, cambia
  la formacion propia (4-3-3 -> 4-4-2) y afirma: (a) sin "Maximum update depth
  exceeded"; (b) el arbol sigue montado (topbar + 11 tokens propios, no
  blanco); (c) el Rol editado sobrevive en la nueva formacion (contrato de
  FIX 2a). Segundo test: la misma secuencia SIN seleccionar ninguna ficha.
- `tests/useBoardEditorHydratePersist.test.tsx` (T3, `// @vitest-environment jsdom`,
  **corregido tras el gate de mc-99 — ver seccion CORRECCION arriba**):
  `renderHook` sobre `useBoardEditor` con un harness de circuito CERRADO
  (`persistWorkspace` alimenta un `useState` real, produciendo una nueva
  identidad de `board` via una re-renderizacion genuina, no un `rerender()`
  guionado por el test). 4 tests: hidrata sin persistir; una edicion real
  persiste EXACTAMENTE una vez via el circuito cerrado; el patron real de
  doble escritura de `applyOwnFormation` (edicion local + commit externo de
  escena en el mismo evento) tambien persiste una sola vez; el churn de
  identidad posterior nunca re-dispara persist. Documentado honestamente
  como contrato de estado en aislamiento — NO como regression test del crash
  P0 (ver CORRECCION).
- `docs/plans/w2-board-render-tests-plan.md`: plan completo, escrito antes del
  codigo.

No se toco `src/**` ni `vite.config.ts` (el pragma por archivo alcanzo).

## Comandos verificados en `test/w2-board-render-tests`

| Comando | Resultado | Tiempo |
|---|---|---|
| `npm install` (tras agregar jsdom pinneado) | OK — 36 paquetes agregados, 312 auditados | 5s |
| `npm run type-check` | **VERDE** | 13s |
| `npm run build` | **VERDE** — 987 modulos, mismo warning preexistente de chunks grandes | 27s |
| `npm test -- --run` (suite completa) | **VERDE** — **87 archivos, 523 tests, 3 todo** (era 85/517 en `10bcbc4` segun `SMOKE-W1.md`: +2 archivos, +6 tests) | 14s |
| `npx vitest run tests/useBoardEditorHydratePersist.test.tsx tests/boardRenderCrashClass.test.tsx` (targeted) | VERDE — 6 tests | ~4.8s (incluye ~4.4s de arranque de environment jsdom, costo fijo por archivo con ese pragma) |

**Costo de los render tests**: +2 archivos jsdom agregan ~4s al tiempo total de
suite (10s -> 14s). No se considera "pesado" segun el umbral de >10s que pide
el brief (T4), asi que no se marcaron/segregaron aparte.

## Riesgos

1. **`fireEvent.pointerDown` sobre `<g>` SVG funciono en el primer intento**
   (jsdom 29 soporta `PointerEvent` lo suficiente) — no hizo falta el
   fallback a `fireEvent.click` que el plan dejaba documentado como riesgo.
   Si una futura version de jsdom cambia ese soporte, el fallback queda
   documentado en `docs/plans/w2-board-render-tests-plan.md` seccion T2.
2. **Sin auto-cleanup de RTL entre tests**: `vite.config.ts` no tiene
   `test.globals: true`, asi que `@testing-library/react` no registra su
   `afterEach(cleanup)` automatico. `tests/boardRenderCrashClass.test.tsx`
   llama `cleanup()` explicito en su propio `afterEach` — cualquier test
   nuevo de render que se agregue despues de este DEBE hacer lo mismo, o sus
   queries van a chocar con arboles de tests previos que quedaron en
   `document.body`. Documentado tambien como comentario inline en el test.
3. **RESUELTO (ver CORRECCION arriba)**: la verificacion roja/verde SI se hizo,
   en un worktree descartable (`git worktree add <tmp> 6e68557`, fuera de esta
   rama, borrado despues con `git worktree remove --force`). Hallazgo: T3, aun
   con el circuito genuinamente cerrado, NO distingue pre/post hotfix (pasa
   4/4 en ambos) — el crash real vive en la topologia de componentes, no en
   el hook aislado. Por eso T3 se re-etiqueto como contrato de estado, no como
   regression test del crash. `tests/boardRenderCrashClass.test.tsx` (T2) es
   el que si distingue (verificado por mc-99 contra el mismo commit
   pre-hotfix).
4. **`@testing-library/react` (`renderHook`, `render`, `fireEvent`, `cleanup`)
   se usa por primera vez en este repo** en esta ola — antes solo estaba
   instalada sin uso real. Cualquier test futuro que reutilice este patron
   deberia copiar el manejo explicito de `cleanup()` del riesgo #2.

## B1. Matriz de regresion actualizada (reemplaza/extiende la de `AUDIT.md`)

| Si tocas... | Corre... | Tiempo aprox |
|---|---|---|
| `src/board/useBoardEditor.ts` o `boardEditorReducer.ts` (hydrate/persist) | `npx vitest run tests/useBoardEditorHydratePersist.test.tsx tests/boardRenderCrashClass.test.tsx tests/board*.test.ts` | ~6s |
| `src/board/TacticalBoardView.tsx` o `src/board/components/*` (arbol del board) | `npx vitest run tests/boardRenderCrashClass.test.tsx` + smoke manual (el render test cubre mount/seleccion/formacion, NO cubre drag de flechas/zonas ni el panel de IA) | ~1s |
| `src/board/useBoardActions.ts` (applyOwnFormation, merge) | `npx vitest run tests/boardRenderCrashClass.test.tsx tests/boardTools.test.ts tests/board*.test.ts` | ~2s |
| `src/state/db.ts` / `useAppStore.ts` (snapshot, migraciones, acciones) | `npm test -- --run tests/snapshot.test.ts tests/migration.test.ts` (sin cambios vs. `AUDIT.md`) | ~2s |
| `src/viewer/lib/*` (coords/matchEngine) | `npm test -- --run tests/coords.test.ts tests/matchEngine.test.ts` (sin cambios) | ~1.5s |
| `src/ai/CoachAgent*`, contexto IA | `npm test -- --run tests/coach*.test.ts` — **nota**: mc-17 puede agregar tests propios de `coachShapeContext`/`buildCoachShapeContext` en paralelo a esta ola (ver `AUDIT.md` H sobre cobertura 0 de esa pieza); si existen al reconciliar, agregar aca por nombre | ~5s |
| Cualquier cosa en `src/**` o un release | Suite completa: `npm run type-check && npm run build && npm test -- --run` | ~54s total (13+27+14) |

## Nota para el coordinador (reconciliacion)

Esta rama no toca nada de `src/ai/*`. Si mc-17 entrega tests nuevos de
contexto de coach en paralelo, no deberian pisar estos archivos (scope
disjunto: `tests/boardRenderCrashClass.test.tsx`,
`tests/useBoardEditorHydratePersist.test.tsx`, `docs/plans/w2-board-render-tests-plan.md`,
`VALIDATION-W2.md`, `package.json`/`package-lock.json` solo por `jsdom`).
