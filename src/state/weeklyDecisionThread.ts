import type { CoachMatchAdvice, CoachResponse } from "@/ai/CoachSchemas";
import type { TeamPattern, TeamPatternKind } from "@/ai/patternDetection";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";

export type WeeklyDecisionThreadOrigin =
  | "manualObservation"
  | "coach"
  | "postMatch"
  | "evolution";

export type WeeklyDecisionThreadMode = "hypothesis" | "diagnosis";

export type WeeklyDecisionThreadStatus =
  | "open"
  | "trained"
  | "reviewed"
  | "evolved";

export type WeeklyDecisionThreadProgress =
  | "open"
  | "improved"
  | "returned"
  | "recurring"
  | "evolved";

export type WeeklyDecisionSessionIntent = {
  problem: string;
  objective: string;
  successSignal: string;
  reviewCriteria: string;
};

export type WeeklyDecisionThread = {
  id: string;
  teamId: string;
  problem: string;
  origin: WeeklyDecisionThreadOrigin;
  evidenceIds: string[];
  mode: WeeklyDecisionThreadMode;
  confidence: number;
  sessionIntent: WeeklyDecisionSessionIntent | null;
  nextReviewCriteria: string[];
  status: WeeklyDecisionThreadStatus;
  progress: WeeklyDecisionThreadProgress;
  createdAt: string;
  updatedAt: string;
  lastReportId?: string;
};

export type PendingPostMatchImport = {
  threadId: string | null;
  teamId: string | null;
  source: "manualObservation" | "videoEvidence";
  observationIds: string[];
  evidenceText: string;
};

export type ManualObservationLike = {
  id: string;
  teamId: string;
  text: string;
  createdAt: string;
  source: "home" | "postMatch";
};

export type WeeklyDecisionThreadReportInput =
  | SavedPostMatchReport
  | {
      id?: string;
      report: SavedPostMatchReport["report"];
    };

export function buildSessionIntentFromProblem(
  problem: string,
  options?: Partial<WeeklyDecisionSessionIntent>,
): WeeklyDecisionSessionIntent {
  const normalizedProblem = problem.trim() || "Problema a confirmar.";
  return {
    problem: normalizedProblem,
    objective:
      options?.objective?.trim() ||
      `Ajustar el comportamiento asociado a: ${normalizedProblem}`,
    successSignal:
      options?.successSignal?.trim() ||
      "El problema deja de repetirse en la tarea y el equipo encuentra una respuesta estable.",
    reviewCriteria:
      options?.reviewCriteria?.trim() ||
      `Revisar si ${normalizeProblemForSentence(normalizedProblem)} vuelve a aparecer en el proximo partido.`,
  };
}

export function buildSessionIntentFromAdvice(
  advice: CoachMatchAdvice,
): WeeklyDecisionSessionIntent {
  return buildSessionIntentFromProblem(advice.tacticalReading, {
    objective: advice.mainAdjustment,
    successSignal:
      advice.successSignals[0] ||
      advice.saturdayFocus ||
      "Validar una mejor ejecucion del ajuste en el partido.",
    reviewCriteria:
      advice.saturdayFocus ||
      advice.wednesdayTest ||
      "Revisar si el ajuste aparece en el proximo partido.",
  });
}

export function buildThreadFromObservation(
  observation: ManualObservationLike,
  activeTeamId: string,
  current: WeeklyDecisionThread | null = null,
): WeeklyDecisionThread {
  const scopedCurrent = current?.teamId === activeTeamId ? current : null;
  const sessionIntent =
    scopedCurrent?.sessionIntent ?? buildSessionIntentFromProblem(observation.text);

  return {
    id: scopedCurrent?.id ?? makeWeeklyThreadId(),
    teamId: activeTeamId,
    problem: observation.text.trim(),
    origin: "manualObservation",
    evidenceIds: uniqueStrings([...(scopedCurrent?.evidenceIds ?? []), observation.id]),
    mode: "hypothesis",
    confidence: clampConfidence(scopedCurrent?.confidence ?? 0.38),
    sessionIntent,
    nextReviewCriteria: uniqueStrings([
      ...(scopedCurrent?.nextReviewCriteria ?? []),
      sessionIntent.reviewCriteria,
    ]).slice(0, 4),
    status:
      scopedCurrent?.status === "evolved"
        ? "open"
        : scopedCurrent?.status ?? "open",
    progress: "open",
    createdAt: scopedCurrent?.createdAt ?? observation.createdAt,
    updatedAt: observation.createdAt,
    lastReportId: scopedCurrent?.lastReportId,
  };
}

export function buildThreadFromCoachResponse(
  response: CoachResponse,
  prompt: string,
  activeTeamId: string,
  current: WeeklyDecisionThread | null = null,
): WeeklyDecisionThread | null {
  const scopedCurrent = current?.teamId === activeTeamId ? current : null;
  const baseProblem = prompt.trim() || scopedCurrent?.problem?.trim() || "";
  if (!baseProblem && response.mode === "question") return scopedCurrent;

  const now = new Date().toISOString();

  if (response.mode === "question") {
    const sessionIntent =
      scopedCurrent?.sessionIntent ?? buildSessionIntentFromProblem(baseProblem);
    return {
      id: scopedCurrent?.id ?? makeWeeklyThreadId(),
      teamId: activeTeamId,
      problem: scopedCurrent?.problem?.trim() || baseProblem,
      origin: "coach",
      evidenceIds: scopedCurrent?.evidenceIds ?? [],
      mode: "hypothesis",
      confidence: clampConfidence(response.confidenceCap),
      sessionIntent,
      nextReviewCriteria: uniqueStrings([
        ...(scopedCurrent?.nextReviewCriteria ?? []),
        sessionIntent.reviewCriteria,
      ]).slice(0, 4),
      status:
        scopedCurrent?.status === "evolved"
          ? "open"
          : scopedCurrent?.status ?? "open",
      progress: scopedCurrent?.progress ?? "open",
      createdAt: scopedCurrent?.createdAt ?? now,
      updatedAt: now,
      lastReportId: scopedCurrent?.lastReportId,
    };
  }

  const advice = response.advice;
  const sessionIntent = buildSessionIntentFromAdvice(advice);
  return {
    id: scopedCurrent?.id ?? makeWeeklyThreadId(),
    teamId: activeTeamId,
    problem: advice.tacticalReading.trim() || baseProblem,
    origin: "coach",
    evidenceIds: uniqueStrings([
      ...(scopedCurrent?.evidenceIds ?? []),
      ...advice.evidenceCitations.map((citation) => citation.sourceId),
    ]),
    mode: response.mode,
    confidence: clampConfidence(advice.reflection.confidence),
    sessionIntent,
    nextReviewCriteria: uniqueStrings([
      sessionIntent.reviewCriteria,
      advice.wednesdayTest,
      advice.saturdayFocus,
      ...advice.successSignals,
    ]).slice(0, 5),
    status:
      scopedCurrent?.status === "evolved"
        ? "open"
        : scopedCurrent?.status ?? "open",
    progress: scopedCurrent?.progress ?? "open",
    createdAt: scopedCurrent?.createdAt ?? now,
    updatedAt: now,
    lastReportId: scopedCurrent?.lastReportId,
  };
}

export function buildThreadFromPostMatchReport(
  report: WeeklyDecisionThreadReportInput,
  activeTeamId: string,
  current: WeeklyDecisionThread | null = null,
): WeeklyDecisionThread | null {
  const scopedCurrent = current?.teamId === activeTeamId ? current : null;
  const primaryProblem =
    report.report.ownTeamProblems[0]?.problem ||
    report.report.mainProblems[0]?.problem ||
    scopedCurrent?.problem ||
    "";
  if (!primaryProblem.trim()) return scopedCurrent;

  const primaryWednesdayTest = report.report.wednesdayTest[0];
  const primarySaturdayFocus = report.report.saturdayFocus[0];
  const primarySuccessSignal =
    primaryWednesdayTest?.successSignals[0] || primarySaturdayFocus;
  const reportEvidenceIds = [report.id, report.report.id].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  const sessionIntent = buildSessionIntentFromProblem(
    scopedCurrent?.problem?.trim() || primaryProblem,
    {
      objective:
        scopedCurrent?.sessionIntent?.objective ||
        primaryWednesdayTest?.hypothesis ||
        `Ajustar el comportamiento asociado a: ${primaryProblem}`,
      successSignal:
        primarySuccessSignal ||
        scopedCurrent?.sessionIntent?.successSignal ||
        "Confirmar si el ajuste aparece en el siguiente partido.",
      reviewCriteria:
        primaryWednesdayTest?.test ||
        primarySaturdayFocus ||
        scopedCurrent?.sessionIntent?.reviewCriteria ||
        `Comparar si ${normalizeProblemForSentence(primaryProblem)} reaparece en el siguiente partido.`,
    },
  );
  const now = new Date().toISOString();

  return {
    id: scopedCurrent?.id ?? makeWeeklyThreadId(),
    teamId: activeTeamId,
    problem: scopedCurrent?.problem?.trim() || primaryProblem.trim(),
    origin: "postMatch",
    evidenceIds: uniqueStrings([
      ...(scopedCurrent?.evidenceIds ?? []),
      ...reportEvidenceIds,
    ]),
    mode: scopedCurrent?.mode ?? "hypothesis",
    confidence: clampConfidence(report.report.reflection.confidence),
    sessionIntent,
    nextReviewCriteria: uniqueStrings([
      sessionIntent.reviewCriteria,
      ...report.report.saturdayFocus,
      ...report.report.wednesdayTest.flatMap((item) => [
        item.hypothesis,
        item.test,
        ...item.successSignals,
      ]),
    ]).slice(0, 5),
    status: "reviewed",
    progress: scopedCurrent?.progress ?? "open",
    createdAt: scopedCurrent?.createdAt ?? now,
    updatedAt: now,
    lastReportId: report.id ?? report.report.id,
  };
}

export function buildPendingPostMatchImport(
  observations: ManualObservationLike[],
  observationIds: string[],
  activeTeamId: string,
  threadId: string | null,
): PendingPostMatchImport | null {
  const scoped = observations.filter((observation) =>
    observation.teamId === activeTeamId && observationIds.includes(observation.id),
  );
  if (!scoped.length) return null;

  return {
    threadId,
    teamId: activeTeamId,
    source: "manualObservation",
    observationIds: scoped.map((observation) => observation.id),
    evidenceText: manualObservationsToEvidenceText(scoped),
  };
}

export function manualObservationsToEvidenceText(
  observations: ManualObservationLike[],
) {
  return observations
    .map((observation) =>
      [
        "Observacion manual",
        observation.text,
        `staff ${observation.source}`,
        "no confirmada por video",
      ].join(" | "),
    )
    .join("\n");
}

export function resolveWeeklyDecisionThreadProgress(
  thread: WeeklyDecisionThread | null,
  patterns: TeamPattern[],
): WeeklyDecisionThreadProgress | null {
  if (!thread) return null;

  const match = findBestPatternMatch(thread.problem, patterns);
  if (!match) {
    return thread.status === "reviewed" ? "evolved" : "open";
  }

  const mapping: Record<TeamPatternKind, WeeklyDecisionThreadProgress> = {
    repeatedProblem: "recurring",
    regression: "returned",
    improvement: "improved",
    newProblem: "open",
    problemNotTrained: "open",
    gameModelContradiction: "open",
  };

  return mapping[match.kind] ?? "open";
}

export function evolveThreadStatus(
  thread: WeeklyDecisionThread,
  progress: WeeklyDecisionThreadProgress | null,
  reportId?: string,
): WeeklyDecisionThread {
  if (!progress) return thread;

  const nextStatus =
    progress === "evolved" || progress === "improved"
      ? "evolved"
      : thread.status === "open" && progress !== "open"
        ? "reviewed"
        : thread.status;

  const nextReportId = reportId ?? thread.lastReportId;
  const unchanged =
    nextStatus === thread.status &&
    progress === thread.progress &&
    nextReportId === thread.lastReportId;
  if (unchanged) return thread;

  return {
    ...thread,
    progress,
    status: nextStatus,
    lastReportId: nextReportId,
    updatedAt: new Date().toISOString(),
  };
}

function findBestPatternMatch(problem: string, patterns: TeamPattern[]) {
  const normalizedProblem = normalizeText(problem);
  let winner: TeamPattern | null = null;
  let winnerScore = 0;

  for (const pattern of patterns) {
    const score = Math.max(
      similarity(normalizedProblem, normalizeText(pattern.statement)),
      ...pattern.evidence.map((evidence) =>
        similarity(normalizedProblem, normalizeText(evidence)),
      ),
    );
    if (score > winnerScore) {
      winner = pattern;
      winnerScore = score;
    }
  }

  return winnerScore >= 0.22 ? winner : null;
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  return overlap.length / Math.max(leftTokens.size, rightTokens.size, 1);
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProblemForSentence(problem: string) {
  return problem.trim().replace(/\.$/, "").toLowerCase();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function makeWeeklyThreadId() {
  return `weekly-thread-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}
