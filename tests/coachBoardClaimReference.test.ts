import { describe, it, expect } from "vitest";
import { CoachBoardClaimReferenceSchema, CoachMatchAdviceSchema } from "@/ai/CoachSchemas";

describe("CoachBoardClaimReference + supportingFacts (additive, anti-launder)", () => {
  it("parses a valid reference with copiedValues", () => {
    const r = CoachBoardClaimReferenceSchema.parse({
      boardClaimId: "press", use: "supportingFact", copiedValues: { own: 3, rival: 2, delta: 1 },
    });
    expect(r.use).toBe("supportingFact");
  });

  it("parses a reference with no copiedValues (optional)", () => {
    expect(CoachBoardClaimReferenceSchema.parse({ boardClaimId: "gap", use: "limitation" }).boardClaimId).toBe("gap");
  });

  it("REJECTS a present-but-empty copiedValues (anti-launder)", () => {
    expect(CoachBoardClaimReferenceSchema.safeParse({ boardClaimId: "press", use: "supportingFact", copiedValues: {} }).success).toBe(false);
  });

  it("REJECTS non-numeric copiedValues fields", () => {
    expect(CoachBoardClaimReferenceSchema.safeParse({ boardClaimId: "press", use: "supportingFact", copiedValues: { own: "3" } }).success).toBe(false);
  });

  it("REJECTS a reference missing boardClaimId or with empty string", () => {
    expect(CoachBoardClaimReferenceSchema.safeParse({ use: "supportingFact" }).success).toBe(false);
    expect(CoachBoardClaimReferenceSchema.safeParse({ boardClaimId: "", use: "supportingFact" }).success).toBe(false);
  });

  it("advice without supportingFacts still parses, defaulting to []", () => {
    const advice = CoachMatchAdviceSchema.parse({
      tacticalReading: "t", probableCause: "c", mainAdjustment: "m",
      onFieldInstructions: [], wednesdayTest: "w", saturdayFocus: "s",
      adjustmentRisks: [], successSignals: [],
      reflection: { mainUncertainty: "u", missingInformation: "i", alternativeInterpretation: "a", confidence: 0.4 },
    });
    expect(advice.supportingFacts).toEqual([]);
  });
});
