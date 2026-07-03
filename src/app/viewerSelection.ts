import { type Exercise, catalog } from "@/data";

// Resuelve un id de ejercicio contra una lista de ejercicios disponibles (que
// puede venir de un snapshot persistido con un id ya retirado del catalog).
// A diferencia de getExerciseById (useAppStore.ts), no oculta el fallback:
// expone `missing` para que quien llama pueda avisar en vez de mostrar/operar
// sobre otro ejercicio en silencio. Reusado por resolveViewerSelection (visor)
// y por HomeView/AppShell/LibraryView (W5) para el mismo patron fuera del
// visor.
export function resolveExerciseSelection(
  selectedExerciseId: string,
  exercises: Exercise[],
): { exercise: Exercise; missing: boolean } {
  const resolved = exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  return { exercise: resolved ?? catalog[0], missing: !resolved };
}

// Igual que resolveExerciseSelection, pero para el visor: un
// viewerExerciseOverride activo (shape del LineupLab inyectada al visor)
// siempre gana y nunca cuenta como "missing".
export function resolveViewerSelection(
  selectedExerciseId: string,
  viewerExerciseOverride: Exercise | null,
  exercises: Exercise[],
): { exercise: Exercise; missing: boolean } {
  if (viewerExerciseOverride) {
    return { exercise: viewerExerciseOverride, missing: false };
  }
  return resolveExerciseSelection(selectedExerciseId, exercises);
}
