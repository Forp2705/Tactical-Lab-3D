import { describe, expect, it } from "vitest";
import { detectTeamPatterns } from "../src/ai/patternDetection";
import type { SavedPostMatchReport } from "../src/ai/post-match/schemas";

describe("patternDetection", () => {
  it("detecta problemas repetidos entre reportes", () => {
    const patterns = detectTeamPatterns([
      makeReport("r1", "2026-05-20", "Reserva", "El bloque queda partido entre lineas", "medium"),
      makeReport("r2", "2026-05-27", "Cantinas", "El bloque queda partido entre lineas", "high"),
    ]);

    expect(patterns.some((pattern) => pattern.kind === "repeatedProblem")).toBe(true);
  });

  it("no inventa patrones sin reportes", () => {
    expect(detectTeamPatterns([])).toEqual([]);
  });

  it("marca problemas nuevos del ultimo reporte", () => {
    const patterns = detectTeamPatterns([
      makeReport("r1", "2026-05-20", "Reserva", "El bloque queda partido entre lineas", "medium"),
      makeReport("r2", "2026-05-27", "Cantinas", "Nos ganan duelos por banda derecha", "medium"),
    ]);

    expect(patterns.some((pattern) => pattern.kind === "newProblem")).toBe(true);
  });
});

function makeReport(
  id: string,
  date: string,
  opponent: string,
  problem: string,
  severity: "low" | "medium" | "high",
): SavedPostMatchReport {
  return {
    id,
    savedAt: `${date}T12:00:00.000Z`,
    sourceInput: {
      matchContext: {
        opponent,
        result: "1-1",
        ownSystem: "4-4-2",
      },
      staffNotes: problem,
      tags: [],
    },
    staffReview: {
      notes: "",
      acceptedMemoryCandidateIds: [],
    },
    report: {
      id: `report-${id}`,
      createdAt: `${date}T12:00:00.000Z`,
      matchContext: {
        opponent,
        result: "1-1",
        ownSystem: "4-4-2",
        date,
      },
      executiveSummary: problem,
      matchStory: problem,
      ownStrengths: [],
      ownProblems: [],
      ownTeamProblems: [
        {
          problem,
          evidence: [problem],
          severity,
        },
      ],
      conditioningContext: [],
      rivalVulnerabilities: [],
      observedRisks: [],
      tacticalTradeoffs: [],
      flankAsymmetries: [],
      tacticalInferences: [],
      memoryInfluence: [],
      grounding: {
        resultPerspective: "",
        evidenceUsed: [],
        unsupportedClaims: [],
        subjectAttributionWarnings: [],
      },
      keyPatterns: [],
      mainProblems: [],
      positives: [],
      wednesdayTest: [],
      saturdayFocus: [],
      risksOfOvercorrection: [],
      missingInformation: [],
      memoryCandidates: [],
      reflection: {
        mainUncertainty: "Sin clips.",
        alternativeInterpretation: "Puede ser un evento aislado.",
        confidence: 0.6,
      },
    },
  };
}
