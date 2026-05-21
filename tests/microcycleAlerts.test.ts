import { describe, expect, it } from "vitest";
import type { Microcycle, Session } from "../src/data";
import { catalog } from "../src/data";
import { computeMicrocycleAlerts } from "../src/sessions/MicrocycleAlerts";

describe("microcycle alerts", () => {
  it("flags high load streaks and missing ABP coverage", () => {
    const alerts = computeMicrocycleAlerts(
      makeMicrocycle(),
      makeSession([]),
      catalog,
    );

    expect(alerts.some((alert) => alert.message.includes("3 o mas dias"))).toBe(
      true,
    );
    expect(
      alerts.some((alert) => alert.message.includes("no incluye ABP")),
    ).toBe(true);
  });

  it("flags repeated exercises in a session", () => {
    const alerts = computeMicrocycleAlerts(
      makeMicrocycle(),
      makeSession(["rondo-4v2-apoyo", "rondo-4v2-apoyo", "rondo-4v2-apoyo"]),
      catalog,
    );

    expect(
      alerts.some((alert) => alert.message.includes("aparece 3 veces")),
    ).toBe(true);
  });
});

function makeSession(exerciseIds: string[]): Session {
  return {
    id: "s1",
    name: "Session test",
    blocks: exerciseIds.map((exerciseId, index) => ({
      id: `b${index}`,
      exerciseId,
      durationMin: 20,
      swappable: true,
    })),
    computed: {
      totalDuration: exerciseIds.length * 20,
      totalLoad: exerciseIds.length * 140,
      materials: [],
      primaryObjectives: [],
    },
  };
}

function makeMicrocycle(): Microcycle {
  return {
    id: "m1",
    name: "Micro test",
    weekOf: "2026-05-18",
    days: {
      "MD+1": { objective: "Recuperar", targetLoad: "low" },
      "MD+2": { objective: "Subir", targetLoad: "high" },
      "MD-4": { objective: "Principal", targetLoad: "high" },
      "MD-3": { objective: "Competitivo", targetLoad: "high" },
      "MD-2": { objective: "Ajustar", targetLoad: "med" },
      "MD-1": { objective: "Activar", targetLoad: "low" },
      MD: { objective: "Partido", targetLoad: "med" },
    },
    alerts: [],
  };
}
