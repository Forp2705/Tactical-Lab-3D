import { describe, expect, it } from "vitest";
import { scanProseForBoardContradictions } from "@/ai/coachProseScan";

describe("scanProseForBoardContradictions (secondary net, telemetry-only)", () => {
  it("flags an obvious numeric contradiction against a rendered fact", () => {
    const prose = "tenés 5 contra 1 en la presión alta, dominás";
    const renderedFacts = [
      { id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" },
    ];

    const flags = scanProseForBoardContradictions(prose, renderedFacts);

    expect(flags).toHaveLength(1);
    expect(flags[0].claimId).toBe("press");
  });

  it("returns no flags when there are no rendered facts to contradict", () => {
    const prose = "tenés 5 contra 1 en la presión alta, dominás";

    expect(scanProseForBoardContradictions(prose, [])).toEqual([]);
  });

  it("does not flag prose that restates the same numbers as the fact", () => {
    const prose = "en la presión alta tenés 3 contra 2, mantené eso";
    const renderedFacts = [
      { id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" },
    ];

    expect(scanProseForBoardContradictions(prose, renderedFacts)).toEqual([]);
  });

  it("does not flag prose that mentions a different zone than any rendered fact", () => {
    const prose = "en la salida tenés 5 contra 1, dominás";
    const renderedFacts = [
      { id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" },
    ];

    expect(scanProseForBoardContradictions(prose, renderedFacts)).toEqual([]);
  });
});
