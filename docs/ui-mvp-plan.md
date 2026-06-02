# Tactical Lab 3D — Plan de UI y MVP vendible

> Auditoría de interfaz y plan para llevar el producto a un MVP comercializable.
> Regla: **no tocar lógica.** Todas las propuestas son CSS, markup, copy, assets y organización visual.
> Fecha: 2026-06-01. Base: código real tras recuperación (type-check limpio).

---

## 0. Estado de estabilidad (punto de partida)

- Recuperación OK: **0 bytes NUL reales**, los archivos antes corruptos están íntegros (`LineupLab3D` 1914, `useAppStore` 1118, `PostMatchAnalysisView` 1359, `CoachAgent` 994).
- `tsc --noEmit` pasa **exit 0**. El código compila.
- `npm run build` falla por un `rimrafSync`/`emptyDir` al limpiar `dist/` — es un **bloqueo de filesystem/OneDrive sobre la carpeta**, no un error de código. A vigilar (pausar sync o mover el repo fuera de OneDrive), pero no bloquea la auditoría.

Conclusión: la base es estable. El trabajo ahora es de **producto y presentación**, no de salvataje.

---

## 1. Veredicto visual ejecutivo

La app **no parece una demo de fin de semana** — tiene un lenguaje visual con intención: dark "cockpit" teal/azul, glassmorphism, gradientes radiales, tipografía cuidada (Space Grotesk + Inter), home guiada ("¿Qué querés resolver hoy?"). Eso ya está por encima del 80% de las herramientas tácticas amateur.

Pero hay un techo claro entre "se ve lindo" y "se ve como un producto que pago": el problema no es feo, es **inconsistente y sin terminar**. Tres cosas lo delatan al instante:

1. **Dos sistemas de diseño conviviendo** que se pisan los tokens.
2. **Detalles de prolijidad** (tildes faltantes, inglés/español mezclado en la misma pantalla).
3. **Estados vacíos y onboarding** apenas resueltos: un usuario nuevo entra y no sabe por dónde empezar más allá de la home.

Ninguno es difícil de arreglar y ninguno requiere tocar lógica. Esa es la buena noticia: el salto a "vendible" es casi todo de capa de presentación.

---

## 2. Sistema de diseño — hallazgos

### 2.1 Dos hojas de estilo que compiten 🔴
`App.tsx` importa **`theme.css` (3053 líneas)** y **`tactical-ui.css` (861)**. Ambas definen `:root` con los **mismos tokens** y valores distintos:

- `theme.css`: `--accent: #5eead4` (hex fijo), `--radius: 22px`, `--font-head: "Avenir Next"`.
- `tactical-ui.css`: `--accent: oklch(0.82 0.13 168)`, `--radius: 20px`, `--font-head: "Space Grotesk"`.

Como `tactical-ui.css` carga segundo, gana en `:root`, pero `theme.css` tiene cientos de reglas de componente con colores hardcodeados que **no** respetan el token. Resultado: el tema "real" es una mezcla impredecible de los dos. Cualquier ajuste visual hoy es a ciegas.

**Acción (sin lógica):** consolidar en un único sistema de tokens. Recomiendo quedarse con la arquitectura de `tactical-ui.css` (oklch + densidad + multi-tema) como fuente de verdad y migrar las reglas de `theme.css` a tokens, eliminando duplicados. Es la inversión de UI de mayor retorno.

### 2.2 Sistema de 3 temas en el CSS pero sin cablear 🟠
`tactical-ui.css` define `[data-theme="broadcast"]` y `[data-theme="pizarra"]` (premium cinematográfico y chalkboard data-dense). **Nadie setea `data-theme` en la UI** (los matches de "broadcast" en el código son el modo de cámara, no el tema). Es una feature visual potente, muerta.

**Acción:** o se cablea un selector de tema (un `data-theme` en `<html>` + 3 botones — markup, no lógica de negocio) y se convierte en diferencial vendible, o se borra para no cargar 400 líneas de CSS sin uso. Cablearlo es barato y muy demostrable en una venta.

### 2.3 Estilos inline dispersos 🟡
`HomeView` (12), `SessionsView` (9), `AiView` (8) usan `style={{...}}` con valores mágicos (gaps, colores, alturas). Rompen la consistencia y la capacidad de re-tematizar.

**Acción:** mover a clases utilitarias tokenizadas (`.stack`, `.grid-2`, `.bar`, etc.). Markup/CSS, sin tocar lógica.

### 2.4 Prolijidad de idioma 🔴 (alto impacto / bajo esfuerzo)
Faltan tildes en todo el producto: "tactico" ×16, "Sesion" ×7, "Distribucion", "Analisis", "Reproduccion", "automatica"… Y la misma pantalla mezcla inglés y español: el topbar muestra eyebrows en inglés ("Matchday cockpit", "Field ready", "Library") con títulos en español.

Para un producto que se vende a entrenadores **hispanohablantes**, esto es lo que separa "amateur" de "profesional" en los primeros 5 segundos. Es puro copy.

**Acción:** pase de corrección ortográfica (tildes) + decidir un idioma por superficie (recomiendo todo en español neutro; el inglés puede quedar como guiño en code-chips). Cero lógica.

### 2.5 Navegación con code-chips crípticos 🟡
El sidebar usa códigos: HOME, 3D, XI, AI, VID, PM, LIB, MD, PL. Se ve "pro/técnico", pero "PM", "MD", "PL" no son obvios para un DT amateur. El label al lado ayuda, pero el chip compite por atención.

**Acción:** mantener el estilo de chip pero con iconografía o códigos más legibles, y agrupar mejor (primario vs herramientas ya existe). Considerar íconos en vez de siglas para reducir carga cognitiva.

---

## 3. Auditoría visual feature por feature

| Superficie | Estado visual | Qué está bien | Qué mejorar (sin lógica) |
|---|---|---|---|
| **App Shell / Sidebar** | 🟢 | Marca, nav clara, status-card con estado de campo, acciones de proyecto | Code-chips crípticos; "Local / IndexedDB" es jerga que no aporta al DT; el footer mezcla guardado/export/import sin jerarquía |
| **Topbar** | 🟡 | Título+subtítulo+stat-strip+acciones, buena densidad | Eyebrows en inglés; "Exportar PNG" y "Modo presentacion" compiten visualmente; en mobile el menú dice "Menu" como texto |
| **Home (cockpit)** | 🟢 | Hero con la pregunta correcta, 4 action-cards que mapean el loop, stat-tiles, mini gráfico de microciclo, cards de sesión/reports/timeline | Mucho `style` inline; el gráfico de carga es lindo pero sin leyenda/escala; jerarquía visual entre hero y action-cards es plana |
| **Visor 3D** | 🟢 | Técnicamente el wow-factor; cámaras, capas, fases | Controles de capas/cámara pueden abrumar; falta un "primer uso" que explique qué estoy viendo |
| **Lineup Lab** | 🟡 | Métricas geométricas en vivo, heatmap, transiciones, comparador | UX de power-user (7 atajos de teclado, sin descubribilidad); panel de métricas denso sin explicación de qué es "bueno"; necesita modo básico vs avanzado |
| **Sessions / Microciclo** | 🟡 | Planner real, alertas de carga/ABP, drag-and-drop | Alertas como texto plano; carga sin visual de "semáforo"; export PDF sin preview |
| **Biblioteca** | 🟡 | Catálogo curado, filtros | 144 ejercicios necesitan mejor escaneabilidad (cards con preview de escena, no solo texto) |
| **Asistente (Coach)** | 🟡 | Salida estructurada, evidencia, citas, modo entrevista | La densidad de la respuesta (lectura+causa+ajuste+riesgos+señales+reflexión+citas+acciones) puede abrumar; falta progresión visual pregunta→hipótesis→diagnóstico clara |
| **Modo entrevista** | 🟡 | Question cards, opciones rápidas, progreso de evidencia | Necesita el badge de modo y la barra `[■■□□]` bien visibles; el "saltar y recibir hipótesis" debe verse como elección secundaria con warning |
| **Post-partido** | 🟠 | Reporte rico, PDF, historial | Schema de 20+ secciones → muro de texto; sin modo "simple" visual; sin comparación entre partidos visible |
| **Timeline del equipo** | 🟠 | Existe (Codex la implementó) | Probablemente sub-explotada visualmente; es el gancho de retención, merece ser protagonista |
| **Modo jugador / Presentación** | 🟢 | Vista limpia sin ruido del staff | Buen diferencial; pulir transición de entrada/salida |

Leyenda: 🟢 sólido · 🟡 funcional, pule · 🟠 verde visualmente.

---

## 4. Mejoras priorizadas (sin tocar lógica)

### Quick wins — días, impacto inmediato en percepción
1. **Pase de tildes y consistencia de idioma** en toda la UI (copy). El cambio más barato y más visible.
2. **Unificar eyebrows a español** (topbar, metaFor/titleFor/subtitleFor).
3. **Sacar jerga al DT**: "Local / IndexedDB" → "Guardado en este equipo"; "snapshot" → "proyecto".
4. **Empty states con intención**: cada card vacía ("Sin reportes", "Sin bloques") con un CTA claro y un ícono, no solo texto gris.
5. **Jerarquía del hero**: que el hero y las 4 action-cards no compitan; hero más grande, cards como segundo nivel.

### Medio plazo — semanas, suben el "se ve profesional"
6. **Consolidar el sistema de tokens** (sección 2.1): una sola fuente de verdad, eliminar duplicados theme.css/tactical-ui.css. Habilita todo lo demás.
7. **Cablear el selector de 3 temas** (cockpit/broadcast/pizarra) como feature visible — diferencial de demo.
8. **Componentizar utilitarios** para matar los `style` inline.
9. **Diagnóstico del Coach progresivo**: colapsar secciones secundarias (riesgos, reflexión, citas) detrás de "ver más"; mostrar primero lectura+causa+ajuste.
10. **Semáforos de carga** en Sessions/Microciclo (color por nivel, no texto).
11. **Cards de biblioteca con miniatura de escena** (snapshot del 3D) para escaneo visual de 144 ejercicios.

### Profundo — define la categoría visual
12. **Modo básico vs avanzado en Lineup Lab**: arrastrar+ver métricas (básico) vs transiciones/comparador/atajos (avanzado).
13. **Timeline del equipo como pantalla protagonista** (evolución de problemas: mejora/recurrente/retroceso) — el gancho de retención.
14. **Onboarding de primer uso** (tour de 3-4 pasos) sobre las superficies existentes.
15. **Sistema de íconos coherente** que reemplace/acompañe los code-chips.

---

## 5. Qué falta para un MVP vendible (más allá de lo visual)

Estabilidad ✅ y features ✅ no alcanzan para "vendible". Lo que falta es **presentación de producto** y **confianza de uso**:

1. **Onboarding / primer uso.** Hoy un usuario nuevo cae en una home rica pero sin guía. Un tour corto + datos de ejemplo "borrables" = diferencia entre prueba abandonada y activación.
2. **Estados vacíos y de error con cara de producto.** Que nada se sienta roto cuando falta data (reports, sesiones, IA sin key).
3. **Idioma y copy impecables.** (Sección 2.4.) Es marketing gratis.
4. **Responsive real.** Verificar mobile/tablet; el `nav-open`/scrim ya existe, pero las vistas densas (Lineup Lab, Post-match) necesitan revisión en pantallas chicas.
5. **Identidad de marca.** Logo "TL" placeholder, nombre "Tactical Lab Pro" — definir marca, paleta de marca (ya hay base), favicon, pantalla de carga.
6. **Pantalla / página de venta.** Una landing o, mínimo, una vista "Acerca de / Qué hace" dentro de la app que cuente el loop de valor.
7. **Manejo visible de configuración de IA** (estado de la key OpenRouter, modelo activo) — ya hay `agent-status`, exponerlo con cara de producto, no de debug.
8. **Confianza y evidencia visibles** (del masterplan): badges de confianza, evidencia citada, modo del agente. Es el diferencial; tiene que verse.

---

## 6. Roadmap visual

### 7 días — "Prolijidad que se nota"
- Pase completo de tildes + idioma consistente.
- Empty states + CTAs en todas las cards.
- Sacar jerga técnica del copy de usuario.
- Jerarquía del hero/home.
- **Resultado:** la app deja de "oler a beta" en la primera impresión.

### 30 días — "Sistema de diseño y coherencia"
- Consolidar tokens (una sola fuente), eliminar conflicto theme.css/tactical-ui.css.
- Cablear selector de 3 temas.
- Componentizar utilitarios (matar inline styles).
- Diagnóstico progresivo del Coach + badges de confianza/evidencia visibles.
- Semáforos de carga en Sessions.
- **Resultado:** consistencia visual total; demuestra como producto serio.

### 90 días — "Listo para vender"
- Onboarding + datos de ejemplo.
- Timeline del equipo como protagonista.
- Modo básico/avanzado en Lineup Lab.
- Responsive verificado en mobile/tablet.
- Identidad de marca + landing/about.
- Biblioteca con miniaturas de escena.
- **Resultado:** MVP comercializable a DT amateur/semipro y cuerpos técnicos chicos.

---

## 7. Riesgos y qué medir

**Riesgos (de presentación, no de lógica):**
- Consolidar tokens puede romper visualmente reglas que dependían del valor "ganador" actual. Mitigación: hacerlo por superficie, con captura de pantalla antes/después de cada vista.
- Cablear `data-theme` toca el árbol de render (markup, no lógica de negocio), pero hay que verificar que las 3 variantes no rompan contraste/legibilidad.
- El `build` falla por OneDrive: cualquier verificación visual local necesita resolver eso (sacar el repo de la carpeta sincronizada o pausar sync) o no vas a poder generar `dist`.

**Qué medir para saber si mejora:**
- Tiempo hasta primera acción útil de un usuario nuevo (activación).
- % de usuarios que pasan de home → diagnóstico → sesión sin perderse.
- Test de "5 segundos": ¿un DT entiende qué hace la app y por dónde empezar?
- Consistencia: 0 strings sin tilde, 0 mezcla de idioma por pantalla (checklist).
- Contraste/accesibilidad (WCAG AA) en los 3 temas si se cablean.
- Reacción cualitativa de 3-5 DT reales a la demo (¿"esto lo pago"?).

---

## 8. Recomendación de arranque

Empezar por los **quick wins de 7 días** (tildes, idioma, empty states, copy sin jerga, jerarquía del hero). Son baratos, no tocan nada riesgoso, y cambian la percepción de "beta" a "producto" de inmediato — justo lo que necesitás para mostrar/vender.

En paralelo, planificar la **consolidación de tokens** (sección 2.1) porque es el desbloqueo de todo lo demás: sin una sola fuente de verdad de diseño, cada mejora visual posterior es trabajo a ciegas.

Lo que **no** haría todavía: rediseños grandes de vistas individuales antes de unificar el sistema de tokens, ni tocar el visor 3D (es el wow-factor y está sólido).
