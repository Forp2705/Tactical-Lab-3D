import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig, loadEnv } from "vite";
import { ZodError } from "zod";
import type { CoachMatchAdvice } from "./src/ai/CoachSchemas";

type GeminiProxyEnv = {
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GEMINI_MODEL?: string;
  // Flag explicita: el endpoint Gemini es legacy y queda desactivado salvo
  // que se ponga ENABLE_GEMINI=true. El camino principal del coach es OpenRouter.
  ENABLE_GEMINI?: string;
};

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

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage) {
  const rawBody = await readBody(req);
  return JSON.parse(rawBody || "{}") as Record<string, unknown>;
}

function statusForError(error: unknown) {
  return error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
}

function geminiProxy(env: GeminiProxyEnv): Plugin {
  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    env.GEMINI_API_KEY ??
    env.GOOGLE_API_KEY;
  const model =
    process.env.GEMINI_MODEL ?? env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  return {
    name: "tactical-lab-gemini-proxy",
    configureServer(server) {
      server.middlewares.use("/api/ai/gemini", async (req, res) => {
        res.setHeader("content-type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        if (!apiKey) {
          res.end(
            JSON.stringify({
              ok: false,
              configured: false,
              error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY",
            }),
          );
          return;
        }

        try {
          const rawBody = await readBody(req);
          const body = JSON.parse(rawBody || "{}") as { prompt?: string };
          const prompt = body.prompt?.trim();

          if (!prompt) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing prompt" }));
            return;
          }

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

          const payload = await upstream.json();
          if (!upstream.ok) {
            res.end(
              JSON.stringify({
                ok: false,
                error: payload?.error?.message ?? "Gemini request failed",
                status: upstream.status,
              }),
            );
            return;
          }

          const text =
            payload?.candidates?.[0]?.content?.parts
              ?.map((part: { text?: string }) => part.text ?? "")
              .join("\n")
              .trim() ?? "";

          res.end(JSON.stringify({ ok: true, model, text }));
        } catch (error) {
          res.end(
            JSON.stringify({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Gemini proxy error",
            }),
          );
        }
      });
    },
  };
}

function coachAgentProxy(): Plugin {
  return {
    name: "tactical-lab-coach-agent-proxy",
    configureServer(server) {
      server.middlewares.use("/api/coach-agent", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        let input = "";

        try {
          const rawBody = await readBody(req);
          const body = JSON.parse(rawBody || "{}") as { input?: unknown };
          input = typeof body.input === "string" ? body.input.trim() : "";
        } catch {
          sendJson(res, 400, { error: "Invalid JSON body" });
          return;
        }

        if (!input) {
          sendJson(res, 400, { error: "Input is required" });
          return;
        }

        try {
          const module = await server.ssrLoadModule("/src/ai/CoachAgent.ts");
          const { generateCoachResponse } = module as {
            generateCoachResponse: (
              userInput: string,
            ) => Promise<CoachMatchAdvice>;
          };
          const advice = await generateCoachResponse(input);
          sendJson(res, 200, advice);
        } catch (error) {
          console.error("[coach-agent] request failed", error);
          sendJson(res, 500, {
            error: "Coach agent failed to generate a response.",
          });
        }
      });

      server.middlewares.use("/api/post-match/generate", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const module = await server.ssrLoadModule(
            "/src/ai/post-match/generatePostMatchReport.ts",
          );
          const { generatePostMatchReport } = module as {
            generatePostMatchReport: (input: unknown) => Promise<unknown>;
          };
          const report = await generatePostMatchReport(body);
          sendJson(res, 200, report);
        } catch (error) {
          console.error("[post-match] generate failed", error);
          sendJson(res, statusForError(error), {
            error:
              error instanceof ZodError
                ? "Invalid post-match input."
                : "Post-match report generation failed.",
          });
        }
      });

      server.middlewares.use("/api/post-match/reports", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const module = await server.ssrLoadModule(
            "/src/ai/post-match/storage.ts",
          );
          const { savePostMatchReport } = module as {
            savePostMatchReport: (payload: unknown) => Promise<unknown>;
          };
          const savedReport = await savePostMatchReport(body);
          sendJson(res, 200, savedReport);
        } catch (error) {
          console.error("[post-match] save failed", error);
          sendJson(res, statusForError(error), {
            error:
              error instanceof ZodError
                ? "Invalid report payload."
                : "Post-match report could not be saved.",
          });
        }
      });

      server.middlewares.use("/api/post-match/memory", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const module = await server.ssrLoadModule(
            "/src/ai/post-match/storage.ts",
          );
          const { commitMemoryCandidates } = module as {
            commitMemoryCandidates: (payload: unknown) => Promise<unknown>;
          };
          const result = await commitMemoryCandidates(body);
          sendJson(res, 200, result);
        } catch (error) {
          console.error("[post-match] memory commit failed", error);
          sendJson(res, statusForError(error), {
            error:
              error instanceof ZodError
                ? "Invalid memory candidate payload."
                : "Memory candidates could not be committed.",
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "") as GeminiProxyEnv;

  const geminiEnabled =
    (process.env.ENABLE_GEMINI ?? env.ENABLE_GEMINI) === "true";

  return {
    plugins: [
      react(),
      ...(geminiEnabled ? [geminiProxy(env)] : []),
      coachAgentProxy(),
    ],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Separamos las dependencias pesadas en vendor chunks con nombre
          // propio. Mejora el cacheo entre deploys y hace honesto el reporte de
          // tamano (antes "three" caia dentro de un chunk llamado Pitch3D).
          // No cambia el lazy-loading: estos paquetes solo los importan vistas
          // que ya se cargan bajo demanda.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (
              id.includes("/three/") ||
              id.includes("@react-three") ||
              id.includes("postprocessing")
            ) {
              return "three-vendor";
            }
            if (id.includes("@react-pdf") || id.includes("react-pdf")) {
              return "pdf-vendor";
            }
            if (id.includes("@ffmpeg")) {
              return "ffmpeg-vendor";
            }
            return undefined;
          },
        },
      },
    },
  };
});
