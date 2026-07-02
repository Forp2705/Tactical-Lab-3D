# PLAN — W2 follow-up: exponer `freeStateEvidence` en runCoachTurn

Branch: `fix/w2-coach-freestate-param` (desde `origin/main` = `fdf9782`, con mi frente IA ya mergeado).
Scope: `src/ai/CoachAgent.ts` (+ tests). Sin push. Gate mc-99 al merge.

## Via de entrada elegida (y por que)
El packet hermano `boardEvidence` (slice 4) entra a `runCoachTurn` como campo opcional
del objeto de args y esta EXPLICITAMENTE AISLADO (comentario en CoachAgent.ts: "NOT
routed through the ambient coachContext"). Doctrina del brief: mismo camino que el
packet hermano. Por lo tanto `freeStateEvidence` NO se cuela por `coachContext`; se
thread-ea EXPLICITO:
- `runCoachTurnCore` acepta `freeStateEvidence?` en su objeto de args (asi el tipo de
  `runCoachTurn` lo hereda via `Parameters<typeof runCoachTurnCore>[0]` y la API de
  mc-21 puede llamar `runCoachTurn({ ..., freeStateEvidence })`).
- `runCoachTurnCore` lo pasa como 5to parametro opcional a cada llamada de
  `generateCoachResponse`.
- `generateCoachResponse(userInput, coachContext?, prefetched?, promptMode?, freeStateEvidence?)`
  construye un bloque neutro y lo interpola en el prompt.

Diferencia con el hermano: `boardEvidence` es un firewall POST-respuesta; `freeStateEvidence`
debe aparecer EN el prompt como hechos citables. Misma via de entrada (arg aislado),
distinto consumo (render en prompt), documentado.

## Render en el prompt
Nueva seccion "HECHOS DEL TABLERO (estado libre)" que lista SOLO los `factualClaims`
como hechos contables en lenguaje neutro, ej: `- <id>: <statement>`. Instruccion estilo
slice 4: son hechos del tablero, se pueden citar por id; lo que no esta en la lista no es
evidencia del tablero; no inferir posiciones ni lectura tactica. CERO interpretacion mia.

Contrato del claim (tipo estructural LOCAL, no importo el de mc-21): cada claim aporta un
`id` y un texto neutro ya redactado por el generador grounded de mc-21
(`statement` | `text` | `label` | `fact`). Fallback defensivo si no hay texto: `kind = value`
neutro (sin etiquetas tacticas inventadas). Asi mc-21 controla la redaccion grounded y yo
solo listo. mc-21 ajusta el import real al integrar (lo coordina el coordinador).

## Cero regresion sin packet
El bloque se interpola PEGADO a `${runtimeManualObservations}` sin literal alrededor:
`${runtimeManualObservations}${freeStateFactsBlock}`. Con packet ausente,
`formatFreeStateFactsBlock(undefined) === ""` -> el prompt queda BYTE-IDENTICO al actual.
Con packet y claims -> el bloque trae su propio separador `\n\n` inicial.
Claims vacios / packet malformado -> seccion OMITIDA (== ausente). Documentado.

## Tests (formatter + param)
- `formatFreeStateFactsBlock` (exportado): presente con claims -> seccion exacta (header +
  `- id: statement` + instruccion, empieza con `\n\n`); ausente/undefined/null -> ""; `{}`
  y `factualClaims: []` -> ""; fallback kind/value; ignora claims sin id.
- Regresion estructural: `formatFreeStateFactsBlock(undefined) === ""` garantiza prompt
  identico (la interpolacion es `${x}${""}`), cubierto por unit.

## Validacion
`npm run type-check && npm run build && npm test -- --run` + `tests/coach*.test.ts` + nuevos.
Guard EOL (`git diff --stat` sin whole-file). Commits atomicos.

## Fuera de scope
Prompt rewrite, `CoachSchemas`, `api/*`, `src/board/*` (no importo el tipo de mc-21).

## Riesgos
- Forma exacta de `factualClaims` de mc-21 desconocida: mitigado con tipo local all-optional
  + narrow defensivo (statement/text/label/fact, fallback kind=value). Si mc-21 ship-ea
  kind-based sin statement, el output es funcional-neutro; el coordinador alinea el import.
- El render solo ocurre en el prompt de `generateCoachResponse` (diagnostico/hipotesis), no
  en el flujo question-only (otra cadena de prompt): consistente con "evidencia para la
  respuesta"; documentado.
