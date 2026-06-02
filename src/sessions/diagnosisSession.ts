import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import { inferDomainsFromText, matchExercisesForDiagnosis } from "@/ai/exerciseMatching";
import type { Exercise, Session } from "@/data";

export type DiagnosisSessionPlan = {
  title: string;
  tacticalObjective: string;
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
    tacticalObjective: advice.mainAdjustment,
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
        notes: [
          `Objetivo: ${plan.tacticalObjective}`,
          `Coaching: ${exercise.coaching.slice(0, 2).join("; ")}`,
          `Errores: ${exercise.errors.slice(0, 2).join("; ")}`,
        ].join("\n"),
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

function shortTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 42) || "plan tactico";
}

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}
