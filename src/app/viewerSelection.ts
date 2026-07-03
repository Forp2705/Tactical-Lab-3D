import { type Exercise, catalog } from "@/data";

// Resuelve que ejercicio mostrar el visor a partir del id seleccionado (que
// puede venir de un snapshot persistido con un id ya retirado del catalog).
// A diferencia de getExerciseById (useAppStore.ts), no oculta el fallback:
// expone `missing` para que el visor pueda avisar en vez de abrir otro
// ejercicio en silencio.
export function resolveViewerSelection(
  selectedExerciseId: string,
  viewerExerciseOverride: Exercise | null,
  exercises: Exercise[],
): { exercise: Exercise; missing: boolean } {
  if (viewerExerciseOverride) {
    return { exercise: viewerExerciseOverride, missing: false };
  }
  const resolved = exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  return { exercise: resolved ?? catalog[0], missing: !resolved };
}
