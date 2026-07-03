# PLAN — W4: deuda UI/CSS acotada (fuentes, botones, CSS legacy)

Branch: `fix/w4-ui-debt` desde `origin/main` @ `851df4c`. Gobernado por `W4-BRIEF-UIDEBT.md`. Limpieza quirurgica, sin features nuevas, sin reskin amplio. 3 items independientes, 1 commit cada uno.

## Item 1 — Fuentes del felt como woff2 local

Familias realmente consumidas por el CSS felt (grep `var(--felt-font-` en `src/app/theme.css:2353-2355` + todos los usos bajo `.rombo-board-shell`):
- `--felt-font-head`: **Bricolage Grotesque**, usada en `.rombo-brand` (weight 900), `.rombo-title-block h1` (weight 800).
- `--felt-font-mono`: **Geist Mono**, usada en `.rombo-board-health span`/`.rombo-board-footer strong` (sin weight explicito = 400) y `.rombo-toolrail h2/h3`/`.rombo-right-panel h2` (weight 800).
- `--felt-font-body`: **Familjen Grotesk**, heredada por default en todo `.rombo-board-shell` (no hay otro override de `font-family` en el bloque) — cubre pesos 400/500/600/700/800/900 usados por distintos elementos hijos (botones, inspector, chips, etc).
- `Shantell Sans` (scribble en el mockup) NO fue transplantada en W3 — no se busca, no se descarga.

Origen legal: Google Fonts, licencia OFL, self-host permitido. Descarga build-time via `fonts.googleapis.com/css2` (UA de navegador real para forzar respuesta woff2), subset `latin` (cubre acentos/enie del espanol: rango U+0000-00FF incluye `ñ áéíóú ü ¿ ¡`), variante **variable font** (1 archivo por familia cubre todo el rango de pesos usado, evita bundlear 6 archivos estaticos por familia):
- Familjen Grotesk: eje `wght` real 400-700 (Google no publica variable por debajo/encima) -> pesos 800/900 pedidos por algunos hijos se clampean al maximo disponible (700), comportamiento identico al fallback actual, no es regresion.
- Bricolage Grotesque: eje `wght` real 200-800 -> weight 900 pedido en `.rombo-brand` se clampea a 800 (headline sigue leyendose bold, diferencia de peso practicamente imperceptible).
- Geist Mono: eje `wght` real 100-900 -> cubre los 2 pesos usados sin clamping.

Bundle final: `public/fonts/{familjen-grotesk,bricolage-grotesque,geist-mono}-variable.woff2`, ~83.4 KB total (18.9 + 41.3 + 23.1 KB). `@font-face` nuevo en `theme.css` (bloque propio, antes de `:root`), `font-display: swap`, `src: url("/fonts/...") format("woff2")`. Cero requests a CDN externo en runtime (assets locales servidos por Vite desde `public/`).

## Item 2 — Botones Guardar/Publicar

Target confirmado (mismo que documento explicitamente NO tocado en `docs/plans/w3-felt-board-slice-plan.md` seccion 3): `.rombo-primary-cta` (`theme.css` ~5268) y su modificador `.rombo-save` (~5289), ambos con `background`/`border-color`/`color` en `!important`. Preexistente desde `b36cdef` (baseline pre-refactor), NO agregado por W3.

Plan: reemplazar los valores hardcodeados azul/verde dentro de esas mismas reglas `!important` por los tokens felt (`--felt-gold` de fondo, tinta oscura de texto) — se edita el VALOR de la declaracion existente, no se agrega un `!important` nuevo ni se pelea la cascada. Si al tocarlo aparece necesidad de ajustar mas reglas fuera de estas 2 (cascada de specificity en otros lados), se aborta y se escala — pero el diff esperado es acotado (2 bloques de reglas, mismo archivo, mismo selector).

Alcance: ambos selectores viven fuera de cualquier media query y no tienen prefijo condicional — pero SON globales por nombre de clase (no scoped a `.rombo-board-shell` en el selector mismo). Hay que confirmar que `.rombo-primary-cta`/`.rombo-save` solo se usan dentro de board (grep en `src/board/**`) antes de tocar el color, para no filtrar el dorado a otra vista que use el mismo nombre de clase por error.

## Item 3 — CSS legacy muerta

Evidencia por regla (grep exhaustivo en `src/**` + `git log -S` en todo el historial trackeado, incluyendo fragmentos por si se arma la clase con template strings):

| Regla | Grep en src (clase completa + fragmento) | git log -S en todo el historial | Veredicto |
|---|---|---|---|
| `.board-pitch-base` | 0 hits (el renderer real usa `pitch-bg`) | 0 hits en cualquier `.tsx`, existe desde `b36cdef` | Borrar |
| `.board-pitch-marks` | 0 hits | 0 hits | Borrar (misma familia, no nombrada en el brief pero misma evidencia) |
| `.board-object` (bare + `.own circle` + `.rival circle`) | 0 hits (el renderer real usa `token`/`token own`/`token rival`) | 0 hits | Borrar |
| `.board-object.selected circle, .board-arrow-group.selected .board-arrow, .board-zone-group.selected .board-zone` (regla compuesta) | 0 hits en los 3 selectores (incluye `board-arrow-group`/`board-zone-group`, tampoco usados) | 0 hits | Borrar la regla completa |
| `.danger-ring` | 0 hits; `isDangerPlayer` existe en `boardModel.ts` pero ningun renderer lo lee para aplicar esta clase | 0 hits | Borrar |
| `.token-role, .board-object-label, .board-zone-label { ... }` | `.token-role` y `.board-object-label`: 0 hits. `.board-zone-label`: 1 hit vivo (`TacticalBoardCanvas.tsx:244`) | — | Borrar SOLO `.token-role` y `.board-object-label` del selector compuesto, dejar `.board-zone-label { ... }` intacto |

Ante cualquier hit real se cancela el borrado de esa regla puntual (regla del brief: ante la duda, no borrar). `.token-number` se mantiene sin cambios (uso vivo confirmado, `TacticalBoardCanvas.tsx:473`).

## Verificacion

- `npm run type-check`, `npm run build`, `npm test -- --run`.
- Smoke visual vivo: `npm run dev` + Playwright, Pizarra desktop + viewport angosto (responsive), mas una pasada por Home/AiView/Biblioteca para confirmar cero fuga visual del recolor de botones o de las fuentes nuevas.
- Contencion: nada global nuevo fuera de `@font-face` (que por naturaleza es global pero solo declara fuentes, no aplica estilos fuera de donde ya se usaban las variables `--felt-font-*`).

## Commits (1 por item, granular)

1. `feat(board): self-host felt-board fonts as local woff2 (Bricolage Grotesque, Geist Mono, Familjen Grotesk)`
2. `fix(board): recolor Guardar/Publicar CTA to felt gold palette`
3. `chore(board): remove dead board-object/board-pitch-base/danger-ring CSS`

Si un item se complica a mitad de camino, se descarta su commit sin arrastrar los otros dos.
