// Shared evidence-strength classification for the post-match TrustGuard.
//
// This is the single source of truth for "how much should a piece of evidence
// be trusted" — used both when grounding a freshly generated report
// (generatePostMatchReport.ts -> guardMemoryCandidate) and when gating which
// staff-selected memory candidates are actually written to long-term tactical
// memory (storage.ts -> canCommitMemoryCandidate). Keeping this logic in one
// place is what makes the two checks consistent instead of silently diverging.

export type EvidenceSource = "result" | "plan" | "staffNotes" | "tag";
export type EvidenceSeverity = "low" | "medium" | "high";
export type EvidenceStrength = "weak" | "moderate" | "strong";

export type EvidenceLike = {
  source: EvidenceSource;
  text: string;
  severity?: EvidenceSeverity;
};

const EVIDENCE_ID_PATTERN = /\bEV-[A-Z]+(?:-\d+)?\b/g;

// Evidence that explicitly flags itself as unconfirmed/manual-only — this can
// never be treated as strong, regardless of its source or severity tag.
const MANUAL_ONLY_PATTERN =
  /observaci[oó]n manual|no confirmada por video|requiere validaci[oó]n/i;

// Narrative evidence (staff notes / plan) that explicitly references
// corroboration — video confirmation, a repeated pattern, or staff
// validation — can be promoted from "weak" to "moderate". A bare opinion
// cannot.
const CORROBORATION_PATTERN =
  /confirmad[oa]\s+por\s+video|corroborad[oa]|patr[oó]n\s+repetido|repetid[oa]\s+(en|durante)|validad[oa]\s+por\s+(el\s+)?staff/i;

export function extractEvidenceIds(text: string): string[] {
  return Array.from(text.matchAll(EVIDENCE_ID_PATTERN)).map((match) => match[0]);
}

export function referencesValidEvidence(
  text: string,
  validEvidenceIds: Set<string>,
): boolean {
  return extractEvidenceIds(text).some((id) => validEvidenceIds.has(id));
}

/**
 * Classifies a single evidence item's trustworthiness.
 *
 * Rules (intentionally symmetric across sources — strength comes from what
 * the evidence actually demonstrates, not from who produced it):
 * - `tag` (structured/video evidence): strong only at high severity, moderate
 *   at medium severity, weak otherwise — and never above "weak" if the text
 *   flags itself as manual/unconfirmed.
 * - `staffNotes` / `plan` (manual/narrative evidence): defaults to weak
 *   ("unconfirmed") because it is a staff impression, not a measurement. It
 *   can only reach "moderate" when the text itself names a corroboration
 *   (video confirmation, a repeated pattern, staff validation) — it can never
 *   be "strong" on its own.
 * - `result` (the scoreline): always weak as grounding for a specific
 *   tactical claim — it's context, not evidence of *why* something happened.
 */
export function classifyEvidenceStrength(evidence: EvidenceLike): EvidenceStrength {
  const manualOnly = MANUAL_ONLY_PATTERN.test(evidence.text);

  if (evidence.source === "tag") {
    if (manualOnly) return "weak";
    if (evidence.severity === "high") return "strong";
    if (evidence.severity === "medium") return "moderate";
    return "weak";
  }

  if (evidence.source === "staffNotes" || evidence.source === "plan") {
    if (manualOnly) return "weak";
    if (CORROBORATION_PATTERN.test(evidence.text)) return "moderate";
    return "weak";
  }

  // "result" — the scoreline alone never grounds a specific tactical claim.
  return "weak";
}

export function isStrongEvidence(evidence: EvidenceLike): boolean {
  return classifyEvidenceStrength(evidence) === "strong";
}

export function isAtLeastModerateEvidence(evidence: EvidenceLike): boolean {
  const strength = classifyEvidenceStrength(evidence);
  return strength === "moderate" || strength === "strong";
}

/**
 * Grounding check used while normalizing/validating a freshly generated
 * report: does this set of evidence references include at least one
 * moderate-or-better item? This is intentionally a lower bar than the
 * commit-time gate — it only decides whether to keep the AI's claimed
 * confidence/severity or downgrade it, not whether to write to memory.
 */
export function hasGroundingEvidence(
  evidenceTexts: string[],
  evidenceById: Map<string, EvidenceLike>,
): boolean {
  return evidenceTexts.some((text) =>
    extractEvidenceIds(text).some((id) => {
      const item = evidenceById.get(id);
      return Boolean(item && isAtLeastModerateEvidence(item));
    }),
  );
}

/**
 * Commit-time gate: does this set of evidence references justify writing a
 * pattern into long-term tactical memory?
 *
 * Bar: at least one *strong* evidence item, OR at least one *moderate* item
 * when the candidate itself represents a staff-validated repeating pattern
 * (`scope === "validated"`). This is the "repeated patterns / staff
 * acceptance can upgrade eligibility" path — it never lets manual-only weak
 * evidence through on its own, no matter how many times it's repeated in a
 * single report.
 */
export function hasCommitGradeEvidence(
  evidenceTexts: string[],
  evidenceById: Map<string, EvidenceLike>,
  options: { allowValidatedModerate: boolean },
): boolean {
  let sawStrong = false;
  let sawModerate = false;

  for (const text of evidenceTexts) {
    for (const id of extractEvidenceIds(text)) {
      const item = evidenceById.get(id);
      if (!item) continue;
      const strength = classifyEvidenceStrength(item);
      if (strength === "strong") sawStrong = true;
      if (strength === "moderate") sawModerate = true;
    }
  }

  if (sawStrong) return true;
  return sawModerate && options.allowValidatedModerate;
}
