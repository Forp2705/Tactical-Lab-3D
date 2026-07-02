// LOCK — mc-21 w2 B: drive the ACTUAL api/coach-agent.ts default handler and
// prove the absent / valid / malformed freeStateEvidence distinction, same
// pattern as coachAgentHandlerBoardGate.test.ts (slice 4's boardEvidence gate).
//
// The handler does `await import("../src/ai/CoachAgent.js")` and calls
// `runCoachTurn`. We mock that module so `runCoachTurn` is a spy we can assert
// call/no-call + args on. The VALID case proves the spy binds (it is reached
// and receives the parsed packet as `freeStateEvidence`, per the interface the
// coordinator defined for this bridge); that is what makes the malformed
// case's `not.toHaveBeenCalled()` a meaningful, NON-vacuous assertion.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBoardFreeStateEvidencePacket,
  type BoardFreeStateEvidencePacket,
} from "@/board/boardFreeStateEvidencePacket";
import { createDefaultBoard } from "@/board";

const { runCoachTurnMock } = vi.hoisted(() => ({
  runCoachTurnMock: vi.fn(),
}));

vi.mock("../src/ai/CoachAgent.js", () => ({
  runCoachTurn: runCoachTurnMock,
}));

import handler from "../api/coach-agent.js";

const COACH_RESPONSE = { mode: "question" };

function buildValidPacket(): BoardFreeStateEvidencePacket {
  const board = createDefaultBoard("Test");
  return buildBoardFreeStateEvidencePacket(
    board,
    board.scenes[0],
    "4-3-3",
    new Set(["attack"]),
  );
}

function makeReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as Parameters<
    typeof handler
  >[0];
  const captured: { statusCode: number; json: unknown } = {
    statusCode: 0,
    json: undefined,
  };
  const res = {
    get statusCode() {
      return captured.statusCode;
    },
    set statusCode(code: number) {
      captured.statusCode = code;
    },
    setHeader() {
      /* no-op */
    },
    end(chunk?: string) {
      captured.json = chunk ? JSON.parse(chunk) : undefined;
    },
  } as unknown as Parameters<typeof handler>[1];
  return { req, res, captured };
}

describe("api/coach-agent handler — free-state evidence gate (absent/valid/malformed)", () => {
  beforeEach(() => {
    runCoachTurnMock.mockReset();
    runCoachTurnMock.mockResolvedValue(COACH_RESPONSE);
  });

  it("absent: no freeStateEvidence in body -> runCoachTurn called once with freeStateEvidence === null, 200", async () => {
    const { req, res, captured } = makeReqRes({ input: "Que te parece la escena?" });

    await handler(req, res);

    expect(runCoachTurnMock).toHaveBeenCalledTimes(1);
    expect(runCoachTurnMock.mock.calls[0][0].freeStateEvidence).toBeNull();
    expect(captured.statusCode).toBe(200);
  });

  it("valid: a real built packet -> runCoachTurn called once with freeStateEvidence = the parsed packet, 200", async () => {
    const packet = buildValidPacket();
    const { req, res, captured } = makeReqRes({
      input: "Que te parece la escena?",
      freeStateEvidence: packet,
    });

    await handler(req, res);

    expect(runCoachTurnMock).toHaveBeenCalledTimes(1);
    // Forwarded against the coordinator-defined interface: the exact field
    // name/shape runCoachTurn will read once mc-17's branch lands.
    expect(runCoachTurnMock.mock.calls[0][0].freeStateEvidence).toEqual(packet);
    // boardEvidence (the other, unrelated packet) stays independently null.
    expect(runCoachTurnMock.mock.calls[0][0].boardEvidence).toBeNull();
    expect(captured.statusCode).toBe(200);
  });

  it("malformed: bad freeStateEvidence -> 400 INVALID_FREE_STATE_EVIDENCE and runCoachTurn NEVER called", async () => {
    const { req, res, captured } = makeReqRes({
      input: "Que te parece la escena?",
      freeStateEvidence: { source: "boardFreeState", freeStateEvidence: {} },
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(400);
    expect(captured.json).toMatchObject({ code: "INVALID_FREE_STATE_EVIDENCE" });
    // Non-vacuous: the VALID case above proved the spy is reachable; a
    // malformed packet must short-circuit to 400 BEFORE the coach runs.
    expect(runCoachTurnMock).not.toHaveBeenCalled();
  });

  it("malformed freeStateEvidence short-circuits even when boardEvidence is absent and vice versa (independent gates)", async () => {
    const { req, res, captured } = makeReqRes({
      input: "x",
      boardEvidence: { source: "boardScenario", boardEvidence: {} },
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(400);
    expect(captured.json).toMatchObject({ code: "INVALID_BOARD_EVIDENCE" });
    expect(runCoachTurnMock).not.toHaveBeenCalled();
  });
});
