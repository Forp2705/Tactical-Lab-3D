# Plan — feat/reactive-board-engine: motor de lecturas geométricas + superficie

## Spec
`REACTIVE-BOARD-TECH-AUDIT.md` (catálogo propio con umbrales) + `REACTIVE-BOARD-PRODUCT-AUDIT.md`
(priorización + UX) + `REACTIVE-BOARD-BRIEF-IMPL.md` (esta ola). Los tres en la raíz del worktree.

## A. Motor `src/board/boardTacticalRead.ts` (nuevo, puro, testeable)

### Contrato
```ts
export type TacticalReadKind =
  | "lateralBias" | "wideArrowBias" | "blockHeight" | "amplitude" | "zoneSuperiority";
export type TacticalRead = {
  id: string; kind: TacticalReadKind; text: string;
  confidence: "low" | "medium" | "high";
  evidenceLevel: "none" | "weak" | "partial" | "sufficient";
  grounded: true;
};
export function deriveTacticalReads(
  scene: BoardScene, dir: 1 | -1, roster: Player[] = [],
): TacticalRead[]
```
`roster` es un 3er parámetro OPCIONAL (default `[]`) — decisión de reconciliación: el brief cita la
firma como `(scene, dir) => TacticalRead[]` pero también exige el fallback
`linkedPlayerId → Player.positions` (sección A.1), que necesita el roster estructurado
(`Player.positions` es el enum de `src/data/schemas.ts:3-16`, NO el `PlanningBoardPlayer.role`
de texto libre). El contrato de 2 argumentos sigue siendo válido/testeable en modo "solo texto de
rol" (roster vacío); el 3er argumento es aditivo para cuando `useBoardActions.ts` (que ya tiene
`team.players: Player[]` en scope, línea ~94) lo pasa en vivo.

### Reglas de matching lateral (honestidad crítica)
- `LEFT_ROLE = /\b(lb|lwb|lm|lw)\b/i`, `RIGHT_ROLE = /\b(rb|rwb|rm|rw)\b/i` sobre `BoardObject.role`
  (texto libre, `boardModel.ts:136`) — mismo patrón que `GK_ROLE`/`CB_ROLE` de
  `scenarioBoardConsequence.ts:15-16`.
- Fallback SOLO si `.role` no matchea: `linkedPlayerId` resuelto contra `roster`, y
  `Player.positions.includes("LB"|"LW")` → izquierda, `("RB"|"RW")` → derecha. `Player.positions`
  no tiene `LM`/`RM`/lado de `WB` — si el enum no distingue lado, NO hay fallback ahí (a
  diferencia de LB/RB/LW/RW que sí son literales de lado explícito).
- Si NINGUNO de los dos lados resuelve (ni rol ni roster) → **silencio**, nunca adivinar por `y`
  (la `y` es justo la cantidad que la lectura compara — usarla para decidir "quién es el lateral"
  sería circular/deshonesto).

### Las 5 lecturas (orden = prioridad de la tabla del tech-audit)
1. **`lateralBias`**: `dir * (x del token lado-izq − x del token lado-der)`. Umbral **15u**. Si
   `|diff| < 15` → silencio (forma equilibrada). `confidence`: `high` si `|diff| ≥ 25`, si no
   `medium`. `evidenceLevel`: `sufficient` si AMBOS lados resolvieron por `.role` directo, `partial`
   si alguno resolvió por fallback de roster. Copy: **describe la ficha medida**
   ("Lateral izquierdo +18 adelantado que el derecho"), nunca intención.
2. **`blockHeight`**: `x` promedio (relativo a `dir`) de tokens propios con rol reconocible
   CB∪LB∪RB (reusa `isOwnCentreBack` de `scenarioBoardConsequence.ts` + mismos regex de lateral).
   Necesita ≥2. Tercios: `<33` bajo, `33-66` medio, `>66` alto.
   **Decisión de reconciliación entre los dos audits:** el tech-audit sugiere "nota honesta, no
   número" (patrón `resolveCentreBacks`) cuando faltan roles; el product-audit es más estricto para
   la superficie AMBIENTA/pasiva ("el silencio... es información válida, no llenar con avisos
   vacíos", "avisos obvios que un DT ya ve" = ruido explícito). `resolveCentreBacks` empuja una nota
   solo dentro de un flujo EXPLÍCITO ("Probar un ajuste", el DT pidió acción); esta lectura es
   ambiental (aparece sola mientras el DT dibuja). Con <2 roles reconocibles → **silencio total**
   (no chip "faltan roles"), seteando la lectura ambiental al estándar más estricto del
   product-audit en vez de al patrón literal del tech-audit. Documentado aquí para que el gate lo
   revise explícitamente.
3. **`amplitude`**: `max(y) − min(y)` de tokens propios de campo (excluye GK). `≥60` "amplio",
   `≤30` "compacto"; entre medio → silencio (no hay señal notable).
4. **`zoneSuperiority`**: rect de ±15u alrededor del `ball` (`scene.objects.find(o => o.type ===
   "ball")`), `countTokensInZone` (reusa `productBoardTypes.ts:345-359`, el ÚNICO contador). Solo
   si hay balón Y ≥1 rival en escena; si no, silencio.
5. **`wideArrowBias`**: flechas con `semantic ∈ {cross, switch, longPass}` cuyo endpoint resuelto
   (`endpointPoint`, `boardGeometry.ts:87-98`) cae en `y<20` o `y>80`. Caso más seguro (semántica
   declarada por el staff). ≥1 flecha así ya es lectura (no es umbral estadístico).

`deriveTacticalReads` devuelve TODAS las lecturas no-nulas (máx 5), ordenadas por la prioridad de
arriba, `.slice(0, 3)` al final — mismo patrón de cap que `inferAiInterpretationFindings`
(`productBoardTypes.ts:255-258`, que vive en el mismo archivo/familia).

### Aislamiento (regla dura, verificado antes de cerrar)
- Grep de cierre: `deriveTacticalReads`/el archivo nuevo NO debe aparecer en ningún import de
  `CoachAgent.ts`, `CoachSchemas.ts`, `coachAgentClient.ts`, `api/`.
- `boardFreeStateEvidencePacket.ts` NO se toca — su doctrina "sin coordenadas" (línea 14) queda
  intacta. El `positionalRead` claim opcional que menciona el product-audit (sección 2) es FUERA DE
  ESTA OLA (explícito en el brief).
- Reusa `detectAttackDir` de `scenarioBoardConsequence.ts` (no reimplementa orientación).

### Tests `tests/boardTacticalRead.test.ts`
Un caso por lectura (positivo + silencio) + el caso crítico "sin rol ni link → silencio" + el cap
de 3 + fixtures con `createPlayerToken`/`createOpponentToken`/`sceneWith` (mismo patrón que
`tests/scenarioBoardConsequence.test.ts`).

## B. Superficie

### B.1 Chips en "Que entiende RomboIQ" (siempre, vía `useMemo(scene)`)
- `useBoardActions.ts`: `const dir = useMemo(() => detectAttackDir(scene).dir, [scene]);` +
  `const tacticalReads = useMemo(() => deriveTacticalReads(scene, dir, team.players), [scene, dir,
  team.players]);` — mismo trigger que `aiInterpretation` (línea 192-201, recomputa en cada cambio
  de escena, incluido cada `pointermove` de un drag — comportamiento YA existente hoy para
  `aiInterpretation`, no es nuevo).
- `TacticalBoardAiPanel.tsx`: nueva fila de chips mono (`.rombo-tactical-chip`) dentro de la
  sección "Que entiende RomboIQ" (línea ~84-89), debajo de la lista de `aiInterpretation`, cada chip
  con su texto + graduación visual sutil (confidence como intensidad del borde, no un badge nuevo).

### B.2 Overlay efímero en canvas (solo al soltar, MVP acotado a 2 de las 5 lecturas)
Alcance: overlay visual SOLO para `lateralBias` (tinte de la media-banda cargada) y `blockHeight`
(línea fantasma horizontal a la `x` promedio). Las otras 3 lecturas (`amplitude`, `zoneSuperiority`,
`wideArrowBias`) quedan solo-chip en esta ola — decisión de alcance para no multiplicar tipos de
visual; documentado, no bloqueante.
- `useBoardActions.ts`: nuevo estado local `const [tacticalOverlay, setTacticalOverlay] =
  useState<{ reads: TacticalRead[]; key: number } | null>(null);` + un `ref` de timeout.
- Disparo en `onCanvasPointerUp` (línea 633-653), rama existente del token-drag (`if (!drag)
  return;` ... `distance(object.position, drag.before) > 0.4`): cuando el drag fue real (mismo
  umbral que ya decide si se apila undo), computar `deriveTacticalReads` sobre la escena
  post-drop y, si hay `lateralBias`/`blockHeight` en el resultado, `setTacticalOverlay({reads,
  key: Date.now()})` + `setTimeout` (≈1600ms) para limpiarlo. Nunca en `onCanvasPointerMove`.
- Render en `TacticalBoardCanvas.tsx`/`TacticalPitch` (mismo lugar que `consequenceOverlay`, línea
  ~330-360): un `<rect>` de media-cancha (banda y 0-50 o 50-100 según el lado cargado) con
  `fill: color-mix(in oklch, var(--felt-gold) 12%, transparent)` + clase nueva
  `.board-tactical-overlay-band` (`pointer-events: none` explícito, mismo invariante que
  `.board-overlay-zone` en `theme.css:6082-6084`) para `lateralBias`; una `<line>` horizontal
  semitransparente para `blockHeight`. CSS con animación de pulso corta (opacity keyframe), scoped
  al board, tokens `--felt-*` únicamente.

## Reglas de validación
1. `npm run type-check`, `npm test -- --run` (suite completa + tests nuevos), `npm run build`.
2. Grep de aislamiento (ver arriba).
3. Vivo (demo, board creado): adelantar LB manteniendo RB → chip "Lateral izq +Nu adelantado" +
   tinte de banda al soltar; forma equilibrada → sin chip; token sin rol ni roster → no adivina;
   drag de tokens y drag-to-create de zonas (W8) intactos; consola limpia.
4. Capturas antes/después 1366.

## Commits
1. Plan (este archivo).
2. Motor `boardTacticalRead.ts` + tests.
3. Integración `useBoardActions.ts` + superficie (`TacticalBoardAiPanel.tsx`,
   `TacticalBoardCanvas.tsx`, `theme.css`).

Sin push. Gate mc-99 al cierre (feature sensible, cercanía al firewall board→coach).
