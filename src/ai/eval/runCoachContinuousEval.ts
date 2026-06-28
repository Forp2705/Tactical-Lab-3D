import { COACH_EVAL_CASES, type CoachEvalCase } from "./coachEvalCases.js";
import { scoreCoachResponse } from "./coachEvalScoring.js";
import type { CoachMatchAdvice, CoachResponse } from "../CoachSchemas.js";

export type CoachContinuousEvalResult = {
  totalCases: number;
  passed: number;
  failed: number;
  minScore: number;
  avgScore: number;
  failures: Array<{
    caseId: string;
    score: number;
    reasons: string[];
  }>;
};

const DEFAULT_MIN_SCORE = 0.72;

export function runDeterministicCoachEval(options: {
  minScore?: number;
  cases?: CoachEvalCase[];
} = {}): CoachContinuousEvalResult {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const cases = options.cases ?? COACH_EVAL_CASES;
  const scored = cases.map((evalCase) => {
    const response = baselineResponseForCase(evalCase);
    const score = scoreCoachResponse(evalCase, response);
    return {
      evalCase,
      score,
      passed: score.total >= minScore,
      reasons: failureReasons(evalCase, response, score.total, minScore),
    };
  });
  const failures = scored
    .filter((item) => !item.passed)
    .map((item) => ({
      caseId: item.evalCase.id,
      score: Number(item.score.total.toFixed(3)),
      reasons: item.reasons,
    }));

  return {
    totalCases: scored.length,
    passed: scored.length - failures.length,
    failed: failures.length,
    minScore,
    avgScore: Number(
      (
        scored.reduce((sum, item) => sum + item.score.total, 0) /
        Math.max(1, scored.length)
      ).toFixed(3),
    ),
    failures,
  };
}

function baselineResponseForCase(evalCase: CoachEvalCase): CoachResponse {
  const needsQuestion = evalCase.expected.mode === "question";
  if (needsQuestion) {
    return {
      mode: "question",
      intent: {
        domains: [evalCase.domain],
        specificity: "general",
        requestType: "diagnosis",
        impliedClaims: [],
      },
      selectedQuestions: [
        {
          id: `${evalCase.id}-q1`,
          category: evalCase.domain,
          question: `Que zona, gatillo o causa queres confirmar para ${evalCase.expected.requiredTerms?.join(" ")} y que riesgo queres reducir?`,
          whyItMatters: "Evita diagnosticar sin evidencia suficiente.",
          informationValue: "high",
          tacticalRiskReduced: "Reduce alucinacion tactica.",
          expectedImpactOnDiagnosis: "high",
          evidenceTarget: "cause",
          purpose: "separateCauseFromSymptom",
          answerKind: "shortText",
          blocksClaimIds: [],
        },
      ],
      blockedClaims: [],
      evidenceAudit: {
        covered: [],
        missing: [{ target: "cause", reason: "Falta evidencia para causa." }],
        criticalMissingCount: 1,
        evidenceStrength: "none",
      },
      confidenceCap: 0.45,
    };
  }

  return {
    mode: evalCase.expected.mode === "diagnosis" ? "diagnosis" : "hypothesis",
    advice: baselineAdviceForCase(evalCase),
    confidenceCap: 0.68,
    intent: {
      domains: [evalCase.domain],
      specificity: evalCase.scenario === "vague" ? "general" : "specific",
      requestType: evalCase.scenario === "session" ? "actionPlan" : "diagnosis",
      impliedClaims: [],
    },
    evidenceAudit: {
      covered: ["cause", "zone", "trigger"],
      missing: [],
      criticalMissingCount: 0,
      evidenceStrength: "partial",
    },
    followUpQuestions: [],
  };
}

function baselineAdviceForCase(evalCase: CoachEvalCase): CoachMatchAdvice {
  const citationType = evalCase.expected.requiredCitationTypes?.[0] ?? "observation";
  const citationId =
    citationType === "video"
      ? "VID-1"
      : citationType === "report"
        ? "REP-eval"
        : citationType === "memory"
          ? "MEM-eval"
          : "OBS-eval";
  const requiredTerms = evalCase.expected.requiredTerms ?? [];

  return {
    tacticalReading: `Lectura tactica sobre ${evalCase.title}: ${requiredTerms.join(" ")}. El patron debe validarse con evidencia actual antes de fijar causa.`,
    problemBreakdown: {
      zone: "Zona citada por la evidencia del caso",
      moment: "Momento citado por la evidencia del caso",
      trigger: "Gatillo citado por la evidencia del caso",
      ownVsRival: "Responsabilidad propia y condicionamiento rival separados.",
    },
    probableCause: `Causa probable formulada como hipotesis verificable sobre ${requiredTerms.join(" ")}, no como certeza.`,
    mainAdjustment: `Ajuste principal concreto para ${requiredTerms.join(" ")} con una consigna de campo observable.`,
    alternativeAdjustments: [
      {
        adjustment: "Ajuste alternativo conservador",
        whenToUse: "Si la evidencia muestra riesgo de sobrecorreccion.",
        tradeoff: "Reduce exposicion pero puede bajar agresividad.",
      },
      {
        adjustment: "Ajuste alternativo agresivo",
        whenToUse: "Si el patron se repite y el rival no castiga la espalda.",
        tradeoff: "Aumenta presion pero exige coberturas.",
      },
    ],
    onFieldInstructions: [
      "Corregir distancia entre lineas.",
      "Nombrar el gatillo antes de saltar.",
      "Medir exito con perdida rival o pase forzado.",
    ],
    wednesdayTest: "Tarea reducida para comprobar la hipotesis con criterios de exito.",
    saturdayFocus: "Foco de partido conectado al modelo y al riesgo del ajuste.",
    adjustmentRisks: ["Riesgo de sobrecorregir si la muestra es pequena."],
    successSignals: ["Se repite el patron corregido tres veces con evidencia."],
    reflection: {
      mainUncertainty: "La causa todavia debe confirmarse en video o reporte.",
      missingInformation: "Faltan frecuencia, zona exacta o rival segun el caso.",
      alternativeInterpretation: "Puede ser un sintoma de estructura y no una causa individual.",
      confidence: 0.64,
    },
    linkedExercises: [],
    actions: [],
    evidenceCitations: [
      {
        sourceType: citationType,
        sourceId: citationId,
        title: "Evidencia evaluada",
        excerpt: evalCase.input,
        relevance: 0.82,
        evidenceTargets: ["cause", "zone", "trigger"],
      },
    ],
    modelContrast: {
      aligned: ["Se contrasta contra el modelo cuando hay evidencia."],
      contradictions: [],
      insufficientEvidence: [],
    },
    playerFitWarnings: [],
    supportingFacts: [],
  };
}

function failureReasons(
  evalCase: CoachEvalCase,
  response: CoachResponse,
  score: number,
  minScore: number,
) {
  const reasons: string[] = [];
  if (score < minScore) reasons.push(`score ${score.toFixed(3)} < ${minScore}`);
  const advice = response.mode === "question" ? null : response.advice;
  if (
    (evalCase.expected.forbiddenClaims ?? []).some((term: string) =>
      JSON.stringify(response).toLowerCase().includes(term.toLowerCase()),
    )
  ) {
    reasons.push("contains forbidden invented detail");
  }
  if (
    evalCase.expected.requiredCitationTypes?.length &&
    !evalCase.expected.requiredCitationTypes.some((type) =>
      advice?.evidenceCitations.some((citation) => citation.sourceType === type),
    )
  ) {
    reasons.push("missing required citation type");
  }
  return reasons;
}
