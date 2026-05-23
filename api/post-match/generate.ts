import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  methodNotAllowed,
  publicServerError,
  readJsonBody,
  safeErrorStatus,
  sendJson,
} from "../_utils.js";

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
    const { generatePostMatchReport } = await import(
      "../../src/ai/post-match/generatePostMatchReport.js"
    );
    const report = await generatePostMatchReport(body);
    sendJson(res, 200, report);
  } catch (error) {
    console.error("[post-match] generate failed", error);
    if (error instanceof ZodError) {
      sendJson(res, safeErrorStatus(error), {
        code: "invalid_post_match_input",
        error: "Invalid post-match input.",
      });
      return;
    }

    const response = publicServerError(
      error,
      "Post-match report generation failed.",
    );
    sendJson(res, response.status, response.payload);
  }
}
