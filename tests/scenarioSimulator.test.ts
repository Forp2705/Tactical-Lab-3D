import { describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import type { Player } from "../src/data";
import { DEFAULT_GAME_MODEL } from "../src/data/gameModel";
import {
  bumpEvidenceLevel,
  gradeConfidence,
  gradeEvidenceLevel,
  simulateScenario,
} from "../src/ai/scenarioSimulator";

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

describe("scenario graders (Enfoque A)", () => {
  it("gradeEvidenceLevel maps source count exactly as before", () => {
    expect(gradeEvidenceLevel(0)).toBe("none");
    expect(gradeEvidenceLevel(1)).toBe("weak");
    expect(gradeEvidenceLevel(2)).toBe("partial");
    expect(gradeEvidenceLevel(3)).toBe("sufficient");
    expect(gradeEvidenceLevel(5)).toBe("sufficient");
  });

  it("gradeConfidence reproduces the !metrics/none/risk>=2 -> low rule", () => {
    // !hasGroundedMetrics -> low regardless
    expect(
      gradeConfidence({ hasGroundedMetrics: false, evidenceLevel: "sufficient", riskCount: 0 }),
    ).toBe("low");
    // none -> low
    expect(
      gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "none", riskCount: 0 }),
    ).toBe("low");
    // risk>=2 -> low
    expect(
      gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "sufficient", riskCount: 2 }),
    ).toBe("low");
    // sufficient & risk 0 -> high
    expect(
      gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "sufficient", riskCount: 0 }),
    ).toBe("high");
    // otherwise -> medium
    expect(
      gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "partial", riskCount: 1 }),
    ).toBe("medium");
  });

  it("bumpEvidenceLevel moves by N tiers, clamped", () => {
    expect(bumpEvidenceLevel("none", 1)).toBe("weak");
    expect(bumpEvidenceLevel("weak", 0)).toBe("weak");
    expect(bumpEvidenceLevel("partial", 1)).toBe("sufficient");
    expect(bumpEvidenceLevel("sufficient", 1)).toBe("sufficient");
  });
});

describe("enrichRiskWithMetrics caveat flag (Task 6)", () => {
  function noMetricsSim(options?: { includeMissingShapeCaveat?: boolean }) {
    return simulateScenario(
      {
        scenarioId: "raise-block",
        gameModel: DEFAULT_GAME_MODEL,
        players: [player()],
        exercises: catalog,
        metrics: null,
      },
      options,
    );
  }

  it("default (no options), metrics null → keeps the 'no shape' caveat (LineupLab non-regression)", () => {
    const result = noMetricsSim();
    expect(result.mainRisk).toContain("no hay shape activo publicado");
    // base risk still present
    expect(result.mainRisk).toContain("Espalda de centrales expuesta");
  });

  it("includeMissingShapeCaveat: false, metrics null → drops the caveat, keeps the base risk", () => {
    const result = noMetricsSim({ includeMissingShapeCaveat: false });
    expect(result.mainRisk).not.toContain("no hay shape activo publicado");
    expect(result.mainRisk).toContain("Espalda de centrales expuesta");
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
