# Tactical Lab 3D — Plan de lanzamiento a testers

> **Reemplaza a `tester-ready-mvp-plan.md`**, que se escribió sobre un diagnóstico equivocado (suponía features y UI sin hacer; en realidad están hechas).
> Fundado en el estado real verificado: type-check verde, UI leap implementado, loop cableado.
> Foco: dejar de sumar escalones sueltos y **converger a algo que un tester usa de punta a punta**. Mejoras gráficas + funcionales. Lógica solo la necesaria (marcada para debatir). Pulido del Coach como prioridad.

---

## 1. Estado real (verificado, no asumido)

Lo que confirmé leyendo el código actual:

- **Sistema de diseño completo y en uso:** `src/ui/tacticalPrimitives.tsx` (`ConfidenceMeter`, `EvidenceChip`, `ModeBadge`, `PitchViz` con zonas/líneas/altura de bloque, `LoopProgress`, `PatternCard`, `FitChip`, `LoadMeter`), consumido en 11 vistas.
- **Diagnóstico ya renderizado como informe diseñado** en `AiView` (confianza, evidencia citada, contraste con modelo, fit warnings, cancha).
- **3 temas vivos** (cockpit/broadcast/pizarra) persistidos en `AppShell`.
- **Loop cableado:** `buildSessionPlanFromDiagnosis` → `DiagnosisSessionPanel`. Game Model, Simulator, Scout, fit y patrones cableados al prompt del Coach.
- **Estable:** `npm run type-check` y `npm run build` pasan.

**Conclusión:** el producto NO está incompleto en features. Está incompleto en **convergencia, profundidad del Coach y acto de lanzar**. Por eso se siente "conservador": cada paso fue incremental y nada cerró en un "esto se entrega".

---

## 2. Por qué se siente que el progreso es corto

No es falta de trabajo — es falta de **un corte que diga "esto va a manos de un tester el martes"**. Tres causas reales:

1. **Nunca se cerró el ciclo de lanzamiento:** el trabajo sigue sin commitear (HEAD `1b427e0`) y sin un deploy estable que el tester alcance. Sin eso, por más features que haya, no hay producto entregable.
2. **El Coach se siente "pocos shots":** da un solo ajuste y respuestas tersas (verificado: schema con un único `mainAdjustment`, prompt capado a "máximo 1-2 oraciones"). El usuario percibe poca profundidad aunque el motor sea bueno.
3. **Riqueza no recorrida:** hay features potentes (simulador, scout, game model) que un tester nuevo no descubre ni conecta solo, porque falta el QA del recorrido completo y la guía.

El salto a "más funcional" no es construir: es **profundizar el Coach, pulir bordes, y lanzar**.

---

## 3. El plan — 4 frentes

### Frente A — Coach Agent: más profundidad, más soluciones, menos latencia (PRIORIDAD)

Tu pedido explícito, y el de mayor impacto percibido.

**A.1 — Más soluciones (no un solo shot).** *(lógica: schema + prompt — §6)*
Agregar a `CoachMatchAdviceSchema` un campo `alternativeAdjustments: [{ adjustment, whenToUse, tradeoff }]` (2-3). El Coach pasa de "una receta" a "camino principal + alternativas con su costo". La UI ya tiene los componentes; se muestran en pestañas/expander para no abrumar.

**A.2 — Más información del problema.** *(lógica: schema + prompt — §6)*
Agregar `problemBreakdown: { zone, moment, trigger, ownVsRival }` para desglosar dónde/cuándo/gatillo/sujeto, en vez de 2 oraciones de lectura. Aprovecha la evidencia que la entrevista ya recolecta. Relajar topes con criterio (`onFieldInstructions` hasta 5, lectura hasta 3-4 oraciones) — profundidad estructurada, no prosa larga.

**A.3 — Latencia (sin romper).**
- **Parallelizar los 5 retrievals secuenciales** en `retrieveCoachEvidence` (`Promise.all`). Son independientes → win directo, **riesgo bajo, sin cambio de comportamiento**. Recomiendo hacerlo ya (no necesita debate).
- **Dedupe** de `loadSavedPostMatchReports` (hoy se carga dos veces).
- **Modelo `:free` → modelo pago chico y rápido con JSON nativo** *(decisión de costo — §6)*: es el mayor factor de latencia y de los errores intermitentes (respuestas sin `choices`). Aunque sea solo durante el período de testing.
- Conservar el guard de `completion.choices` para que un fallo del proveedor no muestre la app "colgada" a un tester.

**Resultado A:** el Coach baja un diagnóstico más profundo, con 2-3 caminos y su trade-off, más rápido y sin fallos crípticos.

### Frente B — Mejoras gráficas (pulido de producto, no rediseño)

El UI leap está; falta que se sienta **terminado y coherente** en las pantallas que el tester toca.

- **Pase de idioma:** tildes y español consistente (verificado: "tactico" ×16, "Sesion", eyebrows en inglés mezclados). Sacar jerga ("IndexedDB", "snapshot" → "guardado local", "proyecto"). Barato, alto impacto en percepción de seriedad.
- **Estados de carga del Coach:** indicador de "pensando" que diga qué hace (recolectando evidencia / razonando), dado que aún hay latencia.
- **Estados vacíos y de error con cara de producto:** IA sin key, modelo caído, sin reports/sesión → mensaje claro + CTA, nunca pantalla rota. Los testers viven en estos bordes.
- **Consistencia de los 3 temas:** revisar contraste/legibilidad (WCAG AA) en broadcast y pizarra, ahora que están vivos.
- **Render de las soluciones nuevas del Coach** (A.1/A.2): pestañas para alternativas + bloque de breakdown, usando las primitivas existentes.

### Frente C — Funcionamiento y lanzamiento (lo que lo vuelve entregable)

- **Sacar el repo de la carpeta sincronizada / commitear / pushear.** Bloqueante real. El trabajo vive sin red en git.
- **Deploy estable a Vercel** (ya hay handlers `api/`) con la key server-side. URL que el tester abra.
- **QA del loop completo end-to-end** en el deploy, recorriéndolo **como un extraño**: observación → entrevista → diagnóstico → sesión → post-match → patrones → timeline. Anotar y arreglar cada muro.
- **Onboarding mínimo + datos de ejemplo borrables:** un tester debe cerrar un loop en 5 minutos sin cargar nada propio primero.

### Frente D — Profundidad funcional sin lógica pesada (para no quedarnos cortos)

Hacer que la riqueza que ya existe **se note y se conecte**, sin construir motores nuevos:

- **Descubribilidad:** que Game Model, Simulator y Scout estén en el flujo/nav, no enterrados. El tester tiene que toparse con ellos.
- **Conexiones visibles:** scout → foco de la semana en sesiones; simulador → ejercicios para probar; diagnóstico → sesión (ya existe, verificar que se vea). Mostrar que las piezas hablan entre sí.
- **Exportables:** pulir `premiumExports` / PDF para que el tester pueda compartir diagnóstico, plan de partido o post-match. Material compartible = feedback y difusión.

---

## 4. Priorización

| # | Acción | Frente | Impacto | Esfuerzo | Riesgo | Debate |
|---|---|---|---|---|---|---|
| 1 | Commit + deploy estable | C | 5 | 2 | 1 | No |
| 2 | Parallelizar retrieval + guard errores | A | 4 | 1 | 1 | No |
| 3 | Coach: alternativas + breakdown (schema+prompt) | A | 5 | 3 | 2 | **Sí** |
| 4 | Render de alternativas/breakdown en UI | A/B | 4 | 2 | 1 | No |
| 5 | Modelo `:free` → pago rápido | A | 4 | 1 | costo | **Sí** |
| 6 | QA del loop end-to-end + fixes | C | 5 | 3 | 1 | No |
| 7 | Estados vacío/error + "pensando" | B | 4 | 2 | 1 | No |
| 8 | Pase de idioma/jerga | B | 3 | 2 | 1 | No |
| 9 | Onboarding + datos de ejemplo | C | 4 | 2 | 1 | No |
| 10 | Descubribilidad + exportables | D | 3 | 2 | 1 | No |

Orden: **1-2 primero (destraban y mejoran ya), luego 3-5 (el Coach), luego 6-9 (recorrido y bordes), 10 al final.**

---

## 5. Sprint a tester-ready (~2 semanas)

- **Días 1-2:** commit + deploy estable (1), parallelizar retrieval + guard (2). Ya queda online y más rápido.
- **Días 3-6:** Coach — schema+prompt de alternativas/breakdown (3), modelo rápido (5), render en UI (4), tests del schema.
- **Días 7-10:** QA del loop end-to-end (6), estados de error/vacío + "pensando" (7).
- **Días 11-13:** idioma/jerga (8), onboarding + ejemplo (9), descubribilidad + exportables (10).
- **Día 14:** recorrido final como tester en el deploy; fix de lo que rompa la primera experiencia.

---

## 6. Cambios de lógica a debatir (marcados, como pediste)

Solo estos tocan lógica; el resto es gráfico/funcional/copy.

1. **Schema + prompt del Coach** (alternativas + breakdown, topes relajados): *necesario* para "más soluciones / más info". Riesgo medio (cambia contrato de salida → tocar el render). **Recomiendo hacerlo** — es el corazón de tu pedido.
2. **Modelo `:free` → pago rápido**: decisión de costo, no de código. Resuelve latencia + errores intermitentes. **Recomiendo** al menos durante testing.
3. *(Seguros, sin debate, los haría ya):* parallelizar retrieval, dedupe de reports, conservar el guard de `choices`.

---

## 7. Qué NO hacer ahora

- No rediseñar la UI (ya está hecha) ni construir features nuevas (simulador/scout/game model existen).
- No meter pattern-detection semántico, multiusuario, video, mobile — post-testers.
- No volver a auditar en círculos: el research está hecho, ahora se ejecuta.
- No pulir Simulator/Scout a fondo antes de lanzar — alcanzan para que el tester opine.

---

## 8. Gate de ship y métricas

**Gate binario:** un tester ajeno al proyecto, en el deploy real, recorre observación → diagnóstico → sesión → post-match → timeline **sin ayuda y sin error**, y el Coach le baja ≥2 soluciones con su trade-off y un desglose del problema.

Métricas de testing:
- Latencia del Coach < ~8s objetivo; 0 errores crípticos en 20 consultas.
- ≥2 soluciones + breakdown legibles por respuesta (tu pedido).
- Test de 5 segundos en la home: el tester entiende qué hace la app.
- 0 pantallas rotas en bordes (sin key/datos/modelo).
- Feedback cualitativo: "¿lo usarías la semana que viene?".

---

## Resumen en una línea

No falta construir: falta **profundizar el Coach (más soluciones + más info + menos latencia), pulir bordes gráficos y de error, y lanzar.** El producto ya está; el trabajo ahora es convergencia y entrega — y eso es ~2 semanas de foco, no otro mes de features.
