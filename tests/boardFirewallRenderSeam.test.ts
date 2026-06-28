// LOCK 2 (slice 4) — firewall → render seam. Proves "honest keep ≠ safe display":
// a `questionTrigger` ref to a `grounded:false` claim SURVIVES the firewall (kept,
// no downgrade) yet emits NO visible number at the render layer. The two halves are
// independent locks; this test pins them together at the exact seam the whole-branch
// review flagged as only probe-covered.
import { describe, expect, it } from "vitest";
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
import { raiseBlockSim, sceneWith } from "./fixtures/raiseBlockFixtures";

// Read the press claim off the real packet so the test tracks the actual mapper
// output, not a hard-coded id/number.
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

// Empty board ⇒ the press band counted no tokens ⇒ the zone-count claim is grounded:false.
function emptyBoardPacket(): BoardEvidencePacket {
  return buildBoardEvidencePacket(
    buildConsequenceOverlay(raiseBlockSim(), sceneWith([])),
  );
}

describe("firewall → render seam: questionTrigger on a grounded:false claim", () => {
  it("honest-keep half: kept (no downgrade) — render half: no row for it", () => {
    const packet = emptyBoardPacket();
    const press = findPressClaim(packet);
    expect(press.grounded).toBe(false); // precondition

    const response = hyp([{ boardClaimId: press.id, use: "questionTrigger" }]);

    const sanitized = applyBoardFactFirewall(response, packet);

    // honest keep: a questionTrigger on an ungrounded claim is NOT a lie → kept,
    // and it never lowers confidence.
    expect(sanitized.downgraded).toBe(false);
    const kept = supportingFactsOf(sanitized);
    expect(
      kept.some(
        (f) => f.boardClaimId === press.id && f.use === "questionTrigger",
      ),
    ).toBe(true);

    // safe display: the conservative render lock drops every grounded !== true
    // claim → the kept ref renders NO number.
    const rows = renderableBoardFacts(packet, kept);
    expect(rows.some((r) => r.id === press.id)).toBe(false);
    expect(rows).toEqual([]);
  });

  it("kept ref is claim-sourced (copiedValues matching the claim) yet still renders no number", () => {
    const packet = emptyBoardPacket();
    const press = findPressClaim(packet);
    expect(press.grounded).toBe(false);

    // copiedValues that match the authoritative claim → no field-incompat, no
    // value-mismatch → kept, rebuilt FROM THE CLAIM. Demonstrates the ref is kept
    // claim-sourced, not stripped, so the no-render result is the render lock's
    // doing (grounded gate), not a missing ref.
    const response = hyp([
      {
        boardClaimId: press.id,
        use: "questionTrigger",
        copiedValues: { own: press.own },
      },
    ]);

    const sanitized = applyBoardFactFirewall(response, packet);

    expect(sanitized.downgraded).toBe(false);
    const kept = supportingFactsOf(sanitized);
    const keptRef = kept.find((f) => f.boardClaimId === press.id);
    expect(keptRef).toBeDefined();
    expect(keptRef?.use).toBe("questionTrigger");

    expect(renderableBoardFacts(packet, kept)).toEqual([]);
  });
});
