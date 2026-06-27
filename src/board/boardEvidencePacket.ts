// src/board/boardEvidencePacket.ts — client-safe; NO server-only imports.
import { z } from "zod";

const EvidenceLevelEnum = z.enum(["none", "weak", "partial", "sufficient"]);

export const BoardFactualClaimSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("zone-count"),
    zoneLabel: z.string().min(1),
    own: z.number(),
    rival: z.number(),
    delta: z.number(),
    grounded: z.boolean(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("coverage"),
    zoneId: z.string().min(1),
    zoneLabel: z.string().min(1),
    covering: z.number(),
    grounded: z.boolean(),
    excludes: z.literal("backs"),
  }),
]);

export const BoardEvidencePacketSchema = z.object({
  source: z.literal("boardScenario"),
  scope: z.literal("drawnSituation"),
  scenarioId: z.string().min(1),
  title: z.string(),
  readout: z.object({
    confidence: z.enum(["low", "medium", "high"]),
    evidenceLevel: EvidenceLevelEnum,
    expectedBenefit: z.string(),
    mainRisk: z.string(),
  }),
  boardEvidence: z.object({
    authority: z.literal("high"),
    evidenceStrength: EvidenceLevelEnum,
    hasGroundedMetrics: z.boolean(),
    factualClaims: z.array(BoardFactualClaimSchema),
    summary: z.string().optional(),
  }),
});

export type BoardFactualClaim = z.infer<typeof BoardFactualClaimSchema>;
export type BoardEvidencePacket = z.infer<typeof BoardEvidencePacketSchema>;

export function isBoardFactualClaimId(packet: BoardEvidencePacket, id: string): boolean {
  return packet.boardEvidence.factualClaims.some((claim) => claim.id === id);
}
