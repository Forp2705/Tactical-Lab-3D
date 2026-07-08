# W18 — zona baja de la Sala + Ficha del equipo

Branch: `feat/w18-sala-baja` (ya en `9aff443`). Feedback directo del
usuario (con captura en modo real): la zona baja de la Sala (CONTEXTO
ACTIVO / SETUP MINIMO / LECTURA COACH / QUICK START / OBSERVACION MANUAL /
Ver detalle operativo) se ve como tiras planas clonadas con pills blancas
que desentonan, y el setup del equipo (que el DT defina nombre/categoria/
sistema) es la decision PRIMORDIAL de un workspace real vacio — merece
diseño acorde, no la misma tira que el resto.

Archivos: `src/home/HomeView.tsx` (solo clase nueva + copy del summary,
cero logica) y `src/app/theme.css` (secciones Sala existentes, ediciones IN
SITU — lección W11). Cero hex nuevos, solo tokens/`color-mix`. NO se tocan
papeles, masthead, metricas, tablero (gateados W12-14), store, ni el flujo
de onboarding (`RealCoachOnboarding.tsx`/`TeamSetupPrompt` logic) — solo
skin vía wrapper classes ya existentes.

## D1 — Jerarquia en `details.home-collapse` (theme.css ~7024-7075)

- `details.home-collapse` (:7024): agrega `border-left: 3px solid` (mismo
  tono que el resto del borde, sin dorado en reposo) + transicion en
  border-color/background.
- Nueva `details.home-collapse:hover`: tinte de panel un paso mas presente
  (background bump).
- Nueva `details.home-collapse[open]`: `border-left-color` dorado 55% +
  background un paso mas presente que el reposo.
- `details.home-collapse > summary::after` (:7057): color pasa de
  `felt-ink 65%` a `felt-gold 65%`, `font-size` sube a 16px (affordance
  +/- deja de leerse "muerta").
- Nueva regla scoped `details.home-collapse > summary .ai-context-chip`
  (Observacion manual) y `details.home-collapse > summary
  .home-collapse-summary-action .btn.secondary.sm` (Boceto rapido,
  QuickSketchLauncher): mono fantasma — `background: transparent`,
  `border: 1px solid` felt-line ~62% transparente, mono 10px uppercase,
  `hover` → borde dorado. Mata la pill blanca sin tocar `.ai-context-chip`
  ni `.btn.secondary` genericos (scope exacto `details.home-collapse >
  summary ...`, no afecta Diagnostico/otras vistas).
- `.home-context-strip` (:6982): pierde la caja — `border: 0`, `background:
  transparent`, queda como linea mono un escalon por debajo de las
  details (que SI conservan caja). Es meta-informacion (modo demo/real +
  switch), no una tira operativa.

## D2 — Ficha del equipo (lo primordial)

- HomeView.tsx:289 (`<details className="home-collapse">` de SETUP
  MINIMO): agrega `home-collapse-setup` a la className.
- HomeView.tsx:292: copy del summary de "SETUP MINIMO · DEFINI LA IDENTIDAD
  DEL EQUIPO" a **"TU EQUIPO · NOMBRE, CATEGORIA Y SISTEMA DE JUEGO"** (mas
  directo, "esto es lo primero").
- Nueva `.home-collapse-setup` (theme.css, junto a la seccion de
  `details.home-collapse`): canto izquierdo dorado PERMANENTE (70%, no solo
  en `[open]`), fondo con radial dorado sutil (7-8% en la esquina superior),
  `summary` en dorado 80% 11px (un paso mas grande/presente que el resto),
  `padding-block` 14. Un nivel arriba de las tiras operativas, sin competir
  con papeles/tablero (mismo family de tokens, menor intensidad que esos).
- `.home-onboarding-strip` (HomeView.tsx:260, `RealCoachOnboarding`): hoy
  sin caja propia en theme.css (solo los botones internos en :7150-7157).
  Mismo tratamiento ficha: borde 4px dorado izquierdo + radial sutil +
  panel ~35% transparente + `border-radius: 12px`. Es la misma decision
  primordial en el estado real-sin-identidad (antes de que exista siquiera
  el details de setup). Los CTAs dorados internos (W10 fix) quedan
  intactos.
- `TeamSetupPrompt` (HomeView.tsx:818): sus inputs/select/textarea ya
  heredan felt digno del remap app-wide `input,select,textarea` (theme.css
  ~2695-2708, border felt-line + bg felt-bg-2 + focus ring dorado) — sin
  hallazgo, no requiere ajuste scoped.

## D3 — Ritmo

- `.home-lower-zone` (:6967): `margin-top` de 4px sube (respiro real tras
  la fila de metricas) y `gap` sube un paso (12px → ~18px) para que las
  tiras no se lean como bloque monolitico. Ajustar el override del media
  query compacto (:7193, hoy 8px) proporcionalmente — la zona baja vive
  bajo el fold del demo, así que este cambio no mueve nada del presupuesto
  de fold (papers/board/metrics quedan arriba, sin tocar).

## Validacion

1. `npm run type-check` + `npm run build` + `npm test -- --run` (suite
   completa).
2. Vivo demo 1366×768: confirmar que el fold (masthead/papers/tablero/
   metricas) no se movio un pixel — la zona baja crece hacia ABAJO
   solamente.
3. Vivo **real** (workspace vacio, sin team identity configurada): el
   onboarding strip + la ficha de setup deben leerse como LO PRIMERO que
   pide atencion en la zona baja, con jerarquia visible vs. las tiras
   operativas (Lectura coach/Quick Start/Observacion). Esta es la vista que
   el usuario juzgo — captura obligatoria.
4. 390×844: sin overflow horizontal, jerarquia se mantiene apilada.
5. Consola limpia.
6. Capturas antes/despues de la zona baja en demo Y real (`w18-mc18-*.png`).

## Riesgo

Bajo: todo el cambio es CSS de una zona ya aislada (`.home-lower-zone` y
sus hijos) + 1 className + 1 string de copy en HomeView.tsx. Cero cambios
de store/logica/gating. El unico riesgo real es reintroducir competencia
visual con papeles/tablero si la ficha queda demasiado intensa — se
calibra con dorado 70%/7-8% radial (un escalon por debajo de los
elementos gateados W12-14), no con el mismo tratamiento que esos.
