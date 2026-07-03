import { describe, expect, it } from "vitest";
import {
  catalog,
  generatedLibraryExerciseIds,
} from "../src/data/exercises/catalog";
import {
  resolveRetiredReplacement,
  retiredExerciseIds,
} from "../src/data/exercises/retiredExercises";
import { validateExercise } from "../src/data/exercises/validateExercise";
import {
  criticalExerciseIds,
  getSelectableCatalog,
} from "../src/data/exercises/validatedCatalog";
import type { Exercise } from "../src/data/schemas";

function byId(id: string): Exercise {
  const exercise = catalog.find((item) => item.id === id);
  if (!exercise) throw new Error(`exercise no encontrado en catalogo: ${id}`);
  return exercise;
}

function clone(exercise: Exercise): Exercise {
  return structuredClone(exercise);
}

describe("validateExercise", () => {
  it("el ejercicio correcto de presion al arquero pasa", () => {
    const result = validateExercise(byId("pressing-portero-recibe"));
    expect(result.critical).toBe(false);
    expect(result.errors).toHaveLength(0);
    expect(result.tags).not.toContain("missing-gk");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("un ejercicio de presion al arquero sin arquero es critico (missing-gk)", () => {
    // Antes cubierto por el generado roto "presion-arquero-pase-atras" (retirado
    // del catalogo en Ola 4). Se sintetiza a partir de un curado de pressing al
    // que se le quita el arquero: el validador debe marcarlo critico igual.
    const broken = clone(byId("pressing-portero-recibe"));
    broken.scene.actors = broken.scene.actors.filter(
      (actor) => !/gk|arq|portero/i.test(actor.role),
    );
    const result = validateExercise(broken);
    expect(result.critical).toBe(true);
    expect(result.tags).toContain("missing-gk");
    expect(result.errors.some((issue) => issue.tag === "missing-gk")).toBe(
      true,
    );
  });

  it("audita el catalogo completo sin crashear y con scores validos", () => {
    expect(() =>
      catalog.map((exercise) => validateExercise(exercise)),
    ).not.toThrow();
    for (const exercise of catalog) {
      const result = validateExercise(exercise);
      expect(result.exerciseId).toBe(exercise.id);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.critical).toBe(result.errors.length > 0);
    }
  });

  it("es deterministica: misma entrada, misma salida", () => {
    const exercise = byId("pressing-portero-recibe");
    expect(validateExercise(exercise)).toEqual(validateExercise(exercise));
  });

  it("detecta referencias rotas en overlays", () => {
    const broken = clone(byId("pressing-portero-recibe"));
    broken.scene.overlays[0] = {
      ...broken.scene.overlays[0],
      from: "actor-inexistente",
    };
    const result = validateExercise(broken);
    expect(result.critical).toBe(true);
    expect(result.tags).toContain("broken-ref");
  });

  it("detecta trigger que apunta a un actor inexistente", () => {
    const broken = clone(byId("pressing-portero-recibe"));
    broken.scene.triggers[0] = {
      ...broken.scene.triggers[0],
      cause: { ...broken.scene.triggers[0].cause, actorId: "fantasma" },
    };
    const result = validateExercise(broken);
    expect(result.errors.some((issue) => issue.tag === "broken-ref")).toBe(
      true,
    );
  });

  it("marca warning cuando falta metadata minima (coaching)", () => {
    const thin = clone(byId("pressing-portero-recibe"));
    thin.coaching = [];
    const result = validateExercise(thin);
    expect(
      result.warnings.some((issue) => issue.tag === "missing-metadata"),
    ).toBe(true);
  });

  it("marca error cuando falta el objetivo primario", () => {
    const thin = clone(byId("pressing-portero-recibe"));
    thin.objective = { ...thin.objective, primary: "" };
    const result = validateExercise(thin);
    expect(result.critical).toBe(true);
    expect(
      result.errors.some((issue) => issue.tag === "missing-metadata"),
    ).toBe(true);
  });
});

describe("exercise selection gate", () => {
  it("ejercicio roto retirado (Ola 4): fuera del catalogo, con tombstone al curado", () => {
    // "presion-arquero-pase-atras" era el generado roto (presion al arquero sin
    // arquero). En Ola 4 se retiro del catalogo por completo; su tombstone redirige
    // al curado equivalente, que sigue siendo seleccionable.
    expect(catalog.some((e) => e.id === "presion-arquero-pase-atras")).toBe(
      false,
    );
    expect(criticalExerciseIds.has("presion-arquero-pase-atras")).toBe(false);
    expect(retiredExerciseIds.has("presion-arquero-pase-atras")).toBe(true);
    expect(resolveRetiredReplacement("presion-arquero-pase-atras")).toBe(
      "pressing-portero-recibe",
    );
    const selectableIds = new Set(getSelectableCatalog().map((e) => e.id));
    expect(selectableIds.has("presion-arquero-pase-atras")).toBe(false);
    expect(selectableIds.has("pressing-portero-recibe")).toBe(true);
  });

  it("ningun ejercicio con error critico es seleccionable (Quick Start protegido)", () => {
    const selectable = getSelectableCatalog();
    for (const exercise of selectable) {
      expect(validateExercise(exercise).critical).toBe(false);
    }
    // Contrato del pool (FIX 1): queda exactamente catalogo - (criticos U
    // generados), ni mas ni menos. Chequeo bidireccional por id en vez de
    // aritmetica de tamanos: el catalogo tiene un id duplicado preexistente
    // ("defensa-centro-lateral" aparece dos veces en compactCuratedSpecs),
    // asi que |catalogo| - |ids excluidos| no cuadra con el conteo de entradas.
    const excluded = new Set([
      ...criticalExerciseIds,
      ...generatedLibraryExerciseIds,
    ]);
    const selectableIds = new Set(selectable.map((exercise) => exercise.id));
    for (const exercise of catalog) {
      expect(selectableIds.has(exercise.id)).toBe(!excluded.has(exercise.id));
    }
  });
});
