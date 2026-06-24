import { type BoardTool, TOOL_DEFS } from "./boardConstants";
import { clamp } from "./boardGeometry";
import type {
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
  targetId,
  scene,
  color,
  lineWidth,
  drawStart,
  setDrawStart,
  commitScene,
  updateSceneObjects,
}: {
  point: BoardPoint;
  tool: BoardTool;
  // Id del token bajo el click, si lo hubo. v1: anclaje por click-sobre-token.
  targetId?: string;
  scene: BoardScene;
  color: string;
  lineWidth: number;
  drawStart: BoardArrowEndpoint | null;
  setDrawStart: (endpoint: BoardArrowEndpoint | null) => void;
  commitScene: (patch: Partial<BoardScene>, record?: boolean) => void;
  updateSceneObjects: (objects: BoardObject[], record?: boolean) => void;
}) {
  const style = { color, tone: String(lineWidth) };
  const arrowSemantic = semanticForTool(tool);
  if (arrowSemantic) {
    // Click sobre token -> endpoint anclado al objeto; sobre vacio -> punto
    // libre (la excepcion). El seguimiento al mover el token ya lo resuelve el
    // render via endpointPoint/resolveBoardScenePoint.
    const endpoint: BoardArrowEndpoint = targetId
      ? { kind: "object", objectId: targetId }
      : { kind: "point", point };
    if (!drawStart) {
      setDrawStart(endpoint);
      return;
    }
    // Gesto de cancelar: segundo click sobre el mismo token origen.
    if (
      drawStart.kind === "object" &&
      endpoint.kind === "object" &&
      drawStart.objectId === endpoint.objectId
    ) {
      setDrawStart(null);
      return;
    }
    const arrow = createSemanticArrow(arrowSemantic, drawStart, endpoint, {
      label: labelForTool(tool),
      style,
      tacticalMeaning: labelForTool(tool),
    });
    commitScene({ arrows: [...scene.arrows, arrow] });
    setDrawStart(null);
    return;
  }
  if (tool === "zone" || tool === "block") {
    const zone = createTacticalZone(
      tool === "block" ? "block" : "occupation",
      clamp(point.x - 10, 1, 78),
      clamp(point.y - 10, 1, 78),
      20,
      16,
      {
        label: tool === "block" ? "Bloque" : "Zona",
        color,
        tacticalMeaning:
          tool === "block" ? "Bloque compacto" : "Zona de ocupacion",
      },
    );
    commitScene({ zones: [...scene.zones, zone] });
    return;
  }
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
