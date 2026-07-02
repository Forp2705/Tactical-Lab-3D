# PLAN — FIX 4: Navegacion nunca rota (860-1180px)

Branch: `fix/w1-nav-collapse` desde `origin/main` @ `1bad717`. Scope estricto: `src/app/theme.css` + `src/app/tactical-ui.css`.

## 1. Diagnostico verificado (amplia el H1 original)

El brief describe dos mecanismos en pugna. Verificando en vivo (Playwright, `npm run dev`, computed styles) encontre que la causa raiz real es una capa mas abajo en la cascada de lo que el H1 original identificaba:

- `App.tsx` importa `theme.css` y despues `tactical-ui.css` (`src/app/App.tsx:8-10`). Vite concatena en orden de import, asi que **cualquier regla sin media query de `tactical-ui.css` le gana a cualquier regla sin media query de `theme.css`**, sin importar el orden interno dentro de cada archivo.
- Por eso `theme.css:2378-2382` (`.app-shell { grid-template-columns: 282px minmax(0,1fr); }`, la redeclaracion que el H1 senala) **ya esta inerte hoy**: nunca gana en el render final, la tapa `tactical-ui.css`.
- El ganador real, en TODOS los anchos, es `tactical-ui.css:1476-1478` (seccion "SIDEBAR CLEAN PASS"): `.app-shell { grid-template-columns: 244px minmax(0, 1fr); }`, sin media query, ultima declaracion sin condicion de esa propiedad en toda la cascada.
- Confirmado en vivo a 700px (por debajo del breakpoint de drawer actual, 860px): `getComputedStyle(.app-shell).gridTemplateColumns` = `"244px 446px"` (NO colapsa a `1fr`), mientras que `.sidebar` si se saca de flujo (`position:fixed; transform:translateX(-100%)`, via `tactical-ui.css:425-428`) y el `.menu-toggle` si es visible (`display:grid`). O sea: el drawer *funciona* para ocultar el sidebar, pero el grid de `.app-shell` nunca libera esa primera columna de 244px — el contenido principal pierde 244px de ancho aun con el sidebar oculto. Este es un bug adicional, mismo origen, no mencionado en el H1 original.

Conclusion: arreglar solo `theme.css:2284/2378` (como sugiere el H1 literal) **no cambia nada visible**, porque esas reglas ya perdian la pulseada contra `tactical-ui.css`. El fix tiene que tocar `tactical-ui.css:1476-1478`, que es la regla que de verdad manda.

## 2. Mecanismo elegido

Extender el drawer off-canvas existente de `tactical-ui.css` (ya tiene affordance: hamburguesa + scrim + `position:fixed`/`translateX`) desde su rango actual (`max-width:860px`) hasta cubrir todo el rango roto (`max-width:1180px`), y neutralizar la redeclaracion incondicional de `244px` para que solo aplique arriba de ese corte. Es el mecanismo que recomienda el gate y el que menos superficie toca (3 ediciones puntuales, sin tocar `.tsx`).

## 3. Cambios (por archivo)

### `src/app/tactical-ui.css`

1. **Linea 423** — `@media (max-width: 860px)` -> `@media (max-width: 1180px)`. Extiende TODO el bloque (`.app-shell{grid-template-columns:1fr}`, `.sidebar{position:fixed;transform:translateX(-100%)}`, `.app-shell.nav-open .sidebar{...}`, `.nav-scrim`, `.menu-toggle{display:grid !important}`, `.home-action-strip`) al rango 860-1180px que hoy no tiene ningun mecanismo de colapso funcional.
2. **Lineas 1476-1478** — envolver la redeclaracion incondicional en `@media (min-width: 1181px) { .app-shell { grid-template-columns: 244px minmax(0, 1fr); } }`. Sin este cambio, el paso 1 no alcanza: esta regla (mas abajo en el archivo, sin condicion) le seguiria ganando al bloque de colapso en todo el rango, exactamente como pasa hoy con el breakpoint de 860px.

Con estos dos cambios, `.app-shell` colapsa a `1fr` en todo el rango <=1180px (una sola fuente de verdad: el bloque de `tactical-ui.css:423-434`), y solo el layout fijo de 244px aplica arriba de 1180px.

### `src/app/theme.css`

3. **Lineas 2378-2382** — envolver en `@media (min-width: 1101px) { ... }` (complemento exacto de `max-width: 1100px` del bloque apilado en `theme.css:2284`). Esto es lo que pide el H1 original: aunque esta regla ya no gana el render final (ver diagnostico), sigue siendo una contradiccion interna dentro del mismo archivo (dos reglas de la misma propiedad, una condicional y otra no, en conflicto directo) — dejarla asi es confuso para el proximo que edite `theme.css` y es un riesgo latente si algun dia cambia el orden de imports. Se neutraliza sin borrar nada ni tocar `theme.css:2284` (que ya esta bien scopeado).
- **No se toca** `theme.css:2935/3510/5083` — verificado que ninguno de los tres declara `grid-template-columns` sobre `.app-shell` (2935 s repite el mismo patron que 2284 sobre `.app-shell`, tambien ya inerte hoy por el mismo motivo de orden de import, se deja igual por indicacion explicita del brief; 3510 y 5083 son grids de `viewer`/`board`, no tocan `.app-shell`). No hace falta editarlos para que el fix funcione ni quedan re-rompiendo nada.
- **No se toca** el "Tactical mockup shell lock" (`theme.css:3838-3900`): solo fija `grid-template-columns` de `.nav-btn` (30px 1fr auto), no de `.app-shell`. No compite con este fix.
- **Fuera de scope, no tocado**: `src/ui/tacticalPrimitives.css` (tercer archivo importado por `App.tsx`) — confirmado que no declara `.app-shell` en absoluto, no puede re-romper el fix.

## 4. Por que no el otro mecanismo (sidebar apilado de `theme.css:2284`)

Descartado: hoy ya esta inerte (perdido contra `tactical-ui.css`), y reactivarlo (haciendolo ganar) requeriria pelear contra la cascada completa de `tactical-ui.css` (headers, nav-btn, brand, etc., todos con reglas propias para el sidebar) sin su affordance de reapertura (el patron apilado de `theme.css:2284` no tiene hamburguesa/scrim propios, dependeria de reutilizar los de `tactical-ui.css` de todos modos). Extender el drawer existente es menos codigo y no exige reconciliar dos sistemas de nav distintos.

## 5. Matriz de validacion (7 anchos obligatorios)

Metodo: Playwright contra `npm run dev`, `getComputedStyle` de `.app-shell` (`gridTemplateColumns`), `.sidebar` (bounding rect / `position`) y `.menu-toggle` (`display`), mas click funcional del toggle en un ancho colapsado.

Resultados medidos post-fix (Playwright, `getComputedStyle` en vivo contra `npm run dev`, mismo build de los 3 commits de este branch):

| Ancho | `.app-shell` grid (computed) | Sidebar (`position`/transform) | `.menu-toggle` | Toggle funcional | Resultado |
|---|---|---|---|---|---|
| 860px  | `850px` (1 columna) | `fixed`, `translateX(-264px)` (oculto) | `display:grid` (visible) | Si — click abre (`nav-open`, `translateX(0)`) y el scrim cierra | OK |
| 1024px | `1014px` (1 columna) | `fixed`, `translateX(-264px)` (oculto) | `display:grid` (visible) | No re-testeado a este ancho especifico (mismo mecanismo que 860, ya validado funcional) | OK — este es el ancho que reproducia el bug original del H1, confirmado resuelto |
| 1100px | `1090px` (1 columna) | `fixed`, `translateX(-264px)` (oculto) | `display:grid` (visible) | Mecanismo identico a 860/1024 | OK |
| 1180px | `1170px` (1 columna, borde exacto del rango colapsado) | `fixed`, `translateX(-264px)` (oculto) | `display:grid` (visible) | Mecanismo identico | OK |
| 1200px | `244px 946px` (2 columnas, sidebar fijo) | `sticky`, sin transform (siempre visible) | `display:none` (oculto) | N/A (no hace falta, sidebar ya visible) | OK |
| 1366px | `244px 1112px` (2 columnas) | `sticky` | `display:none` | N/A | OK |
| 1920px | `244px 1666px` (2 columnas) | `sticky` | `display:none` | N/A | OK |

Un solo mecanismo gobierna todo el rango <=1180px (drawer off-canvas de `tactical-ui.css`), y un solo mecanismo gobierna >1180px (sidebar fijo de 244px). Sin zona muerta entre 860-1180px. Sin errores de consola durante la corrida (`browser_console_messages`, 0 errores/warnings).

## 6. Guard EOL

Antes de cada commit: `git diff --stat`. Si algun archivo aparece con TODAS sus lineas tocadas (whole-file diff por line-endings), parar y escalar. No se espera que pase — el fix son ediciones puntuales de 1-6 lineas por bloque, sin tocar el archivo entero.

## 7. Riesgos residuales (a documentar en worker_done)

- El drawer extendido reutiliza el patron de `tactical-ui.css` (fixed + translateX + scrim); no se valida aqui contraste/tema (`data-theme`) mas alla del tema por defecto.
- `theme.css:2284/2935` quedan como bloques legacy inertes (no rotos, pero muertos) — limpieza real es tarea del reskin, no de este fix (prohibido por brief).
