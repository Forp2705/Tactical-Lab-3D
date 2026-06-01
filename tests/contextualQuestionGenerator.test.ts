import { describe, expect, it } from "vitest";
import { generateContextualQuestions } from "../src/ai/contextualQuestionGenerator";

describe("contextualQuestionGenerator", () => {
  it("devuelve preguntas relevantes y acotadas si el input defensivo es vago", async () => {
    const result = await generateContextualQuestions(
      {
        userInput: "Mi equipo defiende como el orto",
        evidenceCatalog: [],
        collectedEvidence: [],
        priorIntent: null,
        priorClaims: [],
      },
      async () => {
        throw new Error("LLM unavailable in unit test");
      },
    );

    expect(result.recommendedResponseMode).toBe("question");
    expect(result.selectedQuestions.length).toBeGreaterThanOrEqual(2);
    expect(result.selectedQuestions.length).toBeLessThanOrEqual(3);
    expect(result.selectedQuestions.every((question) => question.category === "defense")).toBe(
      true,
    );
    expect(result.confidenceCap).toBeLessThanOrEqual(0.55);
  });
});
