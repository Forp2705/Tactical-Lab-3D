// Tombstones de ejercicios retirados del catalogo (Ola 4).
//
// En W2/W3 se auditaron los 20 ejercicios generados por plantilla (escena
// estampada que contradice el titulo). 3 se re-autoraron a curados (conservando
// id) y 10 se marcaron DELETE porque su valor ya existe en un curado equivalente
// o son redundantes internos (ver docs/plans/w3-content-gk-audit-plan.md tabla T2).
//
// Al borrar esos 10 del catalogo, una sesion GUARDADA que referencie una de esas
// ids deja de resolver. El guard de render (SessionBlockCard) muestra un estado
// "Ejercicio retirado" y usa este mapa para ofrecer el reemplazo curado en 1 click.
// Los motores/Biblioteca nunca ven estas ids: ya no estan en el catalogo.
//
// INVARIANTE (verificado por tests/retiredExercises.test.ts):
//   - cada KEY ya NO existe en `catalog`;
//   - cada VALUE SI existe en `catalog` y es seleccionable (no critico, no generado).

export const retiredExerciseIds: ReadonlyMap<string, string> = new Map([
  // id retirado                      -> curado de reemplazo
  ["presion-arquero-pase-atras", "pressing-portero-recibe"],
  ["posesion-6v3-hombre-libre", "posesion-6v3-pivote"],
  ["salida-3-1-pivote-sombra", "salida-3-1"],
  ["salida-vs-doble-punta", "salida-3-1"],
  ["contraataque-carril-central", "contraataque-4v3"],
  ["rondo-5v2-pared-interior", "rondo-4v2-dos-zonas"],
  ["bloque-medio-trampa-pivote", "bloque-medio-basculacion"],
  ["abp-corner-corto-tercer-hombre", "abp-corner-corto"],
  ["finalizacion-centro-raso", "banda-centro-atras"],
  ["tercer-hombre-banda-derecha", "salida-lateral-tercer-hombre"],
]);

// True si el id fue retirado del catalogo (tiene tombstone).
export function isRetiredExercise(exerciseId: string): boolean {
  return retiredExerciseIds.has(exerciseId);
}

// Id del curado de reemplazo para un id retirado, o undefined si no hay tombstone.
export function resolveRetiredReplacement(
  exerciseId: string,
): string | undefined {
  return retiredExerciseIds.get(exerciseId);
}
