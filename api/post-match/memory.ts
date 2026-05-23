import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import {
  methodNotAllowed,
  readJsonBody,
  safeErrorStatus,
  sendJson,
} from "../../src/server/api.js";

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
    const { commitMemoryCandidates } = await import(
      "../../src/ai/post-match/storage.js"
    );
    const result = await commitMemoryCandidates(body);
    sendJson(res, 200, result);
  } catch (error) {
    console.error("[post-match] memory commit failed", error);
    sendJson(res, safeErrorStatus(error), {
      error:
        error instanceof ZodError
          ? "Invalid memory candidate payload."
          : "Memory candidates could not be committed.",
    });
  }
}
