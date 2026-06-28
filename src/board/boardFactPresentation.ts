// src/board/boardFactPresentation.ts — pure, client-safe. NO server-only imports.
//
// Renders the board-fact rows shown to staff from the AUTHORITATIVE packet claims.
// Invariant: the displayed text is ALWAYS built from the CLAIM (the single source of
// truth). Coach prose and `copiedValues` NEVER drive what is shown. An ungrounded
// claim (grounded !== true) renders NO number — not even framed as a question (the
// conservative lock from Task 4's red-team).
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { CoachBoardClaimReference } from "@/ai/CoachSchemas";

export function renderableBoardFacts(
  packet: BoardEvidencePacket,
  supportingFacts: CoachBoardClaimReference[],
): Array<{ id: string; text: string }> {
  const rows: Array<{ id: string; text: string }> = [];
  for (const ref of supportingFacts) {
    const claim = packet.boardEvidence.factualClaims.find(
      (c) => c.id === ref.boardClaimId,
    );
    if (!claim) continue; // never render an unvalidated reference
    if (claim.grounded !== true) continue; // CONSERVATIVE LOCK: ungrounded ⇒ no number
    if (claim.kind === "zone-count") {
      rows.push({
        id: claim.id,
        text: `${claim.zoneLabel}: ${claim.own} propios vs ${claim.rival} rival (${claim.delta >= 0 ? "+" : ""}${claim.delta})`,
      });
    } else {
      rows.push({
        id: claim.id,
        text: `${claim.zoneLabel}: ${claim.covering} cobertura${claim.covering === 1 ? "" : "s"}`,
      });
    }
  }
  return rows;
}
