import { type BoardTool, TOOL_DEFS } from "./boardConstants";
import {
  clamp,
  gestureDragDistance,
  normalizeZoneRect,
  ZONE_DRAG_CLICK_THRESHOLD,
} from "./boardGeometry";
import type {
  BoardArrow,
  BoardArrowEndpoint,
  BoardArrowSemantic,
  BoardObject,
  BoardPoint,
  BoardScene,
} from "./boardModel";
import {
  BoardArrowSemanticSchema,
  createBoardId,
  createPlayerToken,
  createSemanticArrow,
  createTacticalZone,
} from "./boardModel";
import type { PlanningBoardPlayer } from "./productBoardTypes";

// Las tools de dibujo SON semanticas: la conversion es 1:1, sin colapso. La
// lista de semanticas valida sale del propio schema (una sola fuente de verdad).
const ARROW_SEMANTICS = new Set<string>(BoardArrowSemanticSchema.options);

export function semanticForTool(tool: BoardTool): BoardArrowSemantic | null {
  return ARROW_SEMANTICS.has(tool) ? (tool as BoardArrowSemantic) : null;
}

export function labelForTool(tool: BoardTool) {
  const found = TOOL_DEFS.find((item) => item.id === tool);
  return found?.label ?? "Anotacion";
}

export function makeEquipmentLikeObject(
  type: "note" | "equipmentMarker",
  label: string,
  position: BoardPoint,
  color: string,
): BoardObject {
  return {
    id: createBoardId(type === "note" ? "note" : "equipment"),
    type,
    label,
    position,
    rotationDeg: 0,
    style: { color },
    tacticalMeaning: label,
    visibility: "player",
    locked: false,
    isDangerPlayer: false,
  };
}

// Merge helper for formation rebuilds (FIX mc-21 2a). `applyOwnFormation`
// discards and rebuilds every playerToken from roster+formation; this
// preserves manually-edited identity fields across that rebuild.
//
// Match key: linkedPlayerId. Preservation is unconditional on match (not a
// diffed "was this actually edited" heuristic) — there is no clean signal to
// tell an edited role/note/number apart from one that came from the previous
// formation's default slot label, so we always carry the previous token's
// values forward when matched. Trade-off: a stale positional role label can
// survive a formation change if the user never touched it; preferable to the
// silent full loss this replaces.
//
// Tokens without a linkedPlayerId (roster shorter than the formation, built
// via createPlayerToken(null, ...)) are deliberately NOT preservable — there
// is no stable key to match them across rebuilds. See tests/boardTools.test.ts.
//
// Must not mutate its inputs: `previousTokens` can be the same object
// references held inside undo history (pushHistory stores the board by
// reference, not deep-cloned), so mutating them in place would corrupt an
// already-recorded history entry.
export function mergeFormationTokens(
  previousTokens: BoardObject[],
  nextTokens: BoardObject[],
): BoardObject[] {
  const previousByPlayerId = new Map(
    previousTokens
      .filter((token): token is BoardObject & { linkedPlayerId: string } =>
        Boolean(token.linkedPlayerId),
      )
      .map((token) => [token.linkedPlayerId, token] as const),
  );
  return nextTokens.map((token) => {
    if (!token.linkedPlayerId) return token;
    const previous = previousByPlayerId.get(token.linkedPlayerId);
    if (!previous) return token;
    return {
      ...token,
      role: previous.role,
      note: previous.note,
      number: previous.number,
    };
  });
}

export function tokenFromPlanningPlayer(
  player: PlanningBoardPlayer,
  position: BoardPoint,
  role: string,
  fallbackNumber: number,
): BoardObject {
  const number = Number.parseInt(String(player.number), 10);
  return {
    ...createPlayerToken(
      null,
      position,
      role || player.position,
      Number.isFinite(number) ? number : fallbackNumber,
    ),
    label: player.name,
    number: Number.isFinite(number) ? number : fallbackNumber,
    role: player.role || role || player.position,
    note: [player.task, player.traits].filter(Boolean).join(" / "),
    linkedPlayerId: player.id,
    rosterLink: Number.isFinite(number)
      ? {
          playerId: player.id,
          displayName: player.name,
          number,
          role: player.role || role || player.position,
          linkedAt: new Date().toISOString(),
        }
      : undefined,
  };
}

export function handleCanvasPress({
  point,
  tool,
  scene,
  color,
  updateSceneObjects,
}: {
  point: BoardPoint;
  tool: BoardTool;
  scene: BoardScene;
  color: string;
  updateSceneObjects: (objects: BoardObject[], record?: boolean) => void;
}) {
  // zone/block ya no se crea en el press: es un drag-to-create real, resuelto
  // en el pointerup por resolveZoneDragRect/commitZoneDrag (W8) con el
  // rectangulo completo del gesto (start -> end). Las flechas (W24A) tambien
  // se resuelven fuera de este helper, via stepArrowGestureOnPointerDown/Up
  // — dos gramaticas de gesto distintas del click puro de equipamiento.
  if (tool === "cone" || tool === "mannequin" || tool === "goal") {
    updateSceneObjects([
      ...scene.objects,
      makeEquipmentLikeObject(
        "equipmentMarker",
        labelForTool(tool),
        point,
        color,
      ),
    ]);
  }
}

// === W24A: gramatica de flechas — drag-to-create unificado con click-click
// como fallback explicito ===
//
// El bug que esto reemplaza (audit H3, "flecha fantasma"): la version vieja
// armaba `drawStart` en el pointerDOWN de CUALQUIER primer press con tool de
// flecha, sin distinguir un click de un drag. Un drag real (pointerdown,
// mover, pointerup) armaba el origen en el down y nunca comiteaba en el up
// (no habia logica de up) — el origen quedaba armado en silencio y el
// PROXIMO press de cualquier tipo se comiteaba como "segundo click" no
// querido. La maquina de estados de abajo resuelve TODA la decision en el
// pointerup del gesto pendiente (drag vs click), asi que un gesto que no
// completa nunca deja el origen armado para el proximo click sin que haya
// pasado por una transicion explicita.
export type ArrowGesturePhase =
  | { phase: "idle" }
  | { phase: "pending"; origin: BoardArrowEndpoint; anchor: BoardPoint }
  | { phase: "armed"; origin: BoardArrowEndpoint };

export const IDLE_ARROW_GESTURE: ArrowGesturePhase = { phase: "idle" };

export type ArrowGestureResult = {
  next: ArrowGesturePhase;
  // Presente solo cuando el gesto debe comitear una flecha nueva.
  commit?: { origin: BoardArrowEndpoint; endpoint: BoardArrowEndpoint };
  // Drag o segundo-click que empieza y termina en el mismo token: gesto de
  // cancelar explicito (W24A H3), nunca mudo — el caller decide como avisarlo.
  cancelledSameToken?: boolean;
};

function sameObjectEndpoint(a: BoardArrowEndpoint, b: BoardArrowEndpoint) {
  return a.kind === "object" && b.kind === "object" && a.objectId === b.objectId;
}

// pointerdown con una tool de flecha activa.
export function stepArrowGestureOnPointerDown(
  state: ArrowGesturePhase,
  endpoint: BoardArrowEndpoint,
  point: BoardPoint,
): ArrowGestureResult {
  if (state.phase === "armed") {
    // Segundo click del fallback click-click: comitea o cancela (mismo token).
    if (sameObjectEndpoint(state.origin, endpoint)) {
      return { next: IDLE_ARROW_GESTURE, cancelledSameToken: true };
    }
    return {
      next: IDLE_ARROW_GESTURE,
      commit: { origin: state.origin, endpoint },
    };
  }
  // Gesto nuevo (desde idle, o un pending huerfano defensivo): arranca en
  // "pending" — todavia no sabemos si es un click o un drag, eso se decide en
  // el pointerup.
  return { next: { phase: "pending", origin: endpoint, anchor: point } };
}

// pointerup con una tool de flecha activa. Unico lugar donde se decide si el
// gesto fue un click (arma el origen, fallback click-click) o un drag real
// (comitea/cancela ya mismo). Un pointerup en fase distinta de "pending"
// (p.ej. un mouseup suelto mientras el origen ya esta "armed" esperando el
// segundo click) es un no-op explicito: nunca reintroduce un origen fantasma.
export function stepArrowGestureOnPointerUp(
  state: ArrowGesturePhase,
  point: BoardPoint,
  endpoint: BoardArrowEndpoint,
): ArrowGestureResult {
  if (state.phase !== "pending") {
    return { next: state };
  }
  const dragDistance = gestureDragDistance(state.anchor, point);
  if (dragDistance < ZONE_DRAG_CLICK_THRESHOLD) {
    // No hubo drag real: se trata como el primer click del fallback
    // click-click. Queda armado esperando el segundo click (o Escape).
    return { next: { phase: "armed", origin: state.origin } };
  }
  // Drag real de origen a destino.
  if (sameObjectEndpoint(state.origin, endpoint)) {
    return { next: IDLE_ARROW_GESTURE, cancelledSameToken: true };
  }
  return {
    next: IDLE_ARROW_GESTURE,
    commit: { origin: state.origin, endpoint },
  };
}

// Fabrica la flecha commiteable a partir del resultado de un step — unico
// punto que conoce semanticForTool + createSemanticArrow para el path de
// gesto (drag/click-click), asi useBoardActions no repite la conversion.
export function buildArrowFromGestureCommit(
  commit: NonNullable<ArrowGestureResult["commit"]>,
  tool: BoardTool,
  style: { color: string; tone: string },
): BoardArrow | null {
  const semantic = semanticForTool(tool);
  if (!semantic) return null;
  return createSemanticArrow(semantic, commit.origin, commit.endpoint, {
    label: labelForTool(tool),
    style,
    tacticalMeaning: labelForTool(tool),
  });
}

// 20x16 centrado en el punto — affordance preexistente para clicks sin
// arrastre real (o arrastre por debajo del umbral). No cambia W6/W7.
function centeredZoneRect(point: BoardPoint) {
  return {
    x: clamp(point.x - 10, 1, 78),
    y: clamp(point.y - 10, 1, 78),
    w: 20,
    h: 16,
  };
}

// Resuelve el rectangulo final de una zona/bloque a partir del gesto completo
// (ancla de pointerdown -> punto de pointerup). Por debajo del umbral de
// click usa el 20x16 centrado existente; por encima, el rectangulo real del
// drag (esquinas en cualquier orden, normalizado, con piso de tamano).
export function resolveZoneDragRect(
  start: BoardPoint,
  end: BoardPoint,
): { x: number; y: number; w: number; h: number } {
  const dragDistance = Math.max(
    Math.abs(end.x - start.x),
    Math.abs(end.y - start.y),
  );
  if (dragDistance < ZONE_DRAG_CLICK_THRESHOLD) {
    return centeredZoneRect(start);
  }
  return normalizeZoneRect(start, end);
}

// Commitea UNA zona/bloque por gesto (pointerup), nunca en cada pointermove
// — asi el undo registra una sola entrada por zona creada.
export function commitZoneDrag({
  tool,
  start,
  end,
  scene,
  color,
  commitScene,
}: {
  tool: "zone" | "block";
  start: BoardPoint;
  end: BoardPoint;
  scene: BoardScene;
  color: string;
  commitScene: (patch: Partial<BoardScene>, record?: boolean) => void;
}) {
  const rect = resolveZoneDragRect(start, end);
  const zone = createTacticalZone(
    tool === "block" ? "block" : "occupation",
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    {
      label: tool === "block" ? "Bloque" : "Zona",
      color,
      tacticalMeaning:
        tool === "block" ? "Bloque compacto" : "Zona de ocupacion",
    },
  );
  commitScene({ zones: [...scene.zones, zone] });
}

// === FIXUP W25B: la razon de un block de gramatica tactica (boardTacticalGrammar.ts)
// tiene que GANARLE al hint pasivo de la tool, no convivir a la par de el.
//
// El bug (gate en vivo del combinado W25): la flecha bloqueada se rechazaba
// bien (no se creaba), pero la razon vivia solo en el status del footer,
// chica y lejos de donde el usuario esta mirando (la cancha). El hint
// pasivo ("Arrastra de origen a destino...") sigue mostrandose ahi arriba
// sin cambios, asi que para el DT el gesto se siente como un fallo mudo — el
// mismo pecado que la flecha fantasma de W24A H3.
//
// Fix: el MISMO renglon del hint pasivo (arriba de la cancha, donde el ojo
// ya esta puesto tras el gesto) muestra la razon del block mientras esta
// vigente, con prioridad absoluta sobre el hint generico. `useBoardActions`
// mantiene esa vigencia con un timeout (ARROW_BLOCK_HINT_TTL_MS) y la corta
// antes si el usuario arranca un gesto nuevo real — esta funcion es pura y
// solo decide QUE TEXTO gana, no CUANTO dura.
export const ARROW_BLOCK_HINT_TTL_MS = 4000;

export function resolveArrowHintText(params: {
  grammarBlockReason: string | null;
  isArrowToolActive: boolean;
  armed: boolean;
}): string | null {
  if (params.grammarBlockReason) return params.grammarBlockReason;
  if (!params.isArrowToolActive) return null;
  return params.armed
    ? "Origen fijado — hace clic en el destino (Escape cancela)"
    : "Arrastra de origen a destino para crear la flecha, o hace clic-clic (Escape cancela)";
}
