# Tactical Lab 3D — Product Leap Masterplan

> Plan agresivo de evolución. Objetivo: no un "MVP prolijo", sino un producto que cambie de categoría.
> Pensado como founder + product strategist + football analyst + tech lead.
> No implementar código todavía. Base: código real (post-recuperación, type-check limpio).

---

## 1. Diagnóstico crítico del estado actual

La verdad incómoda primero: **este proyecto ya está más avanzado de lo que los planes anteriores asumían.** Auditando el código real, Codex ya construyó piezas que dábamos por inexistentes:

- `exerciseMatching.ts` — puente diagnóstico→ejercicio con reglas por dominio (fase/principio/objetivo/coaching). **Existe.**
- `patternDetection.ts` — patrones cross-report (repetido / nuevo / mejora / retroceso) con clustering y severidad. **Existe.**
- Métricas del shape inyectadas al Coach (`formatMetrics`, "Métricas shape actual" en el prompt). **Existe.**
- Home guiada ("¿Qué querés resolver hoy?"), `TeamTimeline`, modo entrevista (question/hypothesis/diagnosis), evidencia + citas + reflexión con confianza. **Existen.**

Lo que esto significa: **el esqueleto del loop completo ya está cableado.** El problema no es que falten piezas, es que las piezas son **superficiales, estáticas o no se conectan en una experiencia única.** Tres debilidades estructurales:

1. **El "modelo de juego" está hardcodeado** (`TEAM_IDENTITY`, `FOOTBALL_IDENTITY`): un solo equipo, en el código fuente. No es editable, no es por-equipo, y el Coach no puede *contrastar* contra él de forma estructurada. Es la mayor oportunidad desperdiciada del repo.
2. **Inteligencia frágil donde debería ser profunda**: `patternDetection` detecta "mejoras" por keywords ("mejor", "corrig"), `exerciseMatching` y la clasificación de dominios son keyword-matching. Funciona para demo, se rompe ante lenguaje real.
3. **Falta el "cerebro comparativo"**: hoy el Coach diagnostica el presente. No simula futuros ("¿y si paso a 4-3-3?"), no contrasta contra un modelo de juego, no proyecta el rival. Diagnostica; no *razona tácticamente sobre decisiones*.

**Veredicto:** el producto está a 3-4 features ambiciosas de dejar de ser "una pizarra 3D con IA" y convertirse en **el sistema operativo táctico del cuerpo técnico chico**. La base existe. Falta el salto conceptual.

---

## 2. Qué del plan anterior es demasiado conservador

- **El "UI/MVP plan" se quedó en CSS, copy y prolijidad.** Correcto como higiene, insuficiente como estrategia. Pulir tildes no diferencia de nadie.
- **El "masterplan de evolución" trataba como futuro lo que ya está hecho** (puente de ejercicios, patrones, métricas→Coach). Subestimó el estado real.
- **Ambos pensaron en "conectar lo que existe", no en "cambiar la categoría".** Conectar es necesario pero no es ventaja competitiva. La ventaja está en las capacidades que *nadie más le da a un DT amateur*: modelo de juego comparativo, simulación de decisiones, fit del plantel, scout del rival, evolución medible.
- **Faltó posicionamiento.** Ningún plan anterior definió contra qué se compite ni cuál es la promesa. Sin eso, es un proyecto, no un producto.

---

## 3. Nueva visión de producto

**Tactical Lab 3D = el sistema operativo táctico del cuerpo técnico chico.**

No es una pizarra (TacticalPad), no es video (Hudl/Veo), no es tracking (Metrica), no es un chatbot. Es el único lugar donde un DT amateur/semipro:

> mete lo que ve → la app lo obliga a tener evidencia → diagnostica sin inventar → lo contrasta contra **su** modelo de juego → simula el ajuste antes de arriesgarlo → lo convierte en la semana de entrenamiento → lo revisa tras el partido → detecta qué se repite → guarda solo lo validado → y le muestra que el equipo mejora.

La ventaja propia no es ninguna pieza aislada: **es el loop cerrado con memoria y evidencia.** Los gigantes hacen una etapa cada uno y para clubes con presupuesto. Nadie hace el ciclo completo, barato, local, en español, para el técnico que dirige los sábados sin departamento de análisis.

Promesa comercial: **"Dirigí con la claridad de un cuerpo técnico profesional, aunque seas vos solo."**

---

## 4. North Star

**North Star:** *El equipo del usuario mejora, partido a partido, en los problemas que la app lo ayudó a diagnosticar y entrenar.*

**Métrica North Star:** número de **loops tácticos cerrados por equipo por semana** — donde un loop = observación/post-match → diagnóstico → sesión generada → revisión posterior con patrón detectado. Es la métrica que captura el valor real (no "mensajes al chat" ni "logins").

Métrica secundaria de retención: **% de problemas diagnosticados que mejoran o desaparecen** en los reportes siguientes (lo provee `patternDetection`, hay que exponerlo).

---

## 5. Loop principal del usuario

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                      MODELO DE JUEGO (del equipo)                   │
   │            la vara contra la que se mide todo lo demás              │
   └───────────────┬───────────────────────────────────┬────────────────┘
                   │ define identidad                    │ contrasta
   observación /   ▼                                     ▼
   post-match → [EVIDENCIA] → [DIAGNÓSTICO] → [¿coincide con el modelo?]
                   ▲              │                      │
   shape métricas  │              ▼                      ▼
   plantel/fit ────┘        [SIMULADOR]            [SCOUT RIVAL]
   rival                  "¿y si cambio X?"         plan de partido
                                 │                      │
                                 ▼                      ▼
                          [SEMANA DE ENTRENAMIENTO]  (qué/cuándo/carga/ejercicios)
                                 │
                                 ▼  se juega
                          [POST-MATCH] → [PATRONES] → [MEMORIA VALIDADA]
                                 │                          │
                                 └─────► [EVOLUCIÓN DEL EQUIPO] ◄──┘
                                          (timeline: mejora/retroceso)
```

Cada nodo ya existe en forma básica salvo tres: **Modelo de Juego editable**, **Simulador** y **Scout del rival**. Esos tres son el salto de categoría.

---

## 6. Feature set por versión

### MVP vendible (lo que ya hay + terminar bien) — "El loop, prolijo y confiable"
- Coach Agent con entrevista, evidencia, citas y confianza visibles.
- Diagnóstico → ejercicios sugeridos → bloque de sesión (terminar el handoff a Sessions).
- Post-match modo simple + reporte.
- Patrones cross-report visibles en una Timeline protagonista.
- Métricas del Lineup Lab explicadas (qué es "bueno"/"riesgo").
- Home como Tactical Command Center, idioma/onboarding/empty states resueltos.
- **Promesa:** "De lo que viste el sábado a tu semana de entrenamiento, con evidencia."

### v1 premium — "El cerebro táctico comparativo"
- **Game Model Builder**: el DT define su modelo; el Coach contrasta cada diagnóstico/reporte contra él.
- **Player Fit Intelligence**: el plantel veta/recomienda ajustes (central lento + bloque alto = riesgo).
- **Lineup Lab básico/avanzado** con alertas tácticas automáticas y comparación de shapes.
- **Pattern Intelligence** profundo (no keyword): problemas no entrenados, patrones por rival.
- Memoria validada con capas explícitas (identidad / validada / evidencia / inferencia).
- Exportables premium (PDF de plan de partido, resumen para jugadores, resumen para staff).
- **Promesa:** "Tu modelo de juego, vivo, midiendo si el equipo lo cumple."

### v2 líder de mercado — "Simulación y proyección"
- **Tactical Scenario Simulator**: "¿y si 4-3-3 / subo el bloque / tercer central?" con beneficio/riesgo/impacto por línea/jugadores afectados/ejercicios para probarlo.
- **Opponent Scout Lite** → plan de partido + foco de entrenamiento + alertas automáticas.
- Evolución del equipo como narrativa (mejoras sostenidas, deudas tácticas).
- Asistente con personalidad de cuerpo técnico (memoria de "cómo dirige este DT").
- **Promesa:** "Probá la decisión antes de arriesgarla el sábado."

---

## 7. Roadmap

### 7 días — Cerrar y exponer el loop que YA existe
- Terminar handoff **diagnóstico → bloque de sesión** (usar `exerciseMatching` que ya existe; falta la acción de UI/store que lo materializa).
- **Timeline protagonista**: exponer `patternDetection` (repetido/mejora/retroceso) como pantalla central, no card.
- **Métricas del shape explicadas**: cada métrica con su rango "bueno/riesgo" en Lineup Lab y en la salida del Coach.
- Higiene de presentación (idioma, empty states, jerarquía) — del UI plan, en paralelo.
- **Resultado:** el loop se *ve* y se *recorre* completo por primera vez.

### 30 días — Game Model Builder + Fit Intelligence (el salto a "premium")
- **Game Model Builder**: schema editable (principios def/of, presión, bloque, salida, transiciones, ABP, riesgos aceptados, identidad), UI de edición, persistencia, e inyección estructurada al Coach reemplazando la config estática.
- **Coach comparativo**: el diagnóstico marca explícitamente "coincide / contradice tu modelo de juego" con evidencia.
- **Player Fit Intelligence**: reglas perfil→ajuste sobre los atributos del plantel (ya existen: speed/pass/duel/tactical/press); el Coach veta ajustes que el perfil no sostiene.
- **Pattern Intelligence v2**: reemplazar keyword-matching por clasificación semántica (reusar el RAG existente) para mejoras/regresiones reales.
- **Resultado:** deja de ser "IA que opina" y pasa a "IA que mide tu equipo contra tu idea".

### 90 días — Simulador + Scout (el salto a "líder")
- **Tactical Scenario Simulator**: motor de "qué pasa si" sobre shape + plantel + modelo, con impacto por línea y ejercicios para validar.
- **Opponent Scout Lite**: carga simple del rival → plan de partido + foco de entrenamiento + alertas.
- **Exportables premium** (plan de partido, briefing para jugadores).
- **Memoria validada con capas + personalidad del asistente.**
- **Resultado:** capacidades que ningún producto le da hoy a un DT amateur.

### 6 meses — Plataforma y evolución
- Multi-equipo / multi-temporada (requiere repensar persistencia local → posible backend).
- Evolución del equipo como narrativa de temporada.
- Biblioteca extensible (tus propios ejercicios) con taxonomía rica.
- Posible captura de evidencia desde video (tagging que alimenta evidencia, NO análisis automático).
- **Resultado:** de herramienta de semana a plataforma de temporada.

---

## 8. Priorización (impacto / esfuerzo / riesgo / valor comercial / diferenciación)

Escala 1-5 (5 = alto). "Dif." = cuánto te separa del mercado.

| Feature | Impacto | Esfuerzo | Riesgo | Valor com. | Dif. | Veredicto |
|---|---|---|---|---|---|---|
| Cerrar diagnóstico→sesión | 5 | 2 | 1 | 4 | 3 | **Hacer ya** (casi hecho) |
| Timeline protagonista | 4 | 2 | 1 | 4 | 4 | **Hacer ya** |
| Métricas explicadas | 4 | 2 | 1 | 3 | 3 | **Hacer ya** |
| **Game Model Builder** | 5 | 4 | 3 | 5 | 5 | **Apuesta central** |
| Player Fit Intelligence | 5 | 3 | 3 | 4 | 5 | **Apuesta central** |
| Pattern Intelligence v2 | 4 | 3 | 3 | 4 | 4 | Alta |
| **Scenario Simulator** | 5 | 5 | 4 | 5 | 5 | **Apuesta v2** |
| Opponent Scout Lite | 4 | 3 | 2 | 4 | 4 | Alta |
| Lineup básico/avanzado | 3 | 3 | 2 | 3 | 3 | Media |
| Exportables premium | 3 | 2 | 1 | 4 | 2 | Quick comercial |
| Memoria con capas | 4 | 3 | 2 | 3 | 4 | Media-alta |
| Cablear 3 temas UI | 2 | 1 | 1 | 3 | 2 | Quick demo |

Orden estratégico: **loop visible (7d) → Game Model + Fit (30d) → Simulador + Scout (90d).**

---

## 9. Features nuevas propuestas (detalle)

**A. Game Model Builder (la apuesta).** Schema editable por equipo con secciones: identidad, principios defensivos/ofensivos, presión (altura + gatillos), bloque, salida, transición def/of, ABP, riesgos aceptados. El Coach recibe este modelo estructurado (no string) y en cada diagnóstico/reporte emite una línea de *contraste*: "tu modelo pide presión tras pérdida; los últimos 3 reportes muestran repliegue bajo y distancia alta entre líneas → desvío". Convierte la app en un **espejo del proyecto del DT**. Reemplaza `TEAM_IDENTITY`/`FOOTBALL_IDENTITY` estáticos.

**B. Tactical Scenario Simulator.** Selector de decisión (cambiar sistema, subir/bajar bloque, rol del 5, tercer central, liberar lateral, presión alta, juego directo, comportamiento tras pérdida). Salida estructurada: beneficio esperado, riesgo, impacto por línea, jugadores beneficiados/perjudicados, métricas del shape resultante (usa `shapeMetrics`), y ejercicios para probarlo (usa `exerciseMatching`). Razona contra modelo + plantel + evidencia. Es el "what-if" que ningún producto barato ofrece.

**C. Opponent Scout Lite.** Form simple del rival (sistema, presión, salida, fuertes, vulnerabilidades, ABP, jugadores clave, riesgos) → la app genera plan de partido, foco de entrenamiento de la semana, preguntas para el staff y alertas tácticas. Conecta scout con el microciclo.

**D. Player Fit Intelligence.** Reglas perfil→ajuste sobre atributos existentes: central lento + bloque alto = riesgo a la espalda; 5 con mal perfil de recepción = evitar salida interior bajo presión; lateral ofensivo + extremo que no repliega = riesgo en banda; 9 aislado = ajustar apoyos. El Coach *veta o condiciona* ajustes según el plantel real.

**E. Memoria validada con capas + personalidad.** Distinguir visiblemente identidad / memoria validada / evidencia actual / inferencia, con confianza por capa. El asistente recuerda "cómo dirige este DT" (riesgos que acepta, lenguaje) y suena a ayudante de campo, no a chatbot.

---

## 10. Mejoras profundas de features existentes

- **Coach Agent → asistente central**: salida progresiva (lectura/causa/ajuste primero; riesgos/citas/reflexión en "ver más"), contraste contra modelo de juego, veto por fit, y tono de cuerpo técnico. Anti-invención reforzada con el `evidenceAudit` ya existente + cap de confianza.
- **Lineup Lab → herramienta central**: modo básico (arrastrar + métricas explicadas) vs avanzado (transiciones/comparador/atajos), alertas automáticas (bloque demasiado alto para el perfil, ancho excesivo, líneas partidas), comparación de shapes lado a lado, export para jugadores.
- **Sessions → generador de semana**: de planner manual a "diagnóstico → microciclo" (qué entrenar, cuándo en MD-x, con qué carga, qué ejercicios de `exerciseMatching`, qué errores corregir, qué señales mirar el sábado).
- **Biblioteca → rankeable por diagnóstico**: enriquecer taxonomía (problema que corrige, cuándo usarlo, contraindicaciones, dificultad) + miniaturas de escena 3D + ranking por diagnóstico (ya hay base en `exerciseMatching`).
- **Post-match → dual + comparativo**: modo simple/avanzado, contraste contra modelo, "qué entrenar esta semana", resumen para jugadores y para staff, memory candidates (ya existen).
- **Pattern Intelligence → protagonista**: timeline con problemas recurrentes, no entrenados, por rival, y relación sesión→mejora.

---

## 11. Qué NO construir todavía

- **Análisis automático de video / tracking por CV.** Caro, lento, y compite de frente con Veo/Hudl donde no podés ganar. Más adelante, y solo como *fuente de evidencia*, no como núcleo.
- **Backend multiusuario / SaaS en la nube.** Hasta validar el loop con usuarios reales, la persistencia local alcanza. Construirlo ahora es deuda sin retorno.
- **Marketplace de ejercicios / comunidad.** Distrae del core.
- **App móvil nativa.** Responsive web primero.
- **Integraciones (federaciones, wearables).** Prematuro.

---

## 12. Qué SÍ construir aunque sea ambicioso

- **Game Model Builder** — es el corazón del diferencial. Difícil de copiar porque requiere el resto del loop para tener sentido.
- **Scenario Simulator** — el "wow" vendedor. Aunque sea v2, diseñar su data model desde ya.
- **Player Fit Intelligence** — alto valor, esfuerzo medio, usa datos que ya existen.

Estos tres, juntos, son lo que convierte "otra pizarra con IA" en "el cerebro táctico del equipo".

---

## 13. Cambios necesarios por módulo

| Módulo | Cambio |
|---|---|
| **Coach Agent** | Recibir Game Model estructurado + reglas de fit; emitir contraste vs modelo; salida progresiva; tono de staff. |
| **Game Model** | De `TEAM_IDENTITY`/`FOOTBALL_IDENTITY` estáticos → schema Zod editable, persistido, por equipo. |
| **Evidence/Patterns** | `patternDetection` semántico (RAG) en vez de keywords; "problemas no entrenados" cruzando con sesiones. |
| **Lineup Lab** | Modos básico/avanzado, alertas automáticas, comparador, métricas explicadas, export jugador. |
| **Sessions** | Generador de microciclo desde diagnóstico (qué/cuándo/carga/ejercicios/señales). |
| **Biblioteca** | Taxonomía rica + miniaturas + ranking por diagnóstico. |
| **Post-match** | Modo simple/avanzado, contraste vs modelo, resúmenes jugador/staff. |
| **Memoria** | Capas explícitas + validación + "personalidad" del DT. |
| **Nuevos** | Scenario Simulator, Opponent Scout, Fit Intelligence. |
| **UI** | Tactical Command Center, navegación por loop, evidencia/confianza visibles, onboarding, exportables. |

---

## 14. Archivos / áreas probables a tocar

- **Game Model**: nuevo `src/data/gameModelSchema.ts`, `src/team/GameModelBuilder.tsx`, reemplazo de `src/ai/teamIdentity.ts` + `FootballIdentity.ts`, inyección en `src/ai/CoachAgent.ts` (`formatCoachingStaffContext`), persistencia en `useAppStore.ts` + `db.ts`.
- **Fit Intelligence**: nuevo `src/ai/playerFit.ts` (reglas sobre `src/data/players.ts` / `PlayerSchema`), consumo en `CoachAgent` y simulador.
- **Simulator**: nuevo `src/ai/scenarioSimulator.ts` + `src/team/ScenarioSimulator.tsx`, reusa `shapeMetrics.ts` y `exerciseMatching.ts`.
- **Scout**: nuevo `src/scout/OpponentScout.tsx` + schema + conexión a `CoachAgent`/Sessions.
- **Pattern v2**: `src/ai/patternDetection.ts` + RAG (`retrievalScoring.ts`).
- **Sessions generator**: `src/sessions/SessionsView.tsx`, `useAppStore.ts`, `exerciseMatching.ts`.
- **Timeline**: `src/home/TeamTimeline.tsx` → pantalla propia.
- **UI/tokens**: consolidar `theme.css` + `tactical-ui.css`, cablear `data-theme`.
- **Schemas centrales**: `src/ai/CoachSchemas.ts` (modos, contraste vs modelo), `src/data/schemas.ts`.

---

## 15. Riesgos técnicos

- **Calidad del LLM en lo nuevo**: el contraste vs modelo, el simulador y el fit son tan buenos como el prompt. Riesgo de invención. Mitigación: estructura de salida con `evidenceAudit`, cap de confianza, y reglas determinísticas (fit, métricas) en código, no en el modelo.
- **Keyword-matching frágil** (`exerciseMatching`, `patternDetection`, clasificación de dominios) escala mal. Mitigación: migrar a RAG/semántico el que más duela primero (patrones).
- **Costo/latencia** con modelo `:free` si se suman llamadas (simulador, scout). Mitigación: una llamada por acción, reusar retrieval, considerar modelo pago para features premium.
- **Persistencia local** topa con multi-equipo/temporada. Mitigación: diseñar el Game Model con multi-team en mente aunque se guarde local.
- **Acoplamiento de archivos gigantes** (`LineupLab3D` 1914, `PostMatch` 1359, `useAppStore` 1118). Mitigación: extraer a `lib/` antes de sumar features ahí.
- **Build/OneDrive**: el `build` falla por `rimrafSync` sobre `dist/` en carpeta sincronizada. Resolver (sacar repo de OneDrive) antes de cualquier release.

---

## 16. Riesgos de producto

- **Sobre-ingeniería antes de validar**: construir simulador/scout sin que nadie use el loop básico. Mitigación: 7 días primero, validar con DT reales.
- **Abrumar al DT amateur**: cada feature nueva agrega superficie. Mitigación: modo básico por defecto, avanzado opt-in; progresividad en todo.
- **Confianza mal calibrada**: si el Coach se equivoca con seguridad una vez, se pierde la confianza para siempre. Mitigación: confianza/evidencia siempre visibles, "no sé" como respuesta válida.
- **Diferenciación no percibida**: si el usuario no *ve* el loop ni la evolución, parece otro chatbot. Mitigación: Timeline y contraste vs modelo como protagonistas visuales.
- **Posicionamiento difuso**: si intenta competir con Hudl/Veo, pierde. Mitigación: clavar "para el cuerpo técnico chico, el loop completo, local y barato".

---

## 17. Cómo medir si realmente mejoró

- **North Star**: loops cerrados por equipo por semana.
- **Retención táctica**: % de problemas diagnosticados que mejoran/desaparecen en reportes siguientes (vía `patternDetection`).
- **Adherencia al modelo**: % de diagnósticos que el DT marca como "coincide con mi idea" vs "no la veía así".
- **Confiabilidad**: % de respuestas del Coach con evidencia citada vs afirmaciones sin respaldo; calibración confianza declarada vs corrección del staff.
- **Activación**: tiempo hasta el primer loop cerrado de un usuario nuevo.
- **Valor percibido**: "¿esto lo pagarías?" con 5-10 DT reales; disposición a pagar por v1 premium.
- **Uso del simulador/scout**: % de partidos preparados con scout; % de ajustes simulados antes de aplicarse.

---

## 18. Plan de implementación posterior por fases

**Fase 0 — Estabilidad y base (días):** resolver build/OneDrive; extraer `computeMetrics` y lógica pesada de los componentes gigantes a `lib/`; consolidar tokens CSS. (Habilita todo lo demás sin riesgo.)

**Fase 1 — Loop visible (7 días):** cerrar diagnóstico→sesión; Timeline protagonista; métricas explicadas; higiene de presentación. Gate: un DT recorre el loop completo sin guía.

**Fase 2 — Cerebro comparativo (30 días):** Game Model Builder (schema → UI → persistencia → inyección al Coach); contraste vs modelo; Player Fit Intelligence; Pattern v2 semántico. Gate: el Coach mide al equipo contra el modelo del DT con evidencia.

**Fase 3 — Simulación y proyección (90 días):** Scenario Simulator; Opponent Scout Lite; exportables premium; memoria con capas + personalidad. Gate: el DT prueba decisiones y prepara partidos dentro de la app.

**Fase 4 — Plataforma (6 meses):** multi-equipo/temporada (y evaluar backend), narrativa de evolución, biblioteca extensible, evidencia desde video. Gate: uso sostenido a lo largo de una temporada.

Regla de oro entre fases: **no avanzar a la siguiente sin validar el loop de la anterior con usuarios reales.** La ambición es en la visión; la disciplina es en la secuencia.

---

## Resumen en una línea

El producto ya tiene el esqueleto del loop. El salto no es pulirlo: es darle un **modelo de juego vivo**, **fit del plantel**, **simulación de decisiones** y **scout del rival** — las cuatro cosas que convierten un asistente que opina en el cerebro táctico del cuerpo técnico, y que nadie le ofrece hoy al técnico que dirige los sábados.
