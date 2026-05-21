import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig, loadEnv } from "vite";

type GeminiProxyEnv = {
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GEMINI_MODEL?: string;
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "") as GeminiProxyEnv;

  return {
    plugins: [react(), geminiProxy(env)],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
