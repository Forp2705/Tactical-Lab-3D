import {
  isBoardFactualClaimId,
  type BoardEvidencePacket,
  type BoardFactualClaim,
} from "../board/boardEvidencePacket.js";
import type {
  CoachBoardClaimReference,
  CoachMatchAdvice,
  CoachResponse,
  TacticalDomain,
} from "./CoachSchemas.js";
import { inferDomainsFromText } from "./exerciseMatching.js";

export type GuardEvidence = {
  id: string;
  sourceType: "knowledge" | "memory" | "observation" | "report" | "video";
};

export type CoachTrustAssessment = {
  notes: string[];
  confidenceCap: number;
  missingPrimaryDomain: boolean;
  hasCitation: boolean;
  citationCount: number;
  currentEvidenceCount: number;
  hasCaseEvidence: boolean;
  hasOnlyHistoricalOrContextEvidence: boolean;
  missingCitationRisk: boolean;
  reliesMostlyOnMemoryOrPrinciples: boolean;
  makesStrongClaim: boolean;
  requiresHypothesisMode: boolean;
};

const DOMAIN_LABELS: Record<TacticalDomain, string> = {
  defense: "defensa",
  pressing: "presion",
  block: "bloque",
  buildUp: "salida",
  defensiveTransition: "transicion defensiva",
  offensiveTransition: "transicion ofensiva",
  attack: "ataque",
  setPieces: "pelota parada",
  duels: "duelos",
  physicalEmotional: "fisico/emocional",
  systemLineup: "sistema",
};

export function guardCoachAdvice(
  advice: CoachMatchAdvice,
  {
    userInput,
    evidenceCatalog,
  }: {
    userInput: string;
    evidenceCatalog: GuardEvidence[];
  },
): CoachMatchAdvice {
  const assessment = assessCoachAdviceTrust(advice, {
    userInput,
    evidenceCatalog,
  });

  if (!assessment.notes.length) return advice;

  return {
    ...advice,
    reflection: {
      ...advice.reflection,
      mainUncertainty: appendNote(
        advice.reflection.mainUncertainty,
        assessment.notes.join(" "),
      ),
      confidence: Math.min(advice.reflection.confidence, assessment.confidenceCap),
    },
  };
}

export function assessCoachAdviceTrust(
  advice: CoachMatchAdvice,
  {
    userInput,
    evidenceCatalog,
  }: {
    userInput: string;
    evidenceCatalog: GuardEvidence[];
  },
): CoachTrustAssessment {
  const expectedDomains = inferDomainsFromText(userInput);
  const adviceText = [
    advice.tacticalReading,
    advice.probableCause,
    advice.mainAdjustment,
    advice.wednesdayTest,
    advice.saturdayFocus,
  ].join(" ");
  const adviceDomains = inferDomainsFromText(adviceText);
  const missingPrimaryDomain = expectedDomains.some(
    (domain) => !adviceDomains.includes(domain),
  );
  const citedIds = new Set(advice.evidenceCitations.map((citation) => citation.sourceId));
  const citedEvidence = evidenceCatalog.filter((item) => citedIds.has(item.id));
  const citationCount = citedEvidence.length;
  const hasCitation = citationCount > 0;
  const currentEvidenceCount = citedEvidence.filter((item) =>
    ["observation", "video"].includes(item.sourceType),
  ).length;
  const hasCaseEvidence = currentEvidenceCount > 0;
  const hasOnlyHistoricalOrContextEvidence = hasCitation && currentEvidenceCount === 0;
  const reliesMostlyOnMemoryOrPrinciples =
    hasCitation &&
    citedEvidence.every((item) => ["knowledge", "memory"].includes(item.sourceType));
  const missingCitationRisk = citationCount === 0;
  const hasHistoricalEvidence = citedEvidence.some((item) =>
    ["report", "memory"].includes(item.sourceType),
  );
  const makesStrongClaim = advice.reflection.confidence >= 0.68 || [
    advice.probableCause,
    advice.mainAdjustment,
    advice.wednesdayTest,
    advice.saturdayFocus,
  ].some((text) =>
    /\b(confirmad|evident|claro|principal|seguro|debe|hay que)\b/i.test(text),
  );

  const uncertaintyNotes: string[] = [];
  let confidenceCap = advice.reflection.confidence;

  if (missingPrimaryDomain) {
    uncertaintyNotes.push(
      `Guard: la respuesta puede estar derivando de fase; el pedido apunta a ${expectedDomains
        .map((domain) => DOMAIN_LABELS[domain])
        .join(", ")}.`,
    );
    confidenceCap = Math.min(confidenceCap, 0.52);
  }

  if (missingCitationRisk) {
    uncertaintyNotes.push(
      "Guard: no hay citas validas de evidencia/knowledge en la salida; no elevar confianza.",
    );
    confidenceCap = Math.min(confidenceCap, 0.45);
  }

  if (!currentEvidenceCount) {
    uncertaintyNotes.push(
      hasHistoricalEvidence
        ? "Guard: no hay evidencia actual citada; la lectura depende de memoria o reportes previos."
        : "Guard: no hay evidencia actual citada; mantener como hipotesis.",
    );
    confidenceCap = Math.min(confidenceCap, 0.55);
  }

  if (reliesMostlyOnMemoryOrPrinciples) {
    uncertaintyNotes.push(
      "Guard: la salida se apoya sobre todo en memoria o principios tacticos; no tratarla como diagnostico cerrado.",
    );
    confidenceCap = Math.min(confidenceCap, 0.5);
  }

  if (hasOnlyHistoricalOrContextEvidence && makesStrongClaim) {
    uncertaintyNotes.push(
      "Guard: la respuesta hace afirmaciones fuertes sin evidencia actual del caso; usar como hipotesis.",
    );
    confidenceCap = Math.min(confidenceCap, 0.48);
  }

  return {
    notes: uncertaintyNotes,
    confidenceCap,
    missingPrimaryDomain,
    hasCitation,
    citationCount,
    currentEvidenceCount,
    hasCaseEvidence,
    hasOnlyHistoricalOrContextEvidence,
    missingCitationRisk,
    reliesMostlyOnMemoryOrPrinciples,
    makesStrongClaim,
    requiresHypothesisMode:
      missingPrimaryDomain ||
      missingCitationRisk ||
      currentEvidenceCount === 0 ||
      reliesMostlyOnMemoryOrPrinciples ||
      (hasOnlyHistoricalOrContextEvidence && makesStrongClaim),
  };
}

function appendNote(current: string, note: string) {
  return current.trim() ? `${current.trim()} ${note}` : note;
}

// ────────────────────────────────────────────────────────────────────────────
// Board fact firewall (slice 4 task 4)
//
// Structure-vs-claim ONLY. Every decision is a lookup by `boardClaimId` against
// the packet's `factualClaims`, then field checks. ZERO prose parsing here.
// `copiedValues` only makes sense for positive support — that asymmetry is the
// spine of the whole guard.
// ────────────────────────────────────────────────────────────────────────────

export type BoardFactAuditReason =
  | "unknown-id"
  | "ungrounded-support"
  | "field-incompatible"
  | "value-mismatch"
  | "missing-copied-values"
  | "ignored-values-on-limitation";

export type BoardFactAudit = {
  boardClaimId: string;
  use: CoachBoardClaimReference["use"];
  reason: BoardFactAuditReason;
  // true ONLY for an invalidated use:"supportingFact" ref → drove the downgrade.
  invalidatedSupport: boolean;
};

export type BoardFactFirewallResult = {
  // SANITIZED: invalid refs stripped, limitation values stripped, downgrade
  // ALREADY APPLIED (lowered confidence/cap is part of THIS object).
  response: CoachResponse;
  audit: BoardFactAudit[];
  // convenience flag === (any supportingFact invalidated)
  downgraded: boolean;
};

const DOWNGRADE_CONFIDENCE = 0.3;

type CopiedValues = NonNullable<CoachBoardClaimReference["copiedValues"]>;

// The numeric fields that legitimately belong to each claim kind. Anything else
// present in `copiedValues` — a typed foreign field OR an unknown junk key — is
// incompatible. Kept as readonly string[] so we can test by membership.
const ZONE_COUNT_FIELDS: readonly string[] = ["own", "rival", "delta"];
const COVERAGE_FIELDS: readonly string[] = ["covering"];

function compatibleFieldsFor(claim: BoardFactualClaim): readonly string[] {
  return claim.kind === "zone-count" ? ZONE_COUNT_FIELDS : COVERAGE_FIELDS;
}

// Any present key that is NOT a compatible field for the claim's kind. We iterate
// the keys ACTUALLY present at runtime (not the TS type), so adversarial junk like
// `ghost` is caught — never rely on the static type to exclude unknown keys.
function isFieldIncompatible(
  claim: BoardFactualClaim,
  copiedValues: CopiedValues,
): boolean {
  const allowed = compatibleFieldsFor(claim);
  const present = copiedValues as Record<string, unknown>;
  return Object.keys(present).some(
    (key) => present[key] !== undefined && !allowed.includes(key),
  );
}

// At least one kind-compatible field is actually present (and defined). Covers the
// `{}` case and a copiedValues whose only keys are compatible-but-undefined.
function hasCompatibleField(
  claim: BoardFactualClaim,
  copiedValues: CopiedValues,
): boolean {
  const present = copiedValues as Record<string, unknown>;
  return compatibleFieldsFor(claim).some((key) => present[key] !== undefined);
}

// Rebuild copiedValues FRESH from the AUTHORITATIVE claim: include only the
// compatible fields the ref attempted to copy, each value sourced FROM THE CLAIM.
// The ref's own numbers are never passed through. Precondition: not incompatible,
// ≥1 compatible field present, no value mismatch — so the result is always a
// schema-clean copiedValues (≥1 numeric key, no foreign keys).
function reconstructCopiedValues(
  claim: BoardFactualClaim,
  copiedValues: CopiedValues,
): CopiedValues {
  const present = copiedValues as Record<string, unknown>;
  const out: CopiedValues = {};
  if (claim.kind === "zone-count") {
    if (present.own !== undefined) out.own = claim.own;
    if (present.rival !== undefined) out.rival = claim.rival;
    if (present.delta !== undefined) out.delta = claim.delta;
    return out;
  }
  if (present.covering !== undefined) out.covering = claim.covering;
  return out;
}

// Only kind-compatible present fields are checked; each must equal the source.
function hasValueMismatch(
  claim: BoardFactualClaim,
  copiedValues: CopiedValues,
): boolean {
  if (claim.kind === "zone-count") {
    if (copiedValues.own !== undefined && copiedValues.own !== claim.own) return true;
    if (copiedValues.rival !== undefined && copiedValues.rival !== claim.rival) return true;
    if (copiedValues.delta !== undefined && copiedValues.delta !== claim.delta) return true;
    return false;
  }
  return copiedValues.covering !== undefined && copiedValues.covering !== claim.covering;
}

function findClaim(
  packet: BoardEvidencePacket,
  id: string,
): BoardFactualClaim | undefined {
  return packet.boardEvidence.factualClaims.find((claim) => claim.id === id);
}

// Outcome for a single reference: either keep a (possibly trimmed) ref, or strip
// it; optionally emit one audit entry.
type RefOutcome = {
  keep?: CoachBoardClaimReference;
  audit?: BoardFactAudit;
};

function evaluateSupportingFact(
  ref: CoachBoardClaimReference,
  packet: BoardEvidencePacket,
): RefOutcome {
  const id = ref.boardClaimId;
  const invalid = (reason: BoardFactAuditReason): RefOutcome => ({
    audit: { boardClaimId: id, use: "supportingFact", reason, invalidatedSupport: true },
  });

  // Deterministic priority order — first failure decides the reason.
  // 1. unknown id.
  if (!isBoardFactualClaimId(packet, id)) return invalid("unknown-id");
  const claim = findClaim(packet, id);
  // claim is guaranteed present (isBoardFactualClaimId passed) — narrow for TS.
  if (!claim) return invalid("unknown-id");
  // 2. positive support REQUIRES copiedValues (closes the citation-only launder).
  if (ref.copiedValues === undefined) return invalid("missing-copied-values");
  // 3. any foreign/unknown key present (incl. runtime junk like `ghost`).
  if (isFieldIncompatible(claim, ref.copiedValues)) return invalid("field-incompatible");
  // 4. no kind-compatible field present (covers `{}` and compatible-but-undefined).
  if (!hasCompatibleField(claim, ref.copiedValues)) return invalid("missing-copied-values");
  // 5. ungrounded support.
  if (claim.grounded === false) return invalid("ungrounded-support");
  // 6. any compatible present field ≠ the source value.
  if (hasValueMismatch(claim, ref.copiedValues)) return invalid("value-mismatch");
  // Keep — but rebuild copiedValues FROM THE CLAIM so the displayed numbers can
  // only ever originate from authoritative board evidence, never from the ref.
  return {
    keep: {
      boardClaimId: ref.boardClaimId,
      use: ref.use,
      copiedValues: reconstructCopiedValues(claim, ref.copiedValues),
    },
  };
}

function evaluateLimitation(
  ref: CoachBoardClaimReference,
  packet: BoardEvidencePacket,
): RefOutcome {
  const id = ref.boardClaimId;
  // Unknown id → strip, audit, NO downgrade.
  if (!isBoardFactualClaimId(packet, id)) {
    return {
      audit: { boardClaimId: id, use: "limitation", reason: "unknown-id", invalidatedSupport: false },
    };
  }
  // Exists WITH copiedValues → ignore the values: strip them off the kept ref so
  // they can never render or count as fact. Keep the (honest) limitation itself.
  if (ref.copiedValues !== undefined) {
    return {
      keep: { boardClaimId: ref.boardClaimId, use: ref.use },
      audit: {
        boardClaimId: id,
        use: "limitation",
        reason: "ignored-values-on-limitation",
        invalidatedSupport: false,
      },
    };
  }
  // Exists, no copiedValues → keep as-is. A limitation on grounded:false is legit.
  return { keep: ref };
}

function evaluateQuestionTrigger(
  ref: CoachBoardClaimReference,
  packet: BoardEvidencePacket,
): RefOutcome {
  const id = ref.boardClaimId;
  // Unknown id → strip, audit, NO downgrade.
  if (!isBoardFactualClaimId(packet, id)) {
    return {
      audit: { boardClaimId: id, use: "questionTrigger", reason: "unknown-id", invalidatedSupport: false },
    };
  }
  // copiedValues present + (field-incompatible OR value-mismatch) → strip, audit.
  if (ref.copiedValues !== undefined) {
    const claim = findClaim(packet, id);
    if (claim) {
      if (isFieldIncompatible(claim, ref.copiedValues)) {
        return {
          audit: {
            boardClaimId: id,
            use: "questionTrigger",
            reason: "field-incompatible",
            invalidatedSupport: false,
          },
        };
      }
      if (hasValueMismatch(claim, ref.copiedValues)) {
        return {
          audit: {
            boardClaimId: id,
            use: "questionTrigger",
            reason: "value-mismatch",
            invalidatedSupport: false,
          },
        };
      }
    }
  }
  // Otherwise → keep, NO downgrade.
  return { keep: ref };
}

function evaluateReference(
  ref: CoachBoardClaimReference,
  packet: BoardEvidencePacket,
): RefOutcome {
  switch (ref.use) {
    case "supportingFact":
      return evaluateSupportingFact(ref, packet);
    case "limitation":
      return evaluateLimitation(ref, packet);
    case "questionTrigger":
      return evaluateQuestionTrigger(ref, packet);
  }
}

/**
 * Structure-vs-claim firewall for board-derived facts in a coach response.
 * Returns a fresh sanitized `response` (downgrade already baked in) plus a
 * categorized `audit` and a `downgraded` convenience flag. Never mutates input.
 */
export function applyBoardFactFirewall(
  response: CoachResponse,
  packet: BoardEvidencePacket,
): BoardFactFirewallResult {
  // `question` has no advice → nothing to sanitize. Pure passthrough.
  if (response.mode === "question") {
    return { response, audit: [], downgraded: false };
  }

  const audit: BoardFactAudit[] = [];
  const keptFacts: CoachBoardClaimReference[] = [];

  for (const ref of response.advice.supportingFacts) {
    const outcome = evaluateReference(ref, packet);
    if (outcome.audit) audit.push(outcome.audit);
    if (outcome.keep) keptFacts.push(outcome.keep);
  }

  // Downgrade keys on `use`, NOT on array membership: only an invalidated
  // supportingFact can lower confidence. An honest limitation never does.
  const downgraded = audit.some((entry) => entry.invalidatedSupport);

  const baseConfidence = response.advice.reflection.confidence;
  const confidence = downgraded
    ? Math.min(baseConfidence, DOWNGRADE_CONFIDENCE)
    : baseConfidence;

  const sanitizedAdvice: CoachMatchAdvice = {
    ...response.advice,
    reflection: { ...response.advice.reflection, confidence },
    supportingFacts: keptFacts,
  };

  if (response.mode === "hypothesis") {
    const confidenceCap = downgraded
      ? Math.min(response.confidenceCap, DOWNGRADE_CONFIDENCE)
      : response.confidenceCap;
    return {
      response: { ...response, advice: sanitizedAdvice, confidenceCap },
      audit,
      downgraded,
    };
  }

  // diagnosis: no confidenceCap to lower.
  return {
    response: { ...response, advice: sanitizedAdvice },
    audit,
    downgraded,
  };
}
