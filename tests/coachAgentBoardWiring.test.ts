import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestBoardScenarioTurn } from "@/ai/coachAgentClient";
import {
  buildBoardEvidencePacket,
  type BoardEvidencePacket,
} from "@/board/boardEvidencePacket";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { raiseBlockScene, raiseBlockSim } from "./fixtures/raiseBlockFixtures";

const packet: BoardEvidencePacket = buildBoardEvidencePacket(
  buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)),
);

// A minimal but VALID CoachResponse (mode: "question") so the 200-happy-path
// parse succeeds.
const validCoachResponse = {
  mode: "question",
  intent: {
    domains: ["defense"],
    specificity: "general",
    requestType: "diagnosis",
    impliedClaims: [],
  },
  selectedQuestions: [],
  blockedClaims: [],
  evidenceAudit: {
    covered: [],
    missing: [{ target: "cause", reason: "Falta confirmar la causa." }],
    criticalMissingCount: 1,
    evidenceStrength: "none",
  },
  confidenceCap: 0.4,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function assertEveryCallCarriedPacket() {
  for (const call of fetchMock.mock.calls) {
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.boardEvidence).toBeDefined();
    expect(body.boardEvidence.source).toBe("boardScenario");
  }
}

describe("requestBoardScenarioTurn — honest, one-shot, no packet-less fallback", () => {
  it("posts boardEvidence in the body and returns a parsed CoachResponse on 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, validCoachResponse));

    const result = await requestBoardScenarioTurn("¿Qué te parece?", packet);

    expect(result.mode).toBe("question");
    expect(fetchMock.mock.calls.length).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/coach-agent");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.boardEvidence).toMatchObject({ source: "boardScenario" });
    expect(body.input).toBe("¿Qué te parece?");
  });

  it("on 400 INVALID_BOARD_EVIDENCE → throws, exactly one fetch, packet always present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        code: "INVALID_BOARD_EVIDENCE",
        error: "Invalid boardEvidence packet",
      }),
    );

    await expect(
      requestBoardScenarioTurn("q", packet),
    ).rejects.toThrow();
    expect(fetchMock.mock.calls.length).toBe(1);
    assertEveryCallCarriedPacket();
  });

  it("on 500 → throws, exactly one fetch, no packet-less retry", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: "boom" }),
    );

    await expect(requestBoardScenarioTurn("q", packet)).rejects.toThrow();
    expect(fetchMock.mock.calls.length).toBe(1);
    assertEveryCallCarriedPacket();
  });

  it("on a network reject (fetch throws) → throws, exactly one fetch", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(requestBoardScenarioTurn("q", packet)).rejects.toThrow();
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it("on a 200 with an invalid/garbage body → throws (honest), no second call", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { mode: "garbage", lol: true }),
    );

    await expect(requestBoardScenarioTurn("q", packet)).rejects.toThrow();
    expect(fetchMock.mock.calls.length).toBe(1);
    assertEveryCallCarriedPacket();
  });
});
