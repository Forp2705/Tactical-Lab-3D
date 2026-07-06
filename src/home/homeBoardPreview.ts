import type { BoardPoint, TacticalBoard } from "@/board/boardModel";
import type { Player } from "@/data";
import type { LineupLabShape } from "@/state/useAppStore";

/**
 * View-model puro del panel TABLERO TACTICO de Sala (E8). Deriva, sin tocar
 * el store ni montar nada del editor de Pizarra, que se dibuja en el pitch
 * read-only: board activo > shape mas reciente > vacio.
 *
 * DECISION DE EJES (documentada por acceptance):
 * - Board y LineupLab guardan coords 0-100 sobre cancha HORIZONTAL:
 *   x = eje largo (arco propio en x=0, GK propio ~x=7-8; arco rival x=100),
 *   y = eje ancho.
 * - El pitch de Sala es VERTICAL (mockup: equipo propio abajo atacando hacia
 *   arriba). Mapeo: vx = y (ancho -> horizontal), vy = 100 - x (largo ->
 *   vertical invertido, arco propio abajo). La salida sigue en 0-100; el
 *   componente escala al viewBox solo en render (regla: geometria en 0-100,
 *   escala solo en la capa de render).
 * - "Primera phase de la escena": el modelo de board guarda objects a nivel
 *   escena (las phases no tienen posiciones propias), asi que el render de la
 *   primera phase son los objects de la escena activa.
 */

export type HomeBoardPreviewToken = {
  id: string;
  team: "A" | "B";
  /** Coords 0-100 en cancha vertical: x = ancho, y = largo (arco propio y=100). */
  x: number;
  y: number;
  number?: number;
  role?: string;
};

export type HomeBoardPreview =
  | {
      kind: "board";
      chip: string;
      tokens: HomeBoardPreviewToken[];
      ball: { x: number; y: number } | null;
    }
  | {
      kind: "shape";
      chip: string;
      tokens: HomeBoardPreviewToken[];
    }
  | { kind: "empty" };

export const HOME_BOARD_CHIP_MAX = 16;

export function clampChipLabel(
  text: string,
  max = HOME_BOARD_CHIP_MAX,
): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

/** Cancha horizontal 0-100 -> cancha vertical 0-100 (arco propio abajo). */
export function toVerticalPitch(point: BoardPoint): { x: number; y: number } {
  return { x: point.y, y: 100 - point.x };
}

export function deriveHomeBoardPreview(input: {
  tacticalBoards: TacticalBoard[];
  activeBoardId: string | null;
  activeBoardSceneId: string | null;
  shapes: LineupLabShape[];
  players: Player[];
}): HomeBoardPreview {
  const board = input.activeBoardId
    ? input.tacticalBoards.find((item) => item.id === input.activeBoardId)
    : undefined;
  if (board) return previewFromBoard(board, input.activeBoardSceneId);

  const shape = mostRecentShape(input.shapes);
  if (shape) return previewFromShape(shape, input.players);

  return { kind: "empty" };
}

function previewFromBoard(
  board: TacticalBoard,
  activeBoardSceneId: string | null,
): HomeBoardPreview {
  const scene =
    board.scenes.find((item) => item.id === activeBoardSceneId) ??
    board.scenes[0];
  const tokens: HomeBoardPreviewToken[] = [];
  let ball: { x: number; y: number } | null = null;
  for (const object of scene?.objects ?? []) {
    if (object.type === "ball") {
      ball = ball ?? toVerticalPitch(object.position);
      continue;
    }
    // Solo fichas reales del board; note/equipmentMarker no son fichas y el
    // token punteado "LIBRE" del mockup no se sintetiza nunca.
    if (object.type !== "playerToken" && object.type !== "opponentToken") {
      continue;
    }
    tokens.push({
      id: object.id,
      team: object.type === "playerToken" ? "A" : "B",
      ...toVerticalPitch(object.position),
      number: object.number,
      role: object.role,
    });
  }
  return {
    kind: "board",
    chip: clampChipLabel(board.title),
    tokens,
    ball,
  };
}

function previewFromShape(
  shape: LineupLabShape,
  players: Player[],
): HomeBoardPreview {
  const tokens: HomeBoardPreviewToken[] = Object.entries(shape.positions).map(
    ([playerId, position]) => {
      const player = players.find((item) => item.id === playerId);
      return {
        id: playerId,
        team: "A" as const,
        ...toVerticalPitch(position),
        // Dorsal solo si el player resuelve contra el plantel; sin invento.
        number: player?.num,
      };
    },
  );
  return {
    kind: "shape",
    chip: clampChipLabel(shape.name),
    tokens,
  };
}

function mostRecentShape(shapes: LineupLabShape[]): LineupLabShape | null {
  if (shapes.length === 0) return null;
  return shapes.reduce((latest, item) =>
    item.createdAt > latest.createdAt ? item : latest,
  );
}
