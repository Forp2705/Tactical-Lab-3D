import { describe, expect, it } from "vitest";
import {
  assessCoachAdviceTrust,
  guardCoachAdvice,
} from "../src/ai/coachOutputGuard";
import type { CoachMatchAdvice } from "../src/ai/CoachSchemas";

describe("coachOutputGuard", () => {
  it("capea confianza si no hay citas validas", () => {
    const guarded = guardCoachAdvice(advice(), {
      userInput: "Nos cuesta salir limpio",
      evidenceCatalog: [],
    });

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.5);
    expect(guarded.reflection.mainUncertainty).toContain("no hay citas validas");
  });

  it("capea confianza si la salida deriva de fase", () => {
    const guarded = guardCoachAdvice(
      advice({
        tacticalReading: "El equipo debe defender centros laterales.",
        probableCause: "Falta marca en el area.",
        mainAdjustment: "Cerrar segundo palo.",
        wednesdayTest: "Defensa de centros y marcas en area.",
        saturdayFocus: "Proteger segundo palo.",
        evidenceCitations: [
          {
            sourceType: "knowledge",
            sourceId: "KN-1",
            title: "Salida interior",
            excerpt: "Apoyos del pivote bajo presion.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Al 5 lo aprietan cuando recibe de espaldas",
        evidenceCatalog: [
          {
            id: "KN-1",
            sourceType: "knowledge",
          },
        ],
      },
    );

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.55);
    expect(guarded.reflection.mainUncertainty).toContain("derivando de fase");
  });

  it("capea afirmaciones fuertes cuando solo hay conocimiento generico", () => {
    const guarded = guardCoachAdvice(
      advice({
        reflection: {
          mainUncertainty: "",
          missingInformation: "Falta evidencia actual.",
          alternativeInterpretation: "Puede ser solo una pauta general.",
          confidence: 0.82,
        },
        evidenceCitations: [
          {
            sourceType: "knowledge",
            sourceId: "KN-1",
            title: "Salida interior",
            excerpt: "Apoyos del pivote bajo presion.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Nos cuesta salir limpio por el pivote",
        evidenceCatalog: [
          {
            id: "KN-1",
            sourceType: "knowledge",
          },
        ],
      },
    );

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.62);
    expect(guarded.reflection.mainUncertainty).toContain(
      "sin evidencia actual",
    );
  });

  it("marca downgrade a hipotesis si no hay citas validas", () => {
    const assessment = assessCoachAdviceTrust(advice(), {
      userInput: "Nos cuesta salir limpio",
      evidenceCatalog: [],
    });

    expect(assessment.requiresHypothesisMode).toBe(true);
    expect(assessment.hasCitation).toBe(false);
    expect(assessment.confidenceCap).toBeLessThanOrEqual(0.5);
  });

  it("marca downgrade a hipotesis cuando deriva de fase", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        tacticalReading: "El equipo debe defender centros laterales.",
        probableCause: "Falta marca en el area.",
        mainAdjustment: "Cerrar segundo palo.",
        wednesdayTest: "Defensa de centros y marcas en area.",
        saturdayFocus: "Proteger segundo palo.",
        evidenceCitations: [
          {
            sourceType: "report",
            sourceId: "RP-1",
            title: "Reporte rival",
            excerpt: "Problemas por dentro en salida.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Al 5 lo aprietan cuando recibe de espaldas",
        evidenceCatalog: [{ id: "RP-1", sourceType: "report" }],
      },
    );

    expect(assessment.missingPrimaryDomain).toBe(true);
    expect(assessment.requiresHypothesisMode).toBe(true);
  });

  it("mantiene diagnostico posible cuando hay evidencia del caso y no deriva de fase", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        tacticalReading:
          "El pivote recibe de espaldas y pierde el primer apoyo por dentro.",
        probableCause: "Falta un tercer hombre cercano en salida.",
        mainAdjustment: "Acercar apoyo interior antes del primer pase.",
        wednesdayTest: "Rondo de salida con tercer hombre.",
        saturdayFocus: "Sostener salida interior ante presion.",
        evidenceCitations: [
          {
            sourceType: "video",
            sourceId: "VID-1",
            title: "Clip 14: salida interior",
            excerpt: "El 5 recibe de espaldas y no encuentra apoyo.",
            relevance: 0.9,
            evidenceTargets: ["cause", "trigger"],
          },
        ],
      }),
      {
        userInput: "Nos cuesta salir limpio con el 5 de espaldas",
        evidenceCatalog: [{ id: "VID-1", sourceType: "video" }],
      },
    );

    expect(assessment.requiresHypothesisMode).toBe(false);
    expect(assessment.hasCaseEvidence).toBe(true);
  });
});

function advice(patch: Partial<CoachMatchAdvice> = {}): CoachMatchAdvice {
  return {
    tacticalReading: "El equipo no encuentra salida interior.",
    problemBreakdown: {
      zone: "Carril central",
      moment: "Inicio de jugada",
      trigger: "Presion rival sobre el pivote",
      ownVsRival: "Falta apoyo propio ante presion rival",
    },
    probableCause: "El 5 recibe de espaldas sin tercer hombre.",
    mainAdjustment: "Acercar apoyo y orientar recepcion antes del primer pase.",
    alternativeAdjustments: [],
    onFieldInstructions: ["Perfilar antes de recibir."],
    wednesdayTest: "Rondo posicional de salida.",
    saturdayFocus: "Primer pase limpio.",
    adjustmentRisks: [],
    successSignals: ["Menos perdidas en salida."],
    reflection: {
      mainUncertainty: "Faltan clips.",
      missingInformation: "Falta rival y zona exacta.",
      alternativeInterpretation: "Puede ser distancia entre apoyos.",
      confidence: 0.82,
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
    ...patch,
  };
}
