# W5 fix — 3 items de estabilidad de la Pizarra

Base: origin/main @ 864f51a. Branch: fix/w5-board-stability. 3 items independientes,
commit separado por item.

## Item 1 (P0) — ZodError title>120 mata "Crear desde foco semanal" en silencio

### Causa raiz

`src/board/boardModel.ts:303` — `TacticalBoardSchema.title` tiene `z.string().min(1).max(120)`.

`src/board/boardModel.ts:365-373` (`createDefaultBoard`) construye `cleanTitle` asi:
```
const cleanTitle =
    title.trim() ||
    options?.weeklyThread?.problem?.slice(0, 100) ||
    "Pizarra tactica";
```
Si `title` (primer arg) viene no-vacio pero largo, `title.trim()` es truthy y gana — sin
truncar. `createTacticalBoardFromWeeklyFocus` (`src/state/useAppStore.ts:989-1005`) llama
`createDefaultBoard(state.weeklyDecisionThread?.problem || "...")`. `weeklyDecisionThread.problem`
es un `string` sin limite de longitud (`src/state/weeklyDecisionThread.ts:27,36`; puede salir de
`advice.tacticalReading.trim()`, potencialmente un parrafo largo). Con problem largo,
`TacticalBoardSchema.parse(...)` (linea 385) tira ZodError.

Los dos call sites (`HomeView.tsx:157`, `TacticalBoardView.tsx:54` via
`TacticalBoardEmptyState`) llaman la store action directo en el `onClick`, sin try/catch. El
throw es un uncaught exception dentro del handler: no crashea la app entera (no es fase de
render) pero tampoco hay ningun `set()` que corra despues del throw — el board nunca se crea,
`view` no cambia a "board", y no hay ningun aviso visible. Boton "muere mudo".

### Fix

1. Truncar en el punto de generacion del title, ANTES de `.parse()` — NO tocar el `max(120)`
   del schema (decision de producto fuera de scope esta ola; persistencia/PDF/UI ya asumen 120).
   En `createDefaultBoard`: cap `cleanTitle` a 120 chars con un slice + sufijo razonable si se
   trunca (evita cortar a mitad de palabra sin aviso de que se corto).
2. Defensa adicional (no el P0, pero pedida por el brief): envolver el cuerpo de
   `createTacticalBoard` y `createTacticalBoardFromWeeklyFocus` en try/catch. Si algo more
   inesperado sigue fallando el parse, `console.error` con detalle y no propagar — sin agregar
   un sistema de toasts (fuera de scope). Los dos call sites ignoran el valor de retorno hoy, asi
   que devolver `""` en el catch es seguro.
3. Test que fija el contrato: title de weeklyThread.problem > 120 chars -> board creado con
   title <= 120 y no vacio.

## Item 2 — duplicate-key en "Que entiende RomboIQ" (zone findings)

### Causa raiz

`src/board/productBoardTypes.ts:166-233` (`inferAiInterpretation`) devuelve `string[]`. El
finding de zona (linea ~208) es `En ${zone.label}: ${own} propios vs ${rival} rivales.` — dos
zonas con label/conteo iguales (p.ej. dos zonas default "Zona" con la misma ocupacion) generan
el MISMO string. `src/board/components/TacticalBoardAiPanel.tsx:86-88` renderiza
`aiInterpretation.map((item) => <li key={item}>{item}</li>)` — key = texto -> colision.

Restriccion: `inferAiInterpretation` tambien alimenta `BoardPayload.aiInterpretation: string[]`
(el JSON exportable via "Exportar payload (JSON)", contrato externo probado en
`tests/boardProductPayload.test.ts` y `tests/productBoardReading.test.ts`). Cambiar su firma a
objetos rompe ese contrato y esos tests sin necesidad — fuera de scope de este item.

### Fix (sin tocar el contrato de payload)

Separar construccion de presentacion:
- Refactor interno: `inferAiInterpretation` pasa a ser un wrapper delgado sobre una nueva
  funcion `inferAiInterpretationFindings(...)` que devuelve `{ id: string; text: string }[]`
  (mismo cuerpo/logica, cada `findings.push(string)` pasa a
  `findings.push({ id, text })` con id derivado del origen real: `link:${arrow.id}`,
  `target:${arrow.id}`, `zone:${zone.id}` (el pedido explicito: id estable de la zona), y una
  clave literal fija para cada rama de degradacion honesta (a lo sumo una esta presente a la
  vez, no colisiona).
  `inferAiInterpretation(input) { return inferAiInterpretationFindings(input).map(f => f.text); }`
  — el contrato string[] existente (tests + payload) sigue exactamente igual.
- `src/board/useBoardActions.ts`: el `aiInterpretation` memoizado que alimenta el panel pasa a
  usar `inferAiInterpretationFindings` (rico, con id). El unico otro consumidor de esa variable
  es `createPayload` (linea ~232) que arma el payload exportable — ahi se mapea a
  `.map(f => f.text)` antes de pasarlo a `buildBoardPayload` para no filtrar el shape rico al
  JSON export.
- `TacticalBoardAiPanel.tsx`: prop `aiInterpretation` pasa a `{id: string; text: string}[]`;
  render usa `key={item.id}` y pinta `item.text`.

Cero tests existentes tocados (el contrato string[] de `inferAiInterpretation` y de
`BoardPayload.aiInterpretation` no cambia).

## Item 3 — VEREDICTO: drag directo de zonas

### Hallazgo

En `TacticalBoardCanvas.tsx`, el `<g data-board-target>` de cada zona (linea ~212-220) solo
wirea `onSelect({kind:"zone", id})` en su `onPointerDown` — a diferencia de
`BoardObjectNode` (tokens/pelota/nota/equipamiento, linea ~393+) que llama
`onPointerDown(pointFromSvgEvent(event), object.id)`, el gancho que en
`useBoardActions.ts:onCanvasPointerDown` (linea ~534-552) arranca el drag
(`setDrag({id, before, offset})`) para `tool === "move" || "select"`. Esa rama busca el target
SOLO en `scene.objects.find(...)` — las zonas viven en `scene.zones`, un array distinto, asi
que ni siquiera si la zona disparara ese callback el lookup las encontraria hoy.

**Correccion a un supuesto del brief**: el brief asume "zonas se reposicionan via Inspector"
como la via alternativa. Revisando `ZoneInspector` en
`TacticalBoardInspectorPanel.tsx:236-286`, los unicos campos editables son **semantic (tipo),
label y tacticalMeaning (intencion)** — no hay ningun campo x/y/w/h. No existe HOY ninguna via
para reposicionar una zona ya creada, ni por drag ni por inspector. La unica forma de corregir
la posicion de una zona es borrarla y recrearla en el punto correcto.

### Veredicto: BUG DE AFFORDANCE (no by-design), pero NO trivial — decision de producto para
la ola siguiente

Evidencia de que es un gap, no una decision deliberada:
- El patron de drag para tokens ya existe y es generico en la forma (`drag` state con
  `before`/`offset`); zonas simplemente nunca conectaron su `<g>` a ese mismo callback.
- No hay ningun comentario en el codigo ni commit en `git log` de
  `TacticalBoardCanvas.tsx`/`useBoardActions.ts` que explique una exclusion intencional de
  zonas del drag (revisado: `abca0b6`, `34e2de2`, `9788a45`, `7755a0e`, `c93215c`, `1bd310a` —
  ninguno discute zona-drag como decision, `34e2de2` es el fix de escala Y, no de interaccion).
- Si fuera by-design, se esperaria una via alternativa completa (inspector con x/y/w/h) como
  compensacion — no existe.

Por que NO lo implemento esta ola (SIN inventar comportamiento):
- El fix real no es 1 linea: requiere (a) que el `<g>` de zona dispare un pointer-down
  equivalente al de tokens sin romper la seleccion actual (que tambien vive ahi), (b) estado de
  drag paralelo para zonas en `useBoardActions.ts` (offset sobre x/y del rect, no sobre un
  cx/cy como los tokens), (c) manejar la variante circulo (cx,cy calculado) vs rect (x,y) del
  shape de zona, (d) historial (undo/redo) del drag de zona igual que el de tokens, (e) tests
  nuevos. Estimacion: comparable en tamano al drag de tokens ya existente — no calza en "diff
  chico" de esta ola.
- Es una decision de producto (¿vale la pena drag fino de zonas, o el flujo
  crear-en-el-punto-correcto/borrar-y-recrear alcanza para el uso real de zonas tacticas?) que
  no me corresponde resolver improvisando un mini-fix a mitad de camino.

Recomendacion para W6: si se decide implementar, el camino mas barato es agregar x/y/w/h al
`ZoneInspector` (edicion numerica, reutiliza el patron ya existente de campos controlados) en
vez de drag directo — bastante mas chico que cablear un segundo sistema de drag en el canvas.

## Validacion

- npm run type-check, npm run build, npm test -- --run (611+ esperados: 601 previos + 1 test
  nuevo de item 1; item 2 no agrega tests nuevos, solo no rompe los existentes).
- Verificacion viva items 1 y 2 (Playwright, npm run dev) + regresion basica: dibujar (dos
  clicks), seleccionar, undo/redo, guardar.
