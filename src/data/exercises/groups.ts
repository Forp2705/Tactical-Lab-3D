import type { Exercise } from "../schemas";
import { catalog } from "./catalog";

export const exercisesByPhase = groupExercises(
  catalog,
  (exercise) => exercise.phase,
);

export const attackExercises = [
  ...exercisesByPhase.attackOrg,
  ...exercisesByPhase.transOff,
  ...exercisesByPhase.abpOff,
];

export const defenseExercises = [
  ...exercisesByPhase.defenseOrg,
  ...exercisesByPhase.transDef,
  ...exercisesByPhase.abpDef,
];

export const rondoExercises = catalog.filter((exercise) =>
  exercise.title.toLowerCase().includes("rondo"),
);

export const abpExercises = [
  ...exercisesByPhase.abpOff,
  ...exercisesByPhase.abpDef,
];

function groupExercises<T extends string>(
  exercises: Exercise[],
  readKey: (exercise: Exercise) => T,
): Record<T, Exercise[]> {
  const groups = {} as Record<T, Exercise[]>;
  for (const exercise of exercises) {
    const key = readKey(exercise);
    groups[key] ??= [];
    groups[key].push(exercise);
  }
  return groups;
}
