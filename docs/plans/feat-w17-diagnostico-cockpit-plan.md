# W17 — base del Coach Cockpit (Diagnostico, modo Consulta)

Branch: `feat/w17-diagnostico-cockpit` (ya en `663ab81`). Implementa la
composicion (b) del acceptance sobre `src/ai/AiView.tsx` (modo `coach`
unicamente; `postMatch` no se toca, ni su render ni su CSS). Regla sensible:
`CoachAgent.ts`/`CoachAgentPrompt.ts`/`CoachRules.ts`/retrieval/memoria/`api/`
intocables; `coachAgentClient.ts`/`CoachSchemas.ts` intocables (HONESTY
CONTRACT). Ninguna de las funciones que arman `buildCoachRuntimeContext`
cambia — solo se toca que se MUESTRA, no que se ENVIA.

## Hallazgo clave (de lectura de theme.css antes de tocar nada)

`--accent`/`--text`/`--muted`/`--panel`/`--line` ya fueron remapeados a
tokens felt en el `:root` de W11 FELT BASE (theme.css:32-55): `--accent =
var(--felt-gold)`, `--text = var(--felt-ink)`, etc. El look "cockpit oscuro"
de `.ai-cockpit`/`.coach-report`/`.ai-rail-card` ya hereda paleta felt via
esos tokens; lo que rompe LENGUAJE son los `rgba(94,234,212,X)` (teal)
**hardcodeados sin token** en bordes/fondos de `.ai-cockpit-hero`,
`.ai-metric-pill`, `.ai-context-chip`, `.ai-command-card`/`.ai-rail-card`/
`.coach-report` (regla compartida con Post-Partido, NO se edita in situ),
`.interview-question-card`. `.ai-context-chip` y `.ai-command-card` etc. son
compartidas: `.ai-context-chip` tambien la usa `HomeView.tsx:362` (Sala) y
`.ai-rail-card`/`.coach-report`/`.ai-command-card` comparten regla base con
`.post-match-layout` (theme.css:1354-1366) — **nunca se edita esa regla
combinada in situ**; todo override nuevo va scoped `.ai-cockpit .clase`.

## Composicion nueva (acceptance b)

1. **Zona 1** (header + tabs): sin cambios — vive en `AppShell.tsx` (header
   generico) + `AiModeTabs` ya presente.
2. **Zona 2** (franja contexto, nueva): `ai-cockpit-hero` MUERE completo
   (header + 4 `MetricPill`). Se reemplaza `CoachContextSummary` por un
   nuevo componente `ContextStrip` que fusiona sus tokens (Shape/Formacion/
   Plantel/Rival) con los datos muertos del hero (Evidencia = videoTags +
   videoTracks + manualObservations, Reportes = recentReports.length) + un
   token de estado IA (`agentStatus`). Sin shape: mismo patron chip+link
   "Ir a Evolucion a publicar un shape" que ya existia. Se renderiza como
   PRIMER hijo de `.ai-workbench`, antes de `ai-command-card` (order DOM
   antes del textarea, criterio 4). El chip `activeShape` duplicado que hoy
   vive en el header del command-card (linea ~416-418) se elimina (redundante
   con la franja).
3. **Zona 3** (pregunta): `ai-command-card` queda con eyebrow + textarea +
   footer (slab + microcopy) + edge-state sin-key + `CoachThinkingPanel`. Sin
   el `CoachContextSummary` (movio a zona 2) ni el error card (se mueve a
   zona 4).
4. **Zona 4** (respuesta/estado): nuevo orden `error card` (si hay error) →
   `InterviewPanel` (si activo) → `AdviceResult` / `EmptyState`. El error
   card se reubica desde dentro de `ai-command-card` hasta aca (mismo
   contenido, `{error}` crudo — el fix de humanizacion es mc-17, no se toca).
5. **Zona 5** (detalle): `details` "Ver analisis completo" (dentro de
   `AdviceResult`, pierde `decision-summary-card` por redundante con
   `ShortCoachSummary`) y `details` "Avanzado" sin cambios de contenido.

`EmptyState`: se elimina el `.ai-empty-grid` superior (Equipo/Shape/Reportes
recientes/Memoria validada — duplica la franja de zona 2); queda tablero +
transiciones + el bloque "Hilo semanal activo" (con su propio grid interno,
NO se toca, es data de thread distinta).

`MetricPill` (funcion) queda sin call-sites tras la muerte del hero → se
borra. Las reglas CSS legacy `.ai-cockpit-hero`/`.ai-hero-metrics`/
`.ai-metric-pill` en `theme.css` (1247-1300) y `tactical-ui.css` (fuera de
alcance, tema `[data-theme="cockpit"]` reversible) quedan sin usar pero NO
se borran — riesgo de romper la reversibilidad del tema legacy por un
beneficio cosmetico nulo (dead CSS no ejecuta).

## Regiones marcadas (fixups stacked)

- `{/* W17 REGION CONTEXTO (mc-21) */}` — dos apariciones: sobre `ContextStrip`
  (zona 2) y sobre `<ActiveContextPanel />` (dentro de "Avanzado"). NO se
  implementan los fixes de `W17-CONTEXT-AUDIT.md` (fila de scout, rename
  "Referencia visual del rival", texto de observacion en vez de conteo).
- `{/* W17 REGION RESPUESTA (mc-17) */}` — una aparicion, al tope del bloque
  zona 4 (cubre error card + `InterviewPanel` + `AdviceResult`/`EmptyState`,
  y por extension `EvidenceCard`/`ConfidenceBadge` anidados dentro de
  `AdviceResult`). NO se implementan los fixes de `W17-TRUST-AUDIT.md`
  (relevancia 65%, enum crudo, % inventado, error crudo, score-pill).

## CSS (nueva seccion `W17 AI COCKPIT (mc-18)`, scoped `.ai-cockpit`)

Ubicacion: antes de `W11 FIXUP AI (mc-21)` (theme.css ~7980), agrupando las
olas de ajuste de Diagnostico. Todo selector nuevo prefijado `.ai-cockpit`
(nunca toca `.post-match-layout` ni la regla combinada
`.ai-rail-card,.coach-report,.ai-command-card`).

- `.ai-cockpit`: se agrega la clase `felt-stage` en el JSX (fondo felt vivo
  compartido) + padding/border-radius propios en esta seccion nueva (patron
  `.home-command-view`, ya que `.felt-stage` en si es SOLO el stack de
  `background`, sin layout).
- `.ai-cockpit .ai-context-strip` (nuevo contenedor zona 2) + `.ai-cockpit
  .ai-context-strip .ai-context-chip`: remap scoped a mono felt (border
  `color-mix` con `--felt-line` ~74% transparente, fondo tenue, texto
  `--felt-ink`, `font-family: var(--felt-font-mono)`) — no se toca la regla
  generica `.ai-context-chip` (la usa Sala).
- `.ai-cockpit .ai-command-card`: fondo/borde felt scoped (no se toca la
  regla combinada con `.post-match-layout`).
- `.ai-cockpit .tester-edge-state`, `.ai-cockpit .coach-thinking-panel`,
  `.ai-cockpit .ai-error-card`: tratamiento felt tenue (nuevo, no existia
  remap en theme.css para estas clases fuera del `!important` de
  tactical-ui).
- `.ai-cockpit .interview-question-card`: borde/fondo felt tenue (ajuste
  presentacional pedido por acceptance fila InterviewPanel: "QuestionCards
  hoy son cajas; alinear a chips/paneles tenues sobre felt" — es composicion,
  no toca `question.category` crudo ni ningun contenido, eso es mc-17 H2).
- `.ai-cockpit .coach-short-summary`: refuerzo felt (fondo/borde) para que la
  respuesta corta (zona 4, primer plano) tenga jerarquia visual clara sobre
  el felt y cumpla AA.

Fuera de alcance de esta ola (deuda pre-existente, no bloquea el gate): el
resto de `.coach-report-card` anidados dentro de "Ver analisis completo"
(trust-panel, evidence-panel, alternative-adjustment, football-report-*)
quedan con la paleta cockpit heredada via tokens (`--accent`/`--text`/
`--muted`, ya felt por el remap de `:root`) sin reescribir cada selector
individual — estan colapsados (`<details>`), no forman parte de los criterios
1-8 del checklist, y tocar ~15 selectores mas alli sube el riesgo de la ola
sin mover ninguna metrica del gate.

## Validacion

1. `npm run type-check` + `npm run build` + `npm test -- --run` (suite
   completa, sin filtrar).
2. Vivo 1366×768 demo: medir con `getBoundingClientRect` — textarea y≤420,
   CTA slab completo sobre el fold, 0 ocurrencias del h3 "Decision tactica
   con evidencia visible", 0 `.ai-metric-pill` renderizados, chips de
   contexto ANTES del textarea en el DOM, edge-state sin-key visible sin
   scroll.
3. Vivo 390×844: sin scroll horizontal, textarea alcanzable dentro del
   primer viewport de scroll.
4. Captura `w17-mc18-base-1366.png`.
5. Captura de Sala y Pizarra 1366 pre/post para confirmar cero regresion
   (clases compartidas `.team-card`/`.panel-eyebrow`/`.btn.primary`/
   `.ai-context-chip`).
6. Consola limpia.

## Riesgo

Medio: es una reestructura de composicion grande en un archivo de 2686
lineas, pero acotada a JSX de presentacion (ningun cambio a
`buildCoachRuntimeContext`, `runCoachAgent`, schemas o al packet que se
envia al agente) + CSS nueva scoped. El mayor riesgo puntual es
`.ai-context-chip` y la regla combinada `.ai-rail-card/.coach-report/
.ai-command-card` por ser compartidas — mitigado no tocandolas in situ y
usando overrides `.ai-cockpit`-scoped exclusivamente.
