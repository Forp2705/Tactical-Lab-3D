import type { IncomingMessage, ServerResponse } from "node:http";
import {
  methodNotAllowed,
  publicServerError,
  sendJson,
} from "./_utils.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  try {
    const { loadCoachObservabilitySnapshot } = await import(
      "../src/ai/coachObservability.js"
    );
    sendJson(res, 200, await loadCoachObservabilitySnapshot());
  } catch (error) {
    const response = publicServerError(
      error,
      "Coach observability snapshot could not be loaded.",
    );
    sendJson(res, response.status, response.payload);
  }
}
