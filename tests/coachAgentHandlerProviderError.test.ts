// W8 (mc-17) — higiene del fallo de provider en api/coach-agent.ts.
//
// Fija dos contratos cuando `runCoachTurn` revienta con un error del provider
// (el SDK adjunta status/code/headers y el stack de Node):
//   1. La respuesta HTTP sigue saliendo sanitizada por publicServerError:
//      ni stack, ni headers del provider, ni el message crudo en el body.
//   2. El log server-side por default es COMPACTO (message + status/code +
//      model + duracion) — sin headers del provider ni stack. El dump crudo
//      solo aparece con COACH_AGENT_DEBUG=1.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runCoachTurnMock } = vi.hoisted(() => ({
  runCoachTurnMock: vi.fn(),
}));

// Mismo especificador que usa el handler en su import dinamico (ver
// coachAgentHandlerBoardGate.test.ts para el detalle de por que resuelve).
vi.mock("../src/ai/CoachAgent.js", () => ({
  runCoachTurn: runCoachTurnMock,
}));

import handler from "../api/coach-agent.js";

// Marcadores que NO pueden aparecer ni en el body HTTP ni en el log default.
const SECRET_HEADER_NAME = "x-provider-request-id";
const SECRET_HEADER_VALUE = "leaky-provider-header-value";
const STACK_MARKER = "at fakeProviderFrame";

function buildProviderError(): Error {
  const error = new Error("401 Unauthorized: invalid api key");
  error.stack = `Error: 401 Unauthorized: invalid api key\n    ${STACK_MARKER} (/srv/provider.js:1:1)`;
  return Object.assign(error, {
    status: 401,
    code: "invalid_api_key",
    headers: { [SECRET_HEADER_NAME]: SECRET_HEADER_VALUE },
  });
}

function makeReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as Parameters<
    typeof handler
  >[0];
  const captured: { statusCode: number; raw: string; json: unknown } = {
    statusCode: 0,
    raw: "",
    json: undefined,
  };
  const res = {
    get statusCode() {
      return captured.statusCode;
    },
    set statusCode(code: number) {
      captured.statusCode = code;
    },
    setHeader() {
      /* no-op */
    },
    end(chunk?: string) {
      captured.raw = chunk ?? "";
      captured.json = chunk ? JSON.parse(chunk) : undefined;
    },
  } as unknown as Parameters<typeof handler>[1];
  return { req, res, captured };
}

function loggedText(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls
    .map((call) =>
      call
        .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
        .join(" "),
    )
    .join("\n");
}

describe(
  "api/coach-agent handler — provider failure hygiene",
  { timeout: 20000 },
  () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      runCoachTurnMock.mockReset();
      runCoachTurnMock.mockRejectedValue(buildProviderError());
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it("la respuesta HTTP queda sanitizada: sin stack, sin headers del provider, sin message crudo", async () => {
      const { req, res, captured } = makeReqRes({
        input: "¿Como presionamos?",
      });

      await handler(req, res);

      expect(captured.statusCode).toBe(502);
      expect(captured.json).toMatchObject({ code: "openrouter_unauthorized" });
      expect(captured.raw).not.toContain(STACK_MARKER);
      expect(captured.raw).not.toContain(SECRET_HEADER_NAME);
      expect(captured.raw).not.toContain(SECRET_HEADER_VALUE);
      expect(captured.raw).not.toContain("invalid api key");
    });

    it("log default compacto: message + status/code, SIN headers ni stack del provider", async () => {
      vi.stubEnv("COACH_AGENT_DEBUG", "");
      const { req, res } = makeReqRes({ input: "¿Como presionamos?" });

      await handler(req, res);

      const logged = loggedText(consoleErrorSpy);
      expect(logged).toContain("[coach-agent] request failed:");
      expect(logged).toContain("401 Unauthorized: invalid api key");
      expect(logged).toContain("status=401");
      expect(logged).toContain("code=invalid_api_key");
      expect(logged).toContain("durationMs=");
      expect(logged).not.toContain(SECRET_HEADER_VALUE);
      expect(logged).not.toContain(SECRET_HEADER_NAME);
      expect(logged).not.toContain(STACK_MARKER);
    });

    it("COACH_AGENT_DEBUG=1 vuelca el error crudo (diagnostico local explicito)", async () => {
      vi.stubEnv("COACH_AGENT_DEBUG", "1");
      const { req, res } = makeReqRes({ input: "¿Como presionamos?" });

      await handler(req, res);

      const dumpCall = consoleErrorSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("debug dump"),
      );
      expect(dumpCall).toBeDefined();
      const dumped = dumpCall?.[1] as Error & {
        headers?: Record<string, string>;
      };
      expect(dumped).toBeInstanceOf(Error);
      expect(dumped.stack).toContain(STACK_MARKER);
      expect(dumped.headers?.[SECRET_HEADER_NAME]).toBe(SECRET_HEADER_VALUE);
    });
  },
);
