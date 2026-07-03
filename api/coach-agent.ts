import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CoachInterviewStateSchema,
  CollectedAnswerSchema,
  type CoachInterviewState,
  type CollectedAnswer,
} from "../src/ai/CoachSchemas.js";
import { parseIncomingBoardEvidence } from "../src/board/boardEvidencePacket.js";
import type { BoardEvidencePacket } from "../src/board/boardEvidencePacket.js";
import { parseIncomingBoardFreeState } from "../src/board/boardFreeStateEvidencePacket.js";
import type { BoardFreeStateEvidencePacket } from "../src/board/boardFreeStateEvidencePacket.js";
import {
  badRequest,
  methodNotAllowed,
  publicServerError,
  readJsonBody,
  sendJson,
} from "./_utils.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  let input = "";
  let coachContext: unknown;
  let collectedEvidence: CollectedAnswer[] = [];
  let interviewState: CoachInterviewState | null = null;
  let skipInterview = false;
  let boardEvidence: BoardEvidencePacket | null = null;
  let freeStateEvidence: BoardFreeStateEvidencePacket | null = null;

  try {
    const body = await readJsonBody(req);
    input = typeof body.input === "string" ? body.input.trim() : "";
    coachContext = body.coachContext ?? body.shapeContext;

    // Honesty gate: parse the optional board-evidence packet BEFORE the coach.
    // absent → no-op; valid → forward; malformed → HTTP 400. A malformed packet
    // must NEVER be silently dropped to "no packet" (that would let a non-grounded
    // answer masquerade as board-grounded). `parseIncomingBoardEvidence` is the
    // single source of truth — no parallel hand-rolled checks here.
    const boardEvidenceResult = parseIncomingBoardEvidence(body.boardEvidence);
    if (boardEvidenceResult.status === "malformed") {
      sendJson(res, 400, {
        code: "INVALID_BOARD_EVIDENCE",
        error: "Invalid boardEvidence packet",
      });
      return;
    }
    boardEvidence =
      boardEvidenceResult.status === "ok" ? boardEvidenceResult.packet : null;

    // Same honesty gate, additive (mc-21 w2 B): the free-state packet (asks
    // about the CURRENT scene, not a canned scenario). Same doctrine —
    // malformed never silently becomes "absent".
    const freeStateResult = parseIncomingBoardFreeState(
      body.freeStateEvidence,
    );
    if (freeStateResult.status === "malformed") {
      sendJson(res, 400, {
        code: "INVALID_FREE_STATE_EVIDENCE",
        error: "Invalid freeStateEvidence packet",
      });
      return;
    }
    freeStateEvidence =
      freeStateResult.status === "ok" ? freeStateResult.packet : null;
    const hasCollectedEvidence = Object.prototype.hasOwnProperty.call(
      body,
      "collectedEvidence",
    );
    const hasInterviewState = Object.prototype.hasOwnProperty.call(
      body,
      "interviewState",
    );
    const collectedEvidenceResult = CollectedAnswerSchema.array().safeParse(
      body.collectedEvidence,
    );
    const interviewStateResult = CoachInterviewStateSchema.nullable().safeParse(
      body.interviewState ?? null,
    );
    if (hasCollectedEvidence && !collectedEvidenceResult.success) {
      badRequest(res, "Invalid collectedEvidence format");
      return;
    }
    if (hasInterviewState && !interviewStateResult.success) {
      badRequest(res, "Invalid interviewState format");
      return;
    }
    collectedEvidence = collectedEvidenceResult.success
      ? collectedEvidenceResult.data
      : [];
    interviewState = interviewStateResult.success
      ? interviewStateResult.data
      : null;
    skipInterview = body.skipInterview === true;
  } catch {
    badRequest(res, "Invalid JSON body");
    return;
  }

  if (!input) {
    badRequest(res, "Input is required");
    return;
  }

  try {
    const { runCoachTurn } = await import("../src/ai/CoachAgent.js");
    // `runCoachTurn` now declares `freeStateEvidence` on its args (mc-17's param
    // branch is merged), so the packet forwards directly — no cast needed.
    const response = await runCoachTurn({
      input,
      coachContext,
      collectedEvidence,
      interviewState,
      skipInterview,
      boardEvidence,
      freeStateEvidence,
    });
    sendJson(res, 200, response);
  } catch (error) {
    console.error("[coach-agent] request failed", error);
    const response = publicServerError(
      error,
      "Coach agent failed to generate a response.",
    );
    sendJson(res, response.status, response.payload);
  }
}
