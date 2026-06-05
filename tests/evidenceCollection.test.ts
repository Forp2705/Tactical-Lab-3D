import { describe, expect, it } from "vitest";
import {
  buildEvidenceAudit,
  capConfidence,
  normalizeCollectedEvidence,
} from "../src/ai/evidenceCollection";
import type { ImpliedClaim, TacticalIntent } from "../src/ai/CoachSchemas";

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

describe("evidenceCollection", () => {
  it("convierte respuestas del usuario en evidencia y sube strength", () => {
    const signals = normalizeCollectedEvidence([
      {
        questionId: "q1",
        evidenceTarget: "cause",
        category: "defense",
        answerKind: "shortText",
        rawAnswer: "Los volantes saltan y la defensa no achica.",
      },
      {
        questionId: "q2",
        evidenceTarget: "zone",
        category: "defense",
        answerKind: "singleChoice",
        rawAnswer: "Por dentro",
      },
      {
        questionId: "q3",
        evidenceTarget: "ownTeam",
        category: "defense",
        answerKind: "singleChoice",
        rawAnswer: "Es problema propio.",
      },
    ]);

    const audit = buildEvidenceAudit({
      claims,
      signals,
      retrieved: [],
      intent,
    });

    expect(audit.evidenceStrength).toBe("sufficient");
    expect(audit.criticalMissingCount).toBe(0);
    expect(capConfidence(0.9, audit, false)).toBe(0.9);
  });

  it("limita la confianza si no hay evidencia", () => {
    const audit = buildEvidenceAudit({
      claims,
      signals: [],
      retrieved: [],
      intent,
    });

    expect(audit.evidenceStrength).toBe("none");
    expect(capConfidence(0.9, audit, false)).toBeLessThanOrEqual(0.45);
  });

  it("no cuenta respuestas inciertas como evidencia cubierta", () => {
    const signals = normalizeCollectedEvidence([
      {
        questionId: "q1",
        evidenceTarget: "cause",
        category: "defense",
        answerKind: "singleChoice",
        rawAnswer: "No estoy seguro",
      },
      {
        questionId: "q2",
        evidenceTarget: "zone",
        category: "defense",
        answerKind: "singleChoice",
        rawAnswer: "Depende de la jugada",
      },
    ]);

    expect(signals).toEqual([]);
  });

  it("no trata reportes historicos recuperados como causa confirmada", () => {
    const audit = buildEvidenceAudit({
      claims,
      signals: [],
      retrieved: [
        {
          id: "REP-1",
          sourceType: "report",
          title: "2026-05-20 vs Rival",
          excerpt: "El equipo sufrio a la espalda del bloque.",
          score: 0.2,
        },
      ],
      intent,
    });

    expect(audit.evidenceStrength).not.toBe("sufficient");
    expect(audit.missing.map((item) => item.target)).toContain("cause");
  });
});
