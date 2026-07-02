// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoPlayers } from "../src/data/players";
import { useAppStore } from "../src/state/useAppStore";
import { TacticalBoardView } from "../src/board/TacticalBoardView";

/**
 * Locks the exact render-level contract of the w1 P0 hotfix
 * (docs/plans/w1-fix2a-hotfix-plan.md): selecting an own token and changing
 * the own-team formation must never throw "Maximum update depth exceeded"
 * and must never unmount the board (the crash rendered a blank Pizarra with
 * no error boundary). Also locks the FIX 2a merge contract at the UI level:
 * a roster-linked token's edited role survives a formation change.
 *
 * TacticalBoardCanvas renders plain <svg>/<g>/<circle> (no <canvas>, no
 * three.js — confirmed by reading the component) so jsdom mounts and updates
 * it without any canvas/WebGL mock. The only test-domain setup is seeding
 * one real player so the first own token is roster-linked (an unlinked token
 * is documented, by design, to NOT survive a formation change — see
 * boardTools.ts mergeFormationTokens and RECHECK-W1.md).
 */

const seededPlayers = demoPlayers.slice(0, 1);
const seededPlayerShortName = seededPlayers[0].name.split(" ")[0];

function seedStoreWithOneBoard() {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState((state) => ({
    team: { ...state.team, players: seededPlayers },
  }));
  useAppStore.getState().createTacticalBoard({ title: "Render test board" });
}

function ownTokenGroup(name: string): SVGGElement {
  const label = screen.getByText(name);
  const group = label.closest("g[data-board-target]");
  if (!group) throw new Error(`No token group found for label "${name}"`);
  return group as unknown as SVGGElement;
}

describe("Pizarra render: hydrate/persist crash class (P0 of w1)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    seedStoreWithOneBoard();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    // No `test.globals: true` in vite.config.ts, so RTL's auto-cleanup
    // (which hooks into a global afterEach) never registers itself. Without
    // this, each test's tree stays in document.body and the next test's
    // screen.getByText/getByRole queries fail on duplicate matches.
    cleanup();
  });

  function assertNoMaxUpdateDepthError() {
    const hit = consoleErrorSpy.mock.calls.some((args) =>
      args.some(
        (arg) =>
          typeof arg === "string" && arg.includes("Maximum update depth"),
      ),
    );
    expect(hit).toBe(false);
  }

  it("Caso A: select own token, edit role, change formation -> no crash, tree stays mounted, edit survives", () => {
    render(<TacticalBoardView />);

    // 1-2: select the roster-linked own token (the seeded player, first slot).
    const tokenGroup = ownTokenGroup(seededPlayerShortName);
    fireEvent.pointerDown(tokenGroup);

    // 3: inspector shows the "own player" form for the selection.
    const roleInput = screen.getByLabelText("Rol") as HTMLInputElement;
    expect(roleInput).toBeTruthy();

    // 4: edit the role before the formation change.
    fireEvent.change(roleInput, { target: { value: "QA-ROLE" } });
    expect(roleInput.value).toBe("QA-ROLE");

    // 5: default formation is 4-3-3 (createDefaultBoard) -> 4-4-2 is a real change.
    const formationButton = screen.getByRole("button", { name: "4-4-2" });
    fireEvent.click(formationButton);

    // (a) no "Maximum update depth exceeded" thrown by React.
    assertNoMaxUpdateDepthError();

    // (b) tree still mounted, not blank: topbar heading + full own token set.
    expect(screen.getByText("Pizarra tactica")).toBeTruthy();
    expect(document.querySelectorAll("circle.token.own")).toHaveLength(11);

    // (c) FIX 2a contract: the roster-linked token's edited role survives the
    // formation change (same linkedPlayerId, new position).
    const movedTokenGroup = ownTokenGroup(seededPlayerShortName);
    fireEvent.pointerDown(movedTokenGroup);
    const roleAfter = screen.getByLabelText("Rol") as HTMLInputElement;
    expect(roleAfter.value).toBe("QA-ROLE");
  });

  it("Caso B: change formation with no token selected -> no crash, tree stays mounted", () => {
    render(<TacticalBoardView />);

    // No selection at all: the inspector shows the scene summary, not a
    // player form. Change formation directly.
    const formationButton = screen.getByRole("button", { name: "4-4-2" });
    fireEvent.click(formationButton);

    assertNoMaxUpdateDepthError();
    expect(screen.getByText("Pizarra tactica")).toBeTruthy();
    expect(document.querySelectorAll("circle.token.own")).toHaveLength(11);
  });
});
