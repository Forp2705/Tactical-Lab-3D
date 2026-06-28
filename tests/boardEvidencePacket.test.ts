import { describe, it, expect } from "vitest";
import {
  BoardEvidencePacketSchema,
  buildBoardEvidencePacket,
  isBoardFactualClaimId,
  type BoardEvidencePacket,
} from "@/board/boardEvidencePacket";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { raiseBlockScene, raiseBlockSim, sceneWith } from "./fixtures/raiseBlockFixtures";

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

describe("buildBoardEvidencePacket", () => {
  it("grounded raise-block: claims carry structured numbers + grounded:true, no raw scene", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false));
    const packet = buildBoardEvidencePacket(overlay);
    expect(packet.source).toBe("boardScenario");
    expect(packet.scope).toBe("drawnSituation");
    expect(packet.scenarioId).toBe("raise-block");
    expect(packet.boardEvidence.authority).toBe("high");
    expect(packet.boardEvidence.hasGroundedMetrics).toBe(true);
    expect(packet.boardEvidence.evidenceStrength).toBe(overlay.readout.evidenceLevel);

    const press = packet.boardEvidence.factualClaims.find((c) => c.kind === "zone-count");
    expect(press).toMatchObject({ kind: "zone-count", grounded: true });
    expect(typeof (press as { own: number }).own).toBe("number");
    expect(typeof (press as { rival: number }).rival).toBe("number");
    expect(typeof (press as { delta: number }).delta).toBe("number");

    const gap = packet.boardEvidence.factualClaims.find((c) => c.kind === "coverage");
    expect(gap).toMatchObject({ kind: "coverage", excludes: "backs" });

    // The produced packet must itself be a valid BoardEvidencePacket.
    expect(BoardEvidencePacketSchema.safeParse(packet).success).toBe(true);

    // Hard lock: no raw scene fields leaked into the packet.
    expect(JSON.stringify(packet)).not.toMatch(/objects|position|"x":/);
  });

  it("slice-7 distinction: CB-in-gap coverage claim is grounded:true even with covering:0", () => {
    // GK parked outside the gap band; both CBs at x=30 land inside the gap rect.
    // All-token grounding fires (backs sit in the rect), but the backs are excluded
    // from `covering` → coverage:0 yet grounded:true.
    const base = raiseBlockScene(false).objects;
    const cbInGap = sceneWith([
      { ...base[0], position: { x: 8, y: 10 } },
      { ...base[1], position: { x: 30, y: 48 } },
      { ...base[2], position: { x: 30, y: 52 } },
    ]);
    const overlay = buildConsequenceOverlay(raiseBlockSim(), cbInGap);
    const packet = buildBoardEvidencePacket(overlay);
    const gap = packet.boardEvidence.factualClaims.find((c) => c.kind === "coverage");
    expect(gap).toMatchObject({ kind: "coverage", covering: 0, grounded: true });
  });

  it("ungrounded raise-block (empty board): hasGroundedMetrics false, claims grounded:false", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), sceneWith([]));
    const packet = buildBoardEvidencePacket(overlay);
    expect(packet.boardEvidence.hasGroundedMetrics).toBe(false);
    expect(packet.boardEvidence.factualClaims.every((c) => c.grounded === false)).toBe(true);
  });
});
