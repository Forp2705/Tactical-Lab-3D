# PLAN — W2 UX containment

Branch: `fix/w2-ux-containment` desde `origin/main` @ `bca458d`. Contencion acotada, NO reskin, NO logica.

## Metodo

`npm run dev` + Playwright (contexto nuevo, IndexedDB limpia) contra el estado real de cada componente. Se prioriza lectura de codigo + grep de CSS existente para confirmar con certeza que hallazgos como "clase sin estilo" son hechos verificables, y se corrobora en vivo cuando el costo es bajo.

## Estados revisados y veredicto

### 1. `TacticalBoardGhostSceneState` — SIN CAMBIOS
Reusa integramente las clases `.rombo-board-empty` / `.rombo-board-empty-actions` / `.primary` (`theme.css:5895-5917`), ya estilizadas: eyebrow verde, h2 28px, boton primario con fondo. Copy en espanol, sobrio, con una sola accion clara ("Abrir la primera escena"). No hay texto tecnico ni de dev. Verificado por lectura de codigo + CSS existente; no se forzo el estado en vivo (mismo componente/clases que el estado vacio de tablero, ya validado visualmente en tareas previas de esta misma ola de fixes).

### 2. `TacticalBoardErrorBoundary` — SIN CAMBIOS
Misma familia de clases `.rombo-board-empty`. Copy honesto y tranquilizador ("Tu trabajo guardado no se perdio; recarga la pizarra para intentar de nuevo"), accion de recarga visible ("Recargar la pizarra"). `componentDidCatch` solo loguea a consola (no hay logica de UI que tocar). Reviewed por codigo; no se forzo un throw en vivo por acotar el timebox (~40 min) dado que no hay clases nuevas sin estilo en este componente (mismo riesgo que el item 1).

### 3. `TacticalBoardAiPanel` — panel de bridge de estado libre — TOCADO
Verificado EN VIVO (Playwright, board demo, escena "Respuesta inicial"):
- El resumen pre-ask (`freeStateSummary`, clase `.rombo-freestate-summary`) SI se leia como debug: confirmado por grep que `rombo-freestate-*` no tenia NINGUNA regla en `theme.css`/`tactical-ui.css` (cero coincidencias), a diferencia de su analogo `.rombo-scenario-*` que si tiene estilos dedicados. Computed style confirmaba `padding-left: 40px` + `list-style-type: disc` (default de navegador), inconsistente con `.rombo-ai-list` (mismo panel, misma seccion "Que entiende RomboIQ", ya usa `padding-left: 18px` + color/tamano propios).
- El boton "Consultar al coach sobre esta escena" (`.rombo-freestate-ask-coach`) tampoco tenia clase propia: heredaba solo el estilo generico `button` global (mismo aspecto que cualquier boton sin clase). No compite mal con "Probar un ajuste" en terminos de orden (aparece antes, como pide el flujo), pero no se distingue visualmente como un CTA secundario intencional.
- Modo pregunta (`selectedQuestions`) verificado en vivo: la consulta real devolvio 3 preguntas (`.rombo-freestate-coach-questions` > `li` > `.rombo-freestate-coach-question-text` + `.rombo-freestate-coach-question-why`), tambien sin CSS — mismo problema.
- Fix: agregar reglas CSS quirurgicas para las 8 clases `rombo-freestate-*` siguiendo la convencion visual ya establecida en el mismo panel (`.rombo-ai-list` para listas simples, `.rombo-scenario-*` para el patron de pregunta/respuesta con boton+error+answer). Sin tocar JSX/logica del componente. El gemelo `.rombo-scenario-coach-*` (flujo de escenario) queda EXPLICITAMENTE fuera de este pase: el propio codigo lo marca como "registered debt" de una gate anterior (mc-99), y el brief solo pide revisar el estado nuevo de ola 2 (free-state), no reabrir ese scope.

### 4. Resumen de contexto del coach en `AiView` (`CoachContextSummary`, de FIX 5 / ola 1) — SIN CAMBIOS
Verificado EN VIVO tras publicar un shape desde Evolucion: `textContent` = "Contexto del coach / Shape 4-3-3 publicado / Formacion 4-3-3 / Plantel 11/12 / Rival presente". Lectura clara para un DT, sin jerga tecnica, sigue funcionando igual despues de los cambios de ola 2 (el bridge de board no toca este componente). Sin regresion.

### 5. Viewer post-encuadre (top framing) — SIN CAMBIOS (revision acotada)
Verificado en vivo: canvas de un ejercicio en vista top renderiza a pantalla completa dentro de `.canvas-wrap` sin bandas de letterbox ni overflow (bounding boxes practicamente identicas, 680x638 sobre 682x640). Sin errores de consola (solo warnings de driver GPU sobre `ReadPixels`, genericos del entorno headless, no relacionados a codigo de la app). `Scene3D.tsx`/`topFraming.ts` estan fuera de mi scope permitido (no son `theme.css`/`tactical-ui.css` ni componentes nuevos de board) asi que aunque hubiera hallazgo no lo tocaria — se declara sin cambios porque ademas no se encontro nada roto en los chequeos disponibles. Nota de honestidad: no se pudieron recuperar los archivos de screenshot del sandbox de Playwright para comparacion pixel a pixel (limitacion de entorno ya vista en tareas anteriores); la verificacion se hizo por mediciones DOM (bounding rects) y consola.

## Cambios a implementar

Solo `src/app/theme.css`: bloque nuevo `rombo-freestate-*` al final del archivo, sin tocar ninguna otra regla existente. Sin cambios de `.tsx` (ni logica ni microcopy: el texto actual del panel de bridge ya es claro).

## Guard EOL
`git diff --stat` antes de cada commit; solo se espera una adicion de bloque al final de `theme.css`.

## Validacion
- Gate global: `npm run type-check && npm run build && npm test -- --run`.
- Antes/despues en vivo del panel de bridge (computed styles + snapshot de accesibilidad ya tomados arriba como "antes"; se vuelve a verificar despues del cambio).
