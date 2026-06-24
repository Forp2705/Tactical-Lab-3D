import { beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultBoard,
  duplicateBoardScene,
  summarizeBoardForAi,
} from "../src/board";
import type { SessionBlock } from "../src/data/schemas";
import {
  APP_SNAPSHOT_VERSION,
  type AppSnapshot,
  parseSnapshot,
} from "../src/state/db";
import { useAppStore } from "../src/state/useAppStore";
import type { WeeklyDecisionThread } from "../src/state/weeklyDecisionThread";

function block(overrides: Partial<SessionBlock> = {}): SessionBlock {
  return {
    id: "block-1",
    exerciseId: "exercise-1",
    durationMin: 20,
    swappable: true,
    ...overrides,
  };
}

const weeklyThread: WeeklyDecisionThread = {
  id: "weekly-thread-board",
  teamId: "team-demo",
  problem:
    "El rival nos fija al lateral y no encontramos tercer hombre en salida.",
  origin: "coach",
  evidenceIds: ["obs-1"],
  mode: "diagnosis",
  confidence: 0.64,
  sessionIntent: {
    problem: "Salida bloqueada por presion exterior.",
    objective: "Atraer por fuera y liberar tercer hombre interior.",
    successSignal: "El pivote recibe perfilado tras la segunda circulacion.",
    reviewCriteria: "Revisar si aparece ante presion alta el proximo partido.",
  },
  nextReviewCriteria: ["Ver si aparece el tercer hombre en salida."],
  status: "open",
  progress: "open",
  createdAt: "2026-06-16T10:00:00.000Z",
  updatedAt: "2026-06-16T10:00:00.000Z",
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState((state) => ({
    weeklyDecisionThread: weeklyThread,
    tacticalBoards: [],
    session: {
      ...state.session,
      blocks: [block()],
    },
  }));
});

describe("Tactical Board store integration", () => {
  it("creates a board from weekly focus and stores the weekly link", () => {
    const id = useAppStore.getState().createTacticalBoardFromWeeklyFocus();
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === id);

    expect(board?.linkedWeeklyFocusId).toBe(weeklyThread.id);
    expect(board?.plannedSolution).toBe(true);
    expect(board?.globalInstruction).toContain("tercer hombre");
    expect(useAppStore.getState().activeBoardId).toBe(id);
    expect(useAppStore.getState().activeBoardSceneId).toBe(
      board?.scenes[0]?.id,
    );
    expect(useAppStore.getState().view).toBe("board");
  });

  it("opens an exact tactical board scene through store state", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan abierto" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    useAppStore
      .getState()
      .duplicateTacticalBoardScene(board.id, board.scenes[0].id);
    const withTwoScenes = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === board.id);
    const secondSceneId = withTwoScenes?.scenes[1]?.id;
    expect(secondSceneId).toBeTruthy();
    if (!secondSceneId) return;

    useAppStore.getState().openTacticalBoard(board.id, secondSceneId);

    expect(useAppStore.getState().view).toBe("board");
    expect(useAppStore.getState().activeBoardId).toBe(board.id);
    expect(useAppStore.getState().activeBoardSceneId).toBe(secondSceneId);
  });

  it("clears active board pointers safely when opening a missing board", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan activo" });
    expect(useAppStore.getState().activeBoardId).toBe(boardId);

    useAppStore
      .getState()
      .openTacticalBoard("board-does-not-exist", "scene-does-not-exist");

    expect(useAppStore.getState().view).toBe("board");
    expect(useAppStore.getState().activeBoardId).toBeNull();
    expect(useAppStore.getState().activeBoardSceneId).toBeNull();
  });

  it("supports 3 scenes, duplicate and reorder without losing scene data", () => {
    const id = useAppStore
      .getState()
      .createTacticalBoard({ title: "Salida rival" });
    const state = useAppStore.getState();
    const board = state.tacticalBoards.find((entry) => entry.id === id);
    expect(board).toBeTruthy();
    if (!board) return;

    state.duplicateTacticalBoardScene(id, board.scenes[0].id);
    const afterDuplicate = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === id);
    expect(afterDuplicate?.scenes).toHaveLength(2);
    if (!afterDuplicate) return;

    useAppStore
      .getState()
      .duplicateTacticalBoardScene(id, afterDuplicate.scenes[1].id);
    const withThree = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === id);
    expect(withThree?.scenes).toHaveLength(3);
    const originalOrder = withThree?.scenes.map((scene) => scene.id) ?? [];

    useAppStore.getState().reorderTacticalBoardScenes(id, 0, 2);
    const reordered = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === id);
    expect(reordered?.scenes.map((scene) => scene.id)).toEqual([
      originalOrder[1],
      originalOrder[2],
      originalOrder[0],
    ]);
  });

  it("attaches and detaches a board scene to a session block without touching sketchId", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan de presion" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    useAppStore.setState((state) => ({
      session: {
        ...state.session,
        blocks: [{ ...state.session.blocks[0], sketchId: "sketch-existing" }],
      },
    }));

    useAppStore
      .getState()
      .attachBoardToSessionBlock("block-1", board.id, board.scenes[0].id);
    const attached = useAppStore.getState().session.blocks[0];
    expect(attached.boardId).toBe(board.id);
    expect(attached.boardSceneId).toBe(board.scenes[0].id);
    expect(attached.sketchId).toBe("sketch-existing");

    useAppStore.getState().detachBoardFromSessionBlock("block-1");
    const detached = useAppStore.getState().session.blocks[0];
    expect(detached.boardId).toBeUndefined();
    expect(detached.boardSceneId).toBeUndefined();
    expect(detached.sketchId).toBe("sketch-existing");
  });

  it("attaches boards only through explicit valid board and scene references", () => {
    useAppStore
      .getState()
      .attachBoardToSessionBlock("block-1", "missing-board", "missing-scene");
    expect(useAppStore.getState().session.blocks[0].boardId).toBeUndefined();
    expect(
      useAppStore.getState().session.blocks[0].boardSceneId,
    ).toBeUndefined();

    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Explicit scene" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    useAppStore
      .getState()
      .attachBoardToSessionBlock("block-1", board.id, "missing-scene");
    expect(useAppStore.getState().session.blocks[0].boardId).toBeUndefined();
    expect(
      useAppStore.getState().session.blocks[0].boardSceneId,
    ).toBeUndefined();

    useAppStore
      .getState()
      .attachBoardToSessionBlock("block-1", board.id, board.scenes[0].id);

    expect(useAppStore.getState().session.blocks[0].boardId).toBe(board.id);
    expect(useAppStore.getState().session.blocks[0].boardSceneId).toBe(
      board.scenes[0].id,
    );
  });

  it("clears dangling session board links when a board is deleted", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan borrable" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;
    useAppStore
      .getState()
      .attachBoardToSessionBlock("block-1", board.id, board.scenes[0].id);

    useAppStore.getState().deleteTacticalBoard(board.id);

    expect(
      useAppStore
        .getState()
        .tacticalBoards.some((entry) => entry.id === board.id),
    ).toBe(false);
    expect(useAppStore.getState().session.blocks[0].boardId).toBeUndefined();
    expect(
      useAppStore.getState().session.blocks[0].boardSceneId,
    ).toBeUndefined();
    expect(useAppStore.getState().activeBoardId).toBeNull();
    expect(useAppStore.getState().activeBoardSceneId).toBeNull();
  });

  it("creates a session block draft from a board scene", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan entrenable" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    const before = useAppStore.getState().session.blocks.length;
    useAppStore
      .getState()
      .createSessionBlockFromBoardScene(board.id, board.scenes[0].id);
    const blocks = useAppStore.getState().session.blocks;
    const created = blocks.at(-1);

    expect(blocks).toHaveLength(before + 1);
    expect(created?.boardId).toBe(board.id);
    expect(created?.boardSceneId).toBe(board.scenes[0].id);
    expect(created?.notes).toContain("Objetivo:");
    expect(created?.notes).toContain("Senal de exito:");
  });

  it("maps the board workspace (problem + exercise builder) into the created block", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "Plan fiel" });
    const board = useAppStore
      .getState()
      .tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    useAppStore.getState().updateBoardWorkspace(board.id, {
      ...board.workspace,
      problem: { problem: "El 5 queda tapado", objective: "Liberar al pivote" },
      exercise: {
        ...board.workspace.exercise,
        objective: "Salir ante 4-4-2",
        rule: "Gol doble por el medio",
        successCondition: "Tres salidas limpias",
        duration: "13 min",
      },
    });

    useAppStore
      .getState()
      .createSessionBlockFromBoardScene(board.id, board.scenes[0].id);
    const created = useAppStore.getState().session.blocks.at(-1);
    expect(created).toBeTruthy();
    if (!created) return;

    const variant = useAppStore
      .getState()
      .exerciseVariants.find((entry) => entry.id === created.exerciseId);

    // The DT's free text lands in the block, not a generic placeholder.
    expect(variant?.objective.primary).toBe("Salir ante 4-4-2");
    expect(variant?.rules).toContain("Gol doble por el medio");
    expect(variant?.success).toBe("Tres salidas limpias");
    expect(created.durationMin).toBe(13);
    expect(created.notes).toContain("El 5 queda tapado");
  });

  it("serializes and parses a board with 3 scenes exactly in the app snapshot", () => {
    const board = duplicateBoardScene(
      duplicateBoardScene(
        createDefaultBoard("Snapshot board"),
        "scene-missing",
      ),
      "scene-missing",
    );
    const withThree = {
      ...board,
      scenes: [
        board.scenes[0],
        { ...board.scenes[0], id: "scene-2", title: "Escena 2" },
        { ...board.scenes[0], id: "scene-3", title: "Escena 3" },
      ],
    };
    const s = useAppStore.getState();
    const snapshot = {
      version: APP_SNAPSHOT_VERSION,
      selectedExerciseId: s.selectedExerciseId,
      view: s.view,
      camera: s.camera,
      viewerQuality: s.viewerQuality,
      time: s.time,
      speed: s.speed,
      playing: s.playing,
      search: s.search,
      phase: s.phase,
      level: s.level,
      principle: s.principle,
      exerciseVariants: s.exerciseVariants,
      libraryFavoriteIds: s.libraryFavoriteIds,
      libraryRecentOpens: s.libraryRecentOpens,
      showZones: s.showZones,
      showRuns: s.showRuns,
      showPasses: s.showPasses,
      showPress: s.showPress,
      personalSpace: s.personalSpace,
      layers: s.layers,
      team: s.team,
      workspaceMode: s.workspaceMode,
      teamIdentity: s.teamIdentity,
      gameModel: s.gameModel,
      opponentScout: s.opponentScout,
      session: s.session,
      microcycle: s.microcycle,
      lineupLab: s.lineupLab,
      sketches: s.sketches,
      tacticalBoards: [withThree],
      activeBoardId: withThree.id,
      activeBoardSceneId: "scene-2",
      tags: s.tags,
      tracks: s.tracks,
      manualObservations: s.manualObservations,
      weeklyDecisionThread: s.weeklyDecisionThread,
      aiPrompt: s.aiPrompt,
    } satisfies AppSnapshot;

    const parsed = parseSnapshot(snapshot);
    expect(
      parsed?.tacticalBoards?.[0]?.scenes.map((scene) => scene.id),
    ).toEqual([board.scenes[0].id, "scene-2", "scene-3"]);
    expect(parsed?.activeBoardId).toBe(withThree.id);
    expect(parsed?.activeBoardSceneId).toBe("scene-2");
  });

  it("AI board summary is read-only and does not mutate board or memory", () => {
    const boardId = useAppStore
      .getState()
      .createTacticalBoard({ title: "AI read only" });
    const before = useAppStore.getState();
    const board = before.tacticalBoards.find((entry) => entry.id === boardId);
    expect(board).toBeTruthy();
    if (!board) return;

    const summary = summarizeBoardForAi(board);

    expect(summary.title).toBe("AI read only");
    expect(
      useAppStore
        .getState()
        .tacticalBoards.find((entry) => entry.id === boardId),
    ).toEqual(board);
    expect(useAppStore.getState().manualObservations).toEqual(
      before.manualObservations,
    );
  });
});
