// src/board/boardFactPresentation.ts — pure, client-safe. NO server-only imports.
//
// Renders the board-fact rows shown to staff from the AUTHORITATIVE packet claims.
// Invariant: the displayed text is ALWAYS built from the CLAIM (the single source of
// truth). Coach prose and `copiedValues` NEVER drive what is shown. An ungrounded
// claim (grounded !== true) renders NO number — not even framed as a question (the
// conservative lock from Task 4's red-team).
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { BoardFreeStateEvidencePacket } from "@/board/boardFreeStateEvidencePacket";
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

// Sibling of renderableBoardFacts for the free-state packet (mc-21 w2 B) —
// same doctrine: only paint what is in factualClaims, ungrounded never
// renders a number (the guard is kept even though every free-state claim is
// grounded:true by construction, so the doctrine stays identical/testable
// across both packet types). Used BOTH for the coach's supportingFacts
// references AND for the "what we're about to send" summary shown before
// asking (there every claim in the packet is its own reference).
export function renderableFreeStateFacts(
  packet: BoardFreeStateEvidencePacket,
  claimIds: CoachBoardClaimReference[],
): Array<{ id: string; text: string }> {
  const rows: Array<{ id: string; text: string }> = [];
  for (const ref of claimIds) {
    const claim = packet.freeStateEvidence.factualClaims.find(
      (c) => c.id === ref.boardClaimId,
    );
    if (!claim) continue; // never render an unvalidated reference
    if (claim.grounded !== true) continue; // same conservative lock
    switch (claim.kind) {
      case "formation":
        rows.push({
          id: claim.id,
          text: `Formacion ${claim.side === "own" ? "propia" : "rival"}: ${claim.formation}`,
        });
        break;
      case "tokenCount":
        rows.push({
          id: claim.id,
          text: `Fichas ${claim.side === "own" ? "propias" : "rivales"}: ${claim.count}`,
        });
        break;
      case "objectCount": {
        const label =
          claim.objectType === "arrow"
            ? "Flechas"
            : claim.objectType === "zone"
              ? "Zonas"
              : "Notas";
        const semanticSuffix = claim.semantic ? ` (${claim.semantic})` : "";
        rows.push({
          id: claim.id,
          text: `${label}${semanticSuffix}: ${claim.count}`,
        });
        break;
      }
      case "scene":
        rows.push({
          id: claim.id,
          text: `Escena activa: ${claim.title} (${claim.index + 1}/${claim.totalScenes})`,
        });
        break;
      case "layers":
        rows.push({
          id: claim.id,
          text:
            claim.visible.length > 0
              ? `Capas visibles: ${claim.visible.join(", ")}`
              : "Capas visibles: ninguna",
        });
        break;
    }
  }
  return rows;
}

// All claims in a freshly-built packet, as CoachBoardClaimReference-shaped
// refs — used to render the "what we're about to send" summary before
// asking, reusing the exact same render function/doctrine as the coach's
// post-hoc supportingFacts references.
export function allFreeStateFactRefs(
  packet: BoardFreeStateEvidencePacket,
): CoachBoardClaimReference[] {
  // "use" only matters for the coach's own citations; this summary is a
  // pre-ask display of everything in the packet, so every ref is a plain
  // supportingFact reference. copiedValues is scenario-claim-shaped
  // (own/rival/delta/covering) and unused by renderableFreeStateFacts.
  return packet.freeStateEvidence.factualClaims.map((claim) => ({
    boardClaimId: claim.id,
    use: "supportingFact" as const,
  }));
}
