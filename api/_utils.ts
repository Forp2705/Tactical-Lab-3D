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

  if (message.includes("Missing OPENROUTER_API_KEY")) {
    return {
      status: 503,
      payload: {
        code: "missing_openrouter_key",
        error:
          "OpenRouter is not configured. Set OPENROUTER_API_KEY in Vercel environment variables and redeploy.",
      },
    };
  }

  if (message.includes("Unexpected token") || error instanceof SyntaxError) {
    return {
      status: 502,
      payload: {
        code: "invalid_model_json",
        error:
          "The model returned an invalid JSON response. Try again or use a stricter model.",
      },
    };
  }

  if (message.includes("401") || message.includes("Unauthorized")) {
    return {
      status: 502,
      payload: {
        code: "openrouter_unauthorized",
        error:
          "OpenRouter rejected the request. Check OPENROUTER_API_KEY in Vercel.",
      },
    };
  }

  if (message.includes("model") || message.includes("404")) {
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
