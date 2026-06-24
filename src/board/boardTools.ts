import { type BoardTool, TOOL_DEFS } from "./boardConstants";
import { clamp } from "./boardGeometry";
import type {
  BoardArrowSemantic,
  BoardObject,
  BoardPoint,
  BoardScene,
} from "./boardModel";
import {
  createBoardId,
  createPlayerToken,
  createSemanticArrow,
  createTacticalZone,
} from "./boardModel";
import type { PlanningBoardPlayer } from "./productBoardTypes";

export function semanticForTool(tool: BoardTool): BoardArrowSemantic | null {
  if (tool === "ballRoute" || tool === "longPass" || tool === "cross")
    return "pass";
  if (tool === "pressureLine") return "pressure";
  if (tool === "run") return "run";
  if (
    tool === "line" ||
    tool === "pencil" ||
    tool === "arrow" ||
    tool === "shot"
  )
    return "movement";
  return null;
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
  scene: BoardScene;
  color: string;
  lineWidth: number;
  drawStart: BoardPoint | null;
  setDrawStart: (point: BoardPoint | null) => void;
  commitScene: (patch: Partial<BoardScene>, record?: boolean) => void;
  updateSceneObjects: (objects: BoardObject[], record?: boolean) => void;
}) {
  const style = { color, tone: String(lineWidth) };
  const arrowSemantic = semanticForTool(tool);
  if (arrowSemantic) {
    if (!drawStart) {
      setDrawStart(point);
      return;
    }
    const arrow = createSemanticArrow(
      arrowSemantic,
      { kind: "point", point: drawStart },
      { kind: "point", point },
      {
        label: labelForTool(tool),
        style,
        tacticalMeaning: labelForTool(tool),
      },
    );
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
  if (tool === "text") {
    updateSceneObjects([
      ...scene.objects,
      makeEquipmentLikeObject("note", "Buscar pase entre lineas", point, color),
    ]);
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
