import { describe, it, expect } from "vitest";
import { BoardEvidencePacketSchema, isBoardFactualClaimId, type BoardEvidencePacket } from "@/board/boardEvidencePacket";

const validPacket: BoardEvidencePacket = {
  source: "boardScenario",
  scope: "drawnSituation",
  scenarioId: "raise-block",
  title: "Subir el bloque",
  readout: { confidence: "medium", evidenceLevel: "partial", expectedBenefit: "x", mainRisk: "y" },
  boardEvidence: {
    authority: "high",
    evidenceStrength: "partial",
    hasGroundedMetrics: true,
    factualClaims: [
      { id: "press", kind: "zone-count", zoneLabel: "Presión alta", own: 3, rival: 2, delta: 1, grounded: true },
      { id: "gap", kind: "coverage", zoneId: "gap", zoneLabel: "Espacio a la espalda", covering: 0, grounded: true, excludes: "backs" },
    ],
  },
};

describe("BoardEvidencePacket schema + contract", () => {
  it("parses a valid packet", () => {
    expect(BoardEvidencePacketSchema.safeParse(validPacket).success).toBe(true);
  });

  it("rejects a malformed claim (unknown discriminant kind)", () => {
    const bad = { ...validPacket, boardEvidence: { ...validPacket.boardEvidence, factualClaims: [{ id: "x", kind: "bogus" }] } };
    expect(BoardEvidencePacketSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a packet missing required fields", () => {
    expect(BoardEvidencePacketSchema.safeParse({ source: "boardScenario" }).success).toBe(false);
  });

  it("isBoardFactualClaimId finds existing ids and rejects unknown", () => {
    expect(isBoardFactualClaimId(validPacket, "press")).toBe(true);
    expect(isBoardFactualClaimId(validPacket, "gap")).toBe(true);
    expect(isBoardFactualClaimId(validPacket, "nope")).toBe(false);
  });
});
