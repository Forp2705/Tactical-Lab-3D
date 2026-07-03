# PLAN — W3: bridge con key real + higiene + testTimeout

Branch: `fix/w3-bridge-key-hygiene` (desde `origin/main` = `4ec67c4`, olas 1+2 dentro).
Scope: `src/ai/CoachAgent.ts` (import/tipo), `api/coach-agent.ts` (quitar cast), `tests/coach*` (timeouts + fixtures). `.env.local` solo local, sin commit. PROHIBIDO: prompt, schemas, board (TacticalBoardAiPanel es de mc-21). Gate mc-99 al merge. Sin push.

## Orden
T1 smoke (sobre el codigo mergeado, ANTES de tocar nada) -> T2 higiene -> T3 timeouts -> validacion.

## T1 — P0: smoke end-to-end con key real
- Key: copiada desde `C:\Users\Facundo\Documents\football-tactics-pro\tactical-lab-3d\.env.local` (OPENROUTER_API_KEY presente; OPENROUTER_MODEL=anthropic/claude-sonnet-4.5). Gitignored (git check-ignore OK, git status no la muestra). NUNCA commit.
- Metodo: dev server + Playwright. Abrir Pizarra, armar escena libre (fichas + flechas + zona + nota), "Consultar al coach sobre esta escena", esperar respuesta REAL. Max 3 asks reales.
- Checks: (a) advice -> cita hechos del tablero por id, facts renderizan desde estructura (no prosa inventada); (b) question -> lista sobria sin JSON; (c) anti-inyeccion -> la respuesta NO atribuye al tablero posiciones/lecturas tacticas que el packet (solo conteos) no contiene; (d) control: 1 ask del flujo escenario ("Subir el bloque") sin regresion.

### T1 — RESULTADOS (a completar tras el smoke)
- Ask 1: <prompt> -> <resumen respuesta> -> veredicto checks a/b/c
- Ask 2 (control escenario): <prompt> -> <resumen> -> veredicto
- Veredicto global T1: <PASS/FAIL + notas>

## T2 — P0: higiene cast/imports
- `src/ai/CoachAgent.ts`: importar `import type { BoardFreeStateEvidencePacket } from "../board/boardFreeStateEvidencePacket.js"`; borrar los tipos locales `FreeStateEvidenceInput` y `FreeStateFactualClaim`; tipar los params de `runCoachTurnCore` y `generateCoachResponse` como `BoardFreeStateEvidencePacket | null`. `formatFreeStateFactsBlock(unknown)` queda igual (frontera de render defensiva; los tests pasan shapes parciales). El packet real anida `freeStateEvidence.factualClaims` (mi formatter ya lee esa ruta).
- `api/coach-agent.ts`: quitar el cast `RunCoachTurnArgsWithFreeState` y su comentario; pasar el objeto directo (la firma real de runCoachTurn ya declara `freeStateEvidence`). Cero comportamiento nuevo.
- Boundary: solo `import type` (cero runtime); `boardFreeStateEvidencePacket.ts` es client-safe (zod + tipos).

## T3 — P0: testTimeout explicito
- Archivos con `await import("../src/ai/CoachAgent")` que dan falsos timeouts de 5s bajo contencion: `coachTurnFlow`, `coachAgentBoardEvidenceWiring`, `coachAgentHandlerBoardGate`, `coachAgentHandlerFreeStateGate`.
- Fix menos invasivo: `describe(name, () => {...}, { timeout: 20000 })` (config del describe) o 3er arg 20000 por test. Elegir describe-config donde sea 1 describe; documentar cuales.

## Validacion
`npm run type-check && npm run build && npm test -- --run` + `tests/coach*` (ventana tranquila; los timeouts de import son ambientales, ver W2B section 3) + smoke T1 documentado. Guard EOL. Commits atomicos por T.

## Riesgos
- Smoke depende de la UI de board de mc-21 (no la toco, solo la manejo); si el driver es fragil, fallback a inyectar estado por el store para llegar al packet.
- Costo de tokens: max 3 asks reales.
