import { describe, it, expect } from "vitest";
import {
  countTokensInZone,
  isInsideZoneRect,
  inferAiInterpretation,
  inferAiInterpretationFindings,
} from "@/board/productBoardTypes";
import type { BoardArrow, BoardObject, BoardZone } from "@/board/boardModel";

// Minimal token factory; only fields the counter/reading touch.
const tok = (id: string, type: BoardObject["type"], x: number, y: number) =>
  ({ id, type, position: { x, y }, label: id } as unknown as BoardObject);

const zone = (over: Partial<BoardZone> = {}) =>
  ({ id: "z1", label: "Presion alta", x: 0, y: 0, w: 50, h: 50, semantic: "occupation", ...over } as unknown as BoardZone);

const rect = { x: 0, y: 0, w: 50, h: 50 };

// Minimal anchored-link arrow factory (object -> object); only fields the
// reading touches (`from`/`to`.kind + objectId, `semantic`).
const linkArrow = (id: string, fromId: string, toId: string) =>
  ({
    id,
    semantic: "pass",
    from: { kind: "object", objectId: fromId },
    to: { kind: "object", objectId: toId },
  } as unknown as BoardArrow);

// Minimal target-zone-action arrow factory (unanchored `from`, real
// `targetZoneId`); only fields the reading touches.
const targetArrow = (id: string, targetZoneId: string) =>
  ({
    id,
    semantic: "pass",
    from: { kind: "point", point: { x: 0, y: 0 } },
    to: { kind: "point", point: { x: 10, y: 10 } },
    targetZoneId,
  } as unknown as BoardArrow);

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

describe("W7 P0.7: findings cap never sacrifices zone lines", () => {
  // Priority semantic chosen: zone facts (a real tactical entity, per W6) are
  // exempt from the 4-item cap and always all appear; the cap now only
  // trims links/target-zone actions, with anchored links prioritized over
  // target-zone actions inside that reduced budget. Among zone facts
  // themselves, "danger" zones sort first (still never dropped).
  it("keeps all 5 zone lines even with 3 links + 2 target actions competing for the cap", () => {
    const dangerZone = zone({
      id: "danger1",
      label: "Riesgo alto",
      x: 60,
      y: 0,
      w: 10,
      h: 10,
      semantic: "danger",
    });
    const zones = [
      zone({ id: "z1", label: "Zona 1", x: 0, y: 0, w: 10, h: 10 }),
      zone({ id: "z2", label: "Zona 2", x: 10, y: 0, w: 10, h: 10 }),
      zone({ id: "z3", label: "Zona 3", x: 20, y: 0, w: 10, h: 10 }),
      dangerZone, // index 3 on purpose: not first in insertion order.
      zone({ id: "z5", label: "Zona 5", x: 70, y: 0, w: 10, h: 10 }),
    ];
    const objects = [
      tok("a1", "playerToken", 1, 1),
      tok("a2", "playerToken", 2, 2),
      tok("a3", "playerToken", 3, 3),
      tok("a4", "playerToken", 4, 4),
      tok("a5", "playerToken", 5, 5),
      tok("a6", "playerToken", 6, 6),
      tok("p1", "playerToken", 5, 5), // in z1
      tok("p2", "playerToken", 15, 5), // in z2
      tok("p3", "playerToken", 25, 5), // in z3
      tok("p4", "playerToken", 65, 5), // in dangerZone
      tok("p5", "playerToken", 75, 5), // in z5
    ];
    const arrows = [
      linkArrow("l1", "a1", "a2"),
      linkArrow("l2", "a3", "a4"),
      linkArrow("l3", "a5", "a6"),
      targetArrow("t1", "z1"),
      targetArrow("t2", "z2"),
    ];

    const findings = inferAiInterpretationFindings({
      players: [],
      objects,
      arrows,
      zones,
    });

    // 10 raw candidates (3 link + 2 target + 5 zone) would have been capped
    // to 4 by the old global slice, cutting real zones. Now all 5 survive.
    expect(findings).toHaveLength(5);
    expect(new Set(findings.map((f) => f.id))).toEqual(
      new Set(["zone:z1", "zone:z2", "zone:z3", "zone:danger1", "zone:z5"]),
    );
    // links/target actions dropped entirely: no room left once 5 zones
    // already exceed the 4-item budget on their own.
    expect(findings.some((f) => f.id.startsWith("link:"))).toBe(false);
    expect(findings.some((f) => f.id.startsWith("target:"))).toBe(false);
    // danger zone sorts first among the zone lines (priority semantic).
    expect(findings[0].id).toBe("zone:danger1");
  });

  it("fills remaining budget with links before target actions when zones fit under the cap", () => {
    const zones = [zone({ id: "z1", label: "Zona 1", x: 0, y: 0, w: 10, h: 10 })];
    const objects = [
      tok("a1", "playerToken", 1, 1),
      tok("a2", "playerToken", 2, 2),
      tok("a3", "playerToken", 3, 3),
      tok("a4", "playerToken", 4, 4),
      tok("a5", "playerToken", 5, 5),
      tok("a6", "playerToken", 6, 6),
      tok("p1", "playerToken", 5, 5), // in z1
    ];
    const arrows = [
      linkArrow("l1", "a1", "a2"),
      linkArrow("l2", "a3", "a4"),
      linkArrow("l3", "a5", "a6"),
      targetArrow("t1", "z1"),
      targetArrow("t2", "z1"),
    ];

    const findings = inferAiInterpretationFindings({
      players: [],
      objects,
      arrows,
      zones,
    });

    // Budget = 4 total, 1 taken by the zone -> 3 left for links/targets.
    // All 3 anchored links win that budget over the 2 target actions.
    expect(findings.map((f) => f.id)).toEqual([
      "link:l1",
      "link:l2",
      "link:l3",
      "zone:z1",
    ]);
  });
});
