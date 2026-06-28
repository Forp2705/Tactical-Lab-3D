// src/board/boardEvidencePacket.ts — client-safe; NO server-only imports.
import { z } from "zod";
import type { ConsequenceOverlay } from "@/board/scenarioBoardConsequence";

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

const slug = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * One-shot, pure mapper: ConsequenceOverlay → BoardEvidencePacket.
 * Derives ONLY from the already-audited `overlay.readout` (never the raw scene).
 * Returns a fresh object; reads no store/global. The firewall: no scene fields
 * (`objects`, `position`, `x`, …) ever cross into the packet.
 */
export function buildBoardEvidencePacket(overlay: ConsequenceOverlay): BoardEvidencePacket {
  const { readout } = overlay;
  // all-token populated flag for the band; a CB-in-gap with covering:0 is still grounded:true.
  const groundedOf = (label: string) =>
    readout.grounding.zones.find((z) => z.label === label)?.populated ?? false;

  const factualClaims: BoardFactualClaim[] = readout.tacticalRows.map((row) => {
    if (row.kind === "superiority") {
      return {
        id: slug(row.label),
        kind: "zone-count",
        zoneLabel: row.label,
        own: row.own,
        rival: row.rival,
        delta: row.delta,
        grounded: groundedOf(row.label),
      };
    }
    return {
      id: slug(row.label),
      kind: "coverage",
      zoneId: slug(row.label),
      zoneLabel: row.label,
      covering: row.covering,
      grounded: groundedOf(row.label),
      excludes: "backs",
    };
  });

  return {
    source: "boardScenario",
    scope: "drawnSituation",
    scenarioId: overlay.scenarioId,
    title: overlay.title,
    readout: {
      confidence: readout.confidence,
      evidenceLevel: readout.evidenceLevel,
      expectedBenefit: readout.expectedBenefit,
      mainRisk: readout.mainRisk,
    },
    boardEvidence: {
      authority: "high",
      evidenceStrength: readout.evidenceLevel,
      hasGroundedMetrics: readout.grounding.hasGroundedMetrics,
      factualClaims,
    },
  };
}
