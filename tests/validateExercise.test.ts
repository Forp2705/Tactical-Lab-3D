import { describe, expect, it } from "vitest";
import { catalog } from "../src/data/exercises/catalog";
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

  it("el ejercicio roto de presion al arquero falla por falta de arquero", () => {
    const result = validateExercise(byId("presion-arquero-pase-atras"));
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
    const exercise = byId("presion-arquero-pase-atras");
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
  it("cuarentena el ejercicio roto: queda fuera de los candidatos", () => {
    expect(criticalExerciseIds.has("presion-arquero-pase-atras")).toBe(true);
    const selectableIds = new Set(getSelectableCatalog().map((e) => e.id));
    expect(selectableIds.has("presion-arquero-pase-atras")).toBe(false);
    expect(selectableIds.has("pressing-portero-recibe")).toBe(true);
  });

  it("ningun ejercicio con error critico es seleccionable (Quick Start protegido)", () => {
    const selectable = getSelectableCatalog();
    for (const exercise of selectable) {
      expect(validateExercise(exercise).critical).toBe(false);
    }
    expect(selectable.length).toBe(catalog.length - criticalExerciseIds.size);
  });
});
