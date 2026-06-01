import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CoachInterviewStateSchema,
  CollectedAnswerSchema,
  type CoachInterviewState,
  type CollectedAnswer,
} from "../src/ai/CoachSchemas.js";
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

  try {
    const body = await readJsonBody(req);
    input = typeof body.input === "string" ? body.input.trim() : "";
    coachContext = body.coachContext ?? body.shapeContext;
    const collectedEvidenceResult = CollectedAnswerSchema.array().safeParse(
      body.collectedEvidence,
    );
    const interviewStateResult = CoachInterviewStateSchema.nullable().safeParse(
      body.interviewState ?? null,
    );
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
    const response = await runCoachTurn({
      input,
      coachContext,
      collectedEvidence,
      interviewState,
      skipInterview,
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
