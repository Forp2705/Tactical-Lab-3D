import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_MODEL } from "../src/data/gameModel";
import { buildOpponentGamePlan } from "../src/scout/opponentScout";

describe("opponentScout", () => {
  it("convierte scout simple en foco semanal", () => {
    const plan = buildOpponentGamePlan(
      {
        rival: "Azul FC",
        probableSystem: "4-2-3-1",
        pressing: "Presion alta",
        buildUp: "Salida corta con centrales",
        strengths: ["Extremo derecho rapido"],
        vulnerabilities: ["Espalda del lateral izquierdo"],
        keyPlayers: [],
        setPieces: "",
        rhythm: "",
        risks: [],
        notes: "",
      },
      DEFAULT_GAME_MODEL,
    );

    expect(plan.weeklyTrainingFocus.join(" ")).toContain("Salida");
    expect(plan.attackIt.join(" ")).toContain("lateral izquierdo");
  });
});
