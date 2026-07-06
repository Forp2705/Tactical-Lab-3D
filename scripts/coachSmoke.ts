// Smoke real OPT-IN contra /api/coach-agent (ver docs/qa/coach-smoke.md).
//
// Corre el handler serverless REAL sobre node:http (sin Vercel CLI, sin mocks):
// request HTTP real -> handler real -> CoachAgent real -> OpenRouter real.
// Por eso es opt-in: requiere OPENROUTER_API_KEY, cuesta tokens y no es
// determinista. NO corre en CI; sin key hace SKIP explicito con exit 0.
//
// Higiene: jamas imprimir valores de env ni headers de request — con UNA
// excepcion deliberada: COACH_SMOKE_TIMEOUT_MS (no es secreto y ver el timeout
// efectivo en el header ayuda al diagnostico). Los errores del endpoint ya
// salen sanitizados por api/_utils.ts (publicServerError).

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import dotenv from "dotenv";

// No pisa env ya seteado: el runner puede inyectar la key por env var sin
// necesitar un .env.local en disco.
dotenv.config({ path: ".env.local", quiet: true });

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

// Timeout tunable por env (COACH_SMOKE_TIMEOUT_MS) sin tocar codigo. Un valor
// invalido NO se ignora en silencio: cae al default y se reporta en el output.
function resolveRequestTimeoutMs(): {
  timeoutMs: number;
  invalidRaw: string | null;
} {
  const raw = process.env.COACH_SMOKE_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === "") {
    return { timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS, invalidRaw: null };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS, invalidRaw: raw };
  }
  return { timeoutMs: Math.floor(parsed), invalidRaw: null };
}

const SMOKE_INPUT =
  "Nos estan lastimando con pelotas filtradas a la espalda del lateral " +
  "derecho en transicion defensiva. Que ajuste rapido priorizas sin cambiar " +
  "el dibujo?";

async function main(): Promise<number> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log(
      "SKIP: falta OPENROUTER_API_KEY (smoke opt-in, ver docs/qa/coach-smoke.md)",
    );
    return 0;
  }

  // Imports despues del gate: sin key no se toca nada del agente.
  const [{ default: coachHandler }, { default: statusHandler }, schemas] =
    await Promise.all([
      import("../api/coach-agent.js"),
      import("../api/agent-status.js"),
      import("../src/ai/CoachSchemas.js"),
    ]);

  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/api/coach-agent") {
      void coachHandler(req, res);
      return;
    }
    if (pathname === "/api/agent-status") {
      void statusHandler(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const { timeoutMs, invalidRaw } = resolveRequestTimeoutMs();

  try {
    console.log(`[coach-smoke] runtime local en ${baseUrl} (puerto efimero)`);
    if (invalidRaw !== null) {
      console.log(
        `[coach-smoke] COACH_SMOKE_TIMEOUT_MS="${invalidRaw}" invalido (se espera un numero de ms > 0); usando default ${DEFAULT_REQUEST_TIMEOUT_MS}ms`,
      );
    }
    console.log(
      `[coach-smoke] POST /api/coach-agent (timeout efectivo ${timeoutMs / 1000}s)...`,
    );

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/coach-agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // skipInterview: sin el, una consulta sin evidencia cae en el flujo de
        // preguntas (deterministico, NO llama al provider) y el smoke daria un
        // PASS falso sin haber tocado OpenRouter. Forzamos el camino real
        // handler -> CoachAgent -> completion.
        body: JSON.stringify({ input: SMOKE_INPUT, skipInterview: true }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      console.error(
        isTimeout
          ? `FAIL: /api/coach-agent no respondio en ${timeoutMs / 1000}s`
          : `FAIL: request a /api/coach-agent fallo: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
    const latencyMs = Date.now() - startedAt;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      console.error(
        `FAIL: status ${response.status} con body no-JSON (latencia ${latencyMs}ms)`,
      );
      return 1;
    }

    if (!response.ok) {
      // El payload de error ya viene sanitizado por publicServerError.
      console.error(
        `FAIL: status ${response.status} (latencia ${latencyMs}ms) — ${JSON.stringify(payload)}`,
      );
      return 1;
    }

    const parsed = schemas.CoachResponseSchema.safeParse(payload);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      console.error(
        `FAIL: status 200 pero shape invalido segun CoachResponseSchema (latencia ${latencyMs}ms). Issues: ${issues}`,
      );
      return 1;
    }

    const topLevelFields = Object.keys(payload as Record<string, unknown>)
      .sort()
      .join(", ");
    console.log(
      `PASS: status ${response.status}, latencia ${latencyMs}ms, mode="${parsed.data.mode}"`,
    );
    console.log(`[coach-smoke] campos top-level validados: ${topLevelFields}`);
    return 0;
  } finally {
    server.close();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(
      `FAIL: error inesperado del smoke: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
