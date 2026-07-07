# W13 — fidelidad poster (masthead / metricas / marca / perfil / papeles)

Branch: `fix/w13-fidelidad-poster` (ya en `c83cfe2`). Cierra el ~15% restante
contra `W9-MOCKUP-HOME.png`. Scope exclusivo: `src/app/theme.css` (secciones
W9 SALA ~6300-7232 y W9 SHELL ~7234-7510), `src/ui/AppShell.tsx`,
`src/home/HomeSessionPaper.tsx`, `src/home/HomeMetrics.tsx`. Todas las
ediciones son remaps in situ de reglas existentes (lección W11); no se apila
nada al final de sección salvo reglas genuinamente nuevas (`.brand-iq`,
`.staff-profile-role-row`, chip scoped del papel sesión).

## D1 — Masthead derecho a escala poster

`theme.css`:
- `.home-masthead-rival` (:6348): `font-size` 15px -> `26px` (clamp si el
  fallback largo "PROXIMO RIVAL A DEFINIR" envuelve a 1366 en vivo; medir
  antes de decidir 26 vs 24).
- `button.home-masthead-rival-button` (:6359): quitar `text-decoration:
  underline` estático; mover a `:hover` (nueva regla
  `button.home-masthead-rival-button:hover`), mantener `cursor: pointer`.
- `.home-masthead-foco` (:6370) queda igual.

Verificación en vivo obligatoria: budget masthead ~48px con rival 26-28px +
foco 11px, en AMBOS estados (fallback largo / "VS ATLETICO NORTE" corto).

## D2 — Métricas display

`.home-metric-big` (:6783): `36px` -> `50px`. No se toca el override mobile
≤720 (:7212, 23px) ni el patrón oro/ink/oro (:6791).

## D3 — Un solo slab dorado

`button.home-next-step-cta` (:6838) hoy hereda `.home-cta-gold` (mismo
elemento, misma especificidad 0-1-1, y 6838 ya está DESPUES de 6632 en el
archivo => ya gana en cascada sobre lo que se sobreescriba ahí). Se agregan
las propiedades de `.home-paper-link-cta` (texto plano mono dorado
underline, sin slab): `background: none`, `border: 0`, `box-shadow: none`,
`color: var(--felt-gold)`, `font-family: var(--felt-font-mono)`,
`font-weight: 800`, `font-size: 11px`, `letter-spacing: 0.05em`,
`text-transform: uppercase`, `text-decoration: underline`,
`text-underline-offset: 3px`, más `:hover` (color coral, igual que
`.home-paper-link-cta:hover`). Mantiene `padding: 0`, `width: auto`,
`flex-shrink: 0`, `justify-self: start` (ya están). No se toca
`button.home-cta-gold` (el tablero de mc-21 lo sigue usando tal cual).

## D4 — Marca: subtítulo 1 línea + IQ en caja

`AppShell.tsx`:
- Líneas 96-102: quitar el prefijo `` `Foco ${...}` `` -> usar
  `focoDayLabel(microcycleDays)` directo. Actualizar comentario de línea 94.
- Línea 126: `<h1>RomboIQ</h1>` -> `<h1>Rombo<span
  className="brand-iq">IQ</span></h1>`.
- Grep previo en `tests/` confirmado: ningún test consulta el heading por
  string exacto "RomboIQ" (no hay matches de `RomboIQ`/`brand` fuera de un
  comentario ajeno en `boardProductPayload.test.ts`), y cualquier
  `getByRole('heading')` por `name` sigue matcheando porque el
  `textContent` accesible no cambia.

`theme.css`:
- Sección marca (~7286, `body .app-shell .brand h1`): agregar regla nueva
  `body .app-shell .brand h1 .brand-iq` (fondo `--felt-gold`, color
  `--felt-bg-3`, padding `0 3px`, `border-radius: 3px`).
- Actualizar comentario de :7263 (ya no es solo "wordmark", ahora incluye la
  caja IQ).

## D5 — Perfil 2 líneas

`AppShell.tsx` (`StaffProfileBlock`, display ~348-372): reestructurar a
SIEMPRE 2 líneas —
- Línea 1: nombre, fallback `"Cuerpo tecnico"` si `name` vacío (antes el
  fallback vivía en el slot de rol; ahora vive en el slot de nombre).
- Línea 2 (mismo row): rol (si `role` no vacío) + separador `·` (solo si hay
  rol) + botón "Editar" inline (ya no es un 3er hijo grid del `.staff-profile`,
  pasa a vivir dentro de `.staff-profile-copy`).

El form de edición (`editing === true`) NO cambia.

`theme.css`:
- `.staff-profile` (:7441): grid 3 col (`auto minmax(0,1fr) auto`) -> 2 col
  (`auto minmax(0,1fr)`) — avatar | copy.
- Nueva regla `.staff-profile-role-row` (flex, gap 4px, align-items
  baseline) para agrupar rol + separador + botón en la línea 2.
- `body .app-shell button.staff-profile-edit` (:7491): ya casi cumple
  (padding chico, transparent, mono dorado); ajustar `padding: 0`, `border:
  0`, `border-radius: 0` para que lea como texto inline y no como botón
  suelto.

## D6 — Papel sesión: header 1 línea + duraciones mono

`theme.css`:
- `.home-paper-session-name` (:6461): agregar `display: inline-block`,
  `max-width: 150px`, `overflow: hidden`, `text-overflow: ellipsis`,
  `white-space: nowrap`, `vertical-align: bottom`.
- Nueva regla scoped `.home-paper-block-row .chip.home-paper-chip`:
  `background: none`, `border: 0`, `padding: 0`, `font-family:
  var(--felt-font-mono)`, `font-size: 11px`, `color: color-mix(in oklch,
  var(--felt-bg-3) 60%, transparent)`. No toca `.home-paper-chips
  .chip.home-paper-chip` (chips del papel problema, contenedor distinto).

`HomeSessionPaper.tsx` (líneas 52-56): la fila "+N mas" pierde el
`· {totalDuration}' total` (ya está en el footnote de abajo, líneas 59-61):

```tsx
<span className="home-paper-block-title">+{remaining} mas</span>
```

## D7 — Caps compactos + título poster (1366×768)

`theme.css`, media `@media (max-width:1366px) and (max-height:820px)`
(:7061):
- `.home-paper-problem` (:7087): `max-height: 260px` -> `290px`.
- `.home-paper-session` (:7092): `max-height: 200px` -> `232px`.
- `.home-paper-title` compacto (:7101): `17px` -> `21px`.
- `.home-paper-title` base tall (:6469): `24px` -> `28px`.

Medición en vivo obligatoria a 1366×768 tras D2+D7: fila de métricas debe
cerrar ≤768px de alto acumulado. Si el fold se rompe, recortar caps antes que
tipografía (ver brief).

## D8 — Métrica 1 honesta en real vacío

`HomeMetrics.tsx` tile 1 (líneas 22-25): condicionar a `hasPlayers` (ya
calculado en el componente para tiles 2-3):

```tsx
<b className="home-metric-big">{hasPlayers ? `${loadPercentValue}%` : "—"}</b>
<small className="home-metric-sub">
  {hasPlayers ? `CARGA PLAN · ${loadPeakLabel}` : "CARGA PLAN"}
</small>
```

En demo (hasPlayers true) sigue mostrando 92% + pico, sin cambios.

## Validación al cierre

1. `npm run type-check` + `npm run build` + `npm test -- --run`.
2. En vivo 1366×768 **demo**: masthead poster, métricas 50px, un solo slab
   dorado, subtítulo 1 línea, perfil 2 líneas, papel sesión limpio, fold OK.
3. En vivo 1366×768 **real vacío**: fallback rival a escala nueva sin
   envolver, tile 1 "—", sin regresión de onboarding.
4. Sanity 1920×1080 (título 28px, sin recortes, bloque compacto no aplica) y
   390 (overrides mobile intactos: metric-big 23px, paper-title 19px).
5. Consola limpia.
6. Capturas demo/real 1366 (`w13-mc18-*.png`) en el worktree.

## Riesgo

Medio-bajo: todo CSS + 2 componentes chicos sin tocar store/schema. Mayor
riesgo puntual es el presupuesto de fold a 1366×768 (D2+D7 crecen alto);
mitigado midiendo en vivo antes de cerrar y con margen de recorte de caps ya
identificado en el brief (297/232 son already-holgados vs. lo que ocupa el
contenido real con D6 aplicado).
