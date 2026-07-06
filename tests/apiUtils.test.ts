import { describe, expect, it } from "vitest";
import { compactErrorForLog, publicServerError } from "../api/_utils";

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

describe("compactErrorForLog", () => {
  it("incluye message + status/code del provider cuando existen", () => {
    const error = Object.assign(new Error("429 Too Many Requests"), {
      status: 429,
      code: "rate_limited",
    });

    expect(compactErrorForLog(error)).toBe(
      "429 Too Many Requests | status=429 | code=rate_limited",
    );
  });

  it("NO incluye stack ni headers aunque el error los tenga", () => {
    const error = Object.assign(new Error("boom"), {
      status: 500,
      headers: { "x-request-id": "secret-header-value" },
    });
    error.stack = "Error: boom\n    at providerFrame (/srv/provider.js:1:1)";

    const line = compactErrorForLog(error);
    expect(line).toBe("boom | status=500");
    expect(line).not.toContain("secret-header-value");
    expect(line).not.toContain("providerFrame");
  });

  it("stringifica no-Errors sin romper", () => {
    expect(compactErrorForLog("plain failure")).toBe("plain failure");
    expect(compactErrorForLog(undefined)).toBe("undefined");
  });
});
