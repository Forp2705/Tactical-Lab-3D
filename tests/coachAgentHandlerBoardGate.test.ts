// LOCK 1 (slice 4) — drive the ACTUAL api/coach-agent.ts default handler and
// prove the absent / valid / malformed board-evidence distinction in ONE suite.
//
// The handler does `await import("../src/ai/CoachAgent.js")` and calls
// `runCoachTurn`. We mock that module so `runCoachTurn` is a spy we can assert
// call/no-call + args on. The VALID case proves the spy binds (it is reached and
// receives the parsed packet); that is what makes the malformed case's
// `not.toHaveBeenCalled()` a meaningful, NON-vacuous assertion.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBoardEvidencePacket,
  type BoardEvidencePacket,
} from "@/board/boardEvidencePacket";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { raiseBlockScene, raiseBlockSim } from "./fixtures/raiseBlockFixtures";

// Hoisted spy so the mock factory and the assertions share the same fn instance.
const { runCoachTurnMock } = vi.hoisted(() => ({
  runCoachTurnMock: vi.fn(),
}));

// Mock the module by the SAME specifier the handler imports. From this test file
// `../src/ai/CoachAgent.js` resolves to the same absolute module as the handler's
// `../src/ai/CoachAgent.js` (both → src/ai/CoachAgent.ts), so the dynamic import
// inside the handler is intercepted.
vi.mock("../src/ai/CoachAgent.js", () => ({
  runCoachTurn: runCoachTurnMock,
}));

// Imported AFTER the mock (vitest hoists vi.mock above imports anyway). The
// handler's CoachAgent dependency is dynamically imported, so the stub applies.
import handler from "../api/coach-agent.js";

// The handler does not re-validate runCoachTurn's output — it forwards it to
// sendJson. A minimal believable response is enough.
const COACH_RESPONSE = { mode: "question" };

function buildValidPacket(): BoardEvidencePacket {
  return buildBoardEvidencePacket(
    buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)),
  );
}

// Minimal req/res mirroring how _utils `sendJson` writes:
//   res.statusCode = code; res.setHeader(...); res.end(JSON.stringify(payload));
// `readJsonBody` accepts `req.body` as an object directly (no stream mocking).
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

describe("api/coach-agent handler — board-evidence gate (absent/valid/malformed)", () => {
  beforeEach(() => {
    runCoachTurnMock.mockReset();
    runCoachTurnMock.mockResolvedValue(COACH_RESPONSE);
  });

  it("absent: no boardEvidence in body → runCoachTurn called once with boardEvidence === null, 200", async () => {
    const { req, res, captured } = makeReqRes({ input: "¿Subimos el bloque?" });

    await handler(req, res);

    expect(runCoachTurnMock).toHaveBeenCalledTimes(1);
    expect(runCoachTurnMock.mock.calls[0][0].boardEvidence).toBeNull();
    expect(captured.statusCode).toBe(200);
  });

  it("valid: a real built packet → runCoachTurn called once with the parsed packet (proves the spy binds), 200", async () => {
    const packet = buildValidPacket();
    const { req, res, captured } = makeReqRes({
      input: "¿Subimos el bloque?",
      boardEvidence: packet,
    });

    await handler(req, res);

    expect(runCoachTurnMock).toHaveBeenCalledTimes(1);
    // Forwarded boardEvidence is the SCHEMA-PARSED packet, deep-equal to input.
    expect(runCoachTurnMock.mock.calls[0][0].boardEvidence).toEqual(packet);
    expect(captured.statusCode).toBe(200);
  });

  it("malformed: bad boardEvidence → 400 INVALID_BOARD_EVIDENCE and runCoachTurn NEVER called", async () => {
    const { req, res, captured } = makeReqRes({
      input: "¿Subimos el bloque?",
      boardEvidence: { source: "boardScenario", boardEvidence: {} },
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(400);
    expect(captured.json).toMatchObject({ code: "INVALID_BOARD_EVIDENCE" });
    // Non-vacuous: the VALID case above proved the spy is reachable; a malformed
    // packet must short-circuit to 400 BEFORE the coach is ever invoked.
    expect(runCoachTurnMock).not.toHaveBeenCalled();
  });
});
