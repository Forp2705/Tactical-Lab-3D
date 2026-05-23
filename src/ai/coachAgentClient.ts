import type { CoachMatchAdvice } from "./CoachSchemas";

type CoachAgentError = {
  error?: string;
};

export async function requestCoachAgent(
  input: string,
): Promise<CoachMatchAdvice> {
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });

  const payload = (await response.json().catch(() => null)) as
    | CoachMatchAdvice
    | CoachAgentError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "Coach agent request failed.";
    throw new Error(message);
  }

  return payload as CoachMatchAdvice;
}
