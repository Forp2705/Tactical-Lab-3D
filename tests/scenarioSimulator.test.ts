import { describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import type { Player } from "../src/data";
import { DEFAULT_GAME_MODEL } from "../src/data/gameModel";
import { simulateScenario } from "../src/ai/scenarioSimulator";

describe("scenarioSimulator", () => {
  it("simula beneficio, riesgo y ejercicios", () => {
    const result = simulateScenario({
      scenarioId: "raise-block",
      gameModel: DEFAULT_GAME_MODEL,
      players: [player()],
      exercises: catalog,
      evidenceText: "Nos cuesta presionar alto.",
      patterns: ["bloque partido"],
      metrics: null,
    });

    expect(result.expectedBenefit).toContain("Recuperar");
    expect(result.exercisesToTest.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("low");
  });
});

function player(): Player {
  return {
    id: "p1",
    name: "Central lento",
    num: 2,
    positions: ["CB"],
    foot: "R",
    status: "available",
    profile: "Central",
    attributes: {
      speed: 45,
      stamina: 60,
      pass: 60,
      control: 60,
      press: 60,
      duel: 70,
      tactical: 60,
    },
  };
}
