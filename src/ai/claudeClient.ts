import { AiPlanSchema, type AiPlan } from "./CoachSchemas";
import { fallbackPlan } from "./guardrails";
import { buildPrompt, type AiContext } from "./PromptBuilder";

export async function generateAiPlan(mode: AiPlan["mode"], context: AiContext): Promise<AiPlan> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return fallbackPlan(mode, context.selectedExercise.title);

  const prompt = buildPrompt(mode, context);
  const model = mode === "critic" ? "claude-haiku-4-5" : "claude-sonnet-4-6";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return fallbackPlan(mode, context.selectedExercise.title);
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text ?? "{}";
  try {
    const parsed = AiPlanSchema.parse(JSON.parse(text));
    return parsed;
  } catch {
    return fallbackPlan(mode, context.selectedExercise.title);
  }
}
