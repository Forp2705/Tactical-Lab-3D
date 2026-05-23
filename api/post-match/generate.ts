import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  methodNotAllowed,
  readJsonBody,
  safeErrorStatus,
  sendJson,
} from "../../src/server/api";

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
      "../../src/ai/post-match/generatePostMatchReport"
    );
    const report = await generatePostMatchReport(body);
    sendJson(res, 200, report);
  } catch (error) {
    console.error("[post-match] generate failed", error);
    sendJson(res, safeErrorStatus(error), {
      error:
        error instanceof ZodError
          ? "Invalid post-match input."
          : "Post-match report generation failed.",
    });
  }
}
