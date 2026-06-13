import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import { inferDomainsFromText, matchExercisesForDiagnosis } from "@/ai/exerciseMatching";
import type { Exercise, Session } from "@/data";
import type { WeeklyDecisionThread } from "@/state/weeklyDecisionThread";

export type DiagnosisSessionPlan = {
  title: string;
  problemStatement: string;
  tacticalObjective: string;
  reviewFocus: string;
  exerciseIds: string[];
  estimatedDuration: number;
  estimatedLoad: number;
  coachingPoints: string[];
  errorsToCorrect: string[];
  saturdaySignals: string[];
  staffNotes: string;
};

export function buildSessionPlanFromDiagnosis(
  advice: CoachMatchAdvice,
  exercises: Exercise[],
): DiagnosisSessionPlan {
  const text = [
    advice.tacticalReading,
    advice.probableCause,
    advice.mainAdjustment,
    advice.wednesdayTest,
    advice.saturdayFocus,
    ...advice.onFieldInstructions,
    ...advice.adjustmentRisks,
    ...advice.successSignals,
  ].join(" ");
  const linked = advice.linkedExercises.filter((id) =>
    exercises.some((exercise) => exercise.id === id),
  );
  const matched = matchExercisesForDiagnosis({
    domains: inferDomainsFromText(text),
    query: text,
    exercises,
    limit: 4,
  }).map((match) => match.exercise.id);
  const exerciseIds = [...new Set([...linked, ...matched])].slice(0, 4);
  const selected = exerciseIds.flatMap((id) => {
    const exercise = exercises.find((item) => item.id === id);
    return exercise ? [exercise] : [];
  });
  const estimatedDuration = selected.reduce(
    (sum, exercise) => sum + exercise.duration,
    0,
  );
  const estimatedLoad = selected.reduce(
    (sum, exercise) => sum + exercise.duration * exercise.rpe,
    0,
  );

  return {
    title: `Sesion desde diagnostico - ${shortTitle(advice.mainAdjustment)}`,
    problemStatement: advice.tacticalReading,
    tacticalObjective: advice.mainAdjustment,
    reviewFocus: advice.saturdayFocus,
    exerciseIds,
    estimatedDuration,
    estimatedLoad,
    coachingPoints: unique([
      ...advice.onFieldInstructions,
      ...selected.flatMap((exercise) => exercise.coaching.slice(0, 2)),
    ]).slice(0, 8),
    errorsToCorrect: unique([
      ...advice.adjustmentRisks,
      ...selected.flatMap((exercise) => exercise.errors.slice(0, 2)),
    ]).slice(0, 8),
    saturdaySignals: unique([
      advice.saturdayFocus,
      ...advice.successSignals,
      ...selected.map((exercise) => exercise.success),
    ]).slice(0, 6),
    staffNotes: [
      `Objetivo tactico: ${advice.mainAdjustment}`,
      `Causa probable: ${advice.probableCause}`,
      `Test de miercoles: ${advice.wednesdayTest}`,
      `Senales del sabado: ${advice.successSignals.join("; ")}`,
    ].join("\n"),
  };
}

export function buildSessionPlanFromWeeklyThread(
  thread: WeeklyDecisionThread,
  exercises: Exercise[],
): DiagnosisSessionPlan {
  const intent = thread.sessionIntent;
  const text = [
    thread.problem,
    intent?.objective ?? "",
    ...(thread.nextReviewCriteria ?? []),
  ].join(" ");
  const matchedIds = matchExercisesForDiagnosis({
    domains: inferDomainsFromText(text),
    query: text,
    exercises,
    limit: 8,
  }).map((match) => match.exercise.id);
  const exerciseIds = buildWeeklyThreadExerciseIds(matchedIds, exercises);
  const selected = exerciseIds.flatMap((id) => {
    const exercise = exercises.find((item) => item.id === id);
    return exercise ? [exercise] : [];
  });
  const estimatedDuration = selected.reduce(
    (sum, exercise) => sum + exercise.duration,
    0,
  );
  const estimatedLoad = selected.reduce(
    (sum, exercise) => sum + exercise.duration * exercise.rpe,
    0,
  );
  const successSignal =
    intent?.successSignal ||
    thread.nextReviewCriteria[0] ||
    "Validar una mejor ejecucion del ajuste.";
  const reviewFocus =
    intent?.reviewCriteria ||
    thread.nextReviewCriteria[0] ||
    "Revisar si el problema mejora en el proximo partido.";

  return {
    title: `Sesion semanal - ${shortTitle(thread.problem)}`,
    problemStatement: thread.problem,
    tacticalObjective:
      intent?.objective || `Ajustar el comportamiento asociado a: ${thread.problem}`,
    reviewFocus,
    exerciseIds,
    estimatedDuration,
    estimatedLoad,
    coachingPoints: unique([
      intent?.objective ?? "",
      ...selected.flatMap((exercise) => exercise.coaching.slice(0, 2)),
    ]).slice(0, 8),
    errorsToCorrect: unique([
      ...selected.flatMap((exercise) => exercise.errors.slice(0, 2)),
    ]).slice(0, 8),
    saturdaySignals: unique([
      successSignal,
      reviewFocus,
      ...selected.map((exercise) => exercise.success),
    ]).slice(0, 6),
    staffNotes: [
      `Problema semanal: ${thread.problem}`,
      `Objetivo tactico: ${intent?.objective || `Ajustar el comportamiento asociado a: ${thread.problem}`}`,
      `Senales del sabado: ${successSignal}`,
      `Test de miercoles: ${reviewFocus}`,
    ].join("\n"),
  };
}

export function materializeDiagnosisSession(
  current: Session,
  plan: DiagnosisSessionPlan,
  exercises: Exercise[],
): Session {
  const blocks = plan.exerciseIds.flatMap((exerciseId) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return [];
    return [
      {
        id: makeId("diag-block"),
        exerciseId,
        durationMin: exercise.duration,
        swappable: true,
        notes: formatDiagnosisBlockNotes({
          problem: plan.problemStatement,
          objective: plan.tacticalObjective,
          successSignal: exercise.success || plan.saturdaySignals[0] || "Validar una mejor ejecucion del ajuste.",
          nextMatchReview: plan.reviewFocus,
          coaching: exercise.coaching.slice(0, 2).join("; "),
          errors: exercise.errors.slice(0, 2).join("; "),
        }),
      },
    ];
  });

  return {
    ...current,
    name: plan.title,
    blocks,
    staffNotes: plan.staffNotes,
    computed: recomputeSession(blocks, exercises),
  };
}

function recomputeSession(
  blocks: Session["blocks"],
  exercises: Exercise[],
): NonNullable<Session["computed"]> {
  const materials = new Map<string, { name: string; qty: number; unit: string }>();
  const primaryObjectives = new Set<string>();
  let totalDuration = 0;
  let totalLoad = 0;

  for (const block of blocks) {
    const exercise = exercises.find((item) => item.id === block.exerciseId);
    if (!exercise) continue;
    totalDuration += block.durationMin;
    totalLoad += block.durationMin * exercise.rpe;
    primaryObjectives.add(exercise.objective.primary);
    for (const material of exercise.material) {
      const current = materials.get(material.name);
      if (!current) materials.set(material.name, { ...material });
      else current.qty += material.qty;
    }
  }

  return {
    totalDuration,
    totalLoad,
    materials: [...materials.values()],
    primaryObjectives: [...primaryObjectives],
  };
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function buildWeeklyThreadExerciseIds(
  matchedIds: string[],
  exercises: Exercise[],
) {
  const matched = matchedIds
    .map((id) => exercises.find((exercise) => exercise.id === id) ?? null)
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const used = new Set<string>();
  const picked: string[] = [];

  const warmUp =
    pickExercise(
      matched,
      (exercise) =>
        exercise.intensity !== "veryHigh" &&
        (exercise.title.toLowerCase().includes("activacion") ||
          exercise.title.toLowerCase().includes("rondo") ||
          exercise.players.max <= 10),
      used,
    ) ??
    pickExercise(
      exercises,
      (exercise) =>
        exercise.phase === "attackOrg" &&
        exercise.intensity !== "veryHigh" &&
        (exercise.title.toLowerCase().includes("activacion") ||
          exercise.title.toLowerCase().includes("rondo")),
      used,
    );
  if (warmUp) {
    used.add(warmUp.id);
    picked.push(warmUp.id);
  }

  const main =
    pickExercise(matched, () => true, used) ??
    pickExercise(exercises, (exercise) => exercise.phase === "attackOrg", used);
  if (main) {
    used.add(main.id);
    picked.push(main.id);
  }

  const conditioned =
    pickExercise(
      matched,
      (exercise) =>
        exercise.intensity === "high" ||
        exercise.intensity === "veryHigh" ||
        exercise.phase === "transOff" ||
        exercise.phase === "transDef" ||
        exercise.phase === "defenseOrg",
      used,
    ) ??
    pickExercise(
      exercises,
      (exercise) =>
        exercise.phase === "transOff" ||
        exercise.phase === "transDef" ||
        exercise.phase === "defenseOrg",
      used,
    );
  if (conditioned) {
    used.add(conditioned.id);
    picked.push(conditioned.id);
  }

  const review =
    pickExercise(
      matched,
      (exercise) =>
        exercise.duration <= 16 ||
        exercise.title.toLowerCase().includes("posesion") ||
        exercise.title.toLowerCase().includes("rondo"),
      used,
    ) ??
    pickExercise(
      exercises,
      (exercise) =>
        exercise.phase === "attackOrg" && exercise.duration <= 16,
      used,
    );
  if (review) {
    used.add(review.id);
    picked.push(review.id);
  }

  return picked.slice(0, 4);
}

function shortTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 42) || "plan tactico";
}

function pickExercise(
  exercises: Exercise[],
  predicate: (exercise: Exercise) => boolean,
  used: Set<string>,
) {
  return exercises.find(
    (exercise) => !used.has(exercise.id) && predicate(exercise),
  );
}

function formatDiagnosisBlockNotes({
  problem,
  objective,
  successSignal,
  nextMatchReview,
  coaching,
  errors,
}: {
  problem: string;
  objective: string;
  successSignal: string;
  nextMatchReview: string;
  coaching: string;
  errors: string;
}) {
  return [
    `Problema: ${problem}`,
    `Objetivo: ${objective}`,
    `Senal de exito: ${successSignal}`,
    `Revision proximo partido: ${nextMatchReview}`,
    coaching ? `Coaching: ${coaching}` : "",
    errors ? `Errores: ${errors}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}
