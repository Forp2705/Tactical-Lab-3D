# W4 fix — canvas dead zone bajo "Instrucciones clave"

## Causa raiz

`src/app/theme.css:5629` — `.rombo-key-instructions` es un `position: absolute` box
(`left: 50%`, `bottom: 18px`, `width: min(280px, 44%)`) apilado visualmente encima del
SVG de la cancha (`src/board/components/TacticalBoardCanvas.tsx:109-116`). No tiene
`z-index` ni `pointer-events` propios, pero al ser un elemento posicionado que aparece
despues del SVG en el DOM, captura los eventos de puntero en toda su caja — incluida el
area de padding/fondo sin texto — antes de que lleguen al `<svg onPointerDown>` que esta
debajo. El contenido interno (`<strong>` + `<ul><li>`) es texto estatico sin handlers
(confirmado via grep: unico consumidor de la clase es este componente, sin onClick/onScroll).
Como el box mide ~44% del ancho del panel y cae sobre la esquina inferior derecha de la
cancha, bloquea dibujo/seleccion ahi — coincide con el 26% reportado por mc-99.

## Fix minimo viable

Una linea: agregar `pointer-events: none;` a la regla `.rombo-key-instructions` en
`src/app/theme.css`. No hace falta `pointer-events: auto` en hijos porque no hay ningun
hijo interactivo. El panel sigue siendo visible (no se toca layout/estilo visual), solo
deja de interceptar eventos de puntero.

## Verificacion viva (obligatoria)

Con `npm run dev` + Playwright (trusted pointer events):

1. Repro pre-fix: dibujar en la zona bajo el panel -> confirmar que NO dibuja (baseline).
2. Aplicar el fix.
3. Repro post-fix: dibujar arrow/zone en la MISMA zona antes muerta -> confirmar que SI dibuja.
4. Smoke del resto de la interaccion de la Pizarra: seleccionar, mover token, undo/redo
   (incluye resync del dropdown de formacion de W3), publicar al coach.
5. Confirmar visualmente que el panel "Instrucciones clave" se sigue viendo igual (sin
   reflow, sin cambio de posicion/tamaño).

## Restricciones

- No reposicionar el panel.
- No tocar IA/memoria/catalogo.
- Diff objetivo: 1 linea CSS (+ eventuales tests si se agregan).
