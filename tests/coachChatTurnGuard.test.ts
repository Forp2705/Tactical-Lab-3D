// W22 — deterministic honesty guard for chat turns. `grounded: true` REQUIRES at
// least one evidenceRef whose sourceId exists in the evidence catalog; invented or
// unknown ids are dropped, and a claim of "grounded" with no valid citation is
// downgraded to grounded:false. You cannot claim evidence-backed without evidence.
import { describe, expect, it } from "vitest";
import { finalizeCoachChatTurn } from "../src/ai/CoachAgent";
import type { CoachChatTurn } from "../src/ai/CoachChatSchemas";

const catalog = [
  {
    id: "REP-espalda-lateral",
    sourceType: "report" as const,
    title: "Reporte",
    excerpt: "Daño por la espalda del lateral.",
    score: 0.8,
  },
];

function turn(over: Partial<CoachChatTurn>): CoachChatTurn {
  return {
    mode: "chat",
    reply: "respuesta",
    grounded: true,
    followUpQuestions: [],
    evidenceRefs: [],
    ...over,
  };
}

describe("finalizeCoachChatTurn — grounded requires real citations", () => {
  it("keeps grounded:true when it cites a catalog id", () => {
    const result = finalizeCoachChatTurn(
      turn({
        grounded: true,
        evidenceRefs: [
          { sourceType: "report", sourceId: "REP-espalda-lateral" },
        ],
      }),
      catalog,
    );
    expect(result.grounded).toBe(true);
    expect(result.evidenceRefs).toHaveLength(1);
  });

  it("drops invented ids and downgrades grounded to false when nothing valid remains", () => {
    const result = finalizeCoachChatTurn(
      turn({
        grounded: true,
        evidenceRefs: [{ sourceType: "report", sourceId: "REP-inventado" }],
      }),
      catalog,
    );
    expect(result.evidenceRefs).toHaveLength(0);
    expect(result.grounded).toBe(false);
  });

  it("keeps grounded:false untouched (clarifying turn)", () => {
    const result = finalizeCoachChatTurn(
      turn({ grounded: false, evidenceRefs: [] }),
      catalog,
    );
    expect(result.grounded).toBe(false);
  });
});
