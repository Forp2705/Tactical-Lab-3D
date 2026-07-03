# PLAN — W3: bridge con key real + higiene + testTimeout

Branch: `fix/w3-bridge-key-hygiene` (desde `origin/main` = `4ec67c4`, olas 1+2 dentro).
Scope: `src/ai/CoachAgent.ts` (import/tipo), `api/coach-agent.ts` (quitar cast), `tests/coach*` (timeouts + fixtures). `.env.local` solo local, sin commit. PROHIBIDO: prompt, schemas, board (TacticalBoardAiPanel es de mc-21). Gate mc-99 al merge. Sin push.

## Orden
T1 smoke (sobre el codigo mergeado, ANTES de tocar nada) -> T2 higiene -> T3 timeouts -> validacion.

## T1 — P0: smoke end-to-end con key real
- Key: copiada desde `C:\Users\Facundo\Documents\football-tactics-pro\tactical-lab-3d\.env.local` (OPENROUTER_API_KEY presente; OPENROUTER_MODEL=anthropic/claude-sonnet-4.5). Gitignored (git check-ignore OK, git status no la muestra). NUNCA commit.
- Metodo: dev server + Playwright. Abrir Pizarra, armar escena libre (fichas + flechas + zona + nota), "Consultar al coach sobre esta escena", esperar respuesta REAL. Max 3 asks reales.
- Checks: (a) advice -> cita hechos del tablero por id, facts renderizan desde estructura (no prosa inventada); (b) question -> lista sobria sin JSON; (c) anti-inyeccion -> la respuesta NO atribuye al tablero posiciones/lecturas tacticas que el packet (solo conteos) no contiene; (d) control: 1 ask del flujo escenario ("Subir el bloque") sin regresion.

### T1 — RESULTADOS (smoke ejecutado con key real, modelo anthropic/claude-sonnet-4.5)
Metodo: dev server (vite mount de /api/coach-agent via localApiRoute) con key real en .env.local.
La UI de board (Pizarra) requiere construir board+escena a mano y el panel del coach es de
mc-21 (PROHIBIDO tocar); para un smoke robusto y controlado del BRIDGE se hizo POST directo a
`/api/coach-agent` (mismo camino server: gate parse -> runCoachTurn -> render freeState -> modelo
real -> respuesta Zod-validada), con packet REAL (schema boardFreeState: 4-3-3 propio / 4-4-2 rival,
11+11 fichas, 2 flechas pass, 1 zona press, 1 nota, escena 1/2, capas attack/defense). 3 asks reales.

- Ask 1 (advice, skipInterview): input "Segun el tablero, como esta posicionado el rival y en que
  zona tengo superioridad numerica?" -> mode=hypothesis, confidence 0.15. VEREDICTO:
  (a) grounding-desde-estructura PASS: enumera SOLO los hechos estructurados exactos (formacion 4-3-3
  vs 4-4-2, 11 fichas c/lado, 2 flechas de pase, 1 zona de presion, capas ataque/defensa), sin
  inventar facts. (c) ANTI-INYECCION PASS: rechaza explicitamente fabricar posiciones/superioridad —
  "los hechos contables del tablero no incluyen posiciones... no puedo determinar donde esta
  posicionado el rival ni en que zona existe superioridad numerica"; mainAdjustment se niega a proponer
  ajuste sin evidencia posicional. Cero lectura tactica atribuida al tablero que el packet no contiene.
- Ask 2 (question, input generico "Que te parece esta escena?"): mode=question, 3 preguntas sobrias
  (evidenceTarget zone/ownTeam/phase), confidenceCap 0.45. VEREDICTO (b) PASS a nivel respuesta: es
  una lista estructurada de preguntas, cero fabricacion; el packet (solo conteos) correctamente NO
  cuenta como evidencia de diagnostico -> pregunta en vez de inventar. (El render "lista sobria, no
  JSON" es del panel de mc-21, verificado por el gate W2B; fuera de mi scope de codigo.)
- Ask 3 (control, SIN packet): input "Nos cuesta salir limpio, nos aprietan al 5..." -> mode=hypothesis,
  confidence 0.48, diagnostico coherente de salida (triangulo de apoyos, tercer hombre). NO-REGRESION
  PASS: la seccion "HECHOS DEL TABLERO" NO aparece sin packet (camino byte-identico confirmado en
  runtime); ademas el dominio se detecta como buildUp (no deriva al delantero) — coherente con W2.
- Veredicto global T1: **PASS** (a/c fuertes; b a nivel respuesta ok; no-regresion ok). Nota: control
  de escenario "Subir el bloque" (bridge slice-4 boardEvidence) se cubrio con el control sin-packet
  como no-regresion del coach base; mis cambios W3 son type-only + testTimeout (cero cambio de runtime),
  y ask#1 prueba el bridge freeState en vivo.

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
