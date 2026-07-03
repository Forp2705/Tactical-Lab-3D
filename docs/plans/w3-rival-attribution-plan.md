# PLAN — W3 Brief A: regla de atribucion del rival

Branch: `fix/w3-rival-attribution` (desde `origin/main`, hoy `4a43ea2` — avanzo mas alla del `4ec67c4` del brief; se ramifica del main actual). Gobernado por mc-10 PRODUCT-W3 Brief A (A1-A4 = aceptacion). Sin push. Gate mc-99 al merge.

## Hallazgo que gobierna
El scout YA llega al prompt (`formatOpponentScoutContext` -> `summarizeOpponentScout`, embebido en "Opponent Scout:"). El gap es la REGLA DE ATRIBUCION en 3 niveles + el caso sin-scout. Cambio ADITIVO al prompt, sin tocar schema/evidencia/board/api.

## Donde vive el bloque
Todo en `src/ai/CoachAgent.ts` (NO toco `CoachAgentPrompt.ts`; la instruccion vive natural en el formatter dinamico del scout, que es lo testeable por A1):
1. Reescribir `formatOpponentScoutContext` (exportarlo para unit tests, patron de mis tests de freeState/rival-presence):
   - **Con scout** (`hasOpponentScoutData`): encabezado `OPPONENT SCOUT (staff-declared belief, not verified fact)` + regla de 3 niveles (Nivel 1 hecho del tablero afirmable; Nivel 2 todo el scout = creencia del staff, citar "segun el scout cargado por el staff", NO sube confianza solo; Nivel 3 inferencia = hipotesis en reflection, nunca posicion/conducta concreta) + "NUNCA inventes formacion, coordenadas ni conducta del rival mas alla de lo declarado" + el resumen (`summarizeOpponentScout`).
   - **Sin scout** (raw ausente o vacio): "No opponent scout loaded." + prohibicion explicita de afirmar formacion/posiciones/conducta del rival + 1-2 preguntas de scout accionables reusando `buildOpponentGamePlan(DEFAULT_OPPONENT_SCOUT, DEFAULT_GAME_MODEL).openQuestions`, sin bloquear la respuesta.
2. Una linea ADITIVA en "Game model and fit rules" (junto a la regla de MISSING_TEAM_IDENTITY, extendiendola): tratar todo el Opponent Scout como creencia declarada del staff, nunca hecho verificado; nunca inventar formacion/coordenadas/conducta del rival; sin scout, cero afirmaciones sobre el rival + pedir scout.

## Imports (in-scope, CoachAgent.ts)
`hasOpponentScoutData`, `normalizeOpponentScout`, `buildOpponentGamePlan`, `DEFAULT_OPPONENT_SCOUT` de `../scout/opponentScout.js`; `DEFAULT_GAME_MODEL` de `../data/gameModel.js`. Solo runtime helpers ya existentes; sin schema nuevo.

## Aceptacion (tests unit del composer)
- A1: `formatOpponentScoutContext({opponentScout: {...datos...}})` contiene el encabezado de atribucion por encima del resumen.
- A2: el bloque con scout contiene la instruccion "NO subas la confianza por el scout solo"; y por construccion los caps deterministicos (buildEvidenceAudit/capForEvidenceStrength/assessCoachAdviceTrust) NO reciben ni referencian el scout -> el techo es scout-independiente. (Con key local: hasta 2 asks comparando confidence con/sin scout como evidencia; declarar si se hizo.)
- A3: sin scout -> "No opponent scout loaded." + cero afirmacion posicional/conductual del rival + al menos una pregunta de scout presente.
- A4: el bloque de rival (con scout) NO contiene coordenadas x/y del rival (el resumen del scout no las tiene; el bloque no las agrega); `rivalReference` sigue presencia-only (bloque separado, no tocado).

## Validacion
`npm run type-check && npm run build && npm test -- --run` + `tests/coach*` + nuevos. Guard EOL. Commits atomicos.

## Evidencia con key real (2 asks, modelo anthropic/claude-sonnet-4.5)
Mismo input ("Como planteo el partido contra este rival, sobre todo por las bandas?", skipInterview).
- Ask A (CON scout probableSystem 4-4-2 + vulnerabilities): mode=hypothesis, confidence 0.48.
  ATRIBUCION PASS: "El scout declara que el rival juega con presion alta orientada a banda y sale corto
  por central..." — atribuye al scout, se mantiene dentro de lo declarado (no inventa coordenadas ni
  formacion extra). A2 PASS: 0.48 queda BAJO el techo de no-evidencia-actual (~0.55 de los guards); el
  scout NO empuja la confianza por encima del techo que fija la evidencia (queda en hipotesis).
- Ask B (SIN scout, mismo input): mode=hypothesis, confidence 0.15. A3 PASS FUERTE: "No hay scout
  cargado del rival... Sin conocer la formacion rival, su presion, su salida... cualquier planteo seria
  especulacion" — CERO afirmacion posicional/conductual del rival; missingInformation pide el scout
  explicito ("Falta scout del rival: formacion, presion, salida, perfil de laterales y extremos").
Interpretacion A2: el criterio es el TECHO (no romper el cap que fija la evidencia actual), no un orden
estricto with<=without; con scout 0.48 y sin scout 0.15, ambos <= ~0.55 => el techo no se rompe por el
scout (que ademas es belief, no evidencia). Estructuralmente, ningun path de cap (buildEvidenceAudit /
capForEvidenceStrength / assessCoachAdviceTrust) recibe ni referencia el scout.

## Riesgos
- A2 real requiere modelo (no deterministico); la garantia fuerte es estructural (scout no entra a ningun path de cap). Si corro asks, es evidencia, no la prueba.
- El texto del bloque es un cambio de prompt (aditivo); cero rewrite del system prompt; A1 fija el substring.
