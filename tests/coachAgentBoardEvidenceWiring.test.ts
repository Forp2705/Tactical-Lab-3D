import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachMatchAdvice } from "../src/ai/CoachSchemas";
import { packet } from "./fixtures/coachBridgeFixtures";

// Reuses the existing coach test mock pattern (see tests/coachTurnFlow.test.ts):
// the OpenRouter client is stubbed so runCoachTurn runs end-to-end without an LLM.
const mockState = vi.hoisted(() => ({ advice: null as CoachMatchAdvice | null }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify(mockState.advice) } }],
        }),
      },
    };
  },
}));

describe("runCoachTurn board-evidence wiring", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    mockState.advice = advice();
  });

  it("accepts a boardEvidence argument and is a no-op when it is absent (existing path unchanged)", async () => {
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const withoutPacket = await runCoachTurn({
      input: "Nos cuesta defender centros",
      coachContext: { availableSquad: [], unavailableSquad: [] },
      skipInterview: true,
    });

    // The wrapper accepts the new optional arg; with an unreferenced packet the
    // firewall finds nothing to sanitize, so the response is structurally identical.
    const withPacket = await runCoachTurn({
      input: "Nos cuesta defender centros",
      coachContext: { availableSquad: [], unavailableSquad: [] },
      skipInterview: true,
      boardEvidence: packet(),
    });

    expect(withoutPacket.mode).toBe("hypothesis");
    expect(withPacket).toEqual(withoutPacket);
  });
});

function advice(): CoachMatchAdvice {
  return {
    tacticalReading: "El equipo queda largo entre lineas.",
    problemBreakdown: {
      zone: "Carril central",
      moment: "Tras perdida",
      trigger: "Pase vertical rival",
      ownVsRival: "Falla propia de distancia entre lineas",
    },
    probableCause: "El medio salta sin que la defensa achique.",
    mainAdjustment: "Cerrar el bloque antes de presionar.",
    alternativeAdjustments: [],
    onFieldInstructions: ["Achicar antes de saltar."],
    wednesdayTest: "Tarea de perdida y reaccion.",
    saturdayFocus: "No partirse tras perdida.",
    adjustmentRisks: [],
    successSignals: ["Menos recepciones entre lineas."],
    reflection: {
      mainUncertainty: "Faltan clips.",
      missingInformation: "Falta zona exacta.",
      alternativeInterpretation: "Puede ser cansancio.",
      confidence: 0.7,
    },
    linkedExercises: [],
    actions: [],
    evidenceCitations: [],
    modelContrast: { aligned: [], contradictions: [], insufficientEvidence: [] },
    playerFitWarnings: [],
    supportingFacts: [],
  };
}
