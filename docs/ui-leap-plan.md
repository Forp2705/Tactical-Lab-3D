# Tactical Lab 3D — UI Leap Plan

> Plan de evolución visual ambicioso. **Reemplaza a `ui-mvp-plan.md`** (que era deliberadamente conservador: tildes, empty states, prolijidad).
> Objetivo: que la interfaz esté a la altura del salto de producto — que la app **se vea y se sienta como un producto de fútbol premium**, no como un dashboard oscuro genérico.
> No implementar todavía. Base: código real (theme.css 3053 + tactical-ui.css 861, vistas auditadas).

---

## 1. La premisa: por qué la UI quedó atrás

El backend dio un salto de categoría (modelo de juego, simulador, fit, scout, patrones). La interfaz no acompañó. Hoy:

- **Se ve como un SaaS oscuro de 2021** (glassmorphism teal/azul) — no como un producto de fútbol. La única señal "esto es táctico" es el visor 3D.
- **La información más rica del producto se muestra como texto y grillas.** El diagnóstico es un muro de párrafos; las métricas geométricas (ancho/profundidad/compacidad/altura de bloque), que piden una cancha, se muestran como `Metric label="Ancho" value="42m"`.
- **Todo tiene el mismo peso visual.** No hay jerarquía que guíe el ojo. Un producto premium decide qué mira el usuario primero.
- **Hay identidad visual sin estrenar:** el sistema de 3 temas (`cockpit`/`broadcast`/`pizarra`) existe en `tactical-ui.css` pero nadie lo cablea. Y conviven **dos hojas de estilo que se pisan los tokens** (`theme.css` define `--accent: #5eead4`, `tactical-ui.css` lo redefine con `oklch`). El tema "real" es impredecible.

La distancia entre "lo que hay" y "lo que se puede" no es de skin: es de **diseño de información** y de **identidad de producto**.

---

## 2. Visión visual

**De "dashboard oscuro genérico" a "la sala del cuerpo técnico".**

La app debería sentirse como el lugar donde un cuerpo técnico profesional prepara la semana: serio, denso pero legible, con la cancha como elemento central y la evidencia siempre a la vista. Tres pilares:

1. **Football-first, no SaaS-first.** La cancha, las zonas, las líneas y los carriles son el lenguaje visual base — no las cards genéricas. Cada dato que tiene una ubicación en el campo se muestra *en* el campo.
2. **La confianza y la evidencia son ciudadanos de primera.** Todo lo que dice el sistema viene con su nivel de confianza (medidor) y su fuente (chip citado). Es el diferencial del producto; tiene que verse en cada pantalla.
3. **Una cosa a la vez, con jerarquía brutal.** Pregunta → hipótesis → diagnóstico → acción. Nunca todo junto. El reporte largo y el modo avanzado existen detrás de un "ver más".

---

## 3. Sistema de diseño e identidad

### 3.1 Una sola fuente de verdad de tokens
Consolidar `theme.css` + `tactical-ui.css` en un único sistema de tokens (recomiendo la arquitectura de `tactical-ui.css`: oklch, densidad, multi-tema). Migrar las reglas con color hardcodeado a tokens. **Es el desbloqueo de todo el resto** — sin esto, cada cambio visual es a ciegas.

### 3.2 Los 3 temas como feature, no peso muerto
Cablear `data-theme` en `<html>` + selector visible:
- **Cockpit** — el ADN actual, sala oscura, para trabajo diario.
- **Broadcast** — premium cinematográfico (lime/cyan, viñeta), para modo presentación / mostrarle al plantel o a dirigencia.
- **Pizarra** — editorial, data-dense, monoespaciado, para impресión/PDF y análisis frío.

Esto convierte una decisión de skin en un argumento de venta ("se adapta a cómo trabajás").

### 3.3 Lenguaje visual
- **Tipografía**: jerarquía real (display para titulares de pantalla, mono para datos/métricas — ya hay `Space Grotesk` + `Space Mono` definidas). Hoy la jerarquía es plana.
- **Color con significado**: teal = alineado/positivo, ámbar = riesgo/desvío, rojo = contradicción/peligro, azul = información/evidencia. Consistente en todo el producto, no decorativo.
- **Iconografía coherente** que reemplace o acompañe los code-chips crípticos (HOME/3D/XI/PM…).
- **Motivos de cancha**: zonas, carriles, líneas entre líneas, altura de bloque — como componentes reutilizables, no dibujos ad-hoc.

---

## 4. Principios de diseño de información

1. **Dato con ubicación → mostralo en la cancha.** Métricas de shape, zonas de pérdida, presión, fit por posición: todo sobre un campo, no en grillas.
2. **Texto largo → informe diseñado.** El diagnóstico, el reporte y el plan de partido son *documentos visuales* (jerarquía, secciones colapsables, evidencia citada), no párrafos.
3. **Estado del sistema siempre visible:** modo (pregunta/hipótesis/diagnóstico), confianza, evidencia. El usuario nunca duda de cuán firme es lo que ve.
4. **El loop guía la navegación.** La IA de navegación se ordena por el ciclo táctico (observar → diagnosticar → entrenar → revisar → evolucionar), no por features sueltas.
5. **Progresividad:** básico por defecto, avanzado opt-in. El DT amateur no se ahoga; el obsesivo encuentra profundidad.

---

## 5. Rediseño pantalla por pantalla

### Home → Tactical Command Center
**Hoy:** hero correcto + cards parejas (microciclo, sesión, reports, timeline) sin jerarquía.
**Visión:** un centro de mando que abre con **"esta semana"**: dónde está el equipo en el loop (¿hay diagnóstico sin entrenar? ¿reporte sin revisar? ¿patrón nuevo?), el próximo rival, el estado del plantel. Acciones grandes que continúan el loop. Lo demás, secundario.

### Coach / Diagnóstico → Informe táctico diseñado
**Hoy:** muro de texto (lectura+causa+ajuste+riesgos+señales+reflexión+citas+acciones, todo junto).
**Visión:** *(ver maqueta mostrada en chat)* — confianza como medidor, evidencia citada con su fuente, **contraste contra el modelo de juego** como filas alineado/desvío, **fit del plantel** como chips de riesgo, instrucciones de cancha numeradas, mini-cancha mostrando dónde se corta, y CTAs que continúan el loop ("convertir en sesión", "simular ajuste", "briefing jugadores"). Secciones secundarias colapsadas.

### Modo entrevista → Entrevista táctica con progreso
**Hoy:** question cards funcionales.
**Visión:** badge "modo entrevista" prominente, barra de evidencia `[■■□□] 2/4`, opciones rápidas grandes, "responder" como acción primaria y "saltar y recibir hipótesis" como secundaria con warning de confianza capada.

### Lineup Lab → Cancha analítica (modo básico/avanzado)
**Hoy:** métricas en grilla numérica + atajos de teclado sin descubribilidad.
**Visión:** las métricas **pintadas sobre la cancha** — ancho/profundidad como envolvente, distancia entre líneas como bandas, altura de bloque como referencia, zonas de riesgo resaltadas. **Alertas tácticas automáticas** ("bloque alto + centrales lentos → espalda expuesta", usando `playerFit`). Comparador de shapes lado a lado. Modo básico (arrastrar + leer) vs avanzado (transiciones/comparador/atajos visibles en una barra, no ocultos).

### Game Model Builder → El proyecto del DT, editable
**Nuevo (lógica ya existe en `gameModel.ts`).**
**Visión:** editor por secciones (identidad, presión con altura+gatillos, bloque, salida, transiciones, ABP, riesgos aceptados, no-negociables) con lenguaje visual de cancha donde aplique (altura de presión/bloque como sliders sobre un campo). Es la **vara** del producto; debe sentirse importante, no un formulario.

### Scenario Simulator → "¿Y si…?" visual
**Nuevo (lógica en `scenarioSimulator.ts`).**
**Visión:** elegir decisión (4-3-3, subir bloque, tercer central…) y ver **beneficio/riesgo, impacto por línea sobre la cancha, jugadores beneficiados/expuestos como chips, compatibilidad con el modelo (semáforo), y ejercicios para probarlo**. El "wow" vendedor — tiene que verse como simulación, no como lista.

### Opponent Scout → Plan de partido
**Nuevo (lógica en `opponentScout.ts`).**
**Visión:** form simple del rival → genera plan de partido, foco de entrenamiento de la semana, alertas tácticas y preguntas abiertas (lo que falta cargar). Las preguntas abiertas como CTAs que empujan a completar evidencia.

### Sessions / Microciclo → Generador de semana
**Hoy:** planner con alertas de texto.
**Visión:** carga semanal como **semáforo visual** (MD-x con color por intensidad), bloques con preview de escena, y el handoff "diagnóstico → semana" visible (de qué problema viene cada bloque). Export PDF con preview.

### Post-match → Simple por defecto, avanzado opt-in
**Hoy:** schema de 20+ secciones = muro.
**Visión:** modo simple (resultado + 3 notas → informe corto), modo avanzado detrás de "ver más", contraste contra modelo, "qué entrenar esta semana", y dos resúmenes exportables (jugadores / staff).

### Timeline / Evolución → Pantalla protagonista
**Hoy:** existe como card.
**Visión:** **la pantalla de retención.** Línea de tiempo del equipo: problemas que mejoran (teal), recurrentes (ámbar), retrocesos (rojo), patrones por rival, problemas no entrenados. Conecta sesión→mejora. Es lo que hace que el DT vuelva cada semana.

### Biblioteca → Escaneable
**Hoy:** lista de texto de 144 ejercicios.
**Visión:** cards con **miniatura de la escena 3D**, taxonomía visible (fase/principio/problema que corrige), y ranking por diagnóstico (qué corrige cada uno).

### Modo presentación / jugador → Broadcast
**Visión:** el tema `broadcast` brilla acá — cancha limpia, sin ruido de staff, para mostrar al plantel. Ya existe la base.

### Exportables → PDF premium
**Visión:** plan de partido, briefing para jugadores, informe post-match — con el tema `pizarra`, marca, y diseño editorial. Es material que el DT comparte → marketing orgánico.

---

## 6. Componentes nuevos del sistema de diseño

Reutilizables en todo el producto (matan los `style` inline dispersos):

- `ConfidenceMeter` — medidor de confianza (barra/gauge) con etiqueta de nivel.
- `EvidenceChip` — chip de evidencia citada con ícono de fuente (métrica/report/knowledge/memoria).
- `ModelContrastRow` — fila alineado/desvío contra el modelo de juego.
- `FitChip` — chip de riesgo/fortaleza del plantel con el atributo como evidencia.
- `PitchViz` — cancha base con zonas, líneas, carriles, altura de bloque (el componente más importante; lo usan Lineup Lab, simulador, diagnóstico, scout).
- `LoopProgress` — indicador del estado del loop táctico (para el command center).
- `PatternCard` — tarjeta de patrón (mejora/recurrente/retroceso) para la timeline.
- `ModeBadge` — badge de modo (pregunta/hipótesis/diagnóstico).
- `LoadMeter` — semáforo de carga para microciclo.

---

## 7. Roadmap por fases

### Fase 0 — Fundaciones (días)
- Consolidar tokens (una sola fuente theme.css + tactical-ui.css).
- Cablear `data-theme` + selector de 3 temas.
- Crear `PitchViz`, `ConfidenceMeter`, `EvidenceChip` como base.
- Resolver build/OneDrive (bloqueante para generar releases).

### Fase 1 — El loop, visible y premium (7–14 días)
- **Diagnóstico como informe diseñado** (la maqueta).
- **Command Center** en la home.
- **Timeline protagonista**.
- Higiene de presentación (idioma/tildes, jerarquía) en paralelo.
- **Resultado:** el loop se ve premium en las pantallas que el usuario más toca.

### Fase 2 — La cancha como lenguaje (30 días)
- **Lineup Lab analítico**: métricas sobre cancha + alertas automáticas + básico/avanzado.
- **Game Model Builder** con lenguaje visual de cancha.
- **Post-match simple/avanzado**.
- **Resultado:** la app deja de "parecer dashboard" y pasa a "parecer fútbol".

### Fase 3 — Las features de categoría, visuales (90 días)
- **Scenario Simulator** visual.
- **Opponent Scout / plan de partido**.
- **Exportables premium** (3 temas).
- Onboarding sobre las superficies nuevas.
- **Resultado:** lo que ningún producto barato le da a un DT, además, se ve mejor que los caros.

### Fase 4 — Pulido de marca (6 meses)
- Identidad de marca completa (logo, favicon, splash, landing).
- Responsive verificado en mobile/tablet (vistas densas).
- Micro-interacciones y transiciones.
- **Resultado:** producto comercial terminado.

---

## 8. Riesgos

- **Consolidar tokens puede romper visualmente** reglas que dependían del valor "ganador" actual. Mitigación: por pantalla, con captura antes/después.
- **OneDrive sigue truncando archivos** al sincronizar (confirmado). Cualquier trabajo visual necesita sacar el repo de la carpeta sincronizada o pausar sync — si no, se corrompe y el `build` falla.
- **Sobre-diseño**: caer en decoración que no aporta. Mitigación: cada elemento visual debe comunicar un dato o una acción.
- **Acoplar a componentes gigantes** (`LineupLab3D` 1914, `PostMatch` 1359): extraer a componentes/`lib` antes de rediseñar.
- **Los 3 temas deben mantener contraste/legibilidad (WCAG AA)** en las 3 variantes.

---

## 9. Cómo medir si mejoró

- **Test de 5 segundos**: ¿un DT nuevo entiende qué hace la app y por dónde empezar?
- **Tiempo hasta primer loop cerrado** (activación).
- **% de usuarios que recorren observación → diagnóstico → sesión** sin perderse.
- **Legibilidad del diagnóstico**: ¿el usuario encuentra causa/ajuste/confianza sin leer todo?
- **Uso de la timeline** (proxy de retención).
- **Reacción cualitativa**: mostrar a 3–5 DT reales y medir "¿esto se ve como algo que pagaría?".
- **Consistencia técnica**: 0 mezcla de idioma por pantalla, 0 colores hardcodeados fuera de tokens, contraste AA en 3 temas.

---

## 10. Qué NO hacer

- No rediseñar pantalla por pantalla **antes** de consolidar tokens y crear `PitchViz`/`ConfidenceMeter`/`EvidenceChip` (sería trabajo desechable).
- No tocar el visor 3D — es el wow-factor y está sólido.
- No sumar decoración (gradientes extra, animaciones) que no comunique.
- No diseñar mobile-first todavía: el DT trabaja la semana en desktop; responsive viene después.
- No esperar a tener "todo el sistema" para mostrar valor: la Fase 1 (diagnóstico + command center + timeline) ya cambia la percepción.

---

## Resumen en una línea

La UI no necesita prolijidad, necesita **convertirse en un producto de fútbol**: la cancha como lenguaje, la evidencia y la confianza siempre visibles, el diagnóstico como informe diseñado, y el loop táctico guiando la navegación. La base (3 temas, tokens, datos ricos) ya existe sin estrenar — el salto es activarla con diseño de información, no con más texto en cards.
