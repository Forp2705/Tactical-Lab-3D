import type { IncomingMessage, ServerResponse } from "node:http";
import {
  badRequest,
  methodNotAllowed,
  publicServerError,
  readJsonBody,
  sendJson,
} from "./_utils.js";

const ALLOWED_RATINGS = new Set([
  "useful",
  "weak",
  "invented",
  "missingEvidence",
  "goodExercise",
]);

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  try {
    const body = await readJsonBody(req);
    const rating = typeof body.rating === "string" ? body.rating : "";
    if (!ALLOWED_RATINGS.has(rating)) {
      badRequest(res, "Invalid feedback rating.");
      return;
    }
    const { recordCoachObservabilityEvent } = await import(
      "../src/ai/coachObservability.js"
    );
    await recordCoachObservabilityEvent({
      event: "feedback",
      feedbackRating: rating,
      mode: typeof body.responseMode === "string" ? body.responseMode : undefined,
      evidenceStrength:
        typeof body.evidenceStrength === "string" ? body.evidenceStrength : undefined,
      confidence:
        typeof body.confidence === "number" ? body.confidence : undefined,
      citationCount:
        typeof body.citationCount === "number" ? body.citationCount : undefined,
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const response = publicServerError(
      error,
      "Coach feedback could not be recorded.",
    );
    sendJson(res, response.status, response.payload);
  }
}
