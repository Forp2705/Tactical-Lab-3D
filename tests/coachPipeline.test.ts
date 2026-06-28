import { describe, expect, it } from "vitest";
import {
  buildCoachPipelineTrace,
  buildCoachRetrievalQuery,
  classifyCoachIntent,
  selfCheckCoachAdvice,
} from "../src/ai/CoachPipeline";
import type { CoachMatchAdvice } from "../src/ai/CoachSchemas";

describe("coach multi-step pipeline", () => {
  it("clasifica intent y enriquece query con evidencia recolectada", () => {
    const intent = classifyCoachIntent("Nos cuesta salir limpio con el 5");
    const query = buildCoachRetrievalQuery("Nos cuesta salir limpio", [
      {
        questionId: "q1",
        evidenceTarget: "trigger",
        category: "buildUp",
        answerKind: "shortText",
        rawAnswer: "Lo aprietan cuando recibe de espaldas.",
      },
    ]);

    expect(intent.domains).toContain("buildUp");
    expect(query).toContain("recibe de espaldas");
  });

  it("detecta riesgos de self-check antes de devolver una respuesta", () => {
    const advice = sampleAdvice({
      reflection: {
        mainUncertainty: "Falta evidencia.",
        missingInformation: "Falta frecuencia.",
        alternativeInterpretation: "Puede ser distancia entre apoyos.",
        confidence: 0.82,
      },
      actions: [{ type: "openExercise", label: "Abrir ejercicio" }],
    });

    const check = selfCheckCoachAdvice(advice, {
      covered: ["zone"],
      missing: [{ target: "cause", reason: "Falta causa." }],
      criticalMissingCount: 1,
      evidenceStrength: "partial",
    });

    expect(check.overconfidenceRisk).toBe(true);
    expect(check.nonExecutableActionRisk).toBe(true);
  });

  it("produce una traza operacional por etapas", () => {
    const trace = buildCoachPipelineTrace({
      input: "El 9 queda aislado",
      collectedEvidence: [],
      retrieved: [],
      audit: {
        covered: [],
        missing: [{ target: "cause", reason: "Falta causa." }],
        criticalMissingCount: 1,
        evidenceStrength: "none",
      },
      skipInterview: false,
    });

    expect(trace.intent.domains).toContain("attack");
    expect(trace.promptMode).toBe("hypothesis");
    expect(trace.retrievedEvidenceCount).toBe(0);
  });
});

function sampleAdvice(patch: Partial<CoachMatchAdvice> = {}): CoachMatchAdvice {
  return {
    tacticalReading: "Lectura",
    problemBreakdown: {
      zone: "Central",
      moment: "Inicio",
      trigger: "Presion",
      ownVsRival: "Propio vs rival",
    },
    probableCause: "Causa",
    mainAdjustment: "Ajuste",
    alternativeAdjustments: [],
    onFieldInstructions: [],
    wednesdayTest: "Test",
    saturdayFocus: "Foco",
    adjustmentRisks: [],
    successSignals: [],
    reflection: {
      mainUncertainty: "",
      missingInformation: "",
      alternativeInterpretation: "",
      confidence: 0.5,
    },
    linkedExercises: [],
    actions: [],
    evidenceCitations: [],
    modelContrast: {
      aligned: [],
      contradictions: [],
      insufficientEvidence: [],
    },
    playerFitWarnings: [],
    supportingFacts: [],
    ...patch,
  };
}
