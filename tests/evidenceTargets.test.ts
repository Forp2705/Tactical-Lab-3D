import { describe, expect, it } from "vitest";
import { inferEvidenceTargets } from "../src/ai/evidenceTargets";
import { buildEvidenceAudit } from "../src/ai/evidenceCollection";
import type { ImpliedClaim, TacticalIntent } from "../src/ai/CoachSchemas";

describe("evidence target inference", () => {
  it("infiere targets tacticos desde texto de evidencia", () => {
    const targets = inferEvidenceTargets(
      "12:31 video: el bloque queda largo por dentro tras perdida y el rival juega a la espalda",
    );

    expect(targets).toContain("moment");
    expect(targets).toContain("zone");
    expect(targets).toContain("trigger");
    expect(targets).toContain("rival");
  });

  it("buildEvidenceAudit usa evidenceTargets concretos antes del sourceType", () => {
    const audit = buildEvidenceAudit({
      claims,
      signals: [],
      retrieved: [
        {
          id: "VID-1",
          sourceType: "video",
          title: "Video evidence",
          excerpt: "Bloque largo por dentro tras perdida",
          score: 0.9,
          evidenceTargets: ["cause", "zone", "ownTeam"],
        },
      ],
      intent,
    });

    expect(audit.evidenceStrength).toBe("sufficient");
  });
});

const intent: TacticalIntent = {
  domains: ["defense"],
  specificity: "specific",
  requestType: "diagnosis",
  impliedClaims: [],
};

const claims: ImpliedClaim[] = [
  {
    id: "claim_defense_cause",
    claim: "La causa defensiva esta confirmada.",
    domain: "defense",
    subject: "own",
    riskIfWrong: "high",
    requiredEvidence: ["cause", "zone", "ownTeam"],
  },
];
