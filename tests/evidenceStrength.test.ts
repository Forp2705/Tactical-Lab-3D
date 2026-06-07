import { describe, expect, it } from "vitest";
import {
  classifyEvidenceStrength,
  hasCommitGradeEvidence,
  hasGroundingEvidence,
  type EvidenceLike,
} from "../src/ai/post-match/evidenceStrength";

describe("shared evidence-strength classification", () => {
  it("treats manual staff notes / plan as weak by default, never strong", () => {
    const staffOpinion: EvidenceLike = {
      source: "staffNotes",
      text: "Me parecio que el equipo se desordeno en transicion.",
    };
    const planOpinion: EvidenceLike = {
      source: "plan",
      text: "El plan preveia presionar alto en salida rival.",
    };

    expect(classifyEvidenceStrength(staffOpinion)).toBe("weak");
    expect(classifyEvidenceStrength(planOpinion)).toBe("weak");
  });

  it("upgrades manual evidence to moderate only when it names corroboration, never to strong", () => {
    const corroborated: EvidenceLike = {
      source: "staffNotes",
      text: "Patron repetido y confirmado por video en la segunda mitad.",
    };
    const validatedByStaff: EvidenceLike = {
      source: "plan",
      text: "Hipotesis validada por el staff tras revisar la previa.",
    };

    expect(classifyEvidenceStrength(corroborated)).toBe("moderate");
    expect(classifyEvidenceStrength(validatedByStaff)).toBe("moderate");
  });

  it("never classifies manual-only / unconfirmed text as strong, regardless of source", () => {
    const manualTag: EvidenceLike = {
      source: "tag",
      text: "Perdida en salida (observacion manual, no confirmada por video)",
      severity: "high",
    };
    const manualNotes: EvidenceLike = {
      source: "staffNotes",
      text: "Observacion manual: parecio flojo en la presion. Requiere validacion.",
    };

    expect(classifyEvidenceStrength(manualTag)).toBe("weak");
    expect(classifyEvidenceStrength(manualNotes)).toBe("weak");
  });

  it("classifies structured tag evidence by severity", () => {
    const high: EvidenceLike = { source: "tag", text: "Perdida y contragolpe", severity: "high" };
    const medium: EvidenceLike = { source: "tag", text: "Desorden en cobertura", severity: "medium" };
    const low: EvidenceLike = { source: "tag", text: "Detalle menor de posicionamiento", severity: "low" };

    expect(classifyEvidenceStrength(high)).toBe("strong");
    expect(classifyEvidenceStrength(medium)).toBe("moderate");
    expect(classifyEvidenceStrength(low)).toBe("weak");
  });

  it("treats the scoreline (result) as always weak grounding", () => {
    expect(classifyEvidenceStrength({ source: "result", text: "5-0" })).toBe("weak");
  });

  it("keeps the grounding bar (moderate+) and commit bar (strong, or moderate+validated) consistent and distinct", () => {
    const moderateNotes: EvidenceLike = {
      source: "staffNotes",
      text: "Patron repetido en las dos mitades, confirmado por video.",
    };
    const evidenceById = new Map<string, EvidenceLike>([["EV-NOTES", moderateNotes]]);
    const evidenceTexts = ["Aprendizaje sostenido por EV-NOTES"];

    // Moderate evidence is enough to ground a claim (not downgrade it)...
    expect(hasGroundingEvidence(evidenceTexts, evidenceById)).toBe(true);
    // ...but is NOT enough on its own to write to long-term memory...
    expect(
      hasCommitGradeEvidence(evidenceTexts, evidenceById, { allowValidatedModerate: false }),
    ).toBe(false);
    // ...unless the candidate itself represents a staff-validated repeating
    // pattern, which is the explicit "repeated patterns can upgrade
    // eligibility" path.
    expect(
      hasCommitGradeEvidence(evidenceTexts, evidenceById, { allowValidatedModerate: true }),
    ).toBe(true);
  });

  it("never lets manual-only weak evidence pass the commit bar, validated scope or not", () => {
    const manualOnly: EvidenceLike = {
      source: "staffNotes",
      text: "Observacion manual, no confirmada por video.",
    };
    const evidenceById = new Map<string, EvidenceLike>([["EV-NOTES", manualOnly]]);
    const evidenceTexts = ["Referencia a EV-NOTES"];

    expect(hasGroundingEvidence(evidenceTexts, evidenceById)).toBe(false);
    expect(
      hasCommitGradeEvidence(evidenceTexts, evidenceById, { allowValidatedModerate: true }),
    ).toBe(false);
  });

  it("grants strong evidence the same commit-grade pass regardless of allowValidatedModerate", () => {
    const strongTag: EvidenceLike = {
      source: "tag",
      text: "Perdida en salida y contragolpe directo",
      severity: "high",
    };
    const evidenceById = new Map<string, EvidenceLike>([["EV-TAG-1", strongTag]]);
    const evidenceTexts = ["Visto en EV-TAG-1"];

    expect(
      hasCommitGradeEvidence(evidenceTexts, evidenceById, { allowValidatedModerate: false }),
    ).toBe(true);
    expect(
      hasCommitGradeEvidence(evidenceTexts, evidenceById, { allowValidatedModerate: true }),
    ).toBe(true);
  });
});
