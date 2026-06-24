import type { Player } from "@/data";
import { useCallback, useEffect, useReducer } from "react";
import {
  type BoardWorkspaceState,
  boardEditorReducer,
  initialBoardEditorState,
  resolveBoardWorkspace,
  shouldPersistWorkspace,
} from "./boardEditorReducer";
import type { TacticalBoard } from "./boardModel";
import type {
  CurrentBoardView,
  ExerciseBuilder,
  PlanningBoardLayer,
  PlanningBoardPlayer,
  TacticalProblem,
} from "./productBoardTypes";

type Updater<T> = T | ((prev: T) => T);

export type UseBoardEditorOptions = {
  /** Persists the workspace back onto the board (the source of truth). */
  persistWorkspace: (boardId: string, workspace: BoardWorkspaceState) => void;
  /** Called after a successful persist (e.g. to surface a saved status). */
  onPersist?: () => void;
};

/**
 * Owns the board "workspace" editor state. Hydrates from `board.workspace` once
 * per board, mirrors edits locally for instant feedback, and persists them back
 * to the board via `persistWorkspace`.
 *
 * No localStorage. No persistence loop: hydration is a reducer-level no-op for
 * an already-hydrated board, and persistence only fires on real edits and then
 * clears the dirty flag.
 */
export function useBoardEditor(
  board: TacticalBoard | null,
  players: Player[],
  { persistWorkspace, onPersist }: UseBoardEditorOptions,
) {
  const [state, dispatch] = useReducer(
    boardEditorReducer,
    initialBoardEditorState,
  );

  // Hydrate from the board. The reducer ignores a hydrate for the board it is
  // already hydrated from, so this effect can re-run freely (e.g. after our own
  // persistence changes the board object) without clobbering in-progress edits.
  useEffect(() => {
    if (!board) return;
    dispatch({
      type: "hydrate",
      boardId: board.id,
      workspace: resolveBoardWorkspace(board, players),
    });
  }, [board, players]);

  // Persist edits back to the board. Guarded so it only fires for the currently
  // hydrated board, only when there are real edits, and clears the dirty flag
  // afterwards — so there is no loop and no echo overwrite.
  useEffect(() => {
    if (!board) return;
    if (!shouldPersistWorkspace(state, board.id)) return;
    persistWorkspace(board.id, state.workspace);
    onPersist?.();
    dispatch({ type: "persisted" });
  }, [state, board, persistWorkspace, onPersist]);

  const setRoster = useCallback(
    (value: Updater<PlanningBoardPlayer[]>) =>
      dispatch({ type: "setRoster", value }),
    [],
  );
  const setProblem = useCallback(
    (value: Updater<TacticalProblem>) =>
      dispatch({ type: "setProblem", value }),
    [],
  );
  const setExercise = useCallback(
    (value: Updater<ExerciseBuilder>) =>
      dispatch({ type: "setExercise", value }),
    [],
  );
  const setLayers = useCallback(
    (value: Updater<PlanningBoardLayer[]>) =>
      dispatch({ type: "setLayers", value }),
    [],
  );
  const setCurrentView = useCallback(
    (value: Updater<CurrentBoardView>) =>
      dispatch({ type: "setCurrentView", value }),
    [],
  );
  const setTeamAFormation = useCallback(
    (value: Updater<string>) => dispatch({ type: "setTeamAFormation", value }),
    [],
  );

  return {
    roster: state.workspace.roster,
    problem: state.workspace.problem,
    exercise: state.workspace.exercise,
    layers: state.workspace.layers,
    currentView: state.workspace.currentView,
    teamAFormation: state.workspace.teamAFormation,
    setRoster,
    setProblem,
    setExercise,
    setLayers,
    setCurrentView,
    setTeamAFormation,
  };
}
