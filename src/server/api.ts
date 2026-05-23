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
