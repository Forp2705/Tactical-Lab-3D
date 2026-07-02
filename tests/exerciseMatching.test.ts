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

  it("detecta buildUp aunque el 9 aparezca aislado (no lo tapa attack)", () => {
    const domains = inferDomainsFromText(
      "no salimos limpio y el 9 queda aislado",
    );
    expect(domains).toContain("buildUp");
    expect(domains).toContain("attack");
  });

  it("detecta buildUp con laterales en contexto de salida", () => {
    expect(
      inferDomainsFromText("nos aprietan a los laterales al empezar la jugada"),
    ).toContain("buildUp");
    expect(
      inferDomainsFromText("nos cuesta sacar la pelota jugada por el costado"),
    ).toContain("buildUp");
  });

  it("NO marca buildUp por laterales en una consulta puramente defensiva", () => {
    const domains = inferDomainsFromText(
      "nos ganan por la banda con centros al area",
    );
    expect(domains).not.toContain("buildUp");
  });

  it("no dispara attack por un numero como 90 (word-boundary en '9')", () => {
    expect(
      inferDomainsFromText("bajamos la intensidad en los ultimos 90 minutos"),
    ).not.toContain("attack");
    // pero el '9' como jugador si dispara attack
    expect(inferDomainsFromText("el 9 queda solo arriba")).toContain("attack");
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
