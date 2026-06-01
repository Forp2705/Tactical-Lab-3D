import { describe, expect, it } from "vitest";
import {
  computeLineDistances,
  computeMetrics,
} from "../src/team/lib/shapeMetrics";

const shape442 = [
  { id: "lb", role: "LB", pos: { x: 25, y: 18 } },
  { id: "cb1", role: "CB", pos: { x: 24, y: 40 } },
  { id: "cb2", role: "CB", pos: { x: 24, y: 60 } },
  { id: "rb", role: "RB", pos: { x: 25, y: 82 } },
  { id: "lm", role: "LM", pos: { x: 50, y: 20 } },
  { id: "cm1", role: "CM", pos: { x: 50, y: 43 } },
  { id: "cm2", role: "CM", pos: { x: 50, y: 57 } },
  { id: "rm", role: "RM", pos: { x: 50, y: 80 } },
  { id: "st1", role: "ST", pos: { x: 72, y: 43 } },
  { id: "st2", role: "ST", pos: { x: 72, y: 57 } },
];

describe("shapeMetrics", () => {
  it("calcula ancho y profundidad en metros", () => {
    const metrics = computeMetrics(shape442);

    expect(metrics.width).toBeCloseTo(43.52, 1);
    expect(metrics.depth).toBeCloseTo(50.4, 1);
  });

  it("calcula compacidad y altura de bloque", () => {
    const metrics = computeMetrics(shape442);

    expect(metrics.compactness).toBeGreaterThan(15);
    expect(metrics.compactness).toBeLessThan(30);
    expect(metrics.blockHeight).toBeCloseTo(46.4, 1);
  });

  it("calcula distancia entre lineas", () => {
    const lineDistances = computeLineDistances(shape442);

    expect(lineDistances.defenseToMidfield).toBeCloseTo(26.8, 1);
    expect(lineDistances.midfieldToAttack).toBeCloseTo(23.1, 1);
    expect(lineDistances.defenseToAttack).toBeCloseTo(49.9, 1);
  });

  it("cuenta duelos cercanos contra rivales", () => {
    const metrics = computeMetrics(shape442, [
      { id: "r1", role: "ST", pos: { x: 72, y: 44 } },
      { id: "r2", role: "LW", pos: { x: 70, y: 15 } },
    ]);

    expect(metrics.duels).toBe(1);
  });
});
