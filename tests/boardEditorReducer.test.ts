import { describe, expect, it } from "vitest";
import { createDefaultBoard } from "../src/board";
import {
  type BoardEditorState,
  type BoardWorkspaceState,
  boardEditorReducer,
  initialBoardEditorState,
  resolveBoardWorkspace,
  seedRosterFromPlayers,
  shouldPersistWorkspace,
} from "../src/board/boardEditorReducer";
import type { Player } from "../src/data";

const players = [
  { id: "p1", name: "Uno", positions: ["MC"], num: 5, profile: "base" },
  { id: "p2", name: "Dos", positions: ["DC"], num: 9, profile: "base" },
] as unknown as Player[];

function workspaceFor(boardId: string): BoardWorkspaceState {
  return resolveBoardWorkspace(createDefaultBoard(boardId), []);
}

function hydrate(boardId: string): BoardEditorState {
  return boardEditorReducer(initialBoardEditorState, {
    type: "hydrate",
    boardId,
    workspace: workspaceFor(boardId),
  });
}

describe("boardEditorReducer — hydration", () => {
  it("hydration loads the workspace and starts clean", () => {
    const state = hydrate("board-a");
    expect(state.hydratedBoardId).toBe("board-a");
    expect(state.dirty).toBe(false);
    expect(state.workspace.currentView).toBe("Ataque");
    expect(shouldPersistWorkspace(state, "board-a")).toBe(false);
  });

  it("re-hydrating the same board is a no-op and never overwrites edits", () => {
    const edited = boardEditorReducer(hydrate("board-a"), {
      type: "setProblem",
      value: { problem: "edit", objective: "edit" },
    });
    expect(edited.dirty).toBe(true);

    const reHydrated = boardEditorReducer(edited, {
      type: "hydrate",
      boardId: "board-a",
      workspace: workspaceFor("board-a"),
    });
    // Same reference returned → React bails out, edits preserved.
    expect(reHydrated).toBe(edited);
    expect(reHydrated.workspace.problem.problem).toBe("edit");
  });

  it("switching to a different board re-hydrates clean", () => {
    const edited = boardEditorReducer(hydrate("board-a"), {
      type: "setTeamAFormation",
      value: "3-5-2",
    });
    const switched = boardEditorReducer(edited, {
      type: "hydrate",
      boardId: "board-b",
      workspace: workspaceFor("board-b"),
    });
    expect(switched.hydratedBoardId).toBe("board-b");
    expect(switched.dirty).toBe(false);
    expect(switched.workspace.teamAFormation).toBe("4-3-3");
    // The old board id no longer persists from this state.
    expect(shouldPersistWorkspace(switched, "board-a")).toBe(false);
  });
});

describe("boardEditorReducer — edits update the workspace", () => {
  it("each setter updates its slice and marks dirty", () => {
    const base = hydrate("board-a");
    expect(
      boardEditorReducer(base, {
        type: "setProblem",
        value: { problem: "x", objective: "y" },
      }).workspace.problem,
    ).toEqual({ problem: "x", objective: "y" });
    expect(
      boardEditorReducer(base, {
        type: "setCurrentView",
        value: "Defensa",
      }).workspace.currentView,
    ).toBe("Defensa");
    expect(
      boardEditorReducer(base, {
        type: "setExercise",
        value: { ...base.workspace.exercise, space: "20x20" },
      }).workspace.exercise.space,
    ).toBe("20x20");
    expect(
      boardEditorReducer(base, {
        type: "setProblem",
        value: { problem: "x", objective: "y" },
      }).dirty,
    ).toBe(true);
  });

  it("roster and layers support functional updaters", () => {
    const seeded = boardEditorReducer(hydrate("board-a"), {
      type: "setRoster",
      value: seedRosterFromPlayers(players),
    });
    const filtered = boardEditorReducer(seeded, {
      type: "setRoster",
      value: (roster) => roster.filter((player) => player.id !== "p1"),
    });
    expect(filtered.workspace.roster.map((p) => p.id)).toEqual(["p2"]);

    const toggled = boardEditorReducer(hydrate("board-a"), {
      type: "setLayers",
      value: (layers) =>
        layers.map((layer) =>
          layer.id === "attack" ? { ...layer, visible: false } : layer,
        ),
    });
    expect(
      toggled.workspace.layers.find((l) => l.id === "attack")?.visible,
    ).toBe(false);
  });
});

describe("boardEditorReducer — persistence has no loop", () => {
  it("persist gate opens on edit and closes after persisted", () => {
    const edited = boardEditorReducer(hydrate("board-a"), {
      type: "setCurrentView",
      value: "ABP",
    });
    expect(shouldPersistWorkspace(edited, "board-a")).toBe(true);

    const persisted = boardEditorReducer(edited, { type: "persisted" });
    expect(persisted.dirty).toBe(false);
    expect(shouldPersistWorkspace(persisted, "board-a")).toBe(false);

    // A redundant "persisted" is a stable no-op (same reference).
    expect(boardEditorReducer(persisted, { type: "persisted" })).toBe(
      persisted,
    );
  });
});

describe("shouldPersistWorkspace gate", () => {
  it("only persists for the hydrated board with pending edits", () => {
    const dirty = boardEditorReducer(hydrate("board-a"), {
      type: "setProblem",
      value: { problem: "x", objective: "y" },
    });
    expect(shouldPersistWorkspace(dirty, null)).toBe(false);
    expect(shouldPersistWorkspace(dirty, "board-b")).toBe(false);
    expect(shouldPersistWorkspace(dirty, "board-a")).toBe(true);
    expect(shouldPersistWorkspace(hydrate("board-a"), "board-a")).toBe(false);
  });
});

describe("resolveBoardWorkspace — reload keeps workspace, seeds when empty", () => {
  it("keeps a persisted roster on reload", () => {
    const board = createDefaultBoard("with-roster", { players });
    expect(board.workspace.roster).toHaveLength(2);
    const resolved = resolveBoardWorkspace(board, []);
    expect(resolved.roster).toHaveLength(2);
  });

  it("seeds the roster from the team when the board has none", () => {
    const board = createDefaultBoard("empty");
    expect(board.workspace.roster).toEqual([]);
    const resolved = resolveBoardWorkspace(board, players);
    expect(resolved.roster.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("passes problem/exercise/layers/view/formation through", () => {
    const board = createDefaultBoard("pass-through");
    const resolved = resolveBoardWorkspace(board, []);
    expect(resolved.problem).toEqual(board.workspace.problem);
    expect(resolved.exercise).toEqual(board.workspace.exercise);
    expect(resolved.layers).toEqual(board.workspace.layers);
    expect(resolved.currentView).toBe(board.workspace.currentView);
    expect(resolved.teamAFormation).toBe(board.workspace.teamAFormation);
  });
});
