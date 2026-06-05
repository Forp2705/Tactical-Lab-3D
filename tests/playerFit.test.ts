import { describe, expect, it } from "vitest";
import type { Player } from "../src/data";
import { analyzePlayerFit, inferAdjustmentsFromText } from "../src/ai/playerFit";

describe("playerFit", () => {
  it("advierte centrales lentos en bloque alto", () => {
    const findings = analyzePlayerFit(
      [
        player(
          "1",
          "Central",
          ["CB"],
          "Central fuerte en area, pero lento y sufre a la espalda.",
        ),
      ],
      ["highBlock"],
    );

    expect(findings.some((finding) => finding.id === "slow-cb-high-block")).toBe(true);
    expect(findings[0]?.evidence[0]).toContain("perfil:");
  });

  it("infiere ajustes desde texto tactico", () => {
    expect(inferAdjustmentsFromText("Queremos subir el bloque")).toContain("highBlock");
  });
});

function player(
  id: string,
  name: string,
  positions: Player["positions"],
  profile: string,
): Player {
  return {
    id,
    name,
    num: Number(id),
    positions,
    foot: "R",
    status: "available",
    profile,
    attributes: {
      speed: 60,
      stamina: 60,
      pass: 60,
      control: 60,
      press: 60,
      duel: 60,
      tactical: 60,
    },
  };
}
