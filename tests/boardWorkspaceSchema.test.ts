import { describe, expect, it } from "vitest";
import {
  BoardWorkspaceSchema,
  TacticalBoardSchema,
  createDefaultBoard,
} from "../src/board";
import type { Player } from "../src/data";

describe("BoardWorkspaceSchema defaults", () => {
  it("fills every field from an empty object", () => {
    const workspace = BoardWorkspaceSchema.parse({});
    expect(workspace.roster).toEqual([]);
    expect(workspace.currentView).toBe("Ataque");
    expect(workspace.teamAFormation).toBe("4-3-3");
    expect(workspace.layers).toHaveLength(7);
    expect(workspace.problem.problem).toMatch(/presionan/i);
    expect(workspace.exercise.objective).toMatch(/presion/i);
  });
});

describe("TacticalBoard workspace migration", () => {
  it("backfills a default workspace for a board persisted before the field existed", () => {
    const board = createDefaultBoard("Salida vs presion");
    const { workspace: _omit, ...legacy } = board;
    const migrated = TacticalBoardSchema.parse(legacy);
    expect(migrated.workspace).toBeDefined();
    expect(migrated.workspace.currentView).toBe("Ataque");
    expect(migrated.workspace.layers).toHaveLength(7);
  });
});

describe("createDefaultBoard workspace seeding", () => {
  it("seeds roster from the provided players", () => {
    const players = [
      { id: "p1", name: "Uno", positions: ["MC"], num: 5, profile: "base" },
      { id: "p2", name: "Dos", positions: ["DC"], num: 9, profile: "base" },
    ] as unknown as Player[];
    const board = createDefaultBoard("Test", { players });
    expect(board.workspace.roster).toHaveLength(2);
    expect(board.workspace.roster[0]).toMatchObject({
      id: "p1",
      number: 5,
      team: "A",
      position: "MC",
    });
  });

  it("defaults to an empty roster without players", () => {
    const board = createDefaultBoard("Vacio");
    expect(board.workspace.roster).toEqual([]);
    expect(board.workspace.teamAFormation).toBe("4-3-3");
  });
});
