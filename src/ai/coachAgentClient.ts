import {
  CoachResponseSchema,
  type CoachInterviewState,
  type CoachMatchAdvice,
  type CoachResponse,
  type CollectedAnswer,
} from "./CoachSchemas";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { CoachShapeContext, ManualObservation } from "@/state/useAppStore";
import type { GameModel } from "@/data/gameModel";
import type { TeamIdentitySetup } from "@/data/teamIdentitySetup";
import type { OpponentScout } from "@/scout/opponentScout";

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
      stamina?: number;
      pass: number;
      control?: number;
      press?: number;
      tactical: number;
      duel: number;
    };
};

export type CoachAgentRuntimeContext = {
  workspaceMode?: "demo" | "real";
  activeTeamId?: string;
  teamIdentity?: TeamIdentitySetup;
  shapeContext?: CoachShapeContext | null;
  teamModel?: string;
  gameModel?: GameModel;
  opponentScout?: OpponentScout;
  videoEvidence?: {
    total: number;
    tags: number;
    manualTracks: number;
    confirmedTracks: number;
    assistedTracks: number;
    text: string;
  };
  manualObservations?: ManualObservation[];
  availableSquad: CoachAgentSquadPlayer[];
  unavailableSquad: CoachAgentSquadPlayer[];
  savedLineups?: Array<{
    id: string;
    name: string;
    formation: string;
    players: Array<{
      playerId: string;
      playerName?: string;
      role: string;
      x: number;
      y: number;
    }>;
  }>;
  lineupLabShapes?: Array<{
    id: string;
    name: string;
    phase: string;
    notes?: string;
    players: Array<{
      playerId: string;
      playerName: string;
      num: number;
      positions: string[];
      x: number;
      y: number;
    }>;
  }>;
  lineupLabTransitions?: Array<{
    id: string;
    name: string;
    fromShapeId: string;
    fromShapeName: string;
    toShapeId: string;
    toShapeName: string;
    notes?: string;
  }>;
};

export type CoachTurnOptions = {
  collectedEvidence?: CollectedAnswer[];
  interviewState?: CoachInterviewState | null;
  skipInterview?: boolean;
};

export async function requestCoachAgent(
  input: string,
  coachContext?: CoachAgentRuntimeContext | null,
  options?: CoachTurnOptions,
): Promise<CoachMatchAdvice> {
  const payload = await postCoachTurn(input, coachContext, options);
  const parsed = CoachResponseSchema.safeParse(payload);

  if (parsed.success) {
    if (parsed.data.mode === "question") {
      throw new Error("El agente necesita evidencia antes de diagnosticar.");
    }
    return parsed.data.advice;
  }

  return payload as CoachMatchAdvice;
}

export async function requestCoachTurn(
  input: string,
  coachContext?: CoachAgentRuntimeContext | null,
  options?: CoachTurnOptions,
): Promise<CoachResponse> {
  const payload = await postCoachTurn(input, coachContext, options);
  const parsed = CoachResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Coach agent response had an invalid interview format.");
  }

  return parsed.data;
}

/**
 * One-shot board-scenario coach turn. POSTs `{ input, coachContext, boardEvidence }`
 * to `/api/coach-agent` and returns the parsed `CoachResponse`.
 *
 * HONESTY CONTRACT: this makes EXACTLY ONE fetch and is agnostic to the failure
 * mode. On ANY failure — non-2xx (400/402/429/500/502/503), network reject,
 * timeout, or an unparseable/invalid response body — it throws an honest Error and
 * STOPS. It is FORBIDDEN to retry without the packet, fall back to a generic
 * packet-less coach query, or reuse a stale answer. Every failure ends the same way.
 */
export async function requestBoardScenarioTurn(
  input: string,
  boardEvidence: BoardEvidencePacket,
  coachContext?: CoachAgentRuntimeContext | null,
): Promise<CoachResponse> {
  // Exactly one fetch. No retry/fallback path exists below this line.
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, coachContext, boardEvidence }),
  });

  const payload = (await response.json().catch(() => null)) as
    | CoachResponse
    | CoachAgentError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "Coach agent request failed.";
    throw new Error(message);
  }

  const parsed = CoachResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Coach agent returned an invalid board-scenario response.");
  }

  return parsed.data;
}

async function postCoachTurn(
  input: string,
  coachContext?: CoachAgentRuntimeContext | null,
  options?: CoachTurnOptions,
) {
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, coachContext, ...options }),
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

  return payload;
}
