import { describe, expect, it } from "vitest";
import { generatedLibraryExerciseIds } from "../src/data/exercises/catalog";
import {
  criticalExerciseIds,
  getSelectableCatalog,
  isSelectableExercise,
} from "../src/data/exercises/validatedCatalog";
import { buildSessionPlanFromProblemTemplate } from "../src/sessions/diagnosisSession";
import { PROBLEM_TEMPLATES } from "../src/sessions/problemTemplates";

// FIX 1 (Ola 1): Quick Start honesto. Los generados por plantilla tienen una
// escena estampada que contradice su titulo; la Biblioteca ya los oculta y
// este pool debe hacer lo mismo para que los motores de sesion/diagnostico
// nunca los elijan. `tests/problemTemplates.test.ts` cubre "sesion no vacia +
// sin criticos"; este archivo fija ademas la exclusion de generados y la
// semantica de referencia de `isSelectableExercise`.

describe("getSelectableCatalog (pool honesto)", () => {
  it("no contiene generados ni criticos y no queda vacio", () => {
    const pool = getSelectableCatalog();
    for (const exercise of pool) {
      expect(generatedLibraryExerciseIds.has(exercise.id)).toBe(false);
      expect(criticalExerciseIds.has(exercise.id)).toBe(false);
    }
    // Colchon anti-drift: hoy son 15 curados a mano; si el catalogo curado se
    // recorta por debajo de 10, los templates pierden cobertura real.
    expect(pool.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Quick Start: cada template arma plan solo con curados", () => {
  // Enmienda del gate mc-99: HomeView ignora el boolean de retorno del store
  // (silent no-op si el plan sale vacio), asi que esta es la red real contra
  // drift futuro del catalogo.
  it.each(PROBLEM_TEMPLATES)(
    "'$id' produce exerciseIds no vacios y sin generados/criticos",
    (template) => {
      const plan = buildSessionPlanFromProblemTemplate(
        template,
        getSelectableCatalog(),
      );
      expect(plan.exerciseIds.length).toBeGreaterThan(0);
      for (const id of plan.exerciseIds) {
        expect(generatedLibraryExerciseIds.has(id)).toBe(false);
        expect(criticalExerciseIds.has(id)).toBe(false);
      }
    },
  );
});

describe("isSelectableExercise (validez de referencia existente)", () => {
  it("acepta un generado no critico: las sesiones guardadas que los referencian siguen validas", () => {
    const generatedNonCritical = [...generatedLibraryExerciseIds].find(
      (id) => !criticalExerciseIds.has(id),
    );
    expect(generatedNonCritical).toBeDefined();
    expect(isSelectableExercise(generatedNonCritical as string)).toBe(true);
  });

  it("rechaza un critico si lo hubiera; tras Ola 4 el catalogo no tiene criticos", () => {
    // El unico critico historico ("presion-arquero-pase-atras", generado roto)
    // se retiro del catalogo en Ola 4, asi que el set quedo vacio. Se verifica el
    // contrato de la funcion (rechaza cualquier id del set de criticos) sobre el
    // set real: sin criticos, toda referencia del catalogo curado es reproducible.
    expect(criticalExerciseIds.size).toBe(0);
    for (const id of criticalExerciseIds) {
      expect(isSelectableExercise(id)).toBe(false);
    }
    for (const exercise of getSelectableCatalog()) {
      expect(isSelectableExercise(exercise.id)).toBe(true);
    }
  });
});
