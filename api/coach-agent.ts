import type { IncomingMessage, ServerResponse } from "node:http";
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

  try {
    const body = await readJsonBody(req);
    input = typeof body.input === "string" ? body.input.trim() : "";
    coachContext = body.coachContext ?? body.shapeContext;
  } catch {
    badRequest(res, "Invalid JSON body");
    return;
  }

  if (!input) {
    badRequest(res, "Input is required");
    return;
  }

  try {
    const { generateCoachResponse } = await import("../src/ai/CoachAgent.js");
    const advice = await generateCoachResponse(input, coachContext);
    sendJson(res, 200, advice);
  } catch (error) {
    console.error("[coach-agent] request failed", error);
    const response = publicServerError(
      error,
      "Coach agent failed to generate a response.",
    );
    sendJson(res, response.status, response.payload);
  }
}
