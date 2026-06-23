import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("Tactical Board workflow polish regressions", () => {
  it("does not use native browser prompts for board editing", () => {
    const source = readSource("src/board/TacticalBoardView.tsx");
    expect(source).not.toContain("window.prompt");
  });

  it("does not silently attach the current board to the first session block", () => {
    const source = readSource("src/board/TacticalBoardView.tsx");
    expect(source).not.toContain("session.blocks[0]");
    expect(source).not.toContain("attachToFirstSessionBlock");
  });

  it("session block board opening uses the active-board route instead of plain setView", () => {
    const source = readSource("src/sessions/SessionsView.tsx");
    expect(source).toContain("openTacticalBoard(boardId, sceneId)");
    expect(source).not.toContain('setView("board")');
  });

  it("session-side board attachment does not silently attach the first scene", () => {
    const source = readSource("src/sessions/SessionsView.tsx");
    expect(source).toContain("aria-label=\"Elegir escena de pizarra para adjuntar\"");
    expect(source).not.toContain("selectedPendingBoard.scenes[0]?.id");
  });
});
