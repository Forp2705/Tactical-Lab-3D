# W6 — Quick Start visible en Home (fold fix)

## Medicion en vivo (antes de tocar nada)

Playwright contra `npm run dev` (branch checkout limpio), `.quick-start-block` vs
`window.innerHeight`, scroll top = 0:

| Viewport   | Estado         | hero height | px bajo el fold | % visible del bloque |
|------------|----------------|-------------|------------------|----------------------|
| 1366x768   | demo cargado   | 597px       | 177px            | 41%                  |
| 1366x768   | real/vacio     | 572px       | 152px            | 50%                  |
| 1440x900   | demo cargado   | 597px       | 25px             | 91%                  |
| 1440x900   | real/vacio     | 572px       | 0px (al borde)   | 100% (fragil, 0.2px de margen) |

Confirmado: a 1366x768 (laptop tipico) la fila de chips de Quick Start queda
mayormente oculta; solo el titulo "Que te esta costando esta semana?" es
visible sin scroll. A 1440x900 el caso real/vacio ya entra pero al limite
exacto del viewport (fragilisimo ante cualquier chrome de browser).

## Decision: opcion (a) — compactar el bloque superior

Opcion (b) no tiene recorrido: QuickStartPanel ya es la PRIMERA seccion
despues del hero (antes de WeeklyWorkflowPanel, WeeklyDecisionCard, etc).
Subirlo mas implicaria ponerlo ARRIBA del hero mismo, fuera de alcance de
"reordenar bloques menos accionables".

Se reducen paddings/margenes del hero (masthead + card "Siguiente paso"),
sin tocar texto ni tamanos de fuente del titulo (elemento de marca
deliberado del reskin felt). Se identifico la regla CSS que efectivamente
gana la cascada para cada propiedad (hay 3-4 bloques `.command-hero`
duplicados en tactical-ui.css de waves anteriores; se edita solo la regla
ganadora, no se consolida el resto — fuera de alcance).

Cambios (todos en `src/app/tactical-ui.css`):
- `.command-hero` padding: `clamp(20px,3vw,30px) !important` -> `clamp(14px,1.8vw,18px) !important`
- `.hero h2` margin: `10px 0 8px` -> `4px 0 4px`
- `.command-hero .home-subtitle` margin-bottom: `18px` -> `8px`
- `.home-next-action` margin-top: `14px` -> `8px`; padding (regla ganadora): `16px 18px` -> `10px 18px`
- `.home-hero-intent` margin-top: `12px !important` -> `6px !important`
- nuevo `.command-hero .toolbar.compact` margin-top: `6px` (override scoped, no toca `.toolbar.compact` global que se usa en otras vistas)
- `.command-loop-row` margin-top: `18px` -> `8px`
- `.command-status-row` margin-top: `14px` -> `8px` (las 2 declaraciones duplicadas)

## Validacion

1. Medir de nuevo en vivo a 1366x768 y 1440x900, demo y real/vacio.
2. Screenshots antes/despues en ambas resoluciones.
3. Confirmar viewport angosto no rompe (Home responsive intacto).
4. Confirmar Pizarra (felt) no cambia — cero selectors compartidos con board.
5. `npm run type-check`, `npm run build`, `npm test -- --run`.

## Riesgo

Bajo: solo CSS de espaciado, sin cambios de componentes ni de schema. El
titulo grande de "Sala semanal" se mantiene igual (tamano de fuente
intacto), por lo que el look del masthead no cambia dramaticamente, solo
respira menos.
