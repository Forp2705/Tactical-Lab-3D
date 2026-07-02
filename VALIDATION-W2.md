# VALIDATION — Ola 2 render tests (mc-20)
Base: `origin/main` = `10bcbc4` (post-hotfix PR #12) · Fecha: 2026-07-02 · Branch: `test/w2-board-render-tests` (sin push)

## Que se agrego

- `jsdom` 29.1.1 pinneado en devDependencies (unica dependencia nueva).
- `tests/boardRenderCrashClass.test.tsx` (T2, `// @vitest-environment jsdom`):
  monta `TacticalBoardView` real con el store real (`useAppStore`), crea un
  board, selecciona una ficha propia vinculada a roster, edita su Rol, cambia
  la formacion propia (4-3-3 -> 4-4-2) y afirma: (a) sin "Maximum update depth
  exceeded"; (b) el arbol sigue montado (topbar + 11 tokens propios, no
  blanco); (c) el Rol editado sobrevive en la nueva formacion (contrato de
  FIX 2a). Segundo test: la misma secuencia SIN seleccionar ninguna ficha.
- `tests/useBoardEditorHydratePersist.test.tsx` (T3, `// @vitest-environment jsdom`):
  `renderHook` sobre `useBoardEditor` reproduciendo el patron de churn exacto
  que causaba el ping-pong (nueva identidad de `board` + nuevas closures de
  `persistWorkspace`/`onPersist` en cada render, tal cual el caller real sin
  memoizar). 4 tests: hidrata sin persistir; churn puro no re-hidrata ni
  persiste; una edicion real persiste EXACTAMENTE una vez y el churn posterior
  no la vuelve a disparar (el assert que habria fallado antes del hotfix);
  cambiar de board id re-hidrata una vez sin arrastrar persist de mas.
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
3. **No se pudo hacer la verificacion roja/verde clasica** (revertir
   temporalmente el hotfix en `src/board/useBoardEditor.ts` para confirmar
   que estos tests fallan sin el fix): el harness bloqueo la accion por
   tocar `src/**`, que es exactamente el limite que pidio el brief. La
   confianza en que el test es significativo viene de leer el diff del
   hotfix y el plan (`docs/plans/w1-fix2a-hotfix-plan.md`) linea por linea, no
   de una corrida empirica contra el codigo viejo. Riesgo residual: sin esa
   corrida no hay prueba directa de que T3 falla en el codigo pre-hotfix,
   solo inferencia de lectura.
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
