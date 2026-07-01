import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";

type RequestWithBody = IncomingMessage & {
  body?: unknown;
};

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req: RequestWithBody) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}") as Record<string, unknown>;
  }

  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }

  const rawBody = await readBody(req);
  return JSON.parse(rawBody || "{}") as Record<string, unknown>;
}

export function methodNotAllowed(res: ServerResponse) {
  sendJson(res, 405, { error: "Method not allowed" });
}

export function badRequest(res: ServerResponse, error: string) {
  sendJson(res, 400, { error });
}

export function safeErrorStatus(error: unknown) {
  return error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
}

export function publicServerError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (message.includes("Missing OPENROUTER_API_KEY")) {
    return {
      status: 503,
      payload: {
        code: "missing_openrouter_key",
        error:
          "OpenRouter is not configured. Set OPENROUTER_API_KEY in the server environment and restart the app.",
      },
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("429") ||
    normalized.includes("too many requests")
  ) {
    return {
      status: 429,
      payload: {
        code: "openrouter_rate_limited",
        error:
          "OpenRouter rate-limited the request. Wait a moment or use a fallback model.",
      },
    };
  }

  if (
    normalized.includes("quota") ||
    normalized.includes("credit") ||
    normalized.includes("insufficient")
  ) {
    return {
      status: 402,
      payload: {
        code: "openrouter_quota_exhausted",
        error:
          "OpenRouter has no available quota or credits for this request.",
      },
    };
  }

  if (
    message.includes("Unexpected token") ||
    error instanceof SyntaxError ||
    error instanceof ZodError ||
    normalized.includes("coach response is empty") ||
    normalized.includes("no json object") ||
    normalized.includes("invalid json")
  ) {
    return {
      status: 502,
      payload: {
        code: "invalid_model_json",
        error:
          "The model returned an invalid JSON response. Try again or use a stricter model.",
      },
    };
  }

  if (
    message.includes("401") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid api key")
  ) {
    return {
      status: 502,
      payload: {
        code: "openrouter_unauthorized",
        error:
          "OpenRouter rejected the request. Check OPENROUTER_API_KEY in the server environment.",
      },
    };
  }

  if (
    normalized.includes("no devolvio choices") ||
    normalized.includes("did not return choices")
  ) {
    return {
      status: 502,
      payload: {
        code: "openrouter_empty_choices",
        error:
          "OpenRouter returned no completion choices. Retry or switch model.",
      },
    };
  }

  if (
    normalized.includes("response_format") ||
    normalized.includes("json_object") ||
    normalized.includes("json mode")
  ) {
    return {
      status: 502,
      payload: {
        code: "openrouter_json_mode_unsupported",
        error:
          "The configured model does not support JSON mode. Use another model or disable JSON mode fallback.",
      },
    };
  }

  if (normalized.includes("model") || message.includes("404")) {
    return {
      status: 502,
      payload: {
        code: "openrouter_model_error",
        error:
          "OpenRouter could not use the configured model. Check OPENROUTER_MODEL.",
      },
    };
  }

  return {
    status: safeErrorStatus(error),
    payload: { code: "server_error", error: fallbackMessage },
  };
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
