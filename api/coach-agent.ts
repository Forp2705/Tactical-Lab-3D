import type { IncomingMessage, ServerResponse } from "node:http";
import {
  badRequest,
  methodNotAllowed,
  readJsonBody,
  sendJson,
} from "../src/server/api";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  let input = "";

  try {
    const body = await readJsonBody(req);
    input = typeof body.input === "string" ? body.input.trim() : "";
  } catch {
    badRequest(res, "Invalid JSON body");
    return;
  }

  if (!input) {
    badRequest(res, "Input is required");
    return;
  }

  try {
    const { generateCoachResponse } = await import("../src/ai/CoachAgent");
    const advice = await generateCoachResponse(input);
    sendJson(res, 200, advice);
  } catch (error) {
    console.error("[coach-agent] request failed", error);
    sendJson(res, 500, {
      error: "Coach agent failed to generate a response.",
    });
  }
}
