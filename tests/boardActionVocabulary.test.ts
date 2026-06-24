import { describe, expect, it } from "vitest";
import {
  BoardArrowSchema,
  BoardArrowSemanticSchema,
  TacticalBoardSchema,
  createDefaultBoard,
  createSemanticArrow,
} from "../src/board/boardModel";

// P0.1: el vocabulario de accion se expande de forma ADITIVA. Boards viejos
// (flechas point->point, sin intent/targetZoneId) deben seguir parseando, y las
// semanticas nuevas + campos opcionales deben funcionar. Sin migracion.

const NEW_SEMANTICS = [
  "longPass",
  "cross",
  "switch",
  "carry",
  "support",
  "mark",
] as const;

describe("Board action vocabulary (P0.1)", () => {
  it("keeps the original semantics and adds the new football ones", () => {
    const options = BoardArrowSemanticSchema.options;
    for (const semantic of [
      "movement",
      "pass",
      "pressure",
      "cover",
      "recovery",
      "run",
      "rotation",
      ...NEW_SEMANTICS,
    ]) {
      expect(options).toContain(semantic);
    }
  });

  it("parses a legacy point->point arrow with no intent/targetZoneId", () => {
    const arrow = BoardArrowSchema.parse({
      id: "legacy-1",
      semantic: "pass",
      from: { kind: "point", point: { x: 10, y: 12 } },
      to: { kind: "point", point: { x: 30, y: 18 } },
    });
    expect(arrow.semantic).toBe("pass");
    expect(arrow.intent).toBeUndefined();
    expect(arrow.targetZoneId).toBeUndefined();
  });

  it("parses an anchored arrow with a new semantic, intent and targetZoneId", () => {
    const arrow = BoardArrowSchema.parse({
      id: "new-1",
      semantic: "longPass",
      from: { kind: "object", objectId: "player-5" },
      to: { kind: "object", objectId: "player-2" },
      intent: "Cambiar el juego al lateral libre",
      targetZoneId: "zone-band-right",
    });
    expect(arrow.semantic).toBe("longPass");
    expect(arrow.from).toEqual({ kind: "object", objectId: "player-5" });
    expect(arrow.intent).toBe("Cambiar el juego al lateral libre");
    expect(arrow.targetZoneId).toBe("zone-band-right");
  });

  it.each(NEW_SEMANTICS)(
    "createSemanticArrow derives label+layer for '%s'",
    (semantic) => {
      const arrow = createSemanticArrow(
        semantic,
        { kind: "object", objectId: "o1" },
        { kind: "point", point: { x: 50, y: 50 } },
      );
      expect(arrow.semantic).toBe(semantic);
      // labelForArrow cubre la semantica nueva (no queda undefined).
      expect(arrow.tacticalMeaning).toBeTruthy();
      expect(arrow.layer).toBeTruthy();
    },
  );

  it("re-parses a full board carrying a legacy arrow (no migration needed)", () => {
    const board = createDefaultBoard("Test board");
    const withLegacyArrow = {
      ...board,
      scenes: board.scenes.map((scene, index) =>
        index === 0
          ? {
              ...scene,
              arrows: [
                {
                  id: "legacy-arrow",
                  semantic: "pass",
                  from: { kind: "point", point: { x: 5, y: 5 } },
                  to: { kind: "point", point: { x: 9, y: 9 } },
                },
              ],
            }
          : scene,
      ),
    };
    expect(() => TacticalBoardSchema.parse(withLegacyArrow)).not.toThrow();
  });
});
