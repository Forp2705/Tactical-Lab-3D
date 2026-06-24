import type { Exercise } from "../schemas.js";
import { catalog, generatedLibraryExerciseIds } from "./catalog.js";
import {
  type ExerciseDomain,
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

export type CatalogAuditEntry = {
  exerciseId: string;
  title: string;
  phase: Exercise["phase"];
  generated: boolean;
  score: number;
  critical: boolean;
  domains: ExerciseDomain[];
  tags: ExerciseValidation["tags"];
};

export type CatalogAudit = {
  total: number;
  criticalCount: number;
  averageScore: number;
  byTag: Record<string, number>;
  entries: CatalogAuditEntry[];
  worst: CatalogAuditEntry[];
};

// Reporte de calidad deterministico del catalogo. Ordena por score ascendente
// (peores primero) para alimentar el "top-N a corregir". Sin LLM, sin fecha.
export function auditCatalog(
  exercises: Exercise[] = catalog,
  worstLimit = 5,
): CatalogAudit {
  const entries: CatalogAuditEntry[] = exercises
    .map((exercise) => {
      const validation =
        exerciseValidations.get(exercise.id) ?? validateExercise(exercise);
      return {
        exerciseId: exercise.id,
        title: exercise.title,
        phase: exercise.phase,
        generated: generatedLibraryExerciseIds.has(exercise.id),
        score: validation.score,
        critical: validation.critical,
        domains: validation.domains,
        tags: validation.tags,
      };
    })
    .sort(
      (a, b) => a.score - b.score || a.exerciseId.localeCompare(b.exerciseId),
    );

  const byTag: Record<string, number> = {};
  for (const entry of entries) {
    for (const tag of entry.tags) byTag[tag] = (byTag[tag] ?? 0) + 1;
  }

  const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
  const averageScore = entries.length
    ? Math.round(totalScore / entries.length)
    : 100;

  return {
    total: entries.length,
    criticalCount: entries.filter((entry) => entry.critical).length,
    averageScore,
    byTag,
    entries,
    worst: entries.filter((entry) => entry.score < 100).slice(0, worstLimit),
  };
}
