import { describe, expect, it } from "vitest";
import { catalog } from "../src/data/exercises/catalog";
import {
  inferDomainsFromText,
  matchExercisesForDiagnosis,
} from "../src/ai/exerciseMatching";

describe("exerciseMatching", () => {
  it("infiere dominio de salida limpia", () => {
    expect(inferDomainsFromText("Nos cuesta salir limpio por abajo")).toContain(
      "buildUp",
    );
  });

  it("rankea ejercicios por dominio y no solo por titulo", () => {
    const matches = matchExercisesForDiagnosis({
      domains: ["defensiveTransition"],
      query: "Quedamos largos cuando perdemos la pelota",
      exercises: catalog,
      limit: 5,
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.some((match) => match.exercise.phase === "transDef"),
    ).toBe(true);
  });

  it("devuelve IDs reales del catalogo", () => {
    const ids = new Set(catalog.map((exercise) => exercise.id));
    const matches = matchExercisesForDiagnosis({
      domains: ["pressing"],
      query: "Queremos orientar la presion y recuperar alto",
      exercises: catalog,
      limit: 3,
    });

    expect(matches.every((match) => ids.has(match.exercise.id))).toBe(true);
  });
});
