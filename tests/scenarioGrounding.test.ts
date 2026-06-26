import { describe, it, expect } from "vitest";
import { computeScenarioGrounding, groundingSummary } from "@/board/scenarioGrounding";
import type { BoardObject } from "@/board/boardModel";

const tok = (id: string, type: BoardObject["type"], x: number, y: number) =>
  ({ id, type, position: { x, y }, label: id } as unknown as BoardObject);

const press = { label: "Presión alta", rect: { x: 0, y: 0, w: 40, h: 100 } };
const gap = { label: "Espacio a la espalda", rect: { x: 60, y: 0, w: 40, h: 100 } };

describe("computeScenarioGrounding", () => {
  it("LOCK 1: empty board is NOT grounded (computing a zone != grounded)", () => {
    const g = computeScenarioGrounding([], [press, gap]);
    expect(g.hasGroundedMetrics).toBe(false);
    expect(g.zones.every((z) => !z.populated)).toBe(true);
  });

  it("LOCK 1b: tokens entirely outside both rects are NOT grounded", () => {
    const g = computeScenarioGrounding([tok("a", "playerToken", 50, 50)], [press, gap]);
    expect(g.hasGroundedMetrics).toBe(false);
  });

  it("LOCK 2: a token inside a rect IS grounded, signed dual-face superiority", () => {
    const objects = [
      tok("p1", "playerToken", 10, 10),
      tok("p2", "playerToken", 20, 20),
      tok("p3", "playerToken", 30, 30),
      tok("r1", "opponentToken", 15, 15),
      tok("r2", "opponentToken", 25, 25), // press: own 3 vs rival 2 -> +1
      tok("g1", "playerToken", 70, 50), // gap: own 1 vs rival 2 -> -1
      tok("gr1", "opponentToken", 65, 40),
      tok("gr2", "opponentToken", 75, 60),
    ];
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(g.hasGroundedMetrics).toBe(true);
    expect(g.zones[0]).toMatchObject({ label: "Presión alta", own: 3, rival: 2, delta: 1, populated: true });
    expect(g.zones[1]).toMatchObject({ label: "Espacio a la espalda", own: 1, rival: 2, delta: -1, populated: true });
  });
});

describe("groundingSummary", () => {
  it("returns a partial note when some zones are empty (atom: empty != evidence)", () => {
    const objects = [tok("p1", "playerToken", 10, 10)]; // only press populated
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(groundingSummary(g)).toMatch(/parcial/i);
  });
  it("returns null when all present zones are populated", () => {
    const objects = [tok("p1", "playerToken", 10, 10), tok("g1", "playerToken", 70, 50)];
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(groundingSummary(g)).toBeNull();
  });
});
