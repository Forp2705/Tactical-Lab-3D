import type { CoachResponse } from "../CoachSchemas";
import type { CoachEvalCase } from "./coachEvalCases";

export type CoachEvalMetric =
  | "grounding"
  | "specificity"
  | "actionability"
  | "riskAwareness"
  | "modelAlignment";

export type CoachEvalScore = {
  caseId: string;
  modePass: boolean;
  citationPass: boolean;
  forbiddenClaimsPass: boolean;
  metrics: Record<CoachEvalMetric, number>;
  total: number;
  notes: string[];
};

export function scoreCoachResponse(
  evalCase: CoachEvalCase,
  response: CoachResponse,
): CoachEvalScore {
  const advice = response.mode === "question" ? null : response.advice;
  const text = normalize([
    response.mode,
    advice?.tacticalReading,
    advice?.probableCause,
    advice?.mainAdjustment,
    advice?.wednesdayTest,
    advice?.saturdayFocus,
    advice?.reflection.mainUncertainty,
    advice?.reflection.missingInformation,
    ...(advice?.onFieldInstructions ?? []),
    ...(advice?.adjustmentRisks ?? []),
    ...(advice?.successSignals ?? []),
    ...(response.mode === "question"
      ? response.selectedQuestions.map((question) => question.question)
      : []),
  ].filter(Boolean).join(" "));

  const citations = advice?.evidenceCitations ?? [];
  const modePass = response.mode === evalCase.expected.mode;
  const citationPass = evalCase.expected.requiredCitationTypes?.length
    ? evalCase.expected.requiredCitationTypes.some((type) =>
        citations.some((citation) => citation.sourceType === type),
      )
    : true;
  const forbiddenClaimsPass = !(evalCase.expected.forbiddenClaims ?? []).some(
    (claim) => text.includes(normalize(claim)),
  );
  const requiredTermHits = (evalCase.expected.requiredTerms ?? []).filter((term) =>
    text.includes(normalize(term)),
  ).length;
  const requiredTermRatio = evalCase.expected.requiredTerms?.length
    ? requiredTermHits / evalCase.expected.requiredTerms.length
    : 1;
  const hasCurrentEvidence = citations.some((citation) =>
    ["observation", "report", "video"].includes(citation.sourceType),
  );
  const hasActions =
    advice?.actions.length ||
    advice?.linkedExercises.length ||
    advice?.onFieldInstructions.length ||
    (response.mode === "question" ? response.selectedQuestions.length : 0) ||
    0;
  const riskTerms = ["riesgo", "tradeoff", "incertidumbre", "falta", "cautela"];
  const modelTerms = ["modelo", "alineado", "contradic", "insuficiente", "tradeoff"];

  const metrics: Record<CoachEvalMetric, number> = {
    grounding: clamp01(
      (citationPass ? 0.45 : 0) +
        (citations.length ? 0.25 : 0) +
        (hasCurrentEvidence ? 0.3 : 0) +
        (response.mode === "question" && !evalCase.expected.requiredCitationTypes?.length
          ? 0.3
          : 0),
    ),
    specificity: clamp01(requiredTermRatio),
    actionability: clamp01(hasActions ? 0.75 + Math.min(0.25, hasActions * 0.03) : 0),
    riskAwareness: clamp01(
      riskTerms.some((term) => text.includes(term)) ||
        (advice?.adjustmentRisks.length ?? 0) > 0
        ? 1
        : 0,
    ),
    modelAlignment: clamp01(
      modelTerms.some((term) => text.includes(term)) ||
        (advice?.modelContrast.aligned.length ?? 0) +
          (advice?.modelContrast.contradictions.length ?? 0) +
          (advice?.modelContrast.insufficientEvidence.length ?? 0) >
          0
        ? 1
        : 0.35,
    ),
  };
  const total =
    metrics.grounding * 0.3 +
    metrics.specificity * 0.2 +
    metrics.actionability * 0.2 +
    metrics.riskAwareness * 0.15 +
    metrics.modelAlignment * 0.15;
  const notes = [
    modePass ? "" : `mode expected ${evalCase.expected.mode}, got ${response.mode}`,
    citationPass ? "" : "required citation type missing",
    forbiddenClaimsPass ? "" : "forbidden claim detected",
    requiredTermRatio < 1 ? "some required terms were not present" : "",
  ].filter(Boolean);

  return {
    caseId: evalCase.id,
    modePass,
    citationPass,
    forbiddenClaimsPass,
    metrics,
    total: Number(total.toFixed(3)),
    notes,
  };
}

export function buildCoachLlmJudgePrompt(
  evalCase: CoachEvalCase,
  response: CoachResponse,
) {
  return JSON.stringify(
    {
      task: "Score this tactical coach answer from 0 to 1.",
      metrics: [
        "grounding",
        "specificity",
        "actionability",
        "riskAwareness",
        "modelAlignment",
      ],
      evalCase,
      response,
      outputSchema: {
        grounding: "number",
        specificity: "number",
        actionability: "number",
        riskAwareness: "number",
        modelAlignment: "number",
        notes: ["string"],
      },
    },
    null,
    2,
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
