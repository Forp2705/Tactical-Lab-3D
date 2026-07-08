# Plan — W17 fase 2 mc-17: fixes de confianza (REGION RESPUESTA)

Branch `fix/w17-trust-fixes` stacked sobre mc-18 @ `2a3eca0`. Spec = `W17-TRUST-AUDIT.md` (fase 1), items H1/H2/H3/H5/H6 + dedup sin-key. H4 es de mc-21 (REGION CONTEXTO) — no toco ContextStrip, ActiveContextPanel ni runCoachAgent.

## Alcance de archivos

- `src/ai/AiView.tsx` — solo región respuesta + helpers propios del archivo (buildEvidenceViewModel, EvidenceCard, QuestionCard, InterviewPanel, ConfidenceBadge, error card, gating del botón, edge-state duplicado en AgentStatusPanel).
- `src/ui/tacticalPrimitives.tsx` — ConfidenceMeter, cambio presentacional aditivo (prop opcional `displayValue`); PostMatchAnalysisView usa el meter y NO debe cambiar de comportamiento.
- `tests/aiTrustSurface.test.tsx` — nuevo, tests RED primero.
- PROHIBIDO: CoachAgent/prompts/retrieval/memoria/api/coachAgentClient/CoachSchemas.

## Cambios por hallazgo

1. **H1 relevancia fabricada** — `EvidenceViewModel.relevance` pasa a `number | undefined`; `buildEvidenceViewModel` deja `undefined` cuando la cita no trae `relevance` (muere `?? 0.65`). `EvidenceCard`: sin relevancia muestra "relevancia s/d" y no renderiza ni `%` ni la barra `evidence-score`.
2. **H2 enum crudo** — helper `tacticalDomainLabel` (patrón `impactLabel`) con los 11 valores de `TacticalDomainSchema` en es-AR; `QuestionCard` lo usa en la cabecera.
3. **H3 confianza declarada** — `ConfidenceBadge`: chip compacto pasa a "{n}% declarada" con `title` explicando fuente+umbrales; versión full etiqueta "Confianza declarada por el coach" + leyenda. Meter del hero de AdviceResult recibe `label="Confianza declarada"`. `InterviewPanel`: muere el número inventado (mapa 0.18/0.35/0.58/0.85 queda solo como ancho cualitativo de barra) — `ConfidenceMeter` gana prop opcional `displayValue` que reemplaza el "{n}%" por el label del enum (`evidenceStrengthLabel`).
4. **H5 error digno + gating** — la error card principal pasa el mensaje por `humanizeAgentError`; botón también `disabled` cuando `agentStatusError` esté activo, con label honesto y edge-state con reintento (hoy `null?.openRouterConfigured === false` lo habilita con status caído).
5. **H6 pills regex** — muere `extractEvidenceMeta` completo y los campos `date/opponent/score` del view model y de `EvidenceCard` (el schema de cita no tiene metadata estructurada; "solo estructurado" = nada que mostrar hoy).
6. **Dedup sin-key** — se elimina el edge-state duplicado "Coach IA no disponible" dentro de `AgentStatusPanel` (el principal de la command card queda; la StatusLine "OpenRouter: No configurado" no es duplicado y queda).

## Testing

RED primero en `tests/aiTrustSurface.test.tsx` (patrón `weeklyCoachImmediacy.test.tsx`: `renderToStaticMarkup(<AiView />)` + `useAppStore.setState`):
- entrevista activa con pregunta `category: "defensiveTransition"` → markup contiene "Transicion defensiva" y NO "defensiveTransition" (H2);
- audit `evidenceStrength: "partial"` → markup contiene "Media" y NO "58%" (H3-entrevista);
- `buildEvidenceViewModel` (se exporta para test, como `buildWeeklyDecisionCardModel`) con cita sin `relevance` → queda `undefined` (H1);
- cita con excerpt "salida en 4-3-3" → el view model no expone `score`/`date`/`opponent` (H6).
No testeable por render estático (estado local de AiView, efectos no corren en SSR): error card con mensaje real y gating con `agentStatusError` — se declaran y el gate los cubre en vivo; H1-render y H3-badge quedan cubiertos por lectura + captura viva del demo si hay respuesta renderizable (sin key no la hay: se declara).

## Validación

`npm run type-check` + `npm run build` + suite completa `npm test` + vivo (dev server, demo, captura 1366 de Diagnóstico; la entrevista no es alcanzable sin key desde la UI — declarado). Sin push; done una línea con SHA.
