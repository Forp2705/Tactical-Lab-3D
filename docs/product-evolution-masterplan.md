# Tactical Lab 3D — Plan maestro de evolución del producto

> Auditoría integral basada en el código real (no en el spec). Documento de base para implementación.
> No incluye cambios de código. Fecha de auditoría: 2026-06-01.

---

## 0. TL;DR (para leer en 60 segundos)

- **El producto ya tiene un núcleo valioso y casi nadie lo está conectando.** Hay tres activos serios: (1) un Coach Agent con evidencia, citas, reflexión y modo entrevista ya implementado; (2) un Lineup Lab que **ya calcula** ancho, profundidad, compacidad y distancias entre líneas; (3) un post-match report rico con memoria controlada por staff. Cada uno funciona aislado.
- **El mayor desperdicio del repo:** el Lineup Lab calcula métricas geométricas objetivas (`computeMetrics`) pero `buildCoachShapeContext` **no las manda al Coach**. El agente recibe coordenadas crudas y tiene que adivinar la geometría. Conectar esto es la mejora de mayor impacto/menor esfuerzo de toda la app.
- **La memoria generada está vacía** (`src/ai/generated/tactical-memory.json` = `[]`). Toda la capa de "memoria táctica consolidada" hoy es un no-op. Hay infraestructura sin datos.
- **Los 144 ejercicios se conectan al diagnóstico solo por elección libre del LLM** (le pasamos un índice de 160 títulos). No hay puente estructurado diagnóstico→ejercicio. Es el eslabón flojo entre "qué pasa" y "qué entreno".
- **Núcleo de valor real:** transformar una observación vaga de un entrenador ("defendemos mal") en un diagnóstico con evidencia + un ajuste comunicable + una sesión, **sin inventar**. El anti-invención (evidencia, confianza, preguntas antes de diagnosticar) es el diferencial frente a un ChatGPT genérico.
- **No construir todavía:** video analysis automático, backend multiusuario/SaaS, marketplace de ejercicios. Primero conectar lo que ya existe.

---

## 1. Diagnóstico ejecutivo del producto

Tactical Lab 3D no es una demo de pizarra: tiene profundidad técnica real (visor 3D, dominio Zod bien modelado, RAG propio sin dependencias pesadas, post-match con grounding). El problema no es falta de features —es **sobra de features desconectadas y falta de un hilo conductor**.

Hoy la app se vive como cinco productos en una pestaña cada uno (Biblioteca, Visor, Team/Lineup Lab, Sessions, IA + Post-match). El usuario entra, ve mucho, y no tiene un camino obvio de "tengo un problema → lo entiendo → lo entreno → lo reviso". El valor está latente porque las piezas no se pasan datos entre sí.

El agente IA es la pieza más madura y la que mejor encarna la promesa del producto, pero su confiabilidad está limitada por la evidencia que recibe: mucha es texto libre y memoria estática, cuando la app ya genera evidencia objetiva (métricas del Lineup Lab, patrones de reports) que no se le entrega.

**Veredicto:** el producto está a 2-3 conexiones bien hechas de pasar de "conjunto de herramientas tácticas impresionantes" a "asistente táctico que un DT chico usa toda la semana". La prioridad no es construir, es **cablear y enfocar**.

---

## 2. Mapa de módulos actuales

| Módulo | Archivos núcleo | Rol en el producto |
|---|---|---|
| **Coach Agent** | `src/ai/CoachAgent.ts`, `CoachAgentPrompt.ts`, `CoachRules.ts`, `coachResponseParsing.ts`, `CoachSchemas.ts` | Diagnóstico táctico conversacional con evidencia y citas. |
| **Evidence / Question Generator** | `src/ai/contextualQuestionGenerator.ts`, `evidenceCollection.ts`, `CoachQuestionPrompt.ts` | Modo entrevista: pregunta antes de inventar. **Ya implementado.** |
| **Retrieval / RAG** | `retrievalScoring.ts`, `retrieveRelevant*.ts`, `tacticalKeywords.ts` | Ranking propio (coseno + tags + frases) sobre observaciones/knowledge/memoria/reports. |
| **Knowledge base** | `src/ai/knowledge/*.json` (4), `sources/*.txt` | Principios tácticos curados: build-up, compactness, pressing, defensive-transition. Sólida. |
| **Memoria** | `MatchMemory.ts` (estática), `generated/tactical-memory.json` (**vacío**), `consolidateTacticalMemory.ts`, `buildTacticalMemory.ts` | Capa conceptual de 4 niveles, hoy a medio cablear. |
| **Lineup Lab** | `src/team/LineupLab3D.tsx` (1949 líneas) | Shapes, transiciones, rival, **métricas geométricas (`computeMetrics`)**, heatmap. |
| **Team** | `src/team/TeamView.tsx`, `src/data/players.ts` | Plantel, perfiles, atributos. |
| **Visor 3D** | `src/viewer/Scene3D.tsx`, `Pitch3D.tsx`, `Player3D.tsx`, `lib/coords.ts`, `lib/matchEngine.ts` | Reproduce escenas coreografiadas de ejercicios. |
| **Biblioteca / Ejercicios** | `src/library/LibraryView.tsx`, `src/data/exercises/catalog.ts` (144 ejercicios) | Catálogo curado con phase/principle/objective/coaching/errors. |
| **Sessions / Microcycle** | `src/sessions/SessionsView.tsx`, `MicrocycleAlerts.ts` | Planner drag-and-drop + alertas de carga/ABP/repetición. |
| **Post-match** | `src/ai/post-match/*` | Reporte post-partido con grounding, PDF, historial, memory candidates por staff. |
| **Video** | `src/video/VideoView.tsx` | Tagging y tracking manual. Deliberadamente limitado. |
| **Persistencia** | `src/state/db.ts` (Dexie + Zod + migraciones), `useAppStore.ts` (1098 líneas) | Snapshot versionado y validado. |

---

## 3. Evaluación de madurez por módulo

Escala: 🟢 sólido / 🟡 funcional pero flojo / 🟠 verde / 🔴 stub o desconectado.

| Módulo | Madurez | Lectura crítica |
|---|---|---|
| Coach Agent (diagnóstico) | 🟢 | Bien armado: model ladder, JSON fallback, citas deduplicadas, reflexión con confianza. El prompt es exigente y anti-genérico. |
| Evidence / Question Generator | 🟢 | Híbrido LLM+código limpio, scoring determinístico, fallbacks por dominio que calzan con los ejemplos del spec. Falta validar calidad real del LLM en `inferTemptingClaims`. |
| Retrieval / RAG | 🟢 | Sorprendentemente bueno para no usar embeddings: coseno + boosts de tag/frase/recencia/autoridad. Suficiente para el corpus actual. |
| Knowledge base | 🟢 | 4 categorías bien estructuradas (principle/context/risk/tags). Falta cobertura de ataque, ABP, duelos, transición ofensiva. |
| Dominio / Schemas | 🟢 | `schemas.ts` y `post-match/schemas.ts` muy completos. El dominio es el cimiento más fuerte del repo. |
| Persistencia | 🟢 | Versionado + migraciones + validación Zod + backup ante corrupción. Serio. |
| Lineup Lab | 🟡 | Potente pero sobrecargado (1949 líneas, 7 atajos de teclado). Calcula métricas que no exporta al resto del producto. UX de power-user, no de DT amateur. |
| Post-match report | 🟡 | Schema riquísimo (20+ secciones) — probablemente **demasiado** para un DT chico. Bien aterrizado individualmente, pero reportes **aislados** entre sí. |
| Sessions / Microcycle | 🟡 | Planner real con alertas útiles, pero desconectado del diagnóstico: armar una semana sigue siendo manual. |
| Visor 3D | 🟡 | Técnicamente impresionante; valor para el DT amateur es secundario frente al diagnóstico. Riesgo de bundle. |
| Memoria consolidada | 🔴 | `generated/tactical-memory.json` vacío. La capa existe pero no tiene datos ni loop de escritura visible desde el producto. |
| Conexión diagnóstico→ejercicios | 🔴 | Solo elección libre del LLM sobre un índice de títulos. Sin mapeo estructurado. |
| Patrones cross-report | 🔴 | No existe comparación entre partidos ni detección de problemas recurrentes/retrocesos. |
| Video | 🟠 (a propósito) | Limitado y está bien que lo esté. No es el siguiente paso. |

---

## 4. Principales problemas de producto

1. **No hay un hilo conductor.** Cinco pestañas, ningún flujo guiado de problema→diagnóstico→entrenamiento→revisión. El usuario tiene que saber qué hacer.
2. **El Coach no ve la evidencia objetiva que la app ya produce.** Métricas del Lineup Lab y patrones de reports no llegan al diagnóstico. Resultado: el agente depende de texto libre y se acerca peligrosamente a "opinar".
3. **Del diagnóstico no sale una sesión.** El gran momento de valor —"esto te pasa, entrená esto el miércoles"— se corta: los `linkedExercises` son sugerencias sueltas, no un bloque de sesión accionable.
4. **El post-match pide demasiado y devuelve demasiado.** Carga alta de input para un DT amateur y un reporte con 20+ secciones que abruma. El valor diferencial (patrones, memoria) se diluye.
5. **La memoria no cuenta una historia.** No hay "esto te viene pasando hace 3 partidos" ni "esto mejoró". Sin eso, la memoria es decorativa.
6. **El Lineup Lab es de ingeniero, no de entrenador.** Atajos de teclado, comparador, heatmap: potente, pero la curva para un DT de barrio es alta.

---

## 5. Principales problemas técnicos

1. **Contrato cliente/servidor recién ampliado a unión discriminada** (`CoachResponse`): es el punto más frágil. Cualquier cambio de `mode` debe sincronizar `coachAgentClient.ts` ↔ `AiView.tsx` ↔ `api/coach-agent.ts`. Hoy es un solo bundle local, así que no hay desincronización en runtime, pero el riesgo de regresión visual es real.
2. **`formatRuntimeCoachContext` hace `JSON.stringify` crudo del shapeContext.** Mete todo al prompt sin curar; al agregarle métricas hay que estructurarlo, no inflarlo (costo de tokens en modelo `:free`).
3. **Memoria generada vacía + pipeline de consolidación sin trigger de producto.** `consolidateTacticalMemory.ts` existe pero no hay camino de UI que lo dispare ni evidencia de que escriba. Deuda silenciosa.
4. **Acoplamiento de tamaño:** `LineupLab3D.tsx` (1949), `PostMatchAnalysisView.tsx` (1133), `useAppStore.ts` (1098). Difíciles de evolucionar sin romper. `computeMetrics` está embebido en el componente en vez de en `lib/`.
5. **Bundle grande** (deuda ya reconocida en CLAUDE.md) por el visor 3D + ffmpeg + react-pdf.
6. **Doble fuente de "verdad táctica":** keyword matching (`tacticalKeywords.ts`) usado tanto para retrieval como para fallback de dominios. Frágil para inputs fuera de vocabulario.
7. **Endpoint Gemini legacy** coexiste con OpenRouter. Confunde el boundary.

---

## 6. Oportunidades de mejora de alto impacto

Ordenadas por ratio impacto/esfuerzo:

1. **🔥 Inyectar las métricas del Lineup Lab al Coach.** Exportar `computeMetrics` (ancho/profundidad/compacidad/distancias) dentro de `coachShapeContext` y formatearlas como evidencia objetiva en el prompt. Convierte al agente de "opina sobre coordenadas" a "lee geometría real". Esfuerzo bajo, impacto enorme en confiabilidad.
2. **🔥 Puente diagnóstico→sesión.** Mapeo estructurado `TacticalDomain` → `Exercise.phase`/`principle`, de modo que un diagnóstico genere un bloque de sesión real (no IDs sueltos). Cierra el loop de valor.
3. **🔥 Patrones cross-report.** Comparar reports guardados para detectar "problema recurrente", "mejora", "retroceso". Es la base de una memoria que cuenta historia y el gancho de retención semanal.
4. **Activar la memoria generada con datos reales.** Disparar consolidación desde el commit de memory candidates del staff y poblar `generated/tactical-memory.json`. Hace que la capa deje de ser un no-op.
5. **Modo "simple" del post-match.** Un input mínimo (resultado + 3 notas) que produzca un reporte corto. El reporte largo queda como modo avanzado.
6. **Un flujo guiado de inicio** ("¿Qué querés resolver hoy?") que enrute a entrevista→diagnóstico→sesión. Da el hilo conductor que falta.
7. **Extraer `computeMetrics` a `src/viewer/lib/` o `src/team/lib/`** para reutilizarlo fuera del componente (Coach, post-match, export).

---

## 7. Roadmap priorizado

### Próximos 7 días — "Conectar lo que ya existe" (cero features nuevas grandes)
- Extraer `computeMetrics` del componente a un módulo `lib` reutilizable. Tests de geometría (ancho/profundidad/compacidad) con posiciones conocidas.
- Inyectar esas métricas en `coachShapeContext` (`buildCoachShapeContext`) y formatearlas como bloque de evidencia estructurada en `CoachAgent` (no `JSON.stringify` crudo).
- Validar el modo entrevista end-to-end con los 7 ejemplos del spec (vago→3 preguntas, responder→hipótesis, completar→diagnóstico). Ajustar `CoachQuestionPrompt.ts` si la calidad de `inferTemptingClaims` flojea.
- **Entregable:** el Coach diagnostica usando geometría objetiva del shape actual. Mejora medible de confiabilidad.

### Próximos 30 días — "Cerrar el loop problema→entrenamiento→revisión"
- **Puente diagnóstico→sesión:** mapa `domain→phase/principle` + acción "armar bloque de sesión desde diagnóstico" que use el catálogo real. Conecta Coach ↔ Sessions.
- **Post-match simple:** modo de input mínimo y reporte corto; el largo pasa a "avanzado".
- **Patrones cross-report v1:** detectar problema repetido entre los últimos N reports (por categoría/severidad) y mostrarlo en el cockpit del Coach.
- **Activar memoria generada:** poblar `generated/` desde memory candidates validados por staff; consumir en retrieval.
- **Entregable:** un DT puede ir de "esto me pasó el sábado" a "esta es mi semana de trabajo" sin salir de la app.

### Próximos 90 días — "Producto serio y vendible (v1)"
- **Flujo guiado / home táctico** ("¿Qué querés resolver?") que orquesta entrevista→diagnóstico→sesión→seguimiento.
- **Línea de tiempo del equipo:** vista de evolución (problemas que mejoran/empeoran) construida sobre patrones cross-report + memoria. Este es el gancho de retención.
- **Memoria con capas explícitas en UI** (identidad / validada / evidencia actual / inferencia) con badges de confianza.
- **Simplificación de Lineup Lab:** modo básico (arrastrar y ver métricas) vs avanzado (transiciones/comparador).
- **Export/compartir reporte y plan semanal** en PDF pulido (ya hay base con react-pdf).
- **Entregable:** v1 vendible a DT amateur/semipro y cuerpos técnicos chicos.

### Versión futura avanzada (v2, no antes)
- Video analysis asistido (tagging que **alimenta** evidencia, no análisis automático todavía).
- Métricas geométricas derivadas de tracking manual de video (puente video→evidencia objetiva).
- Multiusuario / sincronización de cuerpo técnico (requiere backend real).
- Comparación contra rivales recurrentes / scouting ligero.
- Embeddings reales si el corpus de knowledge crece más allá de lo que el RAG actual sostiene.

---

## 8. Propuesta de arquitectura de producto

Reorganizar mentalmente la app alrededor de **un loop**, no de pestañas:

```
            ┌─────────────────────────────────────────────┐
            │            EVIDENCIA OBJETIVA                 │
            │  Lineup Lab (métricas) · Post-match (tags)    │
            │  Knowledge base · Plantel/perfiles            │
            └───────────────┬───────────────────────────────┘
                            │ (alimenta)
        observación vaga    ▼
 DT ───────────────► [ EVIDENCE COLLECTION ]  ◄── memoria + patrones
                            │  pregunta solo lo que falta
                            ▼
                     [ COACH AGENT ]
            question → hypothesis → diagnosis (con confianza)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ajuste de       SESIÓN /       MEMORIA
        partido       MICROCICLO    (validada por staff)
                            │             │
                            ▼             ▼
                     se juega ──► POST-MATCH ──► PATRONES
                            (vuelve a evidencia objetiva)
```

Principios de arquitectura:
- **Una sola noción de evidencia** atravesando todo (geométrica, de tags, de knowledge, de memoria), con confianza explícita.
- **El diagnóstico es el centro**; todo lo demás lo alimenta o lo consume.
- **La memoria sólo se escribe con validación de staff** (mantener la regla actual del repo).
- **Capas IA separadas** (Coach conversacional / Post-match / tooling de memoria) — no mezclarlas, como ya advierte `CLAUDE.md`.

---

## 9. Propuesta de experiencia ideal del usuario

Un DT que perdió el sábado abre la app y:

1. **Home táctico:** "¿Qué querés resolver?" → escribe "nos cuesta salir limpio" (o carga el post-match del partido).
2. **Entrevista táctica (ya existe):** 3 preguntas con opciones rápidas + un dato opcional. Badge visible: "Modo entrevista — todavía no diagnostico". Barra de evidencia `[■■□□]`.
3. **Diagnóstico con confianza:** lectura + causa probable + ajuste comunicable en 30s + riesgos. Cada afirmación con su evidencia (incluida la geometría del shape). Si la confianza es baja, lo dice.
4. **"Convertí esto en entrenamiento":** un click arma un bloque de sesión con ejercicios reales del catálogo que atacan ese dominio.
5. **Seguimiento:** "esto te viene pasando hace 3 partidos" / "esto mejoró desde la última vez".

Reglas de UX para no abrumar:
- Mostrar **una cosa a la vez**: pregunta → hipótesis → diagnóstico, nunca todo junto.
- Confianza como semáforo, no como número crudo.
- El reporte largo y el Lineup Lab avanzado existen, pero **detrás de un "ver más"**.
- Lenguaje de entrenador, no académico (el prompt ya lo pide; la UI debe acompañar).

Componentes a sumar: `TacticalHome` (router de intención), `EvidenceBar`, `ConfidenceBadge`, `DiagnosisToSessionButton`, `TeamTimeline` (evolución), `PatternCard` (recurrente/mejora/retroceso).

---

## 10. Plan de conexión entre módulos

| Conexión | Hoy | Propuesta | Dónde |
|---|---|---|---|
| **Lineup Lab → Coach Agent** | Manda posiciones crudas, **no** métricas | Incluir `computeMetrics` (ancho/prof/compacidad/distancias/altura de bloque) en `coachShapeContext` y formatearlo como evidencia objetiva | `buildCoachShapeContext` (`LineupLab3D.tsx`), `formatRuntimeCoachContext` (`CoachAgent.ts`) |
| **Evidence Collection → Coach** | Implementado | Sumar la geometría como `EvidenceSignal` de fuente "shape" para que reduzca preguntas redundantes | `evidenceCollection.ts`, `contextualQuestionGenerator.ts` |
| **Coach → Exercises/Sessions** | `linkedExercises` por elección libre del LLM | Mapa estructurado `TacticalDomain→Exercise.phase/principle` + acción "armar bloque de sesión" | nuevo `src/ai/exerciseMatching.ts`, `SessionsView`, `useAppStore` |
| **Post-match → Memory** | Candidates validados por staff (loop incompleto, generated vacío) | Commit de candidates dispara consolidación y **puebla** `generated/` | `api/post-match/memory.ts`, `consolidateTacticalMemory.ts` |
| **Post-match → Patrones** | No existe | Comparador cross-report (recurrente/mejora/retroceso) que alimente el cockpit del Coach | nuevo `src/ai/patternDetection.ts`, `retrieveRelevantReports.ts` |
| **Memory → Coach** | `MATCH_MEMORY` estático + generated vacío | Distinguir en el prompt: identidad / validada / evidencia actual / inferencia, con confianza por capa | `CoachAgent.ts`, `MatchMemory.ts` |
| **Plantel → Coach** | Ya llega (available/unavailable) | Mantener; usarlo para vetar ajustes que el perfil no sostiene (el prompt ya lo intenta) | sin cambios mayores |

Orden lógico de cableado: 1) Lineup→Coach, 2) Coach→Sessions, 3) Post-match→Patrones, 4) Patrones/validación→Memory→Coach.

---

## 11. Archivos / áreas a revisar o modificar en futuras implementaciones

**Conexión Lineup→Coach (semana 1):**
- `src/team/LineupLab3D.tsx` — extraer `computeMetrics`/`computeTransitionDistances` a `lib`; ampliar `buildCoachShapeContext`.
- `src/ai/CoachAgent.ts` — `formatRuntimeCoachContext` estructurado con métricas.
- `src/state/useAppStore.ts` — tipo `CoachShapeContext` (agregar `metrics`).
- nuevo `src/team/lib/shapeMetrics.ts` + `tests/shapeMetrics.test.ts`.

**Puente diagnóstico→sesión (mes 1):**
- nuevo `src/ai/exerciseMatching.ts` (`domain→phase/principle`), `tests/exerciseMatching.test.ts`.
- `src/data/exercises/catalog.ts` (revisar cobertura de tags por dominio), `groups.ts`.
- `src/sessions/SessionsView.tsx`, `useAppStore.ts` (acción `addDiagnosisBlockToSession`).
- `src/ai/CoachSchemas.ts` (acción de coach `buildSessionFromDiagnosis`).

**Patrones + memoria (mes 1-2):**
- nuevo `src/ai/patternDetection.ts`, `tests/patternDetection.test.ts`.
- `src/ai/retrieveRelevantReports.ts`, `consolidateTacticalMemory.ts`, `buildTacticalMemory.ts`.
- `api/post-match/memory.ts`, `src/ai/generated/tactical-memory.json`.
- `src/ai/MatchMemory.ts` (capas explícitas).

**UX / flujo guiado (mes 2-3):**
- `src/ui/AppShell.tsx`, `src/app/App.tsx`, nuevo `TacticalHome`.
- `src/ai/AiView.tsx` (cockpit + timeline), `src/app/theme.css`.

**No tocar salvo necesidad:** `src/viewer/*` (visor estable), `src/video/*` (congelado a propósito), `api/ai/gemini.ts` (legacy — candidato a retiro, no a inversión).

---

## 12. Riesgos de implementación

- **Inflar el prompt del Coach.** Sumar métricas/patrones/memoria sin curar dispara tokens en modelo `:free` y degrada salida. Mitigación: formatear como bloques cortos y priorizados, no `JSON.stringify`.
- **Romper el contrato discriminado.** Cambios en `CoachResponse` deben tocar cliente+API+UI juntos y correr `coachResponseSchema.test.ts`.
- **Acoplar más a componentes ya enormes.** No agregar lógica a `LineupLab3D.tsx`/`PostMatchAnalysisView.tsx`/`useAppStore.ts`; extraer a `lib/`.
- **Sobre-confianza del agente con geometría.** Las métricas son evidencia, no veredicto: deben entrar al `evidenceAudit` con su confianza, no subir el `confidenceCap` automáticamente.
- **Mapeo diagnóstico→ejercicio demasiado rígido.** Si es puro keyword, repite el problema del "checklist". Combinar `phase/principle` estructurado + ranking del RAG existente.
- **Migración de persistencia.** Cualquier campo nuevo en el snapshot necesita default en `db.ts` (el patrón ya existe; respetarlo).
- **Calidad real del LLM en preguntas/claims.** El riesgo no es el código (está bien) sino el prompt. Necesita evaluación con casos reales, no solo unit tests.

---

## 13. Recomendación: qué implementar primero

**Empezar por la conexión Lineup Lab → Coach Agent (métricas geométricas como evidencia).**

Por qué es el primer paso correcto:
- Máximo impacto en el núcleo de valor (confiabilidad del diagnóstico) con el menor esfuerzo.
- Usa datos que **ya se calculan** — no inventa nada.
- No toca el contrato cliente/servidor ni la persistencia (bajo riesgo de regresión).
- Es testeable de forma pura (geometría con posiciones conocidas).
- Desbloquea conceptualmente el resto: una vez que el Coach razona sobre evidencia objetiva, el puente a sesiones y la detección de patrones tienen sobre qué apoyarse.

Secuencia segura: extraer `computeMetrics` a `lib` con tests → ampliar `coachShapeContext` → formatear como evidencia en el prompt → `type-check && build` → validar manualmente con un shape real.

---

## 14. Qué medir / testear para saber si el producto mejora

**Calidad del diagnóstico (lo más importante):**
- % de respuestas del Coach que citan evidencia real vs. afirmaciones sin cita (auditar `evidenceCitations` vs `reflection.unsupported`).
- % de turnos donde el modo entrevista evitó un diagnóstico prematuro (mode `question`/`hypothesis` antes de `diagnosis`).
- Calibración de confianza: comparar `confidence` declarada vs. corrección posterior del staff.

**Flujo de usuario:**
- ¿El usuario llega de observación vaga → diagnóstico → sesión sin abandonar? (tasa de completitud del loop).
- Nº de clarificaciones necesarias antes de un diagnóstico aceptado.
- Tiempo desde input hasta "plan accionable".

**Conexión entre módulos:**
- % de diagnósticos que derivan en un bloque de sesión creado.
- % de reports que generan un patrón detectado (recurrente/mejora/retroceso).
- % de memory candidates validados por staff que efectivamente influyen un diagnóstico posterior (trazabilidad memoria→uso).

**Técnico / regresión:**
- Suite existente verde: `coords`, `matchEngine`, `microcycleAlerts`, `postMatchResult`, `postMatchSchema`, `retrievalScoring`, `coachResponseParsing`, `coachResponseSchema`, `contextualQuestionGenerator`, `evidenceCollection`.
- Nuevos: `shapeMetrics`, `exerciseMatching`, `patternDetection`.
- Tamaño de prompt del Coach (tokens) por turno — vigilar que no crezca sin control.
- Tamaño de bundle del build.

**Señal de producto vendible (madurez):** un DT externo puede, sin ayuda, resolver un problema táctico real de su equipo y salir con una sesión para el miércoles. Si eso ocurre de forma repetible, hay MVP.

---

## Anexo — Respuestas directas a las preguntas clave

- **¿Núcleo de valor?** Convertir una observación vaga en diagnóstico con evidencia + ajuste comunicable + sesión, sin inventar. El anti-invención es el diferencial.
- **¿Feature central?** El bucle Coach Agent + Evidence Collection. Todo lo demás lo alimenta o lo consume.
- **¿Qué conectar mejor?** Lineup Lab (métricas)→Coach; Coach→Ejercicios/Sesiones; Post-match→Patrones→Memoria→Coach.
- **¿Qué está verde?** Memoria generada (vacía), patrones cross-report (inexistentes), puente diagnóstico→ejercicio (solo LLM), capas de memoria sin distinción en UI.
- **¿Qué ya tiene potencial comercial?** Coach con evidencia, post-match con PDF y memoria controlada, Lineup Lab con métricas.
- **¿7/30/90?** 7: conectar métricas→Coach. 30: cerrar loop diagnóstico→sesión + patrones v1 + memoria activa. 90: flujo guiado + timeline del equipo + simplificación + export (v1 vendible).
- **¿Qué NO construir todavía?** Video analysis automático, backend multiusuario/SaaS, marketplace de ejercicios, embeddings.
- **¿Qué dejar para más adelante?** Video como fuente de evidencia objetiva (v2), scouting de rivales, sincronización de cuerpo técnico.
