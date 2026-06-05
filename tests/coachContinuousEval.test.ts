import { describe, expect, it } from "vitest";
import { COACH_EVAL_CASES } from "../src/ai/eval/coachEvalCases";
import { runDeterministicCoachEval } from "../src/ai/eval/runCoachContinuousEval";

describe("continuous coach eval", () => {
  it("bloquea regresiones graves con un gate deterministico", () => {
    const result = runDeterministicCoachEval({
      cases: COACH_EVAL_CASES.slice(0, 8),
      minScore: 0.6,
    });

    expect(result.totalCases).toBe(8);
    expect(result.failed).toBe(0);
    expect(result.avgScore).toBeGreaterThanOrEqual(0.6);
  });
});
