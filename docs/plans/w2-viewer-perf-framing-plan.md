# PLAN — W2 mc-22: viewer perf + encuadre top

Branch: `fix/w2-viewer-perf-framing`. Base: `origin/main` al momento del checkout = `fdf9782` (el brief pinneaba `10bcbc4`; main avanzó con PR #14 coach-side — verificado `git diff 10bcbc4 fdf9782 -- src/viewer src/app/App.tsx` VACÍO, así que la base efectiva para este scope es idéntica; lo declaro en worker_done).

## T1 — SSAO/medium + dedup getMatchFrame (reuso de `36418fd`)

`git cherry-pick --no-commit 36418fd` aplicó LIMPIO sobre la base nueva (auto-merge de App.tsx, diff --stat idéntico al original, sin blowup EOL). Se commitea como T1 con referencia al SHA original.

Qué trae:
- `Scene3D.tsx`: calidad `medium` con `ssao:false` (el composer nunca monta NormalPass → SSAO en medium era error GL por frame sin beneficio visual). `high` conserva SSAO.
- Dedup `getMatchFrame`: se computa UNA vez en `ViewerWorkspace` (`App.tsx`, +13/-2 líneas: un `useMemo` + prop `frame` a `Scene3D` y `ViewerCanvasHud`) — antes 2×/frame.
- **Archivo extra al scope declarado: `src/export/PlayerView.tsx` (+11/-1)** — consumidor de `Scene3D`, cuya firma ahora exige `frame`; se le inyecta el frame del preview estático. Inevitable sin romper build; declarado en worker_done.
- Test del seam: `tests/viewerFrameDedup.test.tsx` (HUD renderiza desde frame inyectado; headless-safe).

Criterio: Cancha 3D 30s de playback en calidad media con consola limpia (sin "enable the NormalPass", sin `GL_INVALID_OPERATION glBlitFramebuffer` por frame).

## T2 — Encuadre top (H3 del audit)

Todo dentro de `Scene3D.tsx`; cero cambios en `src/viewer/lib/*`.

### (a) Arco relevante dentro de los bounds — `getTopFocus`
Tras juntar puntos de actores+pelota: si hay GK (heurística local sobre `actor.role`: `/gk|arq|port|keeper/i` — `role` es string libre) o si el borde de la acción entra al último cuarto (`maxX > L/4` o `minX < -L/4`), se agrega el punto del arco de ese lado: `{x: ±(L/2 + 2), z: 0}` + postes `z ±4`. Respetando qué lados TIENEN arco según `Pitch3D`: `full`/`small` ambos; `half`/`third` solo `+x`.

### (b) Anti-colisión de chips — nueva `separateTopMarkers` (pura, exportada)
Los duelos hoy se funden ("6"+"8" → un blob). En modo top, antes de mapear `TopActorNode`, las posiciones world pasan por una relajación de 2 iteraciones: pares a distancia < 2.7 (diámetro chip ~2.9 con aro) se empujan simétricamente sobre su vector de separación hasta el mínimo. Pura (`(points, minDist) => points'`), exportada para test unitario. Solo afecta la posición RENDER de los chips en top; la lógica de coords/engine no se toca.

### (c) Matar letterbox — `computeTopZoom` → `computeTopView`
Hoy: zoom = fit de la acción, y la franja vertical visible se pasa de las bandas → ~35% de canvas negro. Nuevo: `computeTopView(focus, size, mode)` devuelve `{zoom, cx, cz}`:
1. zoom de fit de acción (igual que hoy);
2. **piso de zoom anti-bandas**: `zoom >= max(h/(W+2·padZ), w/(L+2·padX))` con `padX≈4.5` (cubre arco+red), `padZ≈2` — la ventana visible nunca excede la cancha+margen;
3. **clamp del centro**: `cx,cz` se ajustan para que el rect visible `[c±(w,h)/(2·zoom)]` quede dentro de cancha+margen (si el rango es degenerado, centro 0).
`SceneCamera` usa `cx/cz` (no `topFocus` crudo) para posición top. iso/broadcast intactos (siguen usando `actionFocus`).

Riesgo conocido del trade-off: si el piso anti-bandas supera el fit de acción en canvas extremos, la acción se recorta antes que mostrar negro; mitigado porque cualquier span de acción cabe dentro de cancha+margen por definición.

### Test puro nuevo: `tests/viewerTopFraming.test.ts`
- `separateTopMarkers`: par pegado se separa a >= minDist; puntos lejanos intactos; determinista.
- `computeTopView`: (1) ventana visible nunca excede cancha+margen (sin bandas) para tamaños de canvas representativos; (2) centro clampeado dentro de la cancha; (3) con GK presente, `getTopFocus` incluye el arco del lado del GK (via bounds más anchos).
- (Exporto los helpers puros desde `Scene3D.tsx`; no se renderiza R3F en tests.)

## T3 — Validación en vivo (dev + Playwright)

3 ejercicios, top e iso, screenshots ANTES (de la base) y DESPUÉS guardados en el worktree (NO commiteados):
1. "Presion alta cuando recibe el arquero" — repro del recorte del arco + duelo 6/8 en círculo central. Screenshots: `w2-before-arquero-top.jpeg` / `w2-after-arquero-top.jpeg` (+ `-iso`).
2. "Rondo 4v2 con salida por apoyo libre" — caso default (no debe degradar). `w2-before-rondo-top.jpeg` / `w2-after-rondo-top.jpeg`.
3. "Presión tras pase atrás orientando a banda" (transDef, parejas pegadas en presión) — anti-colisión. `w2-after-presion-banda-top.jpeg` (before solo si muestra colisión).
Además: consola limpia 30s en media (T1) — pego el conteo de errores/warnings GL en el worker_done.

## Validación de gates
`npm run type-check && npm run build && npm test -- --run` + `npm test -- --run tests/coords.test.ts tests/matchEngine.test.ts` (deben quedar INTACTOS y verdes — si un cambio mío los rompe, el encuadre se pasó de rosca: revertir y repensar).

## Orden de commits
1. este plan; 2. T1 cherry-pick (ref 36418fd); 3. T2 framing + tests; (4. ajustes de validación si hacen falta).

## Guard EOL
`git diff --stat` antes de cada commit; whole-file diff → parar + escalation.
