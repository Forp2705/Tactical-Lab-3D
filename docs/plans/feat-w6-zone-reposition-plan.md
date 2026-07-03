# W6 feat — reposicion de zonas via inspector + zone-summary una linea por zona

Base: origin/main @ 774cd7b. Branch: feat/w6-zone-reposition. 2 items independientes,
commit separado por item. Decisiones de producto ya tomadas (no re-litigar): campos
numericos x/y/w/h (no drag), una linea por zona real en el zone-summary (no dedup).

## Item 1 — Reposicion de zonas via ZoneInspector

### Estado actual (confirmado leyendo codigo)

`ZoneInspector` (`TacticalBoardInspectorPanel.tsx:236-286`) solo edita `semantic`, `label`,
`tacticalMeaning`. No hay ningun campo de geometria — coincide con mi veredicto W5.

El modelo (`BoardZoneSchema`, `boardModel.ts:179-198`) vive en normalizado 0-100 con un
`refine` de invariante: `x + w <= 100 && y + h <= 100`. Solo la capa de render escala
(`scaleY` en `boardGeometry.ts`, pitch mapea 0-100 -> 0-64) — confirmado en
`TacticalBoardCanvas.tsx:221-235` que ambos shapes (`rectangle` y `circle`) derivan su
render de `zone.x/y/w/h` sin geometria propia adicional, asi que los mismos 4 campos
alcanzan para ambos shapes.

El camino de edicion actual: `ZoneInspector.onUpdate` -> `TacticalBoardView.tsx:263
onUpdateZone={a.updateSelectedZone}` -> `useBoardActions.ts:443-457 updateSelectedZone`
-> `commitScene` (`useBoardActions.ts:202-211`, hace `pushHistory()` antes de mutar) ->
`updateTacticalBoardScene` (store) que re-valida con `BoardSceneSchema.safeParse` y
descarta el patch completo si no pasa (`useAppStore.ts:1098-1115`). Ese es el MISMO
camino que ya usan label/tacticalMeaning/semantic — reusarlo entero, no inventar uno
nuevo.

### Cambios

1. `boardGeometry.ts`: nueva funcion pura `zoneGeometryPatch(zone, field, rawValue)`
   donde `field` es `"x" | "y" | "w" | "h"`. Reutiliza el `clamp` ya existente en el mismo
   archivo (evita import circular: `boardModel.ts` no importa `boardGeometry.ts` hoy).
   Reglas (edicion de UN campo a la vez, mantiene el invariante del schema sin tocar los
   otros campos):
   - `Number.isFinite(rawValue)` falso (NaN, Infinity) -> devuelve `null` (rechazo sobrio,
     sin persistir NaN).
   - `x` -> `clamp(rawValue, 0, 100 - zone.w)`
   - `y` -> `clamp(rawValue, 0, 100 - zone.h)`
   - `w` -> `clamp(rawValue, 1, 100 - zone.x)`
   - `h` -> `clamp(rawValue, 1, 100 - zone.y)`
   Devuelve `Partial<Pick<BoardZone, "x"|"y"|"w"|"h">>` o `null`.
2. `TacticalBoardInspectorPanel.tsx`:
   - `ZonePatch` gana `x?, y?, w?, h?: number`.
   - `ZoneInspector` gana 4 `<label><input type="number">` (mismo patron visual que los
     campos existentes: `<label>Texto<input .../></label>`), value = `zone.x` etc.,
     `onChange` calcula `zoneGeometryPatch(zone, "x", Number(event.target.value))` y solo
     llama `onUpdate(patch)` si no es `null` (si es `null`, no-op — el input vuelve a
     mostrar el valor committeado en el proximo render, sin crash).
3. `useBoardActions.ts`: `updateSelectedZone`'s patch type gana `x?, y?, w?, h?: number`
   (ya pasa por `commitScene`, ya es undoable — no toca la funcion en si).

### Tests (nuevo archivo de casos en `tests/boardInspectorPatches.test.ts`, mismo archivo
que ya cubre `zoneSemanticPatch`/`arrowTargetZonePatch` — "logica pura del inspector")

- clamp de `x` no deja `x + w > 100`.
- clamp de `w` no deja `x + w > 100` (ajusta `w`, no toca `x`).
- idem para `y`/`h`.
- `NaN`/`Infinity` -> `null`, no patch.
- valor negativo -> clamp a 0 (no rechazo, es un valor valido fuera de rango).

### Verificacion viva

Editar x/y/w/h de una zona ya creada en el dev server -> el rect se mueve en el canvas,
`Ctrl+Z` revierte (undo), reload de la app conserva el nuevo valor (persistencia Dexie).

## Item 2 — zone-summary: una linea por zona real

### Diagnostico (root cause, no es dedup por texto)

`inferAiInterpretationFindings` (`productBoardTypes.ts:172-247`) arma UNA sola lista
(`aiInterpretation`) mezclando: (1) links jugador-jugador (`.slice(0,3)`), (2) acciones
con `targetZoneId` (`.slice(0,2)`), (3) hechos posicionales por zona (`.slice(0,2)` —
**esta es la linea 213, `zones.slice(0, 2)`**), (4) fallback de degradacion si vacio, y
al final un cap global `findings.slice(0, 4)` (linea 246).

Con 4 zonas reales (todas con fichas, sin links/flechas en la escena del smoke), el
`zones.slice(0, 2)` de la linea 213 corta a las primeras 2 zonas ANTES de que el cap
global de 4 entre en juego — el cap global nunca fue el limitante en ese escenario. No
es un `Set`/dedup por contenido en ningun punto del pipeline; es un cap posicional
duro que ignora zonas reales 3 y 4. Confirmado: no hay ningun `new Set`/`.filter(indexOf)`
en `productBoardTypes.ts` ni en `TacticalBoardAiPanel.tsx` (el render ya keyea por
`item.id`, fix de W5).

### Contrato del payload — verificado, NO llega al coach

`inferAiInterpretation` (wrapper string[]) alimenta dos consumidores unicamente:
- `useBoardActions.ts:171` el memo rico (con id) que consume `TacticalBoardAiPanel`
  (la lista en pantalla).
- `useBoardActions.ts:225-235` `buildBoardPayload` -> el JSON exportable via boton
  "Exportar payload (JSON)" (descarga manual, no un envio automatico).

Grep dirigido sin resultados en `CoachAgent.ts`, `CoachAgentPrompt.ts`,
`scenarioBridge.ts`, `boardEvidencePacket.ts`, `boardFreeStateEvidencePacket.ts`,
`api/coach-agent.ts` para `aiInterpretation`/`inferAiInterpretation`/`BoardPayload` — CERO
matches. El coach lee la escena por un camino estructurado totalmente separado
(evidence packets / grounding), nunca por este string[]. Cambiar cuantas zonas entran
al reading NO cambia lo que llega al prompt del coach — no aplica la clausula de escalar
antes del brief.

### Fix

En `productBoardTypes.ts`, seccion 3 (linea ~212-221): reemplazar el loop con
`zones.slice(0, 2)` por un mapeo sobre TODAS las `zones` (sin cap posicional), manteniendo
la regla existente de solo emitir finding si `own + rival > 0` (eso no es dedup, es "no
reportar zonas vacias" — comportamiento preexistente, no tocado). Agregar desambiguacion
minima: si dos o mas zonas producen el MISMO texto (mismo label default + misma
ocupacion), anexar un sufijo `(zona N)` con el indice absoluto de esa zona dentro de
`scene.zones` — solo a las que colisionan, no a todas. El cap global
`findings.slice(0, 4)` se deja intacto (no es parte de esta decision de producto; ya
tiene un TODO(P0.7) reconocido para priorizar cuando compite con links/target-actions —
deuda preexistente, fuera de este item).

### Tests

`tests/productBoardReading.test.ts`: nuevo caso con 4 zonas (todas con >=1 ficha, dos
con label+conteo identicos) -> 4 findings con id unico cada uno, dos de ellos con sufijo
`(zona N)` visible en el texto, los otros dos sin sufijo.

### Verificacion viva

4 zonas dibujadas (2 con texto identico) en el panel "Que entiende RomboIQ" -> 4 lineas,
sin warnings de duplicate-key en consola.

## Restricciones respetadas

Solo se tocan: `boardGeometry.ts`, `boardModel.ts` (tipos si hace falta), `useBoardActions.ts`,
`TacticalBoardInspectorPanel.tsx`, `productBoardTypes.ts`, y sus tests. No se toca
`CoachAgent`/prompts, no drag, no reskin.

## Validacion

`npm run type-check`, `npm run build`, `npm test -- --run` (636 previos + nuevos casos).
Verificacion viva de ambos items + regresion basica de Pizarra (dibujar dos clicks,
seleccionar, undo/redo, guardar).
