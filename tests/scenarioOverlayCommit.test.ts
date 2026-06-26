import { describe, expect, it } from "vitest";
import { overlayToBoardItems } from "@/board/useBoardActions";
import type { ConsequenceOverlay } from "@/board/scenarioBoardConsequence";

const overlay: ConsequenceOverlay = {
  scenarioId: "raise-block",
  title: "Subir el bloque",
  zones: [
    {
      semantic: "danger",
      x: 10,
      y: 35,
      w: 26,
      h: 30,
      patch: { label: "Espacio a la espalda" },
    },
  ],
  arrows: [
    {
      semantic: "longPass",
      from: { kind: "point", point: { x: 80, y: 50 } },
      to: { kind: "point", point: { x: 23, y: 50 } },
      patch: { label: "Diagonal" },
    },
  ],
  rivalFacts: [],
  notes: [],
  readout: {
    expectedBenefit: "",
    mainRisk: "",
    exposedPlayers: [],
    confidence: "low",
    evidenceLevel: "none",
    grounding: { zones: [], hasGroundedMetrics: false },
  },
};

describe("overlayToBoardItems", () => {
  it("maps 1:1 to real BoardZone/BoardArrow via factories (no recompute)", () => {
    const { zones, arrows } = overlayToBoardItems(overlay);
    expect(zones).toHaveLength(1);
    expect(zones[0].semantic).toBe("danger");
    expect(zones[0].x).toBe(10);
    expect(zones[0].label).toBe("Espacio a la espalda");
    expect(arrows).toHaveLength(1);
    expect(arrows[0].semantic).toBe("longPass");
    expect(arrows[0].to).toEqual({ kind: "point", point: { x: 23, y: 50 } });
  });
});
