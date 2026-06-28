import { describe, expect, it } from "vitest";
import type { CoachResponse } from "../src/ai/CoachSchemas";
import { COACH_EVAL_CASES } from "../src/ai/eval/coachEvalCases";
import {
  buildCoachLlmJudgePrompt,
  scoreCoachResponse,
} from "../src/ai/eval/coachEvalScoring";

describe("coach eval suite", () => {
  it("contiene al menos 20 casos tacticos fijos", () => {
    expect(COACH_EVAL_CASES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(COACH_EVAL_CASES.map((item) => item.id)).size).toBe(
      COACH_EVAL_CASES.length,
    );
  });

  it("scorea grounding, especificidad y accionabilidad", () => {
    const evalCase = COACH_EVAL_CASES.find((item) => item.id === "video-020");
    expect(evalCase).toBeTruthy();

    const score = scoreCoachResponse(evalCase!, response());

    expect(score.modePass).toBe(true);
    expect(score.citationPass).toBe(true);
    expect(score.metrics.grounding).toBeGreaterThan(0.7);
    expect(score.metrics.actionability).toBeGreaterThan(0.7);
    expect(score.total).toBeGreaterThan(0.6);
  });

  it("genera prompt de judge opcional", () => {
    const prompt = buildCoachLlmJudgePrompt(COACH_EVAL_CASES[0], response());
    expect(prompt).toContain("grounding");
    expect(prompt).toContain(COACH_EVAL_CASES[0].id);
  });
});

function response(): CoachResponse {
  return {
    mode: "hypothesis",
    intent: {
      domains: ["defense"],
      specificity: "specific",
      requestType: "diagnosis",
      impliedClaims: [],
    },
    evidenceAudit: {
      covered: ["matchContext", "moment", "zone"],
      missing: [],
      criticalMissingCount: 0,
      evidenceStrength: "sufficient",
    },
    confidenceCap: 0.75,
    followUpQuestions: [],
    advice: {
      tacticalReading: "El video muestra que el bloque queda largo entre lineas.",
      problemBreakdown: {
        zone: "Carril central",
        moment: "Tras perdida",
        trigger: "Pase vertical rival",
        ownVsRival: "Distancia propia entre lineas",
      },
      probableCause: "Los volantes saltan y la defensa no achica.",
      mainAdjustment: "Ajustar distancia del bloque y medirlo con timestamps de video.",
      alternativeAdjustments: [
        {
          adjustment: "Bloque medio.",
          whenToUse: "Si no hay energia para presionar alto.",
          tradeoff: "Cede metros.",
        },
      ],
      onFieldInstructions: ["Achicar antes de saltar."],
      wednesdayTest: "Tarea con video y pausa por timestamp.",
      saturdayFocus: "Reducir distancia entre lineas.",
      adjustmentRisks: ["Riesgo de quedar pasivos."],
      successSignals: ["Menos recepciones entre lineas."],
      reflection: {
        mainUncertainty: "Faltan mas clips.",
        missingInformation: "Falta frecuencia.",
        alternativeInterpretation: "Puede ser cansancio.",
        confidence: 0.75,
      },
      linkedExercises: [],
      actions: [{ type: "addToSession", exerciseId: "ex-1" }],
      evidenceCitations: [
        {
          sourceType: "video",
          sourceId: "VID-1",
          title: "Video evidence 1",
          excerpt: "12:31 | bloque largo | carril central",
          relevance: 0.92,
          evidenceTargets: ["moment", "zone", "matchContext"],
        },
      ],
      modelContrast: {
        aligned: [],
        contradictions: [],
        insufficientEvidence: ["Falta frecuencia completa."],
      },
      playerFitWarnings: [],
      supportingFacts: [],
    },
  };
}
