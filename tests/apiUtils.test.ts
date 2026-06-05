import { describe, expect, it } from "vitest";
import { publicServerError } from "../api/_utils";

describe("publicServerError", () => {
  it("clasifica rate limits de OpenRouter", () => {
    const response = publicServerError(
      new Error("429 Too Many Requests: rate limit exceeded"),
      "fallback",
    );

    expect(response.status).toBe(429);
    expect(response.payload).toMatchObject({
      code: "openrouter_rate_limited",
    });
  });

  it("clasifica cuota o creditos agotados", () => {
    const response = publicServerError(
      new Error("Insufficient credits or quota"),
      "fallback",
    );

    expect(response.status).toBe(402);
    expect(response.payload).toMatchObject({
      code: "openrouter_quota_exhausted",
    });
  });

  it("clasifica respuestas sin choices", () => {
    const response = publicServerError(
      new Error("OpenRouter no devolvio choices"),
      "fallback",
    );

    expect(response.status).toBe(502);
    expect(response.payload).toMatchObject({
      code: "openrouter_empty_choices",
    });
  });
});
