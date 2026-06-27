import { describe, it, expect } from "vitest";
import {
  countTokensInZone,
  isInsideZoneRect,
  inferAiInterpretation,
} from "@/board/productBoardTypes";
import type { BoardObject, BoardZone } from "@/board/boardModel";

// Minimal token factory; only fields the counter/reading touch.
const tok = (id: string, type: BoardObject["type"], x: number, y: number) =>
  ({ id, type, position: { x, y }, label: id } as unknown as BoardObject);

const zone = (over: Partial<BoardZone> = {}) =>
  ({ id: "z1", label: "Presion alta", x: 0, y: 0, w: 50, h: 50, ...over } as unknown as BoardZone);

const rect = { x: 0, y: 0, w: 50, h: 50 };

describe("countTokensInZone (single counter)", () => {
  it("counts own vs rival via isInsideZoneRect membership; ignores non-token objects", () => {
    const objects = [
      tok("a", "playerToken", 10, 10), // in  -> own
      tok("b", "playerToken", 90, 90), // out
      tok("c", "opponentToken", 20, 20), // in -> rival
      tok("d", "ballToken" as BoardObject["type"], 5, 5), // ignored
    ];
    expect(countTokensInZone(objects, rect)).toEqual({ own: 1, rival: 1 });
  });

  it("agrees with a manual isInsideZoneRect filter (equivalence lock)", () => {
    const objects = [
      tok("a", "playerToken", 1, 1),
      tok("b", "playerToken", 60, 1),
      tok("c", "opponentToken", 2, 2),
    ];
    const manualOwn = objects.filter(
      (o) => o.type === "playerToken" && isInsideZoneRect(o.position, rect),
    ).length;
    const manualRival = objects.filter(
      (o) => o.type === "opponentToken" && isInsideZoneRect(o.position, rect),
    ).length;
    expect(countTokensInZone(objects, rect)).toEqual({ own: manualOwn, rival: manualRival });
  });
});

describe("P0.5 reading is tied to countTokensInZone", () => {
  it("inferAiInterpretation's zone reading reflects the counter output", () => {
    const z = zone();
    const objects = [
      tok("p1", "playerToken", 10, 10),
      tok("p2", "playerToken", 12, 14),
      tok("o1", "opponentToken", 20, 20),
    ];
    const { own, rival } = countTokensInZone(objects, z);
    const findings = inferAiInterpretation({
      players: [],
      objects,
      arrows: [],
      zones: [z],
    });
    // The reading string must be derived from the same counter (no drift).
    expect(findings).toContain(`En ${z.label}: ${own} propios vs ${rival} rivales.`);
    expect(own).toBe(2);
    expect(rival).toBe(1);
  });
});
