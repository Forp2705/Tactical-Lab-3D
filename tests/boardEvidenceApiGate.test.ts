import { describe, expect, it } from "vitest";
import { parseIncomingBoardEvidence } from "@/board/boardEvidencePacket";
import { buildBoardEvidencePacket } from "@/board/boardEvidencePacket";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { raiseBlockScene, raiseBlockSim } from "./fixtures/raiseBlockFixtures";

// The honesty gate: the SINGLE validated entry point for an incoming packet.
// absent → no-op; valid → ok; malformed → malformed (NEVER silently downgraded
// to "absent", which would let a non-grounded answer look board-grounded).
describe("parseIncomingBoardEvidence — honesty gate", () => {
  it("absent: undefined → absent", () => {
    expect(parseIncomingBoardEvidence(undefined)).toEqual({ status: "absent" });
  });

  it("absent: null → absent", () => {
    expect(parseIncomingBoardEvidence(null)).toEqual({ status: "absent" });
  });

  it("valid: a real built packet → ok and carries the parsed packet", () => {
    const packet = buildBoardEvidencePacket(
      buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)),
    );
    const result = parseIncomingBoardEvidence(packet);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.packet.source).toBe("boardScenario");
      expect(result.packet.scenarioId).toBe("raise-block");
    }
  });

  describe("malformed → malformed (no silent downgrade to absent)", () => {
    const cases: Array<[string, unknown]> = [
      ["empty object {}", {}],
      [
        "partial (boardEvidence: {})",
        { source: "boardScenario", boardEvidence: {} },
      ],
      [
        "non-number in a claim (own: '3')",
        {
          source: "boardScenario",
          scope: "drawnSituation",
          scenarioId: "raise-block",
          title: "x",
          readout: {
            confidence: "medium",
            evidenceLevel: "partial",
            expectedBenefit: "a",
            mainRisk: "b",
          },
          boardEvidence: {
            authority: "high",
            evidenceStrength: "partial",
            hasGroundedMetrics: true,
            factualClaims: [
              {
                id: "press",
                kind: "zone-count",
                zoneLabel: "Presión alta",
                own: "3",
                rival: 2,
                delta: 1,
                grounded: true,
              },
            ],
          },
        },
      ],
      [
        "unknown discriminant kind",
        {
          source: "boardScenario",
          scope: "drawnSituation",
          scenarioId: "raise-block",
          title: "x",
          readout: {
            confidence: "medium",
            evidenceLevel: "partial",
            expectedBenefit: "a",
            mainRisk: "b",
          },
          boardEvidence: {
            authority: "high",
            evidenceStrength: "partial",
            hasGroundedMetrics: true,
            factualClaims: [{ id: "x", kind: "bogus" }],
          },
        },
      ],
      [
        "wrong literal where strictness applies (source)",
        {
          source: "notBoard",
          scope: "drawnSituation",
          scenarioId: "raise-block",
          title: "x",
          readout: {
            confidence: "medium",
            evidenceLevel: "partial",
            expectedBenefit: "a",
            mainRisk: "b",
          },
          boardEvidence: {
            authority: "high",
            evidenceStrength: "partial",
            hasGroundedMetrics: true,
            factualClaims: [],
          },
        },
      ],
      [
        "two claims sharing an id with conflicting values (superRefine)",
        {
          source: "boardScenario",
          scope: "drawnSituation",
          scenarioId: "raise-block",
          title: "x",
          readout: {
            confidence: "medium",
            evidenceLevel: "partial",
            expectedBenefit: "a",
            mainRisk: "b",
          },
          boardEvidence: {
            authority: "high",
            evidenceStrength: "partial",
            hasGroundedMetrics: true,
            factualClaims: [
              {
                id: "press",
                kind: "zone-count",
                zoneLabel: "Presión alta",
                own: 3,
                rival: 2,
                delta: 1,
                grounded: true,
              },
              {
                id: "press",
                kind: "zone-count",
                zoneLabel: "Presión alta",
                own: 9,
                rival: 0,
                delta: 9,
                grounded: false,
              },
            ],
          },
        },
      ],
    ];

    for (const [label, raw] of cases) {
      it(`${label} → malformed (and explicitly !== absent)`, () => {
        const result = parseIncomingBoardEvidence(raw);
        expect(result.status).toBe("malformed");
        expect(result.status).not.toBe("absent");
      });
    }
  });
});
