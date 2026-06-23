import type { SessionBlock } from "@/data";
import type { Selection } from "./boardConstants";
import type {
  BoardArrow,
  BoardObject,
  BoardScene,
  BoardZone,
  TacticalBoard,
} from "./boardModel";
import type { PlanningBoardLayer } from "./productBoardTypes";

/** Resolve the active board from the store list, matching the legacy fallback. */
export function resolveActiveBoard(
  boards: TacticalBoard[],
  activeBoardId: string | null,
): TacticalBoard | null {
  return (
    boards.find((item) => item.id === activeBoardId) ??
    (!activeBoardId && boards.length === 1 ? boards[0] : null)
  );
}

/** Resolve the active scene within a board, falling back to the first scene. */
export function resolveActiveScene(
  board: TacticalBoard | null,
  activeBoardSceneId: string | null,
): BoardScene | null {
  return (
    board?.scenes.find((item) => item.id === activeBoardSceneId) ??
    board?.scenes[0] ??
    null
  );
}

export type ResolvedSelection = {
  selectedObject: BoardObject | null;
  selectedArrow: BoardArrow | null;
  selectedZone: BoardZone | null;
};

/** Resolve the currently selected object/arrow/zone for the inspector. */
export function resolveBoardSelection(
  selection: Selection,
  scene: BoardScene,
): ResolvedSelection {
  return {
    selectedObject:
      selection?.kind === "object"
        ? (scene.objects.find((object) => object.id === selection.id) ?? null)
        : null,
    selectedArrow:
      selection?.kind === "arrow"
        ? (scene.arrows.find((arrow) => arrow.id === selection.id) ?? null)
        : null,
    selectedZone:
      selection?.kind === "zone"
        ? (scene.zones.find((zone) => zone.id === selection.id) ?? null)
        : null,
  };
}

/** The set of visible layer ids, used to filter what the pitch renders. */
export function getActiveLayers(layers: PlanningBoardLayer[]): Set<string> {
  return new Set(
    layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
}

/** The readiness checklist shown in the board health strip. */
export function buildBoardReadiness(
  board: TacticalBoard,
  sessionBlocks: SessionBlock[],
  scene: BoardScene,
): string[] {
  return [
    board.linkedWeeklyFocusId ? "Foco semanal vinculado" : "Sin foco semanal",
    sessionBlocks.some((block) => block.boardId === board.id)
      ? "Sesion vinculada"
      : "Sin sesion",
    scene.instructions.some(
      (instruction) => instruction.visibility === "player",
    )
      ? "Brief jugadores listo"
      : "Faltan instrucciones visibles",
    scene.notes ? "Notas staff presentes" : "Sin notas staff",
  ];
}

/** The project label shown in the topbar. */
export function boardProjectLabel(weeklyProblem: string | undefined): string {
  return weeklyProblem ? "Foco semanal activo" : "Partido vs. Rojos FC";
}
