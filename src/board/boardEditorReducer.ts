import type { Player } from "@/data";
import type { TacticalBoard } from "./boardModel";
import {
  type CurrentBoardView,
  DEFAULT_BOARD_LAYERS,
  DEFAULT_EXERCISE_BUILDER,
  DEFAULT_TACTICAL_PROBLEM,
  type ExerciseBuilder,
  type PlanningBoardLayer,
  type PlanningBoardPlayer,
  type TacticalProblem,
} from "./productBoardTypes";

/**
 * The editor-side workspace state, mirrored from `board.workspace`. It is held
 * locally so edits feel instant, then persisted back to the board (the single
 * source of truth) via the store. See useBoardEditor for the wiring.
 */
export type BoardWorkspaceState = {
  roster: PlanningBoardPlayer[];
  problem: TacticalProblem;
  exercise: ExerciseBuilder;
  layers: PlanningBoardLayer[];
  currentView: CurrentBoardView;
  teamAFormation: string;
};

export type BoardEditorState = {
  /** Which board id the workspace was last hydrated from. Guards re-hydration. */
  hydratedBoardId: string | null;
  /** True when the workspace has unpersisted edits. */
  dirty: boolean;
  workspace: BoardWorkspaceState;
};

type Updater<T> = T | ((prev: T) => T);

export type BoardEditorAction =
  | { type: "hydrate"; boardId: string; workspace: BoardWorkspaceState }
  | { type: "setRoster"; value: Updater<PlanningBoardPlayer[]> }
  | { type: "setProblem"; value: Updater<TacticalProblem> }
  | { type: "setExercise"; value: Updater<ExerciseBuilder> }
  | { type: "setLayers"; value: Updater<PlanningBoardLayer[]> }
  | { type: "setCurrentView"; value: Updater<CurrentBoardView> }
  | { type: "setTeamAFormation"; value: Updater<string> }
  | { type: "persisted" };

export const EMPTY_WORKSPACE: BoardWorkspaceState = {
  roster: [],
  problem: DEFAULT_TACTICAL_PROBLEM,
  exercise: DEFAULT_EXERCISE_BUILDER,
  layers: DEFAULT_BOARD_LAYERS,
  currentView: "Ataque",
  teamAFormation: "4-3-3",
};

export const initialBoardEditorState: BoardEditorState = {
  hydratedBoardId: null,
  dirty: false,
  workspace: EMPTY_WORKSPACE,
};

function applyUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function"
    ? (updater as (value: T) => T)(prev)
    : updater;
}

function patchWorkspace(
  state: BoardEditorState,
  partial: Partial<BoardWorkspaceState>,
): BoardEditorState {
  return {
    ...state,
    workspace: { ...state.workspace, ...partial },
    dirty: true,
  };
}

export function boardEditorReducer(
  state: BoardEditorState,
  action: BoardEditorAction,
): BoardEditorState {
  switch (action.type) {
    case "hydrate":
      // Hydrate once per board: re-dispatching for the same board id is a no-op
      // so in-progress edits are never overwritten by our own persistence echo.
      if (state.hydratedBoardId === action.boardId) return state;
      return {
        hydratedBoardId: action.boardId,
        dirty: false,
        workspace: action.workspace,
      };
    case "setRoster":
      return patchWorkspace(state, {
        roster: applyUpdater(action.value, state.workspace.roster),
      });
    case "setProblem":
      return patchWorkspace(state, {
        problem: applyUpdater(action.value, state.workspace.problem),
      });
    case "setExercise":
      return patchWorkspace(state, {
        exercise: applyUpdater(action.value, state.workspace.exercise),
      });
    case "setLayers":
      return patchWorkspace(state, {
        layers: applyUpdater(action.value, state.workspace.layers),
      });
    case "setCurrentView":
      return patchWorkspace(state, {
        currentView: applyUpdater(action.value, state.workspace.currentView),
      });
    case "setTeamAFormation":
      return patchWorkspace(state, {
        teamAFormation: applyUpdater(
          action.value,
          state.workspace.teamAFormation,
        ),
      });
    case "persisted":
      return state.dirty ? { ...state, dirty: false } : state;
    default:
      return state;
  }
}

/**
 * Whether the workspace should be persisted right now: only for the board it
 * was hydrated from, and only when there are real edits. After persisting, the
 * "persisted" action clears `dirty`, so this returns false again — no loop.
 */
export function shouldPersistWorkspace(
  state: BoardEditorState,
  activeBoardId: string | null,
): boolean {
  return (
    activeBoardId !== null &&
    state.hydratedBoardId === activeBoardId &&
    state.dirty
  );
}

export function seedRosterFromPlayers(
  players: Player[],
): PlanningBoardPlayer[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.positions[0] ?? "Sin puesto",
    number: player.num,
    traits: player.profile,
    team: "A",
  }));
}

/**
 * Build the workspace state for a board. Uses the board's persisted workspace,
 * seeding the roster from the team when the board has none yet (matching the
 * old localStorage seeding behavior).
 */
export function resolveBoardWorkspace(
  board: TacticalBoard,
  players: Player[],
): BoardWorkspaceState {
  const ws = board.workspace;
  return {
    roster: ws.roster.length ? ws.roster : seedRosterFromPlayers(players),
    problem: ws.problem,
    exercise: ws.exercise,
    layers: ws.layers,
    currentView: ws.currentView,
    teamAFormation: ws.teamAFormation,
  };
}
