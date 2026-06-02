import { describe, expect, it } from "vitest";
import type { Player } from "../src/data";
import { analyzePlayerFit, inferAdjustmentsFromText } from "../src/ai/playerFit";

describe("playerFit", () => {
  it("advierte centrales lentos en bloque alto", () => {
    const findings = analyzePlayerFit([player("1", "Central", ["CB"], { speed: 45 })], [
      "highBlock",
    ]);

    expect(findings.some((finding) => finding.id === "slow-cb-high-block")).toBe(true);
  });

  it("infiere ajustes desde texto tactico", () => {
    expect(inferAdjustmentsFromText("Queremos subir el bloque")).toContain("highBlock");
  });
});

function player(
  id: string,
  name: string,
  positions: Player["positions"],
  attrs: Partial<Player["attributes"]>,
): Player {
  return {
    id,
    name,
    num: Number(id),
    positions,
    foot: "R",
    status: "available",
    profile: "Test",
    attributes: {
      speed: 60,
      stamina: 60,
      pass: 60,
      control: 60,
      press: 60,
      duel: 60,
      tactical: 60,
      ...attrs,
    },
  };
}
