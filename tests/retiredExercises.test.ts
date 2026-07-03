import { describe, expect, it } from "vitest";
import type { SessionBlock } from "../src/data";
import { catalog } from "../src/data/exercises/catalog";
import {
  resolveRetiredReplacement,
  retiredExerciseIds,
} from "../src/data/exercises/retiredExercises";
import { getSelectableCatalog } from "../src/data/exercises/validatedCatalog";
import { recomputeFallback } from "../src/sessions/SessionsView";

/**
 * Ola 4 (mc-22): los 10 ejercicios generados marcados DELETE se retiraron del
 * catalogo. Cada uno deja un tombstone (id retirado -> curado de reemplazo) que
 * el guard de render usa para no romper sesiones guardadas que los referencien.
 */
describe("retiredExerciseIds — tombstones de los 10 generados retirados", () => {
  const catalogIds = new Set(catalog.map((e) => e.id));
  const selectableIds = new Set(getSelectableCatalog().map((e) => e.id));

  it("son exactamente 10 tombstones", () => {
    expect(retiredExerciseIds.size).toBe(10);
  });

  it("cada id retirado ya NO existe en el catalogo", () => {
    for (const id of retiredExerciseIds.keys()) {
      expect(catalogIds.has(id)).toBe(false);
    }
  });

  it("cada reemplazo existe en el catalogo y es seleccionable (no critico, no generado)", () => {
    for (const replacementId of retiredExerciseIds.values()) {
      expect(catalogIds.has(replacementId)).toBe(true);
      expect(selectableIds.has(replacementId)).toBe(true);
    }
  });

  it("resolveRetiredReplacement mapea id retirado -> curado; undefined para uno vigente", () => {
    expect(resolveRetiredReplacement("presion-arquero-pase-atras")).toBe(
      "pressing-portero-recibe",
    );
    expect(resolveRetiredReplacement("pressing-portero-recibe")).toBeUndefined();
  });
});

/**
 * Regla del brief W4 item 7: una sesion guardada con un id borrado NO debe
 * romper. El tombstone/guard lo cubre; este test lo demuestra sobre la logica
 * de resumen de sesion (misma que alimenta duracion/carga del planner).
 */
describe("persistencia: sesion guardada con id retirado no rompe", () => {
  const retiredId = [...retiredExerciseIds.keys()][0];

  it("recomputeFallback saltea el bloque retirado sin crashear (sin carga fantasma)", () => {
    const block: SessionBlock = {
      id: "block-retired-1",
      exerciseId: retiredId,
      durationMin: 15,
      swappable: true,
    };
    expect(() => recomputeFallback([block], [])).not.toThrow();
    const result = recomputeFallback([block], []);
    expect(result.totalDuration).toBe(0);
    expect(result.totalLoad).toBe(0);
  });

  it("al reemplazar por el tombstone, el bloque vuelve a computar carga real", () => {
    const replacementId = resolveRetiredReplacement(retiredId);
    expect(replacementId).toBeTruthy();
    const replacement = catalog.find((e) => e.id === replacementId);
    expect(replacement).toBeTruthy();

    const block: SessionBlock = {
      id: "block-retired-2",
      exerciseId: replacementId as string,
      durationMin: 15,
      swappable: true,
    };
    const result = recomputeFallback([block], []);
    expect(result.totalDuration).toBe(15);
    expect(result.totalLoad).toBe(15 * (replacement?.rpe ?? 0));
  });
});
