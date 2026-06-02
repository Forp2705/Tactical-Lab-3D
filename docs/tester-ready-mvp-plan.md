# Tactical Lab 3D — Plan MVP para testers

> Objetivo: dejar de subir escalones sueltos y **converger a un producto que un tester pueda usar de punta a punta sin pegarse contra un muro.**
> Foco: shipping. Mejoras gráficas + de funcionamiento. Cambios de lógica solo los necesarios (marcados para debatir).
> Base: código real de hoy (CoachAgent 1219 líneas, features nuevas cableadas al prompt).

---

## 1. Diagnóstico honesto: por qué con un mes todavía no hay MVP viable

La verdad incómoda: **el problema no fue ser conservadores en el alcance — fue no converger.** En un mes se construyó muchísimo (loop completo, modelo de juego, simulador, fit, scout, patrones, todo cableado al Coach). Eso es ambicioso, no conservador. Lo que faltó es lo contrario: **disciplina de cierre.** Tres muros concretos que hoy impiden que sea un MVP:

1. **No está estable ni desplegable.** El trabajo más valioso vive **sin commitear** (HEAD sigue en `1b427e0`; hay 45 modificados + 20 sin trackear) en una carpeta de OneDrive que **trunca archivos al sincronizar** (confirmado dos veces). Un MVP que no se puede buildear ni desplegar de forma confiable no es un MVP, por más features que tenga.
2. **El loop no se puede recorrer entero sin fricción.** Hay piezas geniales, pero un tester que entra de cero no tiene un camino guiado observación → diagnóstico → sesión → post-match → evolución que funcione sin saber dónde tocar.
3. **La UI no muestra el valor.** El salto de producto es invisible: el diagnóstico es texto, las features nuevas son paneles que el tester no descubre.

**Conclusión:** no hace falta construir más para tener un MVP. Hace falta **estabilizar, cerrar el loop visible, pulir el Coach y desplegar.** Eso es lo que convierte "un mes de features" en "algo que un tester usa el martes".

---

## 2. Qué es "MVP para testers" (el corte)

El MVP no es todo el producto. Es **el loop mínimo que un tester puede recorrer solo y que demuestra el diferencial.** Corte:

**ENTRA (tiene que funcionar impecable):**
- Plantear un problema → el Coach entrevista si falta evidencia → diagnóstico con confianza, evidencia, contraste con modelo y fit.
- Diagnóstico → armar sesión de la semana (handoff funcional).
- Cargar post-match simple → reporte → patrón detectado → timeline.
- Game Model Builder editable (es la vara; el tester define su idea).
- Home como punto de entrada que guía el loop.
- IA confiable y razonablemente rápida (sin errores crípticos, sin esperas eternas).

**QUEDA PERO NO BLOQUEA EL SHIP (visible, no pulido):**
- Scenario Simulator y Opponent Scout (funcionan, pero no son el camino crítico del tester).
- Lineup Lab avanzado (transiciones/comparador).
- Los 3 temas, exportables premium, mobile.

**FUERA del MVP (no tocar ahora):**
- Video, multiusuario, marketplace, análisis automático.

Regla de corte: si un tester no lo necesita para recorrer el loop, no bloquea el ship.

---

## 3. Pulido del Coach Agent (tu pedido explícito)

Tres ejes: **más profundidad del problema, más soluciones, menos latencia.**

### 3.1 Más información del problema + más soluciones
Hoy el Coach es terso por diseño: un solo `mainAdjustment`, instrucciones capadas a 3, "máximo 1-2 oraciones" en todo. Por eso se siente "pocos shots". Cambios (esto es lógica — schema + prompt; lo marco para debatir en §8):

- **Más soluciones:** agregar al schema `alternativeAdjustments: [{ adjustment, whenToUse, tradeoff }]` (2-3). El Coach pasa de "una receta" a "un camino principal + alternativas con su trade-off". Es lo que un cuerpo técnico realmente quiere: opciones, no una sola orden.
- **Más profundidad del problema:** agregar `problemBreakdown: { zone, moment, trigger, ownVsRival }` para que desglose *dónde/cuándo/gatillo/sujeto*, en vez de solo 2 oraciones de lectura. Aprovecha la evidencia que ya recolecta la entrevista.
- **Relajar los topes con criterio:** `onFieldInstructions` hasta 5, lectura hasta 3-4 oraciones. **Pero la profundidad va estructurada, no en prosa larga** — para no abrumar al DT amateur.
- **Mostrarlo progresivo en la UI:** ajuste principal arriba; alternativas y breakdown detrás de pestañas/expander. Más información sin muro de texto. (Esto se conecta con la maqueta de "diagnóstico como informe".)

### 3.2 Reducir latencia (sin romperlo)
Cuellos reales detectados en `CoachAgent.ts`:

- **5 retrievals secuenciales** (`retrieveRelevantContext`, `...GeneratedMemory`, `...Knowledge`, `...Reports`, `loadSavedPostMatchReports` en líneas 440-452, cada uno con `await` propio). Son **independientes** → `Promise.all`. Solo esto puede recortar fuerte el tiempo de armado del prompt. Riesgo bajísimo, sin cambio de comportamiento.
- **Doble carga de reports:** `loadSavedPostMatchReports` se llama dentro de `retrieveRelevantContext` y otra vez aparte. Cargar una vez y pasar el resultado.
- **Modelo `:free`** (`deepseek-chat-v3-0324:free`): es el mayor factor de latencia *y* de inestabilidad (rate limits, y el error `completion.choices undefined` que ya vimos viene de respuestas sin choices del free). Para testers, conviene un **modelo pago chico y rápido con soporte JSON nativo** — elimina la latencia del free, los rate limits y los reintentos de JSON-mode fallback. Es decisión de costo (§8).
- **Reintentos de JSON-mode:** con un modelo que soporta `json_object` nativo, se evita el fallback que hoy agrega una llamada extra cuando falla.
- **Manejo del error sin choices** (ya lo dejé aplicado en el working tree): que no tire un `TypeError` críptico y que el retry/fallback funcione. Crítico para que un tester no vea la app "colgada".

Resultado esperado: respuestas más rápidas y, sobre todo, **sin fallos crípticos** — que es lo que más rompe la confianza de un tester.

---

## 4. Mejoras gráficas (tester-facing, foco no rediseño total)

No es el momento del rediseño completo (eso es el `ui-leap-plan.md`). Es el momento de que **las pantallas que el tester toca no parezcan un debug tool.** Prioridad:

1. **Diagnóstico como informe diseñado** (la maqueta ya mostrada): confianza como medidor, evidencia citada, contraste con modelo como filas, fit como chips, alternativas en pestañas. Es la pantalla que vende el producto.
2. **Home = punto de entrada que guía el loop**: "¿qué querés resolver?" + estado del loop (qué falta diagnosticar/entrenar/revisar). El tester nunca debe quedarse sin saber qué hacer.
3. **Estados de error y vacío con cara de producto**: IA sin key, modelo caído, sin reports, sin sesión → mensajes claros con CTA, no pantallas rotas. Los testers viven en estos bordes.
4. **Idioma y prolijidad**: tildes, español consistente, sacar jerga ("IndexedDB", "snapshot"). Barato, alto impacto en percepción.
5. **Indicador de "pensando" del Coach**: con la latencia actual, un estado de carga claro (qué está haciendo) evita la sensación de cuelgue.

(El rediseño profundo — cancha analítica, 3 temas, etc. — queda para después del ship a testers.)

---

## 5. Mejoras de funcionamiento (lo que hace que sea usable)

1. **Sacar el repo de OneDrive (o pausar sync) y commitear/pushear.** Bloqueante #1. Sin esto nada es estable ni desplegable, y el trabajo nuevo está en riesgo.
2. **Desplegar a un entorno que el tester alcance** (Vercel, ya hay handlers `api/`). Con la key de OpenRouter configurada server-side.
3. **Verificar cada handoff del loop end-to-end**: diagnóstico→sesión, post-match→patrón→timeline, game model→contraste. Que ninguno se rompa para un usuario que no sabe dónde tocar.
4. **Onboarding mínimo + datos de ejemplo borrables**: un tester debe poder hacer un loop completo en 5 minutos sin cargar nada propio primero.
5. **Confiabilidad de la IA**: modelo estable, manejo de errores, timeouts razonables. Un tester que ve un error en su primera consulta no vuelve.

---

## 6. Qué se difiere (no bloquea el ship a testers)

- Rediseño visual completo (cancha analítica, 3 temas, identidad de marca) → `ui-leap-plan.md`, post-testers.
- Pulido profundo de Simulator/Scout (funcionan; no son el camino crítico).
- Pattern detection semántico (el keyword actual alcanza para testers).
- Responsive/mobile.
- Exportables premium.

Se mantienen visibles para que el tester los descubra y opine, pero **no se invierte en pulirlos antes de shippear.**

---

## 7. Roadmap a tester-ready (sprint de ~2 semanas)

### Días 1-2 — Estabilizar y desplegar (bloqueante)
- Repo fuera de OneDrive, commit/push del trabajo nuevo.
- Build verde, deploy a Vercel con key configurada.
- Aplicar el fix de `completion.choices` (ya en working tree) y verificar.

### Días 3-5 — Coach: profundidad, soluciones y latencia
- Schema + prompt: `alternativeAdjustments` + `problemBreakdown`, topes relajados con criterio.
- Latencia: `Promise.all` en retrieval, dedupe de reports, evaluar/conmutar a modelo pago rápido.
- Tests del schema nuevo.

### Días 6-9 — Loop visible y confiable
- Diagnóstico como informe diseñado (con alternativas en pestañas).
- Home guía el loop + estado.
- Verificar y arreglar los handoffs end-to-end.
- Estados de error/vacío + indicador de "pensando".

### Días 10-12 — Onboarding y prolijidad
- Datos de ejemplo + tour mínimo.
- Pase de idioma/tildes/jerga en las pantallas del MVP.

### Días 13-14 — QA con el loop completo
- Recorrer el loop como un tester, en el deploy real, anotar muros.
- Fix de lo que rompe la primera experiencia.
- **Gate de ship:** un extraño hace un loop completo sin ayuda.

---

## 8. Cambios de lógica a debatir (los marqué, como pediste)

Estos son los que considero **necesarios** para cumplir tu pedido, pero son lógica — los bajo para que decidas:

1. **Schema + prompt del Coach** (`CoachSchemas.ts`, `CoachAgentPrompt.ts`): agregar `alternativeAdjustments` y `problemBreakdown`, relajar topes. *Necesario* para "más info + más soluciones". Riesgo: medio (cambia el contrato de salida; hay que tocar la UI que lo renderiza). Recomiendo hacerlo.
2. **Parallelizar retrieval** (`CoachAgent.ts`, `Promise.all`): *necesario* para latencia. Riesgo: bajo, sin cambio de comportamiento. Recomiendo hacerlo ya.
3. **Conmutar el modelo `:free` a uno pago rápido** (config/env): *muy recomendado* para latencia y confiabilidad ante testers. Riesgo: costo por consulta. Es una decisión tuya de presupuesto — quizás solo para el período de testing.
4. **Manejo del error sin `choices`** (ya aplicado en working tree): bajo riesgo, recomiendo conservarlo.

Ninguno reescribe la app; son cambios acotados. Pero como pediste, no avanzo en lógica sin tu visto bueno salvo el #2 y #4 que son seguros.

---

## 9. Riesgos

- **OneDrive (crítico):** mientras el repo viva ahí, todo lo demás es inestable. Es el primer dominó.
- **Trabajo sin commitear:** el leap completo está sin red de git. Commitear antes de seguir.
- **Modelo `:free`:** latencia + rate limits + errores sin choices = mala primera impresión de tester. El cambio de modelo lo resuelve pero cuesta.
- **Schema nuevo del Coach** desincroniza UI/cliente si no se tocan juntos.
- **Sobre-alcance otra vez:** la tentación de pulir Simulator/Scout antes de shippear. No.

---

## 10. Cómo medir si el MVP está listo para testers

- **Gate binario:** un extraño recorre observación → diagnóstico → sesión → post-match → timeline **sin ayuda y sin error**.
- Tiempo de respuesta del Coach < ~8-10s (objetivo) y 0 errores crípticos en 20 consultas.
- El diagnóstico entrega ≥2 soluciones y un desglose del problema (tu pedido) de forma legible.
- Un tester entiende qué hace la app en los primeros 30 segundos (test de 5 segundos sobre la home).
- 0 pantallas rotas en los bordes (sin key, sin datos, modelo caído).

---

## Resumen en una línea

No falta construir: falta **cerrar**. Estabilizar y desplegar, hacer el loop recorrible y confiable, darle al Coach más profundidad y más soluciones con menos latencia, y pulir solo las pantallas que el tester toca. Eso es el MVP — y está a ~2 semanas de foco, no a otro mes de features.
