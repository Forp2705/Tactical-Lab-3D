# PLAN — W2: Contexto IA + Confianza (mc-17, ola 2)

Branch: `fix/w2-coach-context-trust` (desde `origin/main` = `10bcbc4`, con FIX 5 dentro).
Scope estricto (brief §2). Gate mc-99 al merge. Sin push. Commits atomicos por sub-tema.

## T1 (P0) — `formatShapeRuntimeContext` lee `rivalReference` como PRESENCIA
Archivo: `src/ai/CoachAgent.ts` (`formatShapeRuntimeContext`, ~1317).
- Agregar UNA linea de presencia: `Referencia rival cargada en el tablero: si|no` derivada de `arrayValue(shape.rivalReference).length > 0`.
- PROHIBIDO pasar posiciones (son 4 puntos decorativos constantes; serian evidencia fabricada). La linea incluye una aclaracion "solo presencia, no dato posicional" para que el modelo no la use como geometria.
- Exportar `formatShapeRuntimeContext` para test unit (brief autoriza "unit del formatter").
- Test: (pos) rivalReference no vacio -> output contiene "si" y NO contiene "70"/"80"/"88"/"30"; (neg) sin rivalReference -> "no".

## T2 (P1) — diccionario de dominios robusto (audit H1)
Archivos: `src/ai/exerciseMatching.ts` (`inferDomainsFromText`), `src/ai/contextualQuestionGenerator.ts:255-266` (`inferDomain`).
- buildUp: sumar frases de salida (`salir jugando`, `sacar jugado`, `empezar la jugada`, `primera linea`, `salimos`) directas; y `lateral(es)`/`carrilero(s)`/`costado(s)` SOLO en contexto de salida (co-ocurrencia con un termino de salida) para no meter falso-positivo en preguntas puramente defensivas.
- attack: `9` con word-boundary (`/\b9\b/`, no substring), `gener` -> `genera` (excluye "generico/genero"); `aislado` se mantiene (senal real de delantero aislado; el guard depende de que buildUp TAMBIEN se detecte, no de quitar attack).
- Alinear `contextualQuestionGenerator.inferDomain` con la misma logica (una sola verdad).
- Tests: (pos) "no salimos limpio y el 9 queda aislado" y "nos aprietan a los laterales al empezar la jugada" -> contienen `buildUp`; (neg/guard) respuesta derivada a attack con pedido buildUp -> `assessCoachAdviceTrust.missingPrimaryDomain === true` (coachOutputGuard, sin tocar el modulo). Mantener verde el test existente "salir limpio -> buildUp".

## T3 (P1) — evidencia generica no infla confianza (audit H3)
Archivo: `src/ai/evidenceCollection.ts` (`buildEvidenceAudit`, `evidenceStrengthFor`).
- Calcular `hasCaseSignal` = existe una senal de caso: `signals.source in {userAnswer,observation,video}` O `retrieved.sourceType in {observation,video}`.
- `evidenceStrengthFor(covered, missing, hasCaseSignal)`: si `missing===0` pero NO hay case signal -> `partial` (no `sufficient`). Resto igual.
- Efecto: knowledge/memory solos nunca llegan a `sufficient` -> `capForEvidenceStrength` baja de 0.9 a 0.68.
- Tests (evidenceCollection.test.ts): (neg) solo knowledge cubriendo cause/zone -> `evidenceStrength !== "sufficient"`; (pos) knowledge + 1 observation -> puede ser `sufficient`.

## T4 (P1) — rankeo de video por relevancia (audit H2)
Archivo: `src/ai/CoachAgent.ts` (`buildRuntimeVideoEvidenceCatalog`, ~1494) + su call-site en `retrieveCoachEvidence`.
- Cambiar firma a `(userInput, coachContext)`; rankear las marcas con `rankDocuments(userInput, docs, { limit: 6, minScore: 0.2 })`, usando `authorityScore = confidence(0.94/0.76/0.48)` y sin recency alto, de modo que una marca SIN relacion con la consulta caiga por debajo del umbral (piso irrelevante ~0.075 < 0.2) y no entre al catalogo. Preservar `title`/`evidenceTargets`.
- Tests (via `retrieveCoachEvidence`, offline como el test existente): (pos) query "bloque largo por dentro" + tag "bloque largo | carril central" -> VID presente (mantiene test actual); (neg) query de salida + tag de ABP/corner -> no hay VID en `evidenceCatalog`.

## Fuera de scope (no tocar)
`CoachAgentPrompt.ts`, `CoachSchemas.ts` (verificar que el output sigue validando; NO cambiar), `AiView.tsx`, `api/*`, `src/board/*`. Si un cambio de CoachAgent choca con el board evidence packet -> escalation.

## Validacion
`npm run type-check && npm run build && npm test -- --run` + `tests/coach*.test.ts tests/evidence*.test.ts tests/exerciseMatching.test.ts` + nuevos (>=1 pos + 1 neg por tarea). Guard EOL: `git diff --stat` sin whole-file antes de cada commit.

## Riesgos
- T2: ampliar buildUp con lateral/costado gateado puede aun asi solapar dominios en consultas mixtas; mitigado con co-ocurrencia de salida.
- T4: bajar el score de video cambia el orden del catalogo; marcas relevantes siguen citables (currentEvidenceCount intacto), irrelevantes se filtran. Verificar que el test VID existente sigue verde.
