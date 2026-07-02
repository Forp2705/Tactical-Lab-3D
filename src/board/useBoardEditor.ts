import type { Player } from "@/data";
import { useCallback, useEffect, useReducer, useRef } from "react";
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

  // `board` is a fresh object reference on every store update anywhere in the
  // app (Zustand immutable updates), including updates this hook itself makes
  // (scene edits, persistence). `persistWorkspace`/`onPersist` are typically
  // recreated by the caller on every render too. None of that churn should
  // cause hydrate/persist to redo work — only genuinely switching to a
  // different board id, or a real local edit, should. Latest-ref pattern for
  // the callbacks + id-only effect deps keeps re-renders from re-triggering
  // dispatches (a prior version of this hook could ping-pong hydrate<->persist
  // forever off pure identity churn — see FIX-BRIEF hotfix for mc-21 crash).
  const persistWorkspaceRef = useRef(persistWorkspace);
  const onPersistRef = useRef(onPersist);
  useEffect(() => {
    persistWorkspaceRef.current = persistWorkspace;
    onPersistRef.current = onPersist;
  });

  const boardId = board?.id ?? null;

  // Hydrate from the board. Guarded up front (not just inside the reducer) so
  // that once a board is hydrated, re-renders that only change object
  // identity (not the board id) never even reach a dispatch.
  useEffect(() => {
    if (!board) return;
    if (state.hydratedBoardId === board.id) return;
    dispatch({
      type: "hydrate",
      boardId: board.id,
      workspace: resolveBoardWorkspace(board, players),
    });
  }, [board, players, state.hydratedBoardId]);

  // Persist edits back to the board. Only depends on the board id (not the
  // whole board object — scene edits elsewhere must not re-arm this effect)
  // and only fires for the currently hydrated board, only when there are real
  // edits, clearing the dirty flag afterwards.
  useEffect(() => {
    if (boardId === null) return;
    if (!shouldPersistWorkspace(state, boardId)) return;
    persistWorkspaceRef.current(boardId, state.workspace);
    onPersistRef.current?.();
    dispatch({ type: "persisted" });
  }, [state, boardId]);

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
