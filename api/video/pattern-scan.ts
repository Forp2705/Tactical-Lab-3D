import type { IncomingMessage, ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import {
  VIDEO_PATTERN_DEFINITIONS,
  VideoPatternScanBatchResponseSchema,
} from "../../src/video/videoPatternScan.js";
import {
  badRequest,
  methodNotAllowed,
  publicServerError,
  readJsonBody,
  sendJson,
} from "../_utils.js";

const FrameSchema = z.object({
  timestampSec: z.number().min(0),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/),
});

const PatternScanRequestSchema = z.object({
  matchId: z.string().min(1).default("current-match"),
  ownTeam: z.string().optional(),
  ownColor: z.string().optional(),
  rivalColor: z.string().optional(),
  attackDirectionFirstHalf: z
    .enum(["leftToRight", "rightToLeft", "unknown"])
    .default("unknown"),
  patterns: z.array(z.string()).min(1),
  frames: z.array(FrameSchema).min(1).max(8),
});

const MAX_RESPONSE_REPAIR_ATTEMPTS = 1;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, {
      code: "missing_openai_key",
      error:
        "OpenAI vision is not configured. Set OPENAI_API_KEY to run Video Pattern Scan.",
    });
    return;
  }

  let payload: z.infer<typeof PatternScanRequestSchema>;
  try {
    payload = PatternScanRequestSchema.parse(await readJsonBody(req));
  } catch {
    badRequest(res, "Invalid video pattern scan input.");
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const selectedDefinitions = VIDEO_PATTERN_DEFINITIONS.filter((definition) =>
      payload.patterns.includes(definition.id),
    );
    const allowedPatterns = new Set(selectedDefinitions.map((item) => item.id));
    const allowedTimes = payload.frames.map((frame) => frame.timestampSec);
    const raw = await runVisionBatch(client, payload, selectedDefinitions);
    const parsed = parseModelJson(raw);
    let response = VideoPatternScanBatchResponseSchema.parse(parsed);

    for (let attempt = 0; attempt < MAX_RESPONSE_REPAIR_ATTEMPTS; attempt += 1) {
      if (response.frameFindings.length) break;
      const repairedRaw = await runVisionBatch(
        client,
        payload,
        selectedDefinitions,
        "La respuesta anterior no incluyo frameFindings. Devolve JSON valido con un item por frame, aunque no haya hallazgos.",
      );
      response = VideoPatternScanBatchResponseSchema.parse(
        parseModelJson(repairedRaw),
      );
    }

    sendJson(
      res,
      200,
      normalizeBatchResponse(response, allowedTimes, allowedPatterns),
    );
  } catch (error) {
    console.error("[video-pattern-scan] request failed", error);
    const response = publicServerError(
      error,
      "Video pattern scan failed to analyze the sampled frames.",
    );
    sendJson(res, response.status, response.payload);
  }
}

async function runVisionBatch(
  client: OpenAI,
  payload: z.infer<typeof PatternScanRequestSchema>,
  selectedDefinitions: typeof VIDEO_PATTERN_DEFINITIONS[number][],
  repairInstruction?: string,
) {
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini";
  const prompt = [
    "Sos analista tactico de video para un cuerpo tecnico chico.",
    "Analiza frames sueltos de un partido. No hay tracking continuo ni identidad confiable de jugadores.",
    "Tu tarea es detectar patrones tacticos visibles con prudencia, usando solo lo que se ve en los frames.",
    "Si falta evidencia, deja findings vacio para ese frame o baja la confianza.",
    "No inventes eventos entre frames. No declares certeza por una imagen aislada.",
    "",
    `Partido: ${payload.matchId}`,
    payload.ownTeam ? `Equipo observado: ${payload.ownTeam}` : "",
    payload.ownColor ? `Color equipo observado: ${payload.ownColor}` : "",
    payload.rivalColor ? `Color rival: ${payload.rivalColor}` : "",
    `Direccion de ataque 1T: ${payload.attackDirectionFirstHalf}`,
    "",
    "Patrones a buscar:",
    ...selectedDefinitions.map(
      (definition) => `- ${definition.id} (${definition.label}): ${definition.prompt}`,
    ),
    "",
    "Frames incluidos:",
    ...payload.frames.map(
      (frame, index) => `Imagen ${index + 1}: timestampSec=${frame.timestampSec}`,
    ),
    "",
    "Formato obligatorio: JSON sin markdown con esta forma exacta:",
    JSON.stringify({
      batchSummary: "lectura corta del lote",
      frameFindings: [
        {
          timestampSec: 123,
          phase: "fase observada",
          uncertainty: "limitacion si aplica",
          findings: [
            {
              patternId: "team-stretched",
              label: "Equipo largo",
              confidence: 0.64,
              evidence: "que se ve en el frame",
              zone: "zona si se puede inferir",
              severity: "medium",
            },
          ],
        },
      ],
    }),
    repairInstruction ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Devolve solo JSON valido. Usa espanol claro y tactico. No agregues texto fuera del JSON.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...payload.frames.map((frame) => ({
            type: "image_url" as const,
            image_url: { url: frame.imageDataUrl, detail: "low" as const },
          })),
        ],
      },
    ],
  });

  return completion.choices[0]?.message.content ?? "{}";
}

function parseModelJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

function normalizeBatchResponse(
  response: z.infer<typeof VideoPatternScanBatchResponseSchema>,
  allowedTimes: number[],
  allowedPatterns: Set<string>,
) {
  return {
    ...response,
    frameFindings: response.frameFindings
      .map((frame) => ({
        ...frame,
        timestampSec: nearestTimestamp(frame.timestampSec, allowedTimes),
        findings: frame.findings
          .filter((finding) => allowedPatterns.has(finding.patternId))
          .map((finding) => ({
            ...finding,
            confidence: clamp(finding.confidence, 0, 1),
          })),
      }))
      .filter((frame) => allowedTimes.includes(frame.timestampSec)),
  };
}

function nearestTimestamp(value: number, allowedTimes: number[]) {
  return allowedTimes.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
