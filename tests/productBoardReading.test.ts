import { describe, it, expect } from "vitest";
import {
  countTokensInZone,
  isInsideZoneRect,
  inferAiInterpretation,
  inferAiInterpretationFindings,
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

describe("W6: zone-summary is one line per real zone (no dedup by content)", () => {
  it("reports all 4 zones as 4 distinct findings, even with identical text", () => {
    // Two zones share the same default label + same occupancy on purpose:
    // this used to collapse to fewer visible lines via the old
    // zones.slice(0, 2) cap, which had nothing to do with text dedup.
    const zones = [
      zone({ id: "z1", label: "Zona", x: 0, y: 0, w: 20, h: 20 }),
      zone({ id: "z2", label: "Zona", x: 20, y: 0, w: 20, h: 20 }),
      zone({ id: "z3", label: "Presion alta", x: 40, y: 0, w: 20, h: 20 }),
      zone({ id: "z4", label: "Salida", x: 60, y: 0, w: 20, h: 20 }),
    ];
    const objects = [
      tok("p1", "playerToken", 5, 5), // in z1
      tok("p2", "playerToken", 25, 5), // in z2
      tok("p3", "playerToken", 45, 5), // in z3
      tok("p4", "playerToken", 65, 5), // in z4
    ];
    const findings = inferAiInterpretationFindings({
      players: [],
      objects,
      arrows: [],
      zones,
    });

    expect(findings).toHaveLength(4);
    // ids are always unique (stable, from zone.id) regardless of text.
    expect(new Set(findings.map((f) => f.id)).size).toBe(4);
    // z1/z2 collide on text ("Zona": 1 propios vs 0 rivales) -> disambiguated.
    expect(findings[0].text).toBe("En Zona: 1 propios vs 0 rivales. (zona 1)");
    expect(findings[1].text).toBe("En Zona: 1 propios vs 0 rivales. (zona 2)");
    // z3/z4 have distinct labels -> no suffix needed.
    expect(findings[2].text).toBe("En Presion alta: 1 propios vs 0 rivales.");
    expect(findings[3].text).toBe("En Salida: 1 propios vs 0 rivales.");
  });
});
