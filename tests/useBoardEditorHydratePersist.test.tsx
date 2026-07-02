// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoPlayers } from "../src/data/players";
import { createDefaultBoard } from "../src/board/boardModel";
import type { TacticalBoard } from "../src/board/boardModel";
import { useBoardEditor } from "../src/board/useBoardEditor";

/**
 * The w1 P0 crash (docs/plans/w1-fix2a-hotfix-plan.md) was a hydrate<->persist
 * ping-pong in useBoardEditor: the caller (useBoardActions) passes `board` (a
 * fresh object identity on every store update anywhere in the app) and
 * unmemoized `persistWorkspace`/`onPersist` closures. This test reproduces
 * that exact churn pattern directly against the hook and asserts persist
 * fires exactly once per real edit, never re-triggered by pure identity
 * churn. If the hotfix regresses, this hangs or throws "Maximum update depth
 * exceeded" before reaching the call-count assertions.
 */

const players = demoPlayers.slice(0, 1);

function freshBoard(): TacticalBoard {
  return createDefaultBoard("Hydrate/persist smoke", { players });
}

describe("useBoardEditor hydrate/persist single-fire contract", () => {
  let persistSpy: ReturnType<typeof vi.fn>;
  let onPersistSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    persistSpy = vi.fn();
    onPersistSpy = vi.fn();
  });

  it("hydrates once and does not persist on mount", () => {
    const board = freshBoard();
    const { result } = renderHook(
      (props: { board: TacticalBoard }) =>
        useBoardEditor(props.board, players, {
          persistWorkspace: (id, ws) => persistSpy(id, ws),
          onPersist: () => onPersistSpy(),
        }),
      { initialProps: { board } },
    );

    expect(result.current.teamAFormation).toBe("4-3-3");
    expect(result.current.roster).toHaveLength(1);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("does not re-hydrate or persist on pure board identity churn (no edits)", () => {
    const board = freshBoard();
    const { rerender } = renderHook(
      (props: { board: TacticalBoard }) =>
        useBoardEditor(props.board, players, {
          persistWorkspace: (id, ws) => persistSpy(id, ws),
          onPersist: () => onPersistSpy(),
        }),
      { initialProps: { board } },
    );

    // Exactly what Zustand produces on every `set()` anywhere in the app:
    // same `id`, brand-new object identity. Repeated 5x to mirror the actual
    // ping-pong pattern (each hydrate/persist cycle re-armed the other effect).
    for (let i = 0; i < 5; i++) {
      rerender({ board: { ...board } });
    }

    expect(persistSpy).not.toHaveBeenCalled();
    expect(onPersistSpy).not.toHaveBeenCalled();
  });

  it("persists exactly once for a real edit, then never again on further churn", () => {
    const board = freshBoard();
    const { result, rerender } = renderHook(
      (props: { board: TacticalBoard }) =>
        useBoardEditor(props.board, players, {
          persistWorkspace: (id, ws) => persistSpy(id, ws),
          onPersist: () => onPersistSpy(),
        }),
      { initialProps: { board } },
    );

    act(() => {
      result.current.setTeamAFormation("4-4-2");
    });
    // The real caller (applyOwnFormation) also commits a scene update to the
    // store in the same event, which produces a new `board` reference on the
    // very next render — reproduced here explicitly.
    rerender({ board: { ...board } });

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(
      board.id,
      expect.objectContaining({ teamAFormation: "4-4-2" }),
    );
    expect(onPersistSpy).toHaveBeenCalledTimes(1);

    // Anti-cascade: further pure churn (no new edits) must not re-fire persist.
    // This is the exact assertion that would have failed before the hotfix.
    for (let i = 0; i < 5; i++) {
      rerender({ board: { ...board } });
    }
    expect(persistSpy).toHaveBeenCalledTimes(1);
  });

  it("switching to a different board id re-hydrates exactly once", () => {
    const boardA = freshBoard();
    const boardB = freshBoard();
    const { result, rerender } = renderHook(
      (props: { board: TacticalBoard }) =>
        useBoardEditor(props.board, players, {
          persistWorkspace: (id, ws) => persistSpy(id, ws),
          onPersist: () => onPersistSpy(),
        }),
      { initialProps: { board: boardA } },
    );

    act(() => {
      result.current.setTeamAFormation("3-5-2");
    });
    expect(result.current.teamAFormation).toBe("3-5-2");

    rerender({ board: boardB });
    // New board id hydrated fresh (its own default formation), the edit on
    // boardA is not carried over and does not leak a persist call for boardB.
    expect(result.current.teamAFormation).toBe("4-3-3");

    for (let i = 0; i < 3; i++) {
      rerender({ board: { ...boardB } });
    }
    // The boardA edit already persisted once (inside the act() above, before
    // the switch); hydrating boardB and churning its identity afterwards
    // must not add any further calls.
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(
      boardA.id,
      expect.objectContaining({ teamAFormation: "3-5-2" }),
    );
  });
});
