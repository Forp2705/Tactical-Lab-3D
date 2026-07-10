# W20 — Audit total de producto: Top 10 mejoras de RomboIQ

**Fecha:** 2026-07-10 · **Base:** `origin/main` @ e01a963 (pizarra reactiva mergeada) · **Método:** recorrido en vivo de todas las vistas en modo demo (dev server puerto 5351, viewport 1366×768), con lectura de código solo donde hizo falta confirmar evidencia. Cero código de producto tocado.

---

## 1. Resumen ejecutivo

El producto está en su mejor momento: el loop semanal (Sala → Diagnóstico → Pizarra → Sesión → Post-Partido → Evolución) funciona de punta a punta con datos demo, el lenguaje visual felt está aplicado en las vistas reformadas, y las lecturas reactivas de la pizarra corren en vivo ("Bloque medio", "Equipo amplio", superioridad por zona del balón). Las superficies planas (2D, formularios, textos) transmiten producto premium.

La mayor palanca de valor está donde el producto se vuelve tridimensional: **el visor 3D es hoy la superficie más débil y a la vez la más expuesta** — es lo que ve el jugador en Briefing, lo que abre "Ver en cancha 3D" desde cada bloque de sesión, y lo que se proyecta en Modo presentación. Muñecos genéricos diminutos, pelota casi invisible y una cámara que no encuadra la acción socavan la credibilidad que el resto de la app construye. La segunda palanca es de coherencia: la navegación degrada a "Avanzado / herramientas de apoyo" justamente a la Pizarra y la Sesión, que el propio flujo de la Sala trata como núcleo.

---

## 2. TOP 10 rankeado (valor para el staff vs esfuerzo)

### #1 — Visor 3D: los modelos y el encuadre no comunican el ejercicio
**Área:** Cancha 3D · Briefing · Sesión ("Ver en cancha 3D") · Modo presentación

**Observado en vivo:** abrí "Rondo 4v2 con salida por apoyo libre" y reproduje el playback en top/iso/broadcast. Los jugadores son maniquíes GLB caseros diminutos con etiquetas tipo banderín negro; la pelota es prácticamente invisible a cualquier cámara; un rondo de espacio reducido se renderiza en una cancha 11v11 completa con los actores apiñados en un sector, sin que la cámara encuadre la acción; no hay órbita ni zoom manual. Capturas: `img-w20/w20-visor3d.jpeg` (iso), `img-w20/w20-visor3d-broadcast.jpeg`. En código: `Player3D.tsx` usa un único `footballer.glb` con clips Run/Idle generado por script propio.

**Por qué importa:** es el dolor que el dueño marcó ASAP y coincide con lo que vi: el chrome del visor (Lectura del ejercicio, capas de Claridad táctica, focos de coaching) es de producto premium, pero el contenido 3D parece prototipo. Y es la cara compartible: Briefing (vista para jugadores) y Modo presentación proyectan exactamente esto.

**Tamaño/riesgo:** L. Zona caliente viewer (`Scene3D`, `coords`, `matchEngine` — correr `coords.test.ts` + `matchEngine.test.ts`). mc-22 ya audita lo técnico; esto es la lectura de producto.

**Propuesta de ola:** reemplazar modelo+animaciones (locomoción real, escala creíble), hacer visible la pelota (tamaño/trail/glow), y cámara fit-to-content que encuadre el espacio real del ejercicio (un rondo se ve como rondo, no como cancha vacía). El "cómo" técnico sale del audit de mc-22.

---

### #2 — Pizarra: toolbar desborda y las lecturas reactivas quedan bajo el fold (ola 2 del dueño)
**Área:** Pizarra (editor)

**Observado en vivo:** a 1366×768 la paleta HERRAMIENTAS (Seleccionar, Mover, Pase, Pase largo, Centro, Cambio de orientación, Conducción, Disparo, Jugador…) es una columna que no entra y exige scroll interno; el panel "QUÉ ENTIENDE ROMBOIQ" (la feature estrella recién mergeada) queda debajo del Inspector, fuera del viewport — hay que scrollear para descubrir que existe. Captura: `img-w20/w20-pizarra-editor.jpeg` (se ve la barra de scroll de la paleta). Verifiqué que el motor funciona: con la escena demo muestra "Bloque medio", "Equipo amplio", "Zona del balón: 5 propios vs 2 rivales".

**Por qué importa:** la pizarra es el uso diario del staff y el pedido explícito del dueño para la ola 2. Hoy la inversión en lecturas determinísticas rinde por debajo de su valor porque la superficie no las muestra sin scroll.

**Tamaño/riesgo:** M. UI de board; no toca el motor (`boardTacticalRead.ts` queda intacto).

**Propuesta de ola:** toolbar dinámica contextual (herramientas según selección/modo, no lista completa fija) + subir las lecturas a una posición siempre visible (franja bajo el pitch o chip flotante anclado). Es exactamente la "ola 2" ya decidida.

---

### #3 — Navegación: Pizarra y Sesión degradadas a "Avanzado · herramientas de apoyo"
**Área:** Shell / navegación lateral

**Observado en vivo:** el grupo "Avanzado" dice literalmente "Herramientas de apoyo. El flujo principal sigue arriba" y contiene Pizarra, Sesión, Biblioteca y Briefing. Pero la Sala (vista principal) trata a Sesión ("SESIÓN DE HOY", "Abrir sesión ↗") y a la Pizarra ("TABLERO TÁCTICO", "CREAR PIZARRA") como núcleo del plan semanal, y ambas acaban de recibir reformas mayores (W15-16, W19, pizarra reactiva). El producto se contradice: lo que el flujo llama corazón, la nav lo llama apoyo.

**Por qué importa:** un entrenador nuevo no encuentra la pizarra sin expandir un acordeón rotulado como secundario. La jerarquía de nav es el mapa mental del producto.

**Tamaño/riesgo:** S. Solo `AppShell` (labels/grupos); cero lógica.

**Propuesta de ola:** promover Pizarra y Sesión al grupo del plan semanal (o a un grupo "Trabajo de campo"), dejando en Avanzado lo genuinamente secundario (Biblioteca, Briefing). Revisar de paso la doble entrada Diagnóstico/Post-Partido (ver #9).

---

### #4 — Post-Partido: la vista con más valor de datos es la menos reformada
**Área:** Post-Partido (tab dentro de Diagnóstico)

**Observado en vivo:** el flujo funciona (modo Simple/Avanzado, historial con 3 reportes demo, reporte estructurado con veredicto 78% confianza, "Llevar a diagnóstico", regla honesta de memoria). Pero la superficie es un formulario plano de inputs apilados (Rival/Resultado/Fecha/Notas 1-2-3) sin la jerarquía felt del resto: sin slab, sin eyebrow+display, el panel derecho arranca en "Sin informe todavía" sin guiar. Captura: `img-w20/w20-postpartido.jpeg`. Es una de las dos reformas visuales pendientes declaradas.

**Por qué importa:** es el momento de mayor densidad de decisión del ciclo (qué quedó del partido, qué pasa a memoria) y donde el staff más escribe. La fricción de formulario crudo pega justo ahí.

**Tamaño/riesgo:** M. Zona caliente post-match (schemas/storage/presentation): reforma solo de presentación, correr `postMatchResult.test.ts` + `postMatchSchema.test.ts`; no tocar generación ni memoria.

**Propuesta de ola:** aplicar el lenguaje RomboIQ a la carga (agrupar contexto/notas/tags como "hoja de partido"), y hacer del reporte estructurado el protagonista visual con el loop a semana siguiente arriba.

---

### #5 — Evolución: reforma visual pendiente, con la capa Lineup fuera de línea
**Área:** Evolución (Team + LineupLab)

**Observado en vivo:** la parte alta ya está bien resuelta (Veredicto semanal, hilos de problemas abiertos/recurrentes/retrocesos, "Confirmar veredicto" con regla de no-auto-cierre). La capa avanzada (Lineup/Modelo/Simulador/Scout) funciona pero visualmente es de la generación anterior: fichas amarillas 2D estilo viejo, paneles de edición de jugador densos, y conviven dos estéticas en la misma página. Captura de página completa disponible en el recorrido (`w20-evolucion-full.jpeg`, no incluida en img-w20 por peso; reproducible en vivo).

**Por qué importa:** es la otra reforma pendiente declarada y la vista donde el staff decide si el plan funcionó. Menor urgencia que #4 porque el tramo de decisión (veredicto) ya está ordenado; lo desalineado es la capa profunda.

**Tamaño/riesgo:** M-L (mucha superficie: plantel, lineup, métricas, simulador). Riesgo medio: `LineupLab3D` publica `coachShapeContext` al store — no romper esa inyección.

**Propuesta de ola:** reskin de la capa avanzada al lenguaje felt + revisar la ficha de jugador seleccionado (hoy come media pantalla); mantener intacto el bridge shape→coach.

---

### #6 — IA sin camino de configuración dentro del producto
**Área:** Diagnóstico (y todo lo que depende del coach)

**Observado en vivo:** sin key configurada, Diagnóstico muestra la card honesta "IA no disponible en este entorno / La IA de Coach no está configurada" — correcta, pero es un callejón sin salida: no dice qué hacer, no hay pantalla de configuración ni guía. En código confirmé que no existe ninguna UI cliente para la key (`OPENROUTER_API_KEY` vive solo en `.env.local` del server; las 9 referencias en `src/` son server-side o de estado).

**Por qué importa:** el producto se vende con la IA integrada (Diagnóstico es la segunda vista del plan semanal, el chip "IA no disponible" aparece en el contexto del coach). Un cuerpo técnico que instala la app local no puede activar la IA sin editar un archivo de entorno a mano. Es fricción de activación pura en el momento de mayor expectativa.

**Tamaño/riesgo:** M. No toca la lógica del agente (regla sensible respetada): es onboarding — detectar estado vía `api/agent-status` (ya existe) y guiar.

**Propuesta de ola:** pantalla/flujo "Conectar IA" (dónde obtener la key, dónde pegarla, verificación con agent-status, estados con copy honesto). Alternativa mínima: instrucciones accionables dentro de la card actual.

---

### #7 — Biblioteca: las tarjetas no muestran el ejercicio
**Área:** Biblioteca

**Observado en vivo:** las 26 tarjetas del catálogo curado renderizan como thumbnail una mini-cancha con solo un rectángulo de zona — sin actores, sin flechas, sin nada que distinga un rondo de una salida 3+1. Dos ejercicios distintos se ven idénticos salvo el texto. Captura: `img-w20/w20-biblioteca.jpeg`. El panel derecho (Informe de campo) sí es rico, pero obliga a seleccionar uno por uno.

**Por qué importa:** el catálogo es el insumo del planner; un entrenador escanea visualmente ("ese rondo con salida") y hoy el thumbnail no vende ni diferencia el trabajo curado de W4-W6.

**Tamaño/riesgo:** S-M. Render 2D de `scene` (posiciones de setup + zona) en el thumbnail; los datos ya existen en el catálogo. Sin riesgo de dominio.

**Propuesta de ola:** thumbnail que pinte el frame inicial de la escena (actores propios/rivales + zona + balón) reutilizando la geometría 0-100 existente; con eso la grilla se vuelve escaneable.

---

### #8 — Calibración del motor de lecturas (blockHeight / lateralBias)
**Área:** Pizarra (motor `boardTacticalRead.ts`)

**Observado:** backlog explícito del dueño tras la ola 1. En mi pasada en vivo las lecturas de la escena demo fueron plausibles ("Bloque medio", "Equipo amplio", "5v2 en zona del balón"); **no reproduje un caso de descalibración en vivo** — lo incluyo por decisión de producto pendiente, no por bug observado, y lo digo explícito.

**Por qué importa:** una lectura geométrica que etiqueta mal el bloque una sola vez delante del staff quema la confianza en toda la feature. Calibrar antes de escalar la superficie (#2) es barato y protege la inversión.

**Tamaño/riesgo:** S. Umbrales en un módulo determinístico aislado del coach, testeable por unidad.

**Propuesta de ola:** fixtures de escenas reales (bloque alto/medio/bajo conocidos, sesgos de banda claros), ajustar umbrales contra esos casos y dejar los fixtures como tests de regresión.

---

### #9 — Diagnóstico y Post-Partido: dos entradas de nav, una sola vista
**Área:** Shell / Diagnóstico

**Observado en vivo:** "Diagnóstico" y "Post-Partido" son dos ítems separados en la nav principal, pero abren la misma vista ("Diagnóstico y post-partido") con distinto tab activo. El título duplica el nombre, el ítem activo de la nav cambia según el tab, y el usuario ve dos puertas para el mismo cuarto.

**Por qué importa:** ruido pequeño pero diario en el mapa mental. O son dos vistas de verdad (con Post-Partido reformado según #4, lo merece) o es una vista con dos tabs y una sola entrada.

**Tamaño/riesgo:** S. Decisión de IA + wiring de nav; sin lógica.

**Propuesta de ola:** resolverlo junto con #3 y #4: si Post-Partido se reforma como vista propia, separar de verdad; si no, colapsar a una entrada.

---

### #10 — Micro-copy y metadatos crudos que se filtran a la UI
**Área:** transversal

**Observado en vivo (todos verificables en la pasada):**
- Header de contexto muestra "ACTUAL **6v**" — métrica críptica sin unidad ni explicación (aparece en todas las vistas).
- Visor: "**6-6 jugadores**" como subtítulo de un ejercicio 4v2 (es min-max del dato, leído como marcador).
- Sala: "OBSERVACIÓN MANUAL — **1 guardadas**" (concordancia).
- Evolución: evidencia duplicada "2026-06-01 vs San Telmo / 2026-06-01 vs San Telmo" en el hilo recurrente (el mismo partido dos veces como si fueran dos).

**Por qué importa:** individualmente triviales; juntos son la diferencia entre "herramienta premium" y "demo de ingeniería". El staff paga por pulido.

**Tamaño/riesgo:** S. Copy/formatters; cero dominio.

**Propuesta de ola:** barrida de copy de una tarde con checklist por vista: unidades explicadas, plurales, dedupe de evidencia, y humanizar metadatos de ejercicio ("4v2 · 6 jugadores").

---

## 3. Quick wins (S de alto valor)

| # | Ítem | Tamaño |
|---|------|--------|
| #3 | Sacar Pizarra y Sesión de "Avanzado" | S |
| #8 | Calibración blockHeight/lateralBias con fixtures | S |
| #9 | Una sola puerta para Diagnóstico/Post-Partido | S |
| #10 | Barrida de micro-copy y metadatos | S |

Los cuatro juntos caben en una ola corta y suben la percepción de pulido de toda la app antes de las olas grandes (#1, #4, #5).

---

## 4. Qué miré y decidí NO incluir

- **Gap de cableado de video (`/api/video/pattern-scan`)**: el backlog lo daba como pendiente, pero **ya está cableado** — `VideoView.tsx:458` llama `requestVideoPatternScanBatch`, y la UI expone el scan de patrones (Altura del bloque, 9 aislado, 2v1 en banda…) con copy honesto. El dato de CLAUDE.md quedó viejo; conviene actualizarlo.
- **Deuda de bundle**: medido en build real — `three-vendor` 1.37 MB (421 KB gz) y `pdf-vendor` 1.45 MB (485 KB gz), con las vistas ya code-split. Para una app local-first el impacto de producto hoy es bajo; no compite contra el top 10. (Si se ataca: lazy-load del pdf-vendor solo al exportar.)
- **Lógica interna del CoachAgent / prompts / memoria**: fuera de alcance por regla sensible; nada de lo observado sugiere bug de contrato.
- **Warnings de GPU (stall por ReadPixels)**: presentes en consola con el visor abierto, pero sin degradación visible de fps en la pasada; el frente perf del visor ya tuvo su ola (W2) y mc-22 está encima.
- **Primer click de Play que no arrancó el playback**: lo vi una vez y no lo pude reproducir (el segundo intento vía JS funcionó siempre); sin reproducción no entra al ranking.
- **Comportamiento mobile/fold y export binarios (PDF de sesión, Exportar PNG/imagen)**: no auditados en esta pasada por timebox; el PDF de sesión ya fue verificado por bytes en W19.

---

## 5. Evidencia

Capturas en `docs/audits/img-w20/`: `w20-visor3d.jpeg`, `w20-visor3d-broadcast.jpeg` (#1), `w20-pizarra-editor.jpeg` (#2), `w20-briefing.jpeg` (#1, cara al jugador), `w20-postpartido.jpeg` (#4), `w20-biblioteca.jpeg` (#7).
