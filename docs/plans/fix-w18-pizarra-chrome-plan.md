# Plan — W18 fix/w18-pizarra-chrome: chrome de la Pizarra al felt

## Alcance
Solo `src/app/theme.css`, seccion rombo (~5169-6059, delimitada por el comentario
`/* RomboIQ Tactical Board product surface */` hasta la media query antes de
`/* Scenario sandbox (slice 1) */`). Ediciones IN SITU, cero hex nuevos (unica
excepcion declarada: el chevron SVG en data-URI, no puede leer custom properties).
mc-18 trabaja en paralelo en `~6980-7160` (Sala) — region disjunta, no tocada.

## Barrido
La tabla del brief (14 filas, recon del coordinador sobre `9aff443`) es la
direccion, no el limite: un grep de todo el rango rombo por paleta cockpit
(`rgba(148,163,184,*)`, azules `96,165,250`/`37,99,235`, verdes
`34,197,94`/`74,222,128`, navys `rgba(2,6,23,*)`/`rgba(8,18,31,*)`/`rgba(15,28,44,*)`,
hex sueltos `#e8f2ff`/`#94a3b8`/`#4ade80`/etc.) encontro ~27 ocurrencias, mas que
las 14 filas de la tabla — se migran TODAS las que son chrome (botones, paneles,
labels, chips, checkboxes, estado vacio), con la MISMA formula de la tabla
(`color-mix(in oklch, var(--felt-X) N%, transparent|black)`), reusando el
patron ya establecido en el resto del archivo (`--felt-ink` 65% para texto
mudo, `--felt-gold`/`--felt-mint` para acentos, `#1a1205` para tinta oscura
sobre dorado — ya usado 2 veces en `.rombo-primary-cta`/`.rombo-save`, no es
hex nuevo).

## NO tocar (verificado por lectura, mismo criterio del brief)
- `.note` del canvas (contenido, no chrome).
- Strokes `rgba(2,6,23,*)` de tokens/board-endpoint (outline de legibilidad
  sobre fichas doradas — mismo motivo que el `.note`).
- `.danger` del inspector (rojo semantico, no re-dorar semaforos).
- `.pitch-*` (W15 gateado) y colores de identidad propio/rival.
- Seccion "Scenario sandbox" (despues de la media query, feature distinta,
  fuera del recon).
- `.rombo-formation-grid { }` como bloque standalone (dead CSS desde W15,
  ya no en el DOM) — se limpio solo su aparicion en el selector `.active`
  compuesto (la tabla lo senalaba explicitamente); el bloque base queda,
  cleanup opcional que no hace falta para este fix.

## Fixes por region (extendiendo la tabla del brief)
1. `.rombo-board-shell button/select/input/textarea` — border/bg/color → felt.
2. Chevron SVG — hex declarado como excepcion de asset.
3. Hover / focus-visible — felt-line / felt-gold.
4. `.rombo-toolrail button` texto/icono inactivo (`#cbd5e1`/`#8fb2cf`, no
   estaban en la tabla) → felt-ink 82%/65%.
5. Activo del toolrail/width-row + tick `h3::before` (verde → dorado);
   selector muerto `.rombo-formation-grid.active` fuera.
6. `.rombo-board-select` label (`#94a3b8`, no estaba en la tabla) → felt-ink 65%.
7. `.rombo-pitch-toolbar select` bg.
8. `.rombo-key-instructions` (texto/borders/bg/summary) → felt-ink/felt-mint.
9. Paneles derecha `.rombo-right-panel section`/`.rombo-advanced` bg → felt-bg-2.
10. `.rombo-right-panel label`, `.rombo-roster-list article`,
    `.rombo-inspector label/readonly/kind`, `.rombo-advanced summary` (y hover) —
    toda la familia de labels/borders/bg slate → felt (no estaban completos en
    la tabla, misma familia que las filas si listadas).
11. `.rombo-layer-list input[type=checkbox]` off/checked → felt-line/felt-gold.
12. `.rombo-payload pre` (JSON debug) → felt-bg-3/felt-ink.
13. `.rombo-board-footer` color → felt-ink 65%.
14. `.rombo-board-empty` (pantalla vacia completa: bg `#050b12` + color
    `#e8f2ff`, MUY visible) → felt-bg-3/felt-ink; `.eyebrow` verde → dorado.
15. `.rombo-board-empty-actions .primary` — azul crudo `#1463eb` (CTA
    primario del estado vacio) → dorado + tinta oscura (mismo patron que
    `.rombo-primary-cta`).

## Validacion
1. `npm run type-check`, `npm test -- --run`, `npm run build`.
2. Vivo (demo, board creado): herramienta activa dorada y legible, inputs/
   selects felt con hover/focus dorado, paneles derecha sin azul, instrucciones
   con acentos mint, dibujo zona+flecha intacto, un solo slab = Guardar,
   consola limpia. 1366 y 1920. Capturas antes/despues.

## Commits
1. Plan (este archivo).
2. CSS del chrome felt, en `fix/w18-pizarra-chrome` (stacked sobre `9aff443`).
   Sin push.
