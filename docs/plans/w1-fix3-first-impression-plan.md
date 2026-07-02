# PLAN — FIX 3: Chooser de primer arranque + primera impresion honesta

Branch: `fix/w1-first-impression` desde `origin/main` @ `f004b81` (incluye FIX 4 mergeado).

## 0. Colision concurrente (FIX 5)

`TeamView.tsx` esta siendo editado en paralelo por otro worker en `coachContextFromShape` (~:905) y `publishShape` (~:176-183). Mis hunks en `TeamView.tsx` se limitan a JSX puramente presentacional en tres puntos:
- chip "en cancha" (linea 324 actual)
- header del lineup, el "· salida asimetrica" fijo (linea 322 actual)
- panel de banco (lineas 363-406 actuales)

No toco `publishShape`, `coachContextFromShape`, `addRosterPlayer` (la reutilizo tal cual, sin modificarla), ni ninguna funcion de construccion de contexto.

## 1. Predicado de "workspace virgen"

```
esVirgen = workspaceMode === "real"
        && team.players.length === 0
        && session.blocks.length === 0
        && reports.length === 0   // usePostMatchReports() ya filtra reportes semilla/demo cuando workspaceMode === "real" (usePostMatchReports.ts:41-47)
```

Los cuatro valores ya estan disponibles en `HomeView` (via `useAppStore` y el hook `usePostMatchReports` que `HomeView.tsx` ya importa). No hace falta ningun campo nuevo en el store ni en el snapshot: es una derivacion pura de estado que ya existe. `session.blocks` es `[]` por default en `createRealWorkspaceState()` (`useAppStore.ts:695-710`), `team.players` es `[]` en `initialTeam` (`useAppStore.ts:498-505`), y `reports` llega ya escopado a "reales" por `usePostMatchReports`.

Nota: si el usuario carga UN jugador (via "Empezar desde cero" -> "Agregar jugador"), `esVirgen` pasa a `false` de forma natural en el siguiente render (Zustand reactivo) — no hace falta logica adicional para "salir" del estado virgen.

## 2. Chooser (componente nuevo)

`src/home/FirstRunChooser.tsx` — overlay a pantalla completa, montado desde `HomeView` (import + render condicional al principio del arbol, no reemplaza nada existente).

Visibilidad: `esVirgen && !dismissedThisSession`. `dismissedThisSession` es estado de componente inicializado de forma lazy desde `sessionStorage.getItem("romboiq:first-run-chooser-dismissed") === "1"`.

- **"Explorar demo"**: llama a la accion YA EXISTENTE `useAppStore.getState().loadDemoWorkspace()` (`useAppStore.ts:1454-1462`, la misma que usa hoy `WorkspaceModeCard` en `HomeView.tsx:865-905`). No reimplemento la carga. Ademas marca `dismissedThisSession=true` + escribe el flag de sessionStorage (redundante con el cambio de `workspaceMode` a `"demo"`, que ya saca `esVirgen` de `true`, pero mantiene el comportamiento uniforme entre las dos opciones).
- **"Empezar desde cero"**: NO llama ninguna accion del store (el workspace real vacio YA es el estado actual — no hay nada que "cargar"). Solo marca `dismissedThisSession=true` + sessionStorage. Esto es intencional: en un reload con el workspace todavia virgen, el chooser puede reaparecer (session storage se pierde en un reload duro solo si el usuario cierra la pestana; en un simple refresh del mismo tab, `sessionStorage` persiste, asi que NO reaparece dentro de la misma pestana — documentado como comportamiento correcto: es honesto porque el estado real sigue siendo virgen, y solo se resetea si el usuario abre una pestana/sesion de navegador nueva).
- Sin campo nuevo en el snapshot persistido (cumple la prohibicion explicita del brief). Sin flag en `useAppStore.ts`.
- Estetica: una pantalla, dos tarjetas de accion, sin marketing (nada de copy de venta) — reusa primitivas existentes (`.card`, `.btn`, `.btn.primary`, `.eyebrow`) mas 4-5 clases nuevas de layout puro (`.first-run-chooser-*`) agregadas al final de `theme.css`.

Senal visible de que el modo demo quedo activo tras "Explorar demo": ya existe — `WorkspaceModeCard` (`HomeView.tsx:865-905`, siempre visible en la Sala) muestra "Modo demo" cuando `workspaceMode === "demo"`. No se necesita agregar nada nuevo para esto, se verifica en vivo que sigue mostrandose despues de cerrar el chooser.

## 3. TeamView honesto (solo 3 regiones presentacionales, sin tocar la logica de contexto)

- **Chip** (linea ~324): de `{lineup.length} en cancha` a un conteo real: `lineup.filter((slot) => playersById[slot.playerId]).length` sobre el total de slots -> `"X/11 en cancha"` (o el total real de slots de la formacion activa, no un `11` fijo — algunas formaciones podrian tener otro largo aunque hoy todas usan 11).
- **Header** (linea ~322): elimino el `· salida asimetrica` fijo. No hay ninguna fuente real para ese subtitulo (no hay campo de "estilo de salida" derivado en ningun lado de `TeamView`), asi que en vez de inventar una derivacion fantasma, muestro solo `{formation}`. Documentado: si en el futuro existe una fuente real (p.ej. un campo del `teamIdentity`), se puede reintroducir como derivado — hoy no existe, y el brief prohibe afirmaciones falsas.
- **Banco** (lineas ~363-406): cuando `team.players.length === 0`, en vez de iterar `(bench.length ? bench : team.players)` sobre un array vacio sin feedback, muestro un estado vacio: mensaje + boton "Agregar jugador" que llama a la funcion `addRosterPlayer` YA EXISTENTE en el componente (linea ~185-188, la misma que usa el boton del toolbar) — no invento una accion nueva.

## 4. Cancha de estado honesta (modulo nuevo + HomeView)

`src/home/patternPitchOverlays.ts` (nuevo, NO importa nada de `AiView.tsx`): mapa deterministico `TacticalDomain -> PitchOverlay[]` para los dominios con significado espacial confiable en la convencion de cancha 0-100/0-64 ya usada por `PitchViz` (eje x: 0 = propio arco, 100 = arco rival, igual que `AiView.tsx` y el resto de la app):

| domain | overlay | por que tiene señal espacial |
|---|---|---|
| `buildUp` | zona propia (x:8-34) | salida es siempre en el tercio propio |
| `block` | zona propia compacta (x:10-40) | bloque defensivo es siempre detras de la linea de presion |
| `pressing` | blockHeight alto (x:70) + zona final tercio rival (x:60-92) | presion propia se ubica en campo rival |
| `defensiveTransition` | zona central (x:38-62) | transicion ocurre en el tercio medio |
| `offensiveTransition` | zona central-adelantada (x:50-74) | idem, ligeramente mas adelantada |
| `attack` | zona tercio final (x:66-94) | ataque organizado es en el ultimo tercio |
| `setPieces` | zona area (x:78-96) | ABP tiene ubicacion fija real |

Dominios SIN mapeo (sin señal espacial confiable, caen a estado neutro): `defense` (demasiado generico), `duels`, `physicalEmotional`, `systemLineup`.

`derivePatternPitchOverlays(pattern?: TeamPattern): { overlays: PitchOverlay[]; confirmed: boolean }`:
- sin pattern -> `{ overlays: [], confirmed: false }`
- pattern con domain mapeado -> `{ overlays: <su set>, confirmed: true }`
- pattern con domain no mapeado -> `{ overlays: [], confirmed: false }`

En `HomeView.tsx`, reemplazo el bloque hardcodeado (`x:56,y:12,w:28,h:40` + `blockHeight x:42`, lineas ~199-213 actuales) por el resultado de este modulo:
- `state`: `"analysis"` si `confirmed`, si no `"empty"` (ambos ya soportados por `PitchViz`, no hace falta tocar `tacticalPrimitives.tsx`).
- `emptyMessage`: si hay `primaryPattern` pero sin señal espacial -> `"Patron sin ubicacion espacial confirmada"`; si no hay `primaryPattern` -> se mantiene `"Sin patron confirmado"` (comportamiento actual, sin cambios).
- `subtitle` equivalente: distingue los 3 casos (patron con overlay / patron sin overlay confiable / sin patron).

## 5. Guard EOL

`git diff --stat` antes de cada commit. Los cambios en `theme.css` son un bloque nuevo al final del archivo (linea 6013 en adelante); los cambios en `TeamView.tsx`/`HomeView.tsx` son ediciones puntuales de pocas lineas cada una. Si aparece un diff de archivo completo, freno y escalo.

## 6. Validacion obligatoria (contexto Playwright nuevo = IndexedDB limpia)

1. Contexto nuevo, primer load -> chooser visible.
2. "Explorar demo" -> chooser se cierra, `WorkspaceModeCard` muestra "Modo demo".
3. Contexto nuevo otra vez, primer load -> chooser visible de nuevo (nueva sesion de storage).
4. "Empezar desde cero" -> chooser se cierra; Evolucion muestra "0/11 en cancha" sin "salida asimetrica"; banco con CTA.
5. "Agregar jugador" desde el banco -> chip pasa a "1/11"; recargo la vista (sin nuevo contexto) -> chooser NO reaparece (sessionStorage vive en el mismo contexto/tab).
6. Con patron activo de demo -> overlays derivados (no el rectangulo x:56,y:12 fijo); reviso que domains distintos den overlays distintos o estado neutro.
7. Screenshot de la Sala con datos (modo demo) antes/despues para confirmar que no hay regresion visual fuera de la Cancha de estado.

## 7. Riesgos residuales

- El predicado de "virgen" depende de `reports` resuelto por fetch async; en el primer paint (antes de que resuelva `listPostMatchReports()`) el cache local ya arranca en `[]`, asi que no hay parpadeo visible en el caso real (sin reportes guardados en servidor tampoco hay nada que tarde en aparecer).
- Si el patron primario de la demo cae en un dominio no mapeado (`defense`/`duels`/`physicalEmotional`/`systemLineup`), la Cancha de estado en modo demo mostraria estado neutro en vez de un overlay — comportamiento correcto igual (mejor neutro que inventado), se documenta el resultado real observado en la validacion en vivo.
- No se toca `tacticalPrimitives.tsx` (fuera de scope) — reuso los estados `"empty"/"analysis"` ya soportados por `PitchViz`.
