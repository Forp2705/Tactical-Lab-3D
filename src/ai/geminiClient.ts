import { type AiContext, buildPrompt } from "./PromptBuilder";
import { fallbackPlan } from "./guardrails";
import { type AiPlan, AiPlanSchema } from "./outputSchemas";

type GeminiProxyResponse = {
  ok?: boolean;
  configured?: boolean;
  model?: string;
  text?: string;
  error?: string;
};

type UnknownRecord = Record<string, unknown>;

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "{}";

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export async function generateAiPlan(
  mode: AiPlan["mode"],
  context: AiContext,
): Promise<AiPlan> {
  const prompt = buildPrompt(mode, context);

  try {
    const response = await fetch("/api/ai/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, prompt }),
    });

    if (!response.ok) {
      return fallbackPlan(mode, context.selectedExercise.title);
    }

    const payload = (await response.json()) as GeminiProxyResponse;
    if (payload.ok === false || payload.configured === false) {
      return fallbackPlan(mode, context.selectedExercise.title);
    }

    const rawJson = extractJson(payload.text ?? "{}");
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallbackPlan(mode, context.selectedExercise.title);
    }

    return normalizeAiPlan(mode, parsed as UnknownRecord);
  } catch {
    return fallbackPlan(mode, context.selectedExercise.title);
  }
}

function normalizeAiPlan(mode: AiPlan["mode"], parsed: UnknownRecord): AiPlan {
  const planC = textOrUndefined(parsed.planC);

  return AiPlanSchema.parse({
    mode,
    assumptions: stringList(parsed.assumptions),
    confidence: confidenceValue(parsed.confidence),
    planA: textValue(parsed.planA, "Sin respuesta principal."),
    planB: textValue(parsed.planB, "Sin alternativa definida."),
    ...(planC ? { planC } : {}),
    abpSuggestions: stringList(parsed.abpSuggestions),
    risks: stringList(parsed.risks),
    why: stringList(parsed.why),
    checklist: stringList(parsed.checklist),
    linkedExercises: stringList(parsed.linkedExercises),
  });
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => textValue(item)).filter(Boolean);
  }

  const text = textOrUndefined(value);
  return text ? [text] : [];
}

function textValue(value: unknown, fallback = "") {
  const text = textOrUndefined(value);
  return text ?? fallback;
}

function textOrUndefined(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "optional string" ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return undefined;
}

function confidenceValue(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0.55;

  if (Number.isNaN(numeric)) return 0.55;
  return Math.max(0, Math.min(1, numeric));
}
