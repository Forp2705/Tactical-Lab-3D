# RomboIQ — Crítica de panel al Product Research Roadmap

> Segunda opinión crítica (no reescritura). Lentes: product-manager, reality-checker, ux-architect, ui-designer, ai-engineer, model-qa, software-architect, code-reviewer, performance-benchmarker.
> Regla del panel: no halagar. Verificado contra el código real, no contra el documento.
> Foco: calidad de producto, workflow, confianza en la IA, UX/UI, arquitectura y dirección. No ventas/pricing/GTM.

---

## 1. Veredicto ejecutivo

El roadmap es **bueno, honesto y direccionalmente correcto**: clava la tesis (convergencia y hardening, no expansión), identifica el wedge real (un hilo táctico semanal continuo) y nombra las debilidades sin maquillar. Como banco de pruebas, no necesita reescritura.

Pero comete **dos errores que un segundo par de ojos debe marcar**:

1. **Subestima lo ya construido.** Varios items marcados "build now" ya existen a medias (el gate de confianza, el motor de recomendación de ejercicios). La acción real es *terminar/cablear*, no *construir*.
2. **Se contradice con su propia tesis.** Predica "narrow & harden" pero pone **cuatro features net-new en "Now"** (backlog, objective tracker, exercise rec, onboarding). Eso es exactamente el "impresionante de construir, agotador de usar" que el propio doc dice temer.

Y la corrección más importante, verificada en el repo:

> El must-fix #1 ("AI trust / citas") **no es "construir el gating"** — el gate ya existe en `coachOutputGuard.ts` y **capea la confianza** (0.5 sin citas, 0.55 si deriva de fase, 0.62 si afirma fuerte sin evidencia del caso). Lo que falta es que **el MODO sea coherente con el gate**: hoy capea el número pero no degrada la etiqueta, y `runCoachTurn` decide el modo aparte (`src/ai/CoachAgent.ts` líneas 491–733). Resultado: **un "Diagnóstico @ 0.50" se sigue presentando como diagnóstico.**

**Veredicto reality-checker: NEEDS WORK** — pero el slice real es mucho **más chico y más quirúrgico** de lo que el roadmap implica. El producto está a 1–2 cambios precisos de subir su confianza real, no a un trimestre de features.

Puntaje de fuerza del roadmap como guía: **7.5/10** (acierta el norte; pierde puntos por mis-framing del trabajo de IA y por fan-out de features).

---

## 2. Qué mantener (correcto, no tocar)

- **Tesis central: convergencia/hardening > expansión.** Correcta y la evidencia la respalda.
- **El wedge:** "convertir un problema táctico en una semana coherente de trabajo y aprender de lo que pasó." Es más filoso que "IA para coaches". Mantener como norte. (Visible en `HomeView` next-action, CTA diagnóstico→sesión en `AiView`, card de origen en `SessionsView`, handoff en `PostMatchAnalysisView`, `TeamTimeline`.)
- **AI trust como prioridad #1.** Correcto (pero reencuadrar el slice — §3).
- **Sacar del core path: simulator, scout, game-model builder.** Buena decisión de foco. Se construyeron recién; **parkearlos está bien**, no borrarlos.
- **Tactical problem backlog como la pieza que vuelve operativo el "evolve".** Idea fuerte y **verificado que no existe** — es el único net-new que vale.
- **No construir: video automático, multiusuario, scouting platform, mobile-first, club ERP.** Correcto.
- **Riesgo de mantenibilidad por archivos gigantes.** Correcto — y **peor de lo que dice** (verificado: `AiView` 2185, `CoachAgent` 1904, `LineupLab3D` 1923; el doc decía 2060/1737/1827). El riesgo está creciendo *durante* esta fase.
- **Performance:** mantener lazy-load, vigilar vendor chunks (three/pdf). Razonable.

---

## 3. Qué cambiar (mal encuadrado o mal priorizado)

### 3.1 El slice de AI trust (lo más importante)
**Reencuadrar de "construir citation gating" → "hacer el MODO coherente con el guard".**
Evidencia: `src/ai/coachOutputGuard.ts` ya capea confianza y agrega nota en `reflection.mainUncertainty`, pero **no cambia `mode`**; el modo sale de `runCoachTurn` según `evidenceAudit`, independiente del guard. Fix correcto y chico:
- Si el guard dispara (sin cita / deriva de fase / afirmación fuerte sin evidencia del caso) → **forzar `mode` a `hypothesis`** y **mostrar el porqué en el badge de la UI**, no enterrado en `reflection`.
- Esto convierte un gate existente-pero-a-medias en confianza real. Es ~2–3 días, no un subsistema.

### 3.2 El guard hereda la fragilidad keyword del reconocimiento
El chequeo de "deriva de fase" usa `inferDomainsFromText` (keyword, sin tildes) tanto para el pedido como para la respuesta — el mismo matcher que falla con "lo aprietan" ≠ "apretar". O sea: **el guard está construido sobre un reconocimiento frágil.** El roadmap trata el trust como "citas"; falta agregar: **endurecer el grounding/recognition** (la dirección de `rankDocumentsHybrid` que ya se empezó es la correcta — extenderla a la inferencia de dominio).

### 3.3 "Exercise recommendation engine: build now" — ya existe a medias
`src/ai/exerciseMatching.ts` + `src/sessions/diagnosisSession.ts` ya recomiendan ejercicios desde el diagnóstico. No es net-new: es **mostrar/afinar lo existente** en Library + diagnóstico. Bajar de "feature now" a **should-have / polish**.

### 3.4 Contradicción convergencia vs. 4 features "Now"
Backlog + objective tracker + exercise rec + onboarding están todos en "Now" mientras el doc predica narrowing. **Elegir UNO net-new** (el backlog, que reusa `patternDetection.ts`) para los 30 días; objective tracker y onboarding → should-have; exercise rec → polish. Front-loadear cuatro superficies nuevas es el riesgo que el propio roadmap nombra.

### 3.5 Memoria sub-pesada
El roadmap elogia "staff control over memory" y manda "team identity conditioning" a *Later*. Realidad: `generated/tactical-memory.json` tiene **3 items** — viva pero finísima. La memoria **es la sustancia del diferenciador "evolve"** (lo que Hudl/Coachbetter no copian). Si queda así de fina, la evolución es **descriptiva, no acumulativa**. Subir "hacer que la memoria realmente acumule y alimente visiblemente la semana siguiente" de *Later* hacia el hardening core.

---

## 4. Qué quitar / posponer

- **De acuerdo con el roadmap:** simulator, scout, game-model del core path; video automático; multiusuario; mobile-first; scouting amplio; club admin. Mantener parkeado.
- **Agregar a posponer:** **objective tracker** y **onboarding polish** detrás del trust + backlog (no son "Now"). **Exercise rec**: no construir net-new (ya existe).
- **Code-reviewer:** los comportamientos "print" duplicados y las dos hojas de estilo globales (`theme.css` + `tactical-ui.css` en `App.tsx`) — no "remover" sino **resolver dentro del clean-pass v3 ya specced** (`docs/ui-clean-pass-plan.md`), no como item aparte.

---

## 5. Recomendaciones que faltan (aporte del panel)

1. **(ai-engineer / model-qa) Coherencia modo↔guard** (§3.1) — el faltante más importante y el más barato.
2. **(ai-engineer) Endurecer el reconocimiento** (keyword→semántico en la inferencia de dominio; extender `rankDocumentsHybrid`). El trust no es solo citas; es grounding.
3. **(model-qa) Harness de trust con métricas duras, no solo "benchmark cases".** Debe **assertar**: el modo nunca es `diagnosis` cuando el guard capearía; las citas se adjuntan en outputs de diagnóstico; la fase del diagnóstico coincide con el pedido. Ya hay base: `tests/coachRecognition.test.ts` + `tests/coachTurnFlow.test.ts` — convertirlos en el harness de trust.
4. **(product) Memoria que acumula** como objetivo de hardening de primera clase (§3.5).
5. **(software-architect) Extraer el render del informe y el cockpit-context fuera de `AiView` (2185 líneas) ANTES de meter la UI del backlog**, o el monolito compone. Mismo criterio para separar el pipeline de `CoachAgent` (1904).
6. **(ux-architect) Una sola "captura de observación" liviana** (el roadmap la pide pero no baja el mecanismo): un input de nota→evidencia desde Home/Post-match que escriba al mismo store de evidencia, sin entrar a `VideoView`.

---

## 6. Slice de mayor impacto (el verdadero "next")

No el plan de 7 días amplio del roadmap. **Dos slices ajustados, paralelos, de bajo riesgo — puro hardening:**

- **Slice A — Trust coherente (IA, ~2–3 días).** Hacer que el modo degrade a `hypothesis` cuando el guard dispara + mostrar el porqué en el badge + 6–8 casos de regresión que lo asserten. Convierte el gate existente en confianza real. **Máximo ROI de confianza, mínima superficie.**
- **Slice B — Clean UI pass v3 (ya aprobado, listo).** `docs/ui-clean-pass-plan.md` v3: tokens verde-negro, matar look IA, Home en 3 niveles, AiView como informe. Bajo riesgo, gran salto de percepción, no toca lógica.

Estos dos **son** "más angosto, más filoso, más coherente" — la propia recomendación final del roadmap, pero concreta y verificada.

---

## 7. Plan de implementación a 7 días

**Objetivo: subir confianza real de la IA y la percepción de producto, sin expandir.**

1. **Slice A (trust):** modo↔guard coherente; badge con motivo; regresiones que asserten modo/citas/fase. *(Toca `CoachAgent.ts` runCoachTurn + `coachOutputGuard.ts` + AiView badge; lógica mínima, bien acotada.)*
2. **Slice B (UI):** ejecutar Fase 1+2 del clean-pass v3 (tokens + matar look IA). CSS/tokens, reversible.
3. **(architecture, de-risk)** Extraer el **render del informe** de `AiView` a un componente (`CoachReport`), sin cambiar datos — habilita la UI futura del backlog sin tocar el monolito.
4. **Validación:** harness de trust verde; `type-check`; capturas antes/después de Home y AiView **(las saca el equipo: el sandbox no corre la app ni buildea confiable por OneDrive)**.

**Criterio de aceptación:** ninguna salida con evidencia y cero citas se etiqueta "diagnóstico"; Home/AiView se ven clean; nada de lógica de negocio rota.

---

## 8. Plan de mejora de producto a 30 días

**Objetivo: de "piloto prometedor" a "producto filoso para un trabajo semanal".**

- **(must) Tactical problem backlog** — el ÚNICO net-new. Reusa `patternDetection.ts` (recurrente/mejora/retroceso/no-entrenado). MVP: lista de problemas abiertos/recurrentes/resueltos ligados a reports y sesiones. Construido sobre los módulos ya extraídos (paso 7.3).
- **(must) Memoria que acumula y se ve.** Que el commit de memory candidates realmente engorde la memoria y que el coach vea "esto te viene pasando / esto mejoró". Es el diferenciador.
- **(must) Recognition hardening** — semántico en inferencia de dominio (extender `rankDocumentsHybrid`), para que el guard y el routing dejen de depender de keywords.
- **(should) Captura de observación liviana** fuera de Video (§5.6).
- **(should) Objective tracker** — solo si el backlog aterriza limpio.
- **(architecture) Bajar `AiView`/`CoachAgent`/`PostMatchAnalysisView` de monolitos** extrayendo 2–3 módulos cada uno, en el camino de las features de arriba (no como refactor aparte).
- **Evitar:** exercise-rec net-new, simulator, scout, video automático.

**Criterio de aceptación:** un coach completa el loop y entiende qué cambió sin que se lo expliquen; el modo de la IA nunca miente sobre su certeza; el backlog hace operativo el "evolve".

---

## 9. Recomendación final

El roadmap tiene el norte correcto —**narrow + harden**— pero (a) mis-framea el trabajo de IA como "construir" cuando es "terminar/cablear", y (b) se desparrama en features net-new que contradicen su propia tesis.

La próxima fase real, en orden:
1. **Coherencia modo↔guard + harness de trust** (la mentira de "diagnóstico @ 0.5" es el bug de confianza más caro y el más barato de arreglar).
2. **Ejecutar el clean UI pass v3** (percepción, bajo riesgo).
3. **De-monolitizar `AiView`/`CoachAgent` lo justo** para poder sumar el backlog sin editar archivos de 2000 líneas a ciegas.
4. **Memoria que compone** (el diferenciador que ningún competidor copia).
5. **Un solo net-new (backlog) en 30 días, no cuatro.**

Si pasa eso, RomboIQ deja de ser "un piloto ambicioso con buenas ideas" y empieza a ser "la herramienta táctica semanal más confiable para un cuerpo técnico chico" — que es justo donde el propio roadmap quiere llegar, solo que por un camino más corto y más honesto.

---

### Apéndice — verificaciones contra el repo (para auditar esta crítica)
- Gate existe y solo capea confianza: `src/ai/coachOutputGuard.ts` (caps 0.5/0.55/0.62, nota en `reflection.mainUncertainty`).
- Modo decidido aparte del guard: `src/ai/CoachAgent.ts` líneas 491–733; guard aplicado en ~1667.
- Memoria viva pero fina: `src/ai/generated/tactical-memory.json` = 3 items.
- Backlog/objective tracker: inexistentes (grep sin resultados).
- Exercise rec ya existe: `src/ai/exerciseMatching.ts`, `src/sessions/diagnosisSession.ts`.
- Tamaños reales (riesgo de mantenibilidad creciente): `AiView` 2185, `CoachAgent` 1904, `LineupLab3D` 1923, `PostMatchAnalysisView` 1419, `useAppStore` 1242, `VideoView` 1317.
- Observabilidad activa: `src/ai/generated/coach-observability.jsonl` (existe, ~9KB).
