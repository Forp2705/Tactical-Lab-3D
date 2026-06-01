import { describe, expect, it } from "vitest";
import { CoachResponseSchema } from "../src/ai/CoachSchemas";

const intent = {
  domains: ["defense"],
  specificity: "general",
  requestType: "diagnosis",
  impliedClaims: [],
};

const evidenceAudit = {
  covered: [],
  missing: [{ target: "cause", reason: "Falta confirmar la causa." }],
  criticalMissingCount: 1,
  evidenceStrength: "none",
};

describe("CoachResponse discriminated union", () => {
  it("permite mode question sin campos de diagnostico", () => {
    const result = CoachResponseSchema.safeParse({
      mode: "question",
      intent,
      selectedQuestions: [
        {
          id: "q_defense_cause",
          question: "El problema aparece por dentro o por banda?",
          whyItMatters: "Define si el ajuste es de bloque o de duelos.",
          category: "defense",
          evidenceTarget: "zone",
          purpose: "classifyProblem",
          answerKind: "singleChoice",
          options: ["Por dentro", "Por banda", "A la espalda"],
          informationValue: "high",
          tacticalRiskReduced: "Evita inventar la zona del problema.",
          expectedImpactOnDiagnosis: "high",
          blocksClaimIds: [],
        },
      ],
      blockedClaims: [],
      evidenceAudit,
      confidenceCap: 0.45,
    });

    expect(result.success).toBe(true);
  });

  it("no acepta diagnosis sin advice", () => {
    const result = CoachResponseSchema.safeParse({
      mode: "diagnosis",
      intent,
      evidenceAudit,
    });

    expect(result.success).toBe(false);
  });
});
