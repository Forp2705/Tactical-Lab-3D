# RomboIQ — Inspección en vivo + plan de desarrollo a "vendible"

> Lente: agency-product-manager (Alex). Inspección real del deploy `https://romboiq.vercel.app` con navegador (no del código): Visor, Sala, Diagnóstico, y dos consultas reales al Coach.
> Foco: producto, workflow, confianza en la IA, UX/UI. No ventas/pricing/GTM.
> Fecha: 2026-06-04.

---

## 1. Veredicto ejecutivo

La **espina del producto es real y se ve en vivo**: el loop semanal *es* la navegación, la "Cancha de estado" usa la cancha como lenguaje, hay onboarding (demo vs equipo real), y los patrones se muestran con evidencia. Eso ya está por encima de un dashboard genérico.

Pero **hoy RomboIQ no es vendible**, por una razón que pesa más que todo lo visual: **la feature central no funciona en producción.** Dos consultas seguidas al Coach devuelven error. Un tester que entra y pregunta lo primero, choca contra una pared en el único momento que justifica el producto.

> Outcome PM: hoy un usuario **no puede completar el momento "wow"** (problema → diagnóstico). Una feature que no responde es waste con timestamp de deploy. La prioridad es ruthless: nada visual importa hasta que el Coach responda.

---

## 2. Hallazgos en vivo (priorizados por impacto)

### 🔴 P0 — El Coach falla en producción (reproducible)
- Dos consultas seguidas → **"Error del agente: OpenRouter could not use the configured model. Check OPENROUTER_MODEL"** + "El proveedor no respondió bien… cambia a un modelo rápido y pago para testing".
- Modelo configurado en el deploy: `anthropic/claude-sonnet-4.5` — OpenRouter lo rechaza (slug inválido/no habilitado, env mal seteado, o sin crédito/acceso).
- La copy del error es **de dev** ("Check OPENROUTER_MODEL", "modelo pago para testing"), visible al usuario final.
- Positivo chico: el error no rompe la app y es legible. Pero el `resolveModelLadder` / `OPENROUTER_FALLBACK_MODELS` no está salvando el caso → o no hay fallback configurado, o todos fallan.

### 🟠 P1 — La app aterriza en el lugar equivocado
- RomboIQ **abre en "Visor táctico 3D", no en la Sala.**
- El visitante frío ve un panel de ~15 checkboxes (Zonas/Carreras/Pases/**Presión duplicada**/Coberturas/Alt A/Alt B/Rival/ABP/Notas) y un **canvas 3D negro/vacío** (la feature estrella renderiza un hueco).
- El valor —el loop semanal— es invisible en la llegada. **Debe abrir en Sala.**

### 🟠 P1 — Telemetría de dev expuesta al coach
- En Diagnóstico: "Motor IA / OPENROUTER **Disponible** / RUNTIME **vercel** / FALLBACK **Automatico server-side**".
- Un DT no sabe qué es OpenRouter ni Vercel. Es el tell "prototipo de dev" más fuerte. Reemplazar por un estado simple: "IA lista / IA no disponible".

### 🟡 P2 — Densidad del cockpit del Coach
- Antes de preguntar, la pantalla apila: estado del motor + 10 campos de contexto + 3 reportes + memoria + 3 patrones + caja de consulta. Muro de analista. Comprimir a "pregunta + contexto colapsable".

### 🟡 P2 — Prolijidad / copy
- Faltan tildes en todo el deploy ("Diagnostico", "evolucion", "Reproduccion", "Presion", "decision"). Tell de "no terminado" sobre pantallas que por lo demás están bien.

---

## 3. Qué está sólido (no romper)
- **Sala / Centro de Mando Táctico:** título display comandante, el **loop como navegación** (observar→diagnosticar→entrenar→revisar→evolucionar con barra de progreso), "siguiente paso", y la **"Cancha de estado"** con zona resaltada + lectura + evidencia. Diferenciador real.
- **Onboarding presente:** "Modo demo / Cargar demo / Equipo real".
- **Identidad verde-negra ya aplicada** en Sala y Diagnóstico (dark, acento verde, sobrio). El "look IA" está mitigado ahí; el **Visor es la pantalla más cruda**.
- **Patrones detectados surfaced** (repetido/nuevo/retroceso con evidencia y fechas) — el diferenciador mostrándose.
- **Modelo serio** (sonnet-4.5) — buena elección, *cuando responda*.

---

## 4. Dónde está "detrás" para ser vendible
1. **Confiabilidad del core (IA):** hoy roto en prod; sin fallback efectivo.
2. **Primera impresión:** aterriza en una herramienta avanzada vacía, no en el valor.
3. **Madurez de producto vs prototipo:** telemetría de dev, copy sin tildes, densidad.
4. **Render del visor 3D:** la feature visual estrella muestra un canvas vacío (a investigar: WebGL/escena/carga).
5. **Confianza de la IA (más allá de que responda):** el bug modo↔guard del critique ("Diagnóstico @ 0.5" etiquetado como diagnóstico) sigue pendiente.
6. **Sin medición:** no hay analítica de qué hacen los testers (dónde abandonan, si cierran el loop).

---

## 5. Plan de desarrollo a "vendible" (por fases, prioridad ruthless)

### Fase 0 — Destrabar el core (horas–1 día) · **P0**
- **Arreglar el modelo OpenRouter:** poner en `OPENROUTER_MODEL` (Vercel) un slug válido y habilitado en tu cuenta, con crédito. Verificar contra el catálogo de OpenRouter.
- **Fallback efectivo:** configurar `OPENROUTER_FALLBACK_MODELS` con 1–2 modelos rápidos/baratos para que un fallo de modelo **no** llegue al usuario como error.
- **Copy de error de usuario** (no "OPENROUTER_MODEL"): "El asistente no está disponible ahora, reintentá en un momento".
- **Gate de éxito:** el Coach responde un diagnóstico real desde el deploy, dos veces seguidas, sin error.

### Fase 1 — Primera impresión y confianza (días) · **P1**
- **Abrir en Sala**, no en Visor.
- **Esconder la telemetría de dev** (OpenRouter/runtime/fallback) detrás de un estado simple.
- **Investigar el visor vacío** (por qué el canvas 3D no renderiza la escena) — o, si es pesado, no exponerlo como landing.
- **Mode↔guard coherente** (del critique): que un diagnóstico con poca evidencia/citas baje a "hipótesis" y lo muestre, no que mienta con "Diagnóstico @ 0.5".

### Fase 2 — Pulido a producto (días) · **P2**
- Ejecutar el **clean-pass v3** ya specced (`docs/ui-clean-pass-plan.md`): tokens verde-negro, matar look IA, Home 3 niveles, AiView como informe.
- **Comprimir el cockpit del Coach** (contexto colapsable).
- **Pase de tildes/copy** en todo el deploy.

### Fase 3 — Profundidad que retiene (semanas) · convergencia
- **Memoria que acumula y se ve** (hoy 1–3 items; es el diferenciador que nadie copia).
- **Tactical problem backlog** (el único net-new del critique; reusa `patternDetection`).
- **Medición de uso** mínima (qué tocan los testers, dónde abandonan).

### Fase 4 — Features de cancha (later) · ver §6
- Tu idea de transiciones, en su versión barata, recién acá.

---

## 6. Sobre tu idea: simulación de transiciones (def/of) o dos drag&drop chicos

**Veredicto PM honesto: buena idea táctica y on-brand, pero (a) NO ahora, y (b) probablemente NO hay que construirla de cero — ya existe casi toda.**

Lo que ya hay en el repo:
- **`LineupLab3D`** ya es un editor de **shapes con drag&drop** (posicionás jugadores) y guarda **transiciones from-shape → to-shape** con blend animado + distancias calculadas. O sea, "simular transición" (estado A → estado B) **ya está**.
- **`scenarioSimulator.ts` + `ScenarioSimulatorPanel`** ya hacen el "qué pasa si" (subir bloque, tercer central, etc.) con impacto por línea, riesgo y ejercicios.

Entonces el gap **no es el motor**, es que esas piezas están **parkeadas en superficies avanzadas y desconectadas del loop** (el propio critique recomendó sacarlas del core path). Construir otro tablero ahora, con `LineupLab3D` ya en **1923 líneas** y el core roto, es exactamente el "impresionante de construir, agotador de usar" que mata el wedge.

**Si igual querés tu versión, la barata y segura (Fase 4):**
- **Dos tableros estáticos personalizables, sin animación**: "estado pre-pérdida" y "estado post-pérdida" (y un par ofensivo: "al recuperar" / "tras 5s"). Reusan el modelo de `shapes` que ya existe — son un *shape editor simplificado*, no un sistema nuevo.
- **Conectados al diagnóstico:** que el Coach pueda referenciar "así querés quedar tras pérdida" y que el tablero muestre el antes/después del ajuste. Ahí suma al loop en vez de ser otra herramienta suelta.
- Coste real: bajo-medio **si se reusa el shape model**; alto si se hace un sistema de simulación nuevo. Hacé lo primero.

Resumen: **tu instinto es correcto** (las transiciones son el corazón del problema que el equipo repite: "queda partido tras pérdida"). Pero hoy el valor no está bloqueado por falta de tableros, está bloqueado por un Coach que no responde y una primera pantalla que no vende. Transiciones = Fase 4, versión "antes/después estático" reusando shapes.

---

## 7. Criterios de "vendible" (acceptance)
- El Coach responde un diagnóstico real, confiable, desde el deploy — sin errores de proveedor.
- Un tester ajeno recorre observación → diagnóstico → sesión → post-partido → evolución **sin error y sin ayuda**.
- La primera pantalla comunica el valor (Sala), no una herramienta avanzada vacía.
- Cero telemetría de dev / copy de dev visible.
- La IA nunca miente sobre su certeza (modo coherente con evidencia).
- Copy prolijo (tildes), demo reseteable.

---

## 8. Recomendación final
RomboIQ está **una capa de confiabilidad y una de primera-impresión** de ser demostrable, y **un pulido** de ser vendible. No le falta otra feature — le falta que **lo que ya tiene funcione y se vea terminado**.

Orden: **Fase 0 (arreglar el Coach) → Fase 1 (abrir en Sala + esconder telemetría + visor + trust) → Fase 2 (clean-pass + copy) → Fase 3 (memoria + backlog + medición) → Fase 4 (transiciones, versión barata).**

La feature de transiciones es buena, pero es Fase 4 y mayormente ya existe: el movimiento correcto es **conectar y simplificar lo que hay**, no construir otro tablero.

---

### Apéndice — qué se vio en vivo
- Landing real: `Visor táctico 3D` (no Sala), canvas 3D vacío, panel de ~15 checkboxes.
- Sala: "Centro de Mando Táctico", barra de loop, "Cancha de estado" con zona + lectura + evidencia, "Modo demo / Cargar demo / Equipo real".
- Diagnóstico: "Motor IA" con OPENROUTER/RUNTIME/FALLBACK; contexto cargado (modelo 4-3-3, 3 reportes reales, memoria 1, 3 patrones); modelo `anthropic/claude-sonnet-4.5`.
- Coach query ×2 → **error reproducible** ("OpenRouter could not use the configured model").
