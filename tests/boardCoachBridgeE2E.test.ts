// End-to-end board-initiated flow (slice 4 task 9). Locks the composition:
//   buildBoardEvidencePacket(overlay)
//     → applyBoardFactFirewall(coachResponse, packet)
//       → renderableBoardFacts(packet, sanitized supportingFacts)
// Tests ONLY — no production code. Confirms the grounded fact survives + renders
// from structure, a lying copiedValue is dropped + downgraded, and an ungrounded
// board fact is dropped + renders nothing.
import { describe, it, expect } from "vitest";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import {
  buildBoardEvidencePacket,
  type BoardEvidencePacket,
  type BoardFactualClaim,
} from "@/board/boardEvidencePacket";
import { applyBoardFactFirewall } from "@/ai/coachOutputGuard";
import { renderableBoardFacts } from "@/board/boardFactPresentation";
import type { CoachResponse } from "@/ai/CoachSchemas";
import { hyp } from "./fixtures/coachBridgeFixtures";
import { raiseBlockSim, raiseBlockScene, sceneWith } from "./fixtures/raiseBlockFixtures";

// The press superiority row is authored as "Presión alta" → the grounded
// zone-count claim. Read it off the real packet so the test tracks the actual
// mapper output, not a hard-coded number.
function findPressClaim(
  packet: BoardEvidencePacket,
): Extract<BoardFactualClaim, { kind: "zone-count" }> {
  const claim = packet.boardEvidence.factualClaims.find(
    (c) => c.zoneLabel === "Presión alta",
  );
  if (!claim || claim.kind !== "zone-count") {
    throw new Error("expected a zone-count press claim in the packet");
  }
  return claim;
}

function supportingFactsOf(result: { response: CoachResponse }) {
  return result.response.mode !== "question"
    ? result.response.advice.supportingFacts
    : [];
}

describe("board-initiated coach flow (e2e)", () => {
  it("grounded raise-block: a valid supportingFact survives and renders from structure", () => {
    const packet = buildBoardEvidencePacket(
      buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)),
    );
    const press = findPressClaim(packet);
    // The populated press band makes this claim grounded — precondition for the case.
    expect(press.grounded).toBe(true);

    // Honest support: copiedValues match the authoritative claim (REQUIRED post-Task-4).
    const response = hyp([
      { boardClaimId: press.id, use: "supportingFact", copiedValues: { own: press.own } },
    ]);

    const sanitized = applyBoardFactFirewall(response, packet);

    expect(sanitized.downgraded).toBe(false);
    const kept = supportingFactsOf(sanitized);
    expect(kept.some((f) => f.boardClaimId === press.id && f.use === "supportingFact")).toBe(true);

    const rows = renderableBoardFacts(packet, kept);
    const pressRow = rows.find((r) => r.id === press.id);
    expect(pressRow).toBeDefined();
    // Displayed number is sourced from the CLAIM, never from the coach.
    expect(pressRow?.text).toContain(String(press.own));
  });

  it("grounded but the coach lies in copiedValues: dropped + downgraded, renders nothing for it", () => {
    const packet = buildBoardEvidencePacket(
      buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)),
    );
    const press = findPressClaim(packet);
    expect(press.grounded).toBe(true);

    // Mismatching copied value → value-mismatch → stripped + downgrade.
    const response = hyp([
      { boardClaimId: press.id, use: "supportingFact", copiedValues: { own: press.own + 5 } },
    ]);

    const sanitized = applyBoardFactFirewall(response, packet);

    expect(sanitized.downgraded).toBe(true);
    const kept = supportingFactsOf(sanitized);
    expect(kept.some((f) => f.boardClaimId === press.id)).toBe(false);

    const rows = renderableBoardFacts(packet, kept);
    expect(rows.some((r) => r.id === press.id)).toBe(false);
  });

  it("ungrounded (empty board): board fact used as support is dropped + downgraded, renders nothing", () => {
    const packet = buildBoardEvidencePacket(
      buildConsequenceOverlay(raiseBlockSim(), sceneWith([])),
    );
    const press = findPressClaim(packet);
    // Empty board ⇒ the press band counted no tokens ⇒ not grounded.
    expect(press.grounded).toBe(false);

    const response = hyp([
      { boardClaimId: press.id, use: "supportingFact", copiedValues: { own: 0 } },
    ]);

    const sanitized = applyBoardFactFirewall(response, packet);

    expect(sanitized.downgraded).toBe(true);
    const kept = supportingFactsOf(sanitized);
    expect(kept.some((f) => f.boardClaimId === press.id)).toBe(false);

    // Conservative render lock: ungrounded ⇒ no row, even if a ref slipped through.
    expect(renderableBoardFacts(packet, kept)).toEqual([]);
  });
});
