export { catalog, generatedLibraryExerciseIds } from "./exercises/catalog.js";
export {
  isRetiredExercise,
  resolveRetiredReplacement,
  retiredExerciseIds,
} from "./exercises/retiredExercises.js";
export {
  type ExerciseDomain,
  type ExerciseValidation,
  type ValidationIssue,
  type ValidationSeverity,
  type ValidationTag,
  validateExercise,
} from "./exercises/validateExercise.js";
export {
  type CatalogAudit,
  type CatalogAuditEntry,
  auditCatalog,
  criticalExerciseIds,
  exerciseValidations,
  getSelectableCatalog,
  isSelectableExercise,
} from "./exercises/validatedCatalog.js";
export {
  abpExercises,
  attackExercises,
  defenseExercises,
  exercisesByPhase,
  rondoExercises,
} from "./exercises/groups.js";
export { demoPlayers } from "./players.js";
export { formatPlayerRange } from "./formatPlayers.js";
export * from "./schemas.js";
