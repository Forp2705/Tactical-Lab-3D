import { describe, expect, it } from "vitest";
import type { Exercise } from "../src/data";
import { catalog } from "../src/data/exercises/catalog";
import { retiredExerciseIds } from "../src/data/exercises/retiredExercises";
import { resolveViewerSelection } from "../src/app/viewerSelection";

/**
 * W4 (mc-19): valida el camino 2 del brief de persistencia — un
 * `selectedExerciseId` de snapshot que referencia un id ya retirado del
 * catalog. Antes del fix, `getExerciseById` (useAppStore.ts) resolvia esto
 * a `catalog[0]` sin ninguna senal (el gate mc-10 lo marco como sospecha
 * concreta). `resolveViewerSelection` es la logica que reemplaza ese
 * call-site en `ViewerWorkspace` (App.tsx) y expone `missing` para que el
 * visor pueda avisar en vez de sustituir en silencio.
 */
describe("resolveViewerSelection — id retirado en selectedExerciseId", () => {
  const retiredId = [...retiredExerciseIds.keys()][0];
  const exercises: Exercise[] = catalog;

  it("id vigente resuelve normal, sin marcar missing", () => {
    const vigenteId = catalog[1].id;
    const result = resolveViewerSelection(vigenteId, null, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(vigenteId);
  });

  it("id retirado no crashea, cae a catalog[0] y marca missing:true", () => {
    expect(() =>
      resolveViewerSelection(retiredId, null, exercises),
    ).not.toThrow();
    const result = resolveViewerSelection(retiredId, null, exercises);
    expect(result.missing).toBe(true);
    expect(result.exercise.id).toBe(catalog[0].id);
  });

  it("id retirado con variante local homonima resuelve la variante, no missing", () => {
    const variant: Exercise = {
      ...catalog[0],
      id: `${retiredId}__variant__123`,
    };
    const result = resolveViewerSelection(variant.id, null, [
      ...catalog,
      variant,
    ]);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(variant.id);
  });

  it("viewerExerciseOverride activo gana siempre, sin importar el id seleccionado", () => {
    const override: Exercise = catalog[2];
    const result = resolveViewerSelection(retiredId, override, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(override.id);
  });
});
