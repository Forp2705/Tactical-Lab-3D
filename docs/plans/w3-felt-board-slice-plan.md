# PLAN — W3 slice 1: felt-board reskin de la Pizarra

Branch: `feat/w3-felt-board-slice` desde `origin/main` @ 4a43ea2 (incluye 4ec67c4 citado en el brief). Gobernado por Brief C (`mc-10-product-manager-audit/PRODUCT-W3.md`). Paso 0 (mockup landeado) ya commiteado como `docs(design): land Pizarra.html felt-board mockup (R.1)`.

## 1. Mapeo mockup -> DOM real (verificado por grep + lectura de JSX)

El mockup `Pizarra.html` es una maqueta de TODAS las vistas (Home/Sala/Diagnostico/Evolucion/Post-partido/Cancha3D/Video) con un `<div class="board">` compartido como "mesa de fieltro". No tiene una UI de edicion de pizarra (tool rail, undo/redo, roster) — esa parte es exclusiva del producto real. El slice se limita a `.rombo-board-shell` (`src/board/TacticalBoardView.tsx:178`), asi que transplanto los TOKENS de diseno reutilizables del mockup (paleta, textura felt, tratamiento de pitch, tokens de jugador, tipografia) sobre los contenedores reales que ya existen ahi, sin inventar estructura que el mockup no muestra para esta vista.

Selectores reales confirmados (grep, `src/board/**`):
- `.rombo-board-shell` (contenedor raiz) — analogo a `.board` del mockup.
- `.rombo-pitch-panel` / `.rombo-pitch-svg` / `.pitch-bg` / `.pitch-lines` / `.pitch-lines-fill` / `.pitch-dot` — analogo a `.pitch` + su grid de fondo.
- `.token.own` / `.token.rival` / `.token-number` / `.token-name` — analogo a `.tok.us` / `.tok.them`.
- `.rombo-toolrail`, `.rombo-right-panel section`, `.rombo-board-empty > div` (regla compartida linea 5297) — analogo a `.panel`/`.card` (contenedores oscuros con borde) del mockup.
- `.rombo-board-topbar`, `.rombo-board-footer`, `.rombo-board-health` — analogo a `.top`/`.nav` (chrome superior) del mockup, adaptado.

## 2. Transplant verbatim (valores copiados de `docs/design/Pizarra.html`, no aproximados)

1. **Paleta felt** (nueva, aditiva, en el bloque `:root` existente ~theme.css:2320): `--felt-bg-1:#16352a; --felt-bg-2:#0d241b; --felt-bg-3:#0a1d16; --felt-ink:#f3efe2; --felt-gold:#f6d24b; --felt-coral:#ff6b5e; --felt-mint:#eafff2; --felt-line:rgba(243,239,226,.8);` — copiados de `.board`/`.tok`/`.pitch` (Pizarra.html:19-92). Fuente unica; nada de aproximar con `--lime`/`--chalk` existentes (que son otra paleta, cockpit).
2. **`.rombo-board-shell`**: fondo de fieltro (radial-gradients + `repeating-linear-gradient` grano + `linear-gradient` base, copiados de `.board` linea 23-27), color base `--felt-ink`.
3. **`.rombo-pitch-panel`**: borde `2.5px solid var(--felt-line)`, fondo `linear-gradient(165deg,#0c1f18,#081410)` + `inset 0 0 60px rgba(0,0,0,.35)` (copiado de `.pitch` linea 62-64).
4. **`.pitch-bg`/`.pitch-lines`/`.pitch-lines-fill`/`.pitch-dot`**: stroke/fill alineado a `rgba(243,239,226,.5-.8)` del mockup (hoy usa un verde/mint distinto).
5. **`.token.own`/`.token.rival`/`.token-number`**: recolor a `.tok.us`(relleno `--felt-gold`, texto tinta oscura)/`.tok.them`(transparente + borde punteado `--felt-coral`, via `stroke-dasharray` en SVG ya que `.token` es un `<circle>`, no un div con `border-style:dashed`). Nota: la NOTA del brief sobre "Fase 2 recolor ya existente" corresponde a un commit (`1c6aee2`) que vive en OTRO branch, no en `origin/main` — no esta en mi base. Lo implemento yo mismo como parte del transplant (mismo resultado esperado, mismos valores del mockup), no lo doy por hecho.
6. **`.rombo-toolrail` / `.rombo-right-panel section` / `.rombo-pitch-panel` / `.rombo-board-empty > div`** (regla compartida linea 5297-5305): de fondo azulado cockpit a fondo/borde felt (`var(--felt-line)` borde, fondo verde oscuro con tinte), acercando el tool rail y panel derecho al tratamiento `.panel`/`.card` del mockup.
7. **Tipografia**: `font-family` con las fuentes del mockup como PRIMERA opcion + fallbacks seguros ya existentes (`"Bricolage Grotesque", var(--font-head)` / `"Geist Mono", monospace`) en headers de panel (`.rombo-toolrail h2/h3`, `.rombo-right-panel h2`) y textos mono (`.rombo-board-health span`, `.rombo-board-footer strong`). Nota: las fuentes NO se cargan (no hay `<link>` a Google Fonts disponible en mi scope — index.html no esta en la lista de archivos permitidos) — el navegador cae al fallback existente. Se documenta como riesgo aceptado, no bloqueante (no rompe nada, es no-op visual hasta que alguien cargue las fuentes en un paso posterior).
8. **`.rombo-board-topbar`/`.rombo-board-footer`/`.rombo-board-health`**: borde/fondo armonizado a `var(--felt-line)` en vez del azul cockpit actual.

## 3. Explicitamente NO tocado (declarado, no me lo salto por descuido)

- **`.rombo-primary-cta` / `.rombo-save`** (botones CTA "Publicar"/"Guardar"): YA tienen `!important` en `background`/`border-color`/`color` (preexistente, linea 5236-5238 y 5255-5256). Cambiar su color a dorado del mockup requeriria otro `!important` para ganar la cascada -> **prohibido explicitamente por el brief**. Quedan con su azul/verde cockpit actual. Documentado como limite duro, no como omision.
- **`.board-zone` / `.board-arrow` (colores semanticos de dibujo)**: el mockup no tiene UI de dibujo de flechas/zonas (no es parte de ninguna vista mockeada), no hay valor de referencia que transplantar sin inventar. Se dejan intactos.
- Cualquier vista fuera de la Pizarra (Home, AiView, Post-match, visor): cero cambios, confirmado por diff scope.

## 4. Guard EOL
`git diff --stat` antes de cada commit; se espera solo `theme.css` con hunks acotados (no whole-file).

## 5. Validacion (C1-C5)
- C1: `git diff --stat` contra origin/main solo debe listar `theme.css`, `docs/design/Pizarra.html`, `docs/plans/w3-felt-board-slice-plan.md`.
- C2: `git diff | grep -c '!important'` = 0 en las lineas agregadas (`+`); `git diff --stat` no debe mostrar ninguna hoja nueva.
- C3: `npm run type-check && npm run build` verdes; `npm test -- --run` sin tests nuevos rotos (CSS-only, no se espera movimiento).
- C4: smoke visual en vivo (`npm run dev`), screenshots antes/despues de Pizarra + Home + AiView (Home/AiView deben verse identicos al baseline).
- C5: checklist de interaccion de 5 pasos en vivo (crear escena, dibujar flecha, dibujar zona, editar roster, preguntar al coach).

Screenshots planeados (nombres): `w3-before-board.png`, `w3-after-board.png`, `w3-before-home.png`, `w3-after-home.png`, `w3-before-aiview.png`, `w3-after-aiview.png`, mas comparacion directa contra `docs/design/Pizarra.html` renderizado.
