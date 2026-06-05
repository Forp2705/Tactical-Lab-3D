import { beforeEach, describe, expect, it } from "vitest";
import type {
  CoachMatchAdvice,
  CoachResponse,
  EvidenceAudit,
  TacticalIntent,
} from "../src/ai/CoachSchemas";
import {
  detectTeamPatterns,
  type TeamPattern,
} from "../src/ai/patternDetection";
import type { SavedPostMatchReport } from "../src/ai/post-match/schemas";
import { useAppStore } from "../src/state/useAppStore";
import { resolveWeeklyDecisionThreadProgress } from "../src/state/weeklyDecisionThread";

const diagnosisIntent: TacticalIntent = {
  domains: ["buildUp"],
  specificity: "specific",
  requestType: "diagnosis",
  impliedClaims: [],
};

const sufficientAudit: EvidenceAudit = {
  covered: ["cause", "zone", "ownTeam"],
  missing: [],
  criticalMissingCount: 0,
  evidenceStrength: "sufficient",
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    manualObservations: [],
    weeklyDecisionThread: null,
    pendingPostMatchImport: null,
    aiPrompt: "",
    session: {
      ...useAppStore.getState().session,
      name: "Sesion test",
      blocks: [],
      computed: {
        totalDuration: 0,
        totalLoad: 0,
        materials: [],
        primaryObjectives: [],
      },
      staffNotes: "",
    },
  });
});

describe("weeklyDecisionThread", () => {
  it("mantiene hipotesis cuando la semana nace desde una observacion manual", () => {
    const store = useAppStore.getState();
    const observationId = store.addManualObservation({
      text: "El 5 queda tapado en salida",
      source: "home",
    });

    expect(observationId).toBeTruthy();
    store.activateWeeklyThreadFromObservation(observationId!);
    store.setAiPrompt("El 5 queda tapado en salida");
    store.applyCoachTurnResult(
      makeHypothesisResponse("El 5 queda tapado en salida", observationId!),
    );

    const next = useAppStore.getState().weeklyDecisionThread;
    expect(next).toMatchObject({
      problem: "El 5 queda tapado en salida",
      origin: "coach",
      mode: "hypothesis",
      status: "open",
    });
    expect(next?.evidenceIds).toContain(observationId);
    expect(next?.sessionIntent?.problem).toBe("El 5 queda tapado en salida");
  });

  it("sube a diagnostico cuando entra evidencia mas fuerte y citada", () => {
    const store = useAppStore.getState();
    const observationId = store.addManualObservation({
      text: "El 5 queda tapado en salida",
      source: "home",
    });

    store.activateWeeklyThreadFromObservation(observationId!);
    store.setAiPrompt("El 5 queda tapado en salida");
    store.applyCoachTurnResult(
      makeDiagnosisResponse("El 5 queda tapado en salida", observationId!),
    );

    const next = useAppStore.getState().weeklyDecisionThread;
    expect(next).toMatchObject({
      problem:
        "El 5 queda tapado en salida y la progresion nace sin apoyo frontal.",
      mode: "diagnosis",
      confidence: 0.74,
    });
    expect(next?.evidenceIds).toEqual(
      expect.arrayContaining([observationId!, "report-build-up-1"]),
    );
  });

  it("crea una sesion ya ligada al problema activo", () => {
    const store = useAppStore.getState();
    const observationId = store.addManualObservation({
      text: "El 5 queda tapado en salida",
      source: "home",
    });

    store.activateWeeklyThreadFromObservation(observationId!);
    store.setAiPrompt("El 5 queda tapado en salida");
    store.applyCoachTurnResult(
      makeDiagnosisResponse("El 5 queda tapado en salida", observationId!),
    );

    const created = store.createSessionFromWeeklyThread();
    const next = useAppStore.getState();

    expect(created).toBe(true);
    expect(next.weeklyDecisionThread?.status).toBe("trained");
    expect(next.session.blocks.length).toBeGreaterThan(0);
    expect(next.session.staffNotes).toContain("Problema semanal:");
    expect(next.session.staffNotes).toContain(
      "El 5 queda tapado en salida y la progresion nace sin apoyo frontal.",
    );
    expect(next.session.blocks[0]?.notes).toContain("Revision proximo partido:");
  });

  it("importa a post-partido solo las observaciones seleccionadas", () => {
    const store = useAppStore.getState();
    const firstId = store.addManualObservation({
      text: "El 5 queda tapado en salida",
      source: "home",
    });
    const secondId = store.addManualObservation({
      text: "El 9 queda lejos del bloque",
      source: "home",
    });

    store.activateWeeklyThreadFromObservation(firstId!);
    store.queuePostMatchManualObservations([firstId!]);
    const pending = store.consumePendingPostMatchImport();

    expect(pending).toMatchObject({
      source: "manualObservation",
      observationIds: [firstId],
      threadId: useAppStore.getState().weeklyDecisionThread?.id ?? null,
    });
    expect(pending?.evidenceText).toContain("El 5 queda tapado en salida");
    expect(pending?.evidenceText).not.toContain("El 9 queda lejos del bloque");
    expect(pending?.evidenceText).toContain("Observacion manual");
    expect(pending?.evidenceText).toContain("no confirmada por video");
    expect(secondId).toBeTruthy();
  });

  it("sincroniza evolucion del mismo hilo y marca estado recurrente", () => {
    const store = useAppStore.getState();
    const observationId = store.addManualObservation({
      text: "El 5 queda tapado en salida",
      source: "home",
    });

    store.activateWeeklyThreadFromObservation(observationId!);
    store.setAiPrompt("El 5 queda tapado en salida");
    store.applyCoachTurnResult(
      makeDiagnosisResponse("El 5 queda tapado en salida", observationId!),
    );
    store.syncWeeklyThreadFromPostMatchReport(
      makeReport(
        "r1",
        "2026-06-01",
        "Reserva",
        "El 5 queda tapado en salida y no encuentra apoyo cercano",
        "medium",
      ),
    );

    const patterns = detectTeamPatterns([
      makeReport(
        "r1",
        "2026-06-01",
        "Reserva",
        "El 5 queda tapado en salida y no encuentra apoyo cercano",
        "medium",
      ),
      makeReport(
        "r2",
        "2026-06-08",
        "Cantinas",
        "El 5 queda tapado en salida y no encuentra apoyo cercano",
        "high",
      ),
    ]);

    const progress = resolveWeeklyDecisionThreadProgress(
      useAppStore.getState().weeklyDecisionThread,
      patterns,
    );
    expect(progress).toBe("recurring");

    store.syncWeeklyThreadProgress(progress!, "r2");
    const next = useAppStore.getState().weeklyDecisionThread;
    expect(next).toMatchObject({
      progress: "recurring",
      status: "reviewed",
      lastReportId: "r2",
    });
  });
});

function makeHypothesisResponse(
  prompt: string,
  observationId: string,
): CoachResponse {
  return {
    mode: "hypothesis",
    intent: diagnosisIntent,
    evidenceAudit: {
      ...sufficientAudit,
      evidenceStrength: "partial",
      criticalMissingCount: 1,
    },
    confidenceCap: 0.48,
    followUpQuestions: [],
    advice: {
      ...makeAdvice(prompt, observationId),
      tacticalReading: prompt,
      reflection: {
        mainUncertainty: "Falta confirmar frecuencia y apoyos alrededor del 5.",
        missingInformation: "No hay clips validados por video.",
        alternativeInterpretation: "Puede ser un problema de alturas, no solo de linea de pase.",
        confidence: 0.48,
      },
      evidenceCitations: [
        {
          sourceType: "observation",
          sourceId: observationId,
          title: "Observacion manual del staff",
          excerpt: prompt,
          relevance: 0.68,
          evidenceTargets: ["cause", "zone"],
        },
      ],
    },
  };
}

function makeDiagnosisResponse(
  prompt: string,
  observationId: string,
): CoachResponse {
  return {
    mode: "diagnosis",
    intent: diagnosisIntent,
    evidenceAudit: sufficientAudit,
    advice: makeAdvice(prompt, observationId),
  };
}

function makeAdvice(
  prompt: string,
  observationId: string,
): CoachMatchAdvice {
  return {
    tacticalReading:
      "El 5 queda tapado en salida y la progresion nace sin apoyo frontal.",
    problemBreakdown: {
      zone: "Carril central",
      moment: "Inicio de salida",
      trigger: "Primer pase hacia el pivote",
      ownVsRival: "Problema propio de distancias y apoyos",
    },
    probableCause:
      "El interior y el lateral no ofrecen una linea de apoyo corta cuando el 5 recibe de espaldas.",
    mainAdjustment:
      "Acercar un apoyo interior y escalonar mejor al lateral para liberar al 5 en salida.",
    onFieldInstructions: [
      "Dar apoyo frontal al 5 antes de buscar progresion larga.",
    ],
    alternativeAdjustments: [],
    wednesdayTest:
      "Tarea de salida donde el 5 debe recibir con apoyo interior y lateral escalonado.",
    saturdayFocus:
      "Revisar si el 5 vuelve a quedar tapado en el inicio de salida.",
    adjustmentRisks: ["Fijar apoyos demasiado bajos y perder altura."],
    successSignals: [
      "El 5 recibe con pase de apoyo corto y el equipo supera la primera linea.",
    ],
    reflection: {
      mainUncertainty: "Falta validar si el ajuste se sostiene contra un rival de presion alta.",
      missingInformation: "Falta frecuencia en mas partidos.",
      alternativeInterpretation:
        "Parte del problema puede venir del perfil corporal del 5 al recibir.",
      confidence: 0.74,
    },
    linkedExercises: [],
    actions: [],
    evidenceCitations: [
      {
        sourceType: "observation",
        sourceId: observationId,
        title: "Observacion manual del staff",
        excerpt: prompt,
        relevance: 0.78,
        evidenceTargets: ["cause", "zone"],
      },
      {
        sourceType: "report",
        sourceId: "report-build-up-1",
        title: "Reporte reciente",
        excerpt: "El pivote queda tapado y la salida no conecta con apoyo corto.",
        relevance: 0.82,
        evidenceTargets: ["cause", "frequency"],
      },
    ],
    modelContrast: {
      aligned: [],
      contradictions: [],
      insufficientEvidence: [],
    },
    playerFitWarnings: [],
  };
}

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
        ownSystem: "4-3-3",
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
        ownSystem: "4-3-3",
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
          probableCause:
            "El apoyo interior llega tarde y el 5 queda recibiendo de espaldas.",
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
      mainProblems: [
        {
          problem,
          probableCause:
            "El apoyo interior llega tarde y el 5 queda recibiendo de espaldas.",
          severity,
          examplesToReview: [],
        },
      ],
      positives: [],
      wednesdayTest: [
        {
          hypothesis: "El 5 necesita un apoyo corto y visible en salida.",
          test: "Repetir salida con apoyo interior fijo y lateral escalonado.",
          successSignals: [
            "El primer pase conecta con apoyo frontal.",
          ],
        },
      ],
      saturdayFocus: [
        "Confirmar si el 5 recibe con apoyo corto y perfilado.",
      ],
      risksOfOvercorrection: [],
      missingInformation: [],
      memoryCandidates: [],
      reflection: {
        mainUncertainty: "Falta mas de un rival para confirmar el patron.",
        alternativeInterpretation: "Puede ser tambien un problema de orientacion corporal.",
        confidence: 0.71,
      },
    },
  };
}
