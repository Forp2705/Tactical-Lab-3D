import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  methodNotAllowed,
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
    const { savePostMatchReport } = await import(
      "../../src/ai/post-match/storage.js"
    );
    const savedReport = await savePostMatchReport(body);
    sendJson(res, 200, savedReport);
  } catch (error) {
    console.error("[post-match] save failed", error);
    sendJson(res, safeErrorStatus(error), {
      error:
        error instanceof ZodError
          ? "Invalid report payload."
          : "Post-match report could not be saved.",
    });
  }
}
