import type { IncomingMessage, ServerResponse } from "node:http";
import {
  badRequest,
  methodNotAllowed,
  readJsonBody,
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

  // Endpoint legacy: desactivado salvo ENABLE_GEMINI=true. El camino principal
  // del coach es OpenRouter (api/coach-agent.ts).
  if (process.env.ENABLE_GEMINI !== "true") {
    sendJson(res, 404, {
      ok: false,
      configured: false,
      error: "Gemini endpoint disabled (set ENABLE_GEMINI=true to enable).",
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  if (!apiKey) {
    sendJson(res, 200, {
      ok: false,
      configured: false,
      error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY",
    });
    return;
  }

  let prompt = "";

  try {
    const body = await readJsonBody(req);
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    badRequest(res, "Invalid JSON body");
    return;
  }

  if (!prompt) {
    badRequest(res, "Missing prompt");
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const payload = (await upstream.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      sendJson(res, 200, {
        ok: false,
        error: payload.error?.message ?? "Gemini request failed",
        status: upstream.status,
      });
      return;
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

    sendJson(res, 200, { ok: true, model, text });
  } catch (error) {
    console.error("[gemini] request failed", error);
    sendJson(res, 200, {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unknown Gemini proxy error",
    });
  }
}
