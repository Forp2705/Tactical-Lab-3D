import type { Exercise } from "../schemas.js";
import { catalog } from "./catalog.js";
import {
  type ExerciseValidation,
  validateExercise,
} from "./validateExercise.js";

// Auditoria deterministica del catalogo, evaluada una vez al cargar el modulo.
// Quick Start / diagnostico deben construir sesiones a partir de
// `getSelectableCatalog()` para no elegir ejercicios con errores criticos
// (ej: "presion al arquero" sin arquero). No alcanza con ocultarlos en la
// Biblioteca: hay que sacarlos tambien de los motores que arman sesiones.

export const exerciseValidations: ReadonlyMap<string, ExerciseValidation> =
  new Map(catalog.map((exercise) => [exercise.id, validateExercise(exercise)]));

export const criticalExerciseIds: ReadonlySet<string> = new Set(
  [...exerciseValidations.values()]
    .filter((validation) => validation.critical)
    .map((validation) => validation.exerciseId),
);

export function getSelectableCatalog(): Exercise[] {
  return catalog.filter((exercise) => !criticalExerciseIds.has(exercise.id));
}

export function isSelectableExercise(exerciseId: string): boolean {
  return !criticalExerciseIds.has(exerciseId);
}
