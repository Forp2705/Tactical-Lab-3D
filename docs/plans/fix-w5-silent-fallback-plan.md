# W5 — Fallback silencioso de selectedExerciseId fuera del visor (mc-19)

Branch `fix/w5-silent-fallback`, base `origin/main @ 864f51a` (incluye el fix del
viewer de W4, PR #30, ya mergeado).

## Call sites enumerados (los 3 archivos del brief + lo que aparece al grep)

`grep -n "getExerciseById" src/home/HomeView.tsx src/ui/AppShell.tsx
src/library/LibraryView.tsx` da 4 call sites, no 3 — `HomeView.tsx` tiene dos
independientes:

1. `src/home/HomeView.tsx:60` (componente `HomeView`, usado en linea 436-442)
   — card "Ejercicio actual" (eyebrow "Biblioteca"): titulo, fase/principio y
   rango de jugadores del `selectedExerciseId` global.
2. `src/home/HomeView.tsx:1213` (componente `SessionCard`, memo aparte) — lista
   de hasta 4 bloques de la sesion activa; por bloque llama
   `getExerciseById(block.exerciseId)` de forma INDEPENDIENTE del guard de
   `SessionBlockCard` en `SessionsView.tsx` (ese guard solo cubre el planner
   completo, no este preview de Home). Mismo patron, mismo riesgo: bloque con
   id retirado se ve reemplazado en silencio por catalog[0] en vez de mostrar
   "Ejercicio retirado".
3. `src/ui/AppShell.tsx:64` (usado en linea 164) — top-stat-strip del header,
   "Actual: {selectedExercise.players.min}v". Es el sitio de menor superficie:
   un solo numero.
4. `src/library/LibraryView.tsx:153` (usado en lineas 425-501) — panel de
   detalle completo (titulo, fase, principio, jugadores, duracion, objetivo,
   organizacion, exito, coaching points, errores) MAS dos botones de accion
   que operan sobre `selected.id`: "Agregar a sesion"
   (`useAppStore.getState().addToSession(selected.id)`, linea 490) y "Crear
   copia editable" (`handleCreateEditableCopy`, linea 158-176, que llama
   `createExerciseVariantFrom(selected.id, ...)`). Este es el mas grave de los
   3 no-viewer: con un id retirado, esos botones agregarian/clonarian
   `catalog[0]` — una mutacion de datos equivocada, no solo un display
   incorrecto.

`AiView.tsx` queda fuera (usa `getExerciseById` en linea 138, mismo patron,
pero la restriccion no-tocar-IA del brief W4/W5 lo excluye explicitamente).
Documentado, no tocado.

## Decision de diseno — reuso, no helper paralelo

`resolveViewerSelection` (src/app/viewerSelection.ts) tiene una firma con
`viewerExerciseOverride`, un concepto exclusivo del visor (exercise inyectado
por LineupLab). Los 3 archivos de esta ola no tienen ese concepto. Extraje el
nucleo de resolucion a una funcion nueva en el MISMO archivo,
`resolveExerciseSelection(id, exercises) -> { exercise, missing }`, y reescribi
`resolveViewerSelection` para que la llame por dentro. Mismo archivo, misma
semantica (`missing: true` si el id no esta en `exercises`, fallback a
`catalog[0]`), sin segundo helper paralelo. `resolveViewerSelection` mantiene
firma y comportamiento identicos — cero impacto en `App.tsx` ni en
`tests/viewerSelectionFallback.test.ts` existente.

## Tratamiento por vista (honesto, minimo, consistente con lo que ya existe)

- **LibraryView (site 4)** — mismo patron visual que el visor: banner
  `alert-row warn` (misma clase que uso el fix de W4) arriba del panel de
  detalle cuando `missing`, mismo texto "El ejercicio seleccionado ya no esta
  disponible... Mostrando X en su lugar." ADEMAS deshabilito los botones
  "Agregar a sesion" y "Crear copia editable" cuando `missing` (con `title`
  explicando por que) — evita la mutacion silenciosa sobre el ejercicio
  equivocado, que es el riesgo real de este sitio, no solo el texto.
- **HomeView site 1 (card "Ejercicio actual")** — mismo patron que Library:
  cuando falta, el titulo se reemplaza por "Ejercicio retirado del catalogo" en
  `--warn` y el chip de jugadores por un chip de aviso ("!"). Nivel de detalle
  menor que Library porque es un preview de 2 lineas, no un panel completo.
- **HomeView site 2 (SessionCard, filas de bloques)** — mismo texto que ya usa
  el guard de `SessionsView.tsx` ("Ejercicio retirado del catalogo"), en vez
  del titulo, para consistencia dentro de la app con el mismo tipo de dato
  (session block). No agrego boton de reemplazo 1-click aca (eso ya vive en el
  planner completo via `SessionsView`) — este es un preview de solo lectura,
  agregar esa accion aca duplicaria logica de reemplazo en un segundo lugar.
- **AppShell (site 3)** — la vacia explicita que sugiere el brief: cuando
  falta, el numero se reemplaza por `-`, igual que el fallback existente
  `selectedExercise?.players.min ?? "-"` para cuando no hay seleccion. No hay
  espacio en ese chip de una palabra para un mensaje, asi que "sin dato"
  honesto es mejor que inventar un tercer texto.

Ningun sitio muestra el titulo/stat de OTRO ejercicio sin marca visible. Nadie
crashea; todos degradan a un estado explicito.

## Archivos tocados

- `src/app/viewerSelection.ts` — nueva `resolveExerciseSelection` (extraida),
  `resolveViewerSelection` reescrita en terminos de ella (firma sin cambios).
- `src/home/HomeView.tsx` — usa `resolveExerciseSelection` en `HomeView` (site
  1) y en `SessionCard` (site 2, requiere suscribir `exerciseVariants` ahi,
  no estaba suscripto).
- `src/ui/AppShell.tsx` — usa `resolveExerciseSelection` (site 3, requiere
  suscribir `exerciseVariants`, no estaba suscripto).
- `src/library/LibraryView.tsx` — usa `resolveExerciseSelection` (site 4),
  banner + botones deshabilitados condicionales.
- `tests/viewerSelectionFallback.test.ts` — extendido con
  `resolveExerciseSelection` (id retirado, id inexistente arbitrario, id
  vigente, variante local homonima).

Nota de proceso: `HomeView.tsx`, `LibraryView.tsx` y `AppShell.tsx` ya tenian
drift de formato de `biome` antes de esta ola (import order y algunos
wraps, no relacionado a W5). Un primer intento de aplicar
`biome check --write` a los 3 archivos completos infló el diff a ~850 lineas
por reformatear TODO el archivo, no solo lo tocado — lo deshice (reset +
reescritura quirurgica de solo las lineas cambiadas) para respetar "diffs
chicos" del brief. El diff final de estos 3 archivos son 16/61/27 lineas
respectivamente; quedan 5 errores de `biome check` preexistentes, ninguno en
lineas que edite.

## Verificacion

- `npm run type-check`, `npm run build` — ambos limpios.
- `npm test -- --run` — 616 pass / 3 todo (611 pass desde W4+PR#30, +5 tests
  nuevos: `resolveExerciseSelection` con id vigente, id retirado, id
  inexistente, variante local homonima, y equivalencia con
  `resolveViewerSelection`).
- Verificacion viva: Playwright contra `npm run dev` (puerto 5174, 5173
  ocupado por otro worktree). Primer intento mutando IndexedDB directo desde
  afuera de la app fallo — el tab ya montado tiene su propio autosave
  (interval 8s + `pagehide`/`visibilitychange`) que reescribe el snapshot con
  el estado en memoria (sin mutar) apenas la pestaña navega/se oculta,
  pisando la mutacion externa antes de que la nueva carga la lea. Lo resolvi
  mutando el store EN VIVO via `import('/src/state/useAppStore.ts')` desde
  `page.evaluate` (mismo modulo ESM que ya tiene montada la app, dev server
  de Vite sirve el mismo grafo de modulos) y `useAppStore.setState(...)` con
  `selectedExerciseId: "posesion-6v3-hombre-libre"` y un bloque de sesion con
  ese mismo id. Confirmado por screenshot + DOM-check, sin errores de
  consola:
  - Home / card "Ejercicio actual": "Ejercicio retirado del catalogo" en
    `--warn` + chip "!" (antes: catalog[0] silencioso).
  - Home / SessionCard: fila "01 — Ejercicio retirado del catalogo — 15 min"
    en `--warn` (antes: titulo/objetivo de catalog[0]).
  - AppShell / top-stat-strip (vista Biblioteca): "Actual -v" (antes: numero
    de catalog[0]).
  - LibraryView / panel de detalle: banner `alert-row warn` con el titulo del
    reemplazo, y botones "Agregar a sesion" / "Crear copia editable"
    confirmados `disabled: true` con el `title` correcto via
    `document.querySelectorAll('.detail-panel .toolbar button')`.
  - Regresion: `selectExercise('rondo-4v2-salida')` (id vigente) hace
    desaparecer el banner y reactiva los botones — sin falsos positivos.

## Riesgos

- `resolveExerciseSelection` resuelve contra `[...catalog, ...exerciseVariants]`
  en los 4 sitios, igual que hacia `getExerciseById` — mantiene el mismo
  universo de ids validos que antes, no cambia que cuenta como "encontrado".
- No toque `AiView.tsx` (fuera de alcance) ni el flujo del viewer ya mergeado
  salvo el reuso interno de `viewerSelection.ts`.
