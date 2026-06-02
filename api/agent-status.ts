import type { IncomingMessage, ServerResponse } from "node:http";
import { methodNotAllowed, sendJson } from "./_utils.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  sendJson(res, 200, {
    ok: true,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    openRouterModel:
      process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    ),
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
