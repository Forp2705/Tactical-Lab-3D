import type { CoachMatchAdvice } from "./CoachSchemas";
import type { CoachShapeContext } from "@/state/useAppStore";

type CoachAgentError = {
  error?: string;
};

export type CoachAgentSquadPlayer = {
  name: string;
  num: number;
  positions: string[];
  status: "available" | "doubt" | "injured" | "suspended";
  profile: string;
  attributes: {
    speed: number;
    pass: number;
    tactical: number;
    duel: number;
  };
};

export type CoachAgentRuntimeContext = {
  shapeContext?: CoachShapeContext | null;
  teamModel?: string;
  availableSquad: CoachAgentSquadPlayer[];
  unavailableSquad: CoachAgentSquadPlayer[];
};

export async function requestCoachAgent(
  input: string,
  coachContext?: CoachAgentRuntimeContext | null,
): Promise<CoachMatchAdvice> {
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, coachContext }),
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
