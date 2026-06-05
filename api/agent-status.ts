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
    embeddingsConfigured: Boolean(process.env.OPENAI_API_KEY),
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions:
      Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 512,
    visionConfigured: Boolean(process.env.OPENAI_API_KEY),
    visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    ),
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
