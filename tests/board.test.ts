import { describe, expect, it } from "vitest";
import {
  BoardArrowSchema,
  BoardObjectSchema,
  BoardZoneSchema,
  TacticalBoardSchema,
  createInstruction,
  createPlayerToken,
  createDefaultBoard,
  createSemanticArrow,
  duplicateBoardScene,
  generateBoardSessionDraft,
  reorderBoardScenes,
  summarizeBoard,
} from "../src/board";
import type { TacticalBoard } from "../src/board";

describe("Tactical Board schema", () => {
  it("createDefaultBoard produces a schema-valid board with defaults and phases", () => {
    const board = createDefaultBoard("Salida vs presion alta");

    expect(() => TacticalBoardSchema.parse(board)).not.toThrow();
    expect(board.title).toBe("Salida vs presion alta");
    expect(board.defaults.pitchMode).toBe("full");
    expect(board.scenes).toHaveLength(1);
    expect(board.scenes[0].phases.map((phase) => phase.type)).toEqual([
      "salida",
      "salida",
      "salida",
    ]);
  });

  it("supports weak roster links without requiring shared Player imports", () => {
    const result = BoardObjectSchema.safeParse({
      id: "obj-1",
      type: "playerToken",
      label: "6",
      position: { x: 42, y: 55 },
      rosterLink: {
        playerId: "player-6",
        displayName: "Pivot",
        number: 6,
        role: "Mediocentro",
        linkedAt: "2026-06-16T00:00:00.000Z",
      },
    });

    expect(result.success).toBe(true);
  });

  it("validates semantic arrows and rejects unknown arrow meanings", () => {
    expect(
      BoardArrowSchema.safeParse({
        id: "arrow-1",
        semantic: "pressure",
        from: { kind: "object", objectId: "obj-1" },
        to: { kind: "point", point: { x: 70, y: 35 } },
      }).success,
    ).toBe(true);

    expect(
      BoardArrowSchema.safeParse({
        id: "arrow-2",
        semantic: "teleport",
        from: { kind: "point", point: { x: 10, y: 20 } },
        to: { kind: "point", point: { x: 30, y: 40 } },
      }).success,
    ).toBe(false);
  });

  it("keeps zones bounded to normalized pitch coordinates", () => {
    expect(
      BoardZoneSchema.safeParse({
        id: "zone-1",
        semantic: "freeSpace",
        label: "Weak side pocket",
        shape: "rectangle",
        x: 60,
        y: 30,
        w: 30,
        h: 20,
      }).success,
    ).toBe(true);

    expect(
      BoardZoneSchema.safeParse({
        id: "zone-2",
        semantic: "danger",
        label: "Out of pitch",
        shape: "rectangle",
        x: 90,
        y: 30,
        w: 20,
        h: 20,
      }).success,
    ).toBe(false);
  });
});

describe("Tactical Board helpers", () => {
  function buildBoardWithTwoScenes(): TacticalBoard {
    const board = createDefaultBoard("Pressing board");
    const firstScene = {
      ...board.scenes[0],
      id: "scene-a",
      title: "Press trigger",
      objects: [
        createPlayerToken(null, { x: 55, y: 40 }, "9", 9),
      ],
      arrows: [
        createSemanticArrow(
          "pressure",
          { kind: "object" as const, objectId: "player-test" },
          { kind: "point" as const, point: { x: 70, y: 35 } },
          { label: "Saltar", tacticalMeaning: "Press trigger", visibility: "player" },
        ),
      ],
      instructions: [
        createInstruction(
          "player",
          "Press trigger",
          "Jump when the center back receives facing his own goal.",
          { objectIds: ["player-test"], coachingCue: true, visibility: "player" },
        ),
      ],
    };
    firstScene.objects[0] = { ...firstScene.objects[0], id: "player-test" };
    firstScene.arrows[0] = createSemanticArrow(
      "pressure",
      { kind: "object", objectId: firstScene.objects[0].id },
      { kind: "point", point: { x: 70, y: 35 } },
      { label: "Saltar", tacticalMeaning: "Press trigger", visibility: "player" },
    );

    return TacticalBoardSchema.parse({
      ...board,
      scenes: [
        firstScene,
        {
          ...board.scenes[0],
          id: "scene-b",
          title: "Second ball",
        },
      ],
    });
  }

  it("duplicates a scene without mutating the source board", () => {
    const board = buildBoardWithTwoScenes();
    const duplicated = duplicateBoardScene(board, "scene-a");

    expect(board.scenes).toHaveLength(2);
    expect(duplicated.scenes).toHaveLength(3);
    expect(duplicated.scenes[1].title).toBe("Press trigger copia");
    expect(duplicated.scenes[1].id).not.toBe("scene-a");
    expect(duplicated.scenes[1].objects[0].id).not.toBe("obj-1");

    const duplicatedArrow = duplicated.scenes[1].arrows[0];
    expect(duplicatedArrow.from.kind).toBe("object");
    if (duplicatedArrow.from.kind === "object") {
      expect(duplicatedArrow.from.objectId).toBe(duplicated.scenes[1].objects[0].id);
    }
  });

  it("reorders scenes immutably and ignores invalid moves", () => {
    const board = buildBoardWithTwoScenes();
    const reordered = reorderBoardScenes(board, 0, 1);

    expect(reordered.scenes.map((scene) => scene.id)).toEqual(["scene-b", "scene-a"]);
    expect(board.scenes.map((scene) => scene.id)).toEqual(["scene-a", "scene-b"]);
    expect(reorderBoardScenes(board, -1, 1)).toBe(board);
  });

  it("summarizes a board and creates a self-contained session draft", () => {
    const board = buildBoardWithTwoScenes();
    const summary = summarizeBoard(board);
    const draft = generateBoardSessionDraft(board);

    expect(summary).toContain("Pressing board");
    expect(summary).toContain("Press trigger");
    expect(draft.sourceBoardId).toBe(board.id);
    expect(draft.totalDurationMin).toBeGreaterThan(0);
    expect(draft.blocks).toHaveLength(2);
    expect(draft.blocks[0].objective).toContain("center back receives");
  });
});
