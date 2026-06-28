// FRAGILE BY DESIGN. Secondary net, NOT the firewall.
//
// The hard guarantees of the Board -> CoachAgent bridge live elsewhere:
//   - Task 4: structured `coachOutputGuard` (confidence capping + claim validation).
//   - Task 7: render-from-structure (board facts are rendered from validated structure,
//             ungrounded claims render no number).
//
// This module is a BEST-EFFORT secondary net only. It performs a crude numeric scan to
// catch an obvious contradiction between the coach's FREE PROSE and the SMALL set of
// already-validated, RENDERED board facts (the exact claims the coach cited via
// `boardClaimId`). It is intentionally NOT full-text NLP and will miss many cases; that
// is acceptable because the real firewall is upstream.
//
// TELEMETRY / AUDIT ONLY. The flags returned here MUST NOT gate, block, or alter the
// coach turn in any way. They exist solely for visibility/observability. Treat any flag
// as a soft signal, never a hard guarantee.

export function scanProseForBoardContradictions(
  prose: string,
  renderedFacts: Array<{ id: string; text: string }>,
): Array<{ claimId: string; note: string }> {
  const flags: Array<{ claimId: string; note: string }> = [];
  const proseNumbers = (prose.match(/\d+/g) ?? []).map(Number);
  for (const fact of renderedFacts) {
    // Compare only against the PRIMARY board counts, not the rendered differential.
    // A fact like "Presión alta: 3 propios vs 2 rival (+1)" carries a derived "(+1)"
    // annotation; that parenthetical differential is not a primary claim count and must
    // not be treated as a number the prose can "share". Strip parenthetical groups first.
    const factCore = fact.text.replace(/\([^)]*\)/g, "");
    const factNumbers = (factCore.match(/\d+/g) ?? []).map(Number);
    if (factNumbers.length === 0) continue;
    const zoneLabel = fact.text.split(":")[0].toLowerCase();
    const mentionsZone = prose.toLowerCase().includes(zoneLabel);
    const sharesNoNumber =
      proseNumbers.length >= 2 && !factNumbers.some((n) => proseNumbers.includes(n));
    if (mentionsZone && sharesNoNumber) {
      flags.push({ claimId: fact.id, note: "prose numbers differ from validated board fact" });
    }
  }
  return flags;
}
