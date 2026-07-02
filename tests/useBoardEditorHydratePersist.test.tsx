// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { demoPlayers } from "../src/data/players";
import { createDefaultBoard } from "../src/board/boardModel";
import type { TacticalBoard } from "../src/board/boardModel";
import { useBoardEditor } from "../src/board/useBoardEditor";

/**
 * SCOPE, STATED HONESTLY (this file was corrected after a red-check gate
 * found its original claims false — see docs/plans/w2-board-render-tests-plan.md
 * addendum below and the worker_done report for task_92fe08d8fdbc):
 *
 * This test locks the hydrate/persist STATE CONTRACT of useBoardEditor in
 * isolation: hydrate exactly once per board id; persist fires only while
 * dirty and exactly once per real edit; pure identity churn of `board` and
 * of the `persistWorkspace`/`onPersist` closures (unmemoized, recreated
 * every render — the real-world caller pattern) never triggers a spurious
 * extra persist.
 *
 * It does NOT reproduce, and cannot be used as evidence against, the w1 P0
 * crash ("Maximum update depth exceeded" / blank Pizarra on formation
 * change). Verified empirically: the closed-loop harness below (where
 * `persistWorkspace` feeds its result back into a real re-render via
 * `useState`, not a manually-scripted `rerender()` call — i.e., the loop
 * really is closed, calling `useBoardEditor` in a fresh render with the new
 * `board` identity the same way the real store round-trip would) was run
 * against BOTH the pre-hotfix hook (commit 6e68557, one parent before hotfix
 * 7d1ef66, in a throwaway worktree) and the post-hotfix hook on this branch.
 * It settles cleanly (exactly one persist call, no growing render count) on
 * BOTH versions, single-write and dual-write (setTeamAFormation + a
 * simultaneous external scene touch, matching the real applyOwnFormation
 * pattern of two writes in one event). The reducer-level idempotency guard
 * (`hydratedBoardId === action.boardId` in boardEditorReducer.ts) and the
 * `dirty`-flag gate in `shouldPersistWorkspace` already existed pre-hotfix
 * and already prevent a runaway loop when useBoardEditor is driven in
 * isolation by a single synchronous render/effect cycle.
 *
 * The real crash required the full component/store topology: `useBoardActions`
 * subscribes via `useAppStore()` with NO selector (full-state, re-renders on
 * every store write anywhere in the app), while the parent `TacticalBoardView`
 * derives `board` via selector-based subscriptions (`tacticalBoards`,
 * `activeBoardId`) — two independent Zustand subscription channels feeding
 * the same tree, whose relative scheduling is what actually produced the
 * "no se auto-extingue de forma confiable" (docs/plans/w1-fix2a-hotfix-plan.md)
 * divergence. That is exactly the shape `tests/boardRenderCrashClass.test.tsx`
 * exercises (real store, real mounted component tree) — confirmed to fail
 * red against pre-hotfix code. THIS file is a narrower unit contract test,
 * not a substitute for that one.
 */

const players = demoPlayers.slice(0, 1);

function freshBoard(): TacticalBoard {
  return createDefaultBoard("Hydrate/persist smoke", { players });
}

function useHarness(
  initialBoard: TacticalBoard,
  persistSpy: ReturnType<typeof vi.fn>,
  onPersistSpy: ReturnType<typeof vi.fn>,
) {
  const [board, setBoard] = useState(initialBoard);

  const editor = useBoardEditor(board, players, {
    // New closure every render (unmemoized), matching the real caller
    // (useBoardActions passes `{ persistWorkspace: updateBoardWorkspace,
    // onPersist: () => setStatus(...) }` as an inline literal).
    persistWorkspace: (id, ws) => {
      persistSpy(id, ws);
      // Closes the loop for real: this feeds a brand-new `board` object
      // identity (same id, updated workspace) back into the SAME hook via a
      // genuine re-render — exactly what the real store round-trip
      // (updateBoardWorkspace -> Zustand set() -> new board reference from
      // useAppStore) does. Not a manually-scripted rerender() call.
      setBoard((prev) => ({ ...prev, workspace: ws }));
    },
    onPersist: () => onPersistSpy(),
  });

  return {
    ...editor,
    // Simulates the SEPARATE, simultaneous store write the real
    // applyOwnFormation does in the same event (updateSceneObjects ->
    // updateTacticalBoardScene), independent of the hydrate/persist cycle.
    touchSceneExternally: () =>
      setBoard((prev) => ({ ...prev, updatedAt: new Date().toISOString() })),
  };
}

describe("useBoardEditor hydrate/persist state contract (unit, isolated hook)", () => {
  it("hydrates once and does not persist on mount", () => {
    const persistSpy = vi.fn();
    const onPersistSpy = vi.fn();
    const board = freshBoard();

    const { result } = renderHook(() =>
      useHarness(board, persistSpy, onPersistSpy),
    );

    expect(result.current.teamAFormation).toBe("4-3-3");
    expect(result.current.roster).toHaveLength(1);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("a real edit persists exactly once, via a closed feedback loop (not a scripted rerender)", () => {
    const persistSpy = vi.fn();
    const onPersistSpy = vi.fn();
    const board = freshBoard();

    const { result } = renderHook(() =>
      useHarness(board, persistSpy, onPersistSpy),
    );

    act(() => {
      result.current.setTeamAFormation("4-4-2");
    });

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(
      board.id,
      expect.objectContaining({ teamAFormation: "4-4-2" }),
    );
    expect(onPersistSpy).toHaveBeenCalledTimes(1);
    expect(result.current.teamAFormation).toBe("4-4-2");
  });

  it("the real two-write event (local formation edit + simultaneous external scene commit) still persists exactly once", () => {
    const persistSpy = vi.fn();
    const onPersistSpy = vi.fn();
    const board = freshBoard();

    const { result } = renderHook(() =>
      useHarness(board, persistSpy, onPersistSpy),
    );

    // Matches applyOwnFormation: setTeamAFormation (local reducer) and
    // updateSceneObjects (external store write) both happen inside the same
    // click handler / act().
    act(() => {
      result.current.setTeamAFormation("4-4-2");
      result.current.touchSceneExternally();
    });

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(onPersistSpy).toHaveBeenCalledTimes(1);
    expect(result.current.teamAFormation).toBe("4-4-2");
  });

  it("further pure identity churn after persisting never re-fires persist", () => {
    const persistSpy = vi.fn();
    const onPersistSpy = vi.fn();
    const board = freshBoard();

    const { result, rerender } = renderHook(
      (props: { board: TacticalBoard }) =>
        useHarness(props.board, persistSpy, onPersistSpy),
      { initialProps: { board } },
    );

    act(() => {
      result.current.setTeamAFormation("3-5-2");
    });
    expect(persistSpy).toHaveBeenCalledTimes(1);

    // External, unrelated identity churn (new object, same id) with no new
    // edit — the caller's own re-renders (from unrelated store writes) do
    // exactly this in production.
    for (let i = 0; i < 5; i++) {
      rerender({ board: { ...board } });
    }

    expect(persistSpy).toHaveBeenCalledTimes(1);
  });
});
