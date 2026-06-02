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

  it("acepta diagnosis con desglose y alternativas", () => {
    const result = CoachResponseSchema.safeParse({
      mode: "diagnosis",
      intent,
      evidenceAudit,
      advice: {
        tacticalReading: "El equipo queda largo tras perdida.",
        problemBreakdown: {
          zone: "Carril central",
          moment: "Tras perdida",
          trigger: "Pase vertical rival",
          ownVsRival: "Falla propia de distancia entre lineas",
        },
        probableCause: "El medio salta sin que la defensa achique.",
        mainAdjustment: "Cerrar el bloque antes de presionar hacia delante.",
        alternativeAdjustments: [
          {
            adjustment: "Bloque medio con gatillo de pase atras.",
            whenToUse: "Si el rival sale limpio bajo presion.",
            tradeoff: "Cede metros iniciales.",
          },
          {
            adjustment: "Presion alta por ventanas cortas.",
            whenToUse: "Si el rival tiene centrales imprecisos.",
            tradeoff: "Expone espalda si el salto llega tarde.",
          },
        ],
        onFieldInstructions: ["Achicar antes de saltar."],
        wednesdayTest: "Tarea de perdida y reaccion.",
        saturdayFocus: "No partirse tras perdida.",
        adjustmentRisks: ["Quedar pasivos."],
        successSignals: ["Menos recepciones entre lineas."],
        reflection: {
          mainUncertainty: "Faltan clips.",
          missingInformation: "Falta zona exacta.",
          alternativeInterpretation: "Puede ser cansancio.",
          confidence: 0.7,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
