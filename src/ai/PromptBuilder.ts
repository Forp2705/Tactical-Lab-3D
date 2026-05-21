import type { Exercise, Microcycle, Player, Session } from "@/data";

export type AiContext = {
  teamName: string;
  model: string;
  selectedExercise: Exercise;
  players: Player[];
  session: Session;
  microcycle: Microcycle;
  prompt: string;
};

function compactPlayer(player: Player) {
  return {
    name: player.name,
    num: player.num,
    positions: player.positions,
    status: player.status,
    profile: player.profile,
    attributes: player.attributes,
  };
}

function compactExercise(exercise: Exercise) {
  return {
    id: exercise.id,
    title: exercise.title,
    phase: exercise.phase,
    principle: exercise.principle,
    intensity: exercise.intensity,
    rpe: exercise.rpe,
    density: exercise.density,
    duration: exercise.duration,
    players: exercise.players,
    objective: exercise.objective,
    rules: exercise.rules,
    coaching: exercise.coaching,
    success: exercise.success,
  };
}

function averageAttributes(players: Player[]) {
  if (players.length === 0) {
    return {
      speed: 0,
      stamina: 0,
      pass: 0,
      control: 0,
      press: 0,
      duel: 0,
      tactical: 0,
    };
  }

  const totals = players.reduce(
    (acc, player) => ({
      speed: acc.speed + player.attributes.speed,
      stamina: acc.stamina + player.attributes.stamina,
      pass: acc.pass + player.attributes.pass,
      control: acc.control + player.attributes.control,
      press: acc.press + player.attributes.press,
      duel: acc.duel + player.attributes.duel,
      tactical: acc.tactical + player.attributes.tactical,
    }),
    {
      speed: 0,
      stamina: 0,
      pass: 0,
      control: 0,
      press: 0,
      duel: 0,
      tactical: 0,
    },
  );

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      Math.round(value / players.length),
    ]),
  );
}

function statusCounts(players: Player[]) {
  const counts = { available: 0, doubt: 0, injured: 0, suspended: 0 };
  for (const player of players) {
    counts[player.status] += 1;
  }
  return counts;
}

export function buildPrompt(
  mode: "query" | "critic" | "match",
  context: AiContext,
) {
  const unavailable = context.players
    .filter((player) => player.status !== "available")
    .map(compactPlayer);
  const available = context.players
    .filter((player) => player.status === "available")
    .map(compactPlayer);

  return [
    "You are Tactical Lab Pro's conservative football coaching assistant.",
    "Use the provided local context only. If something is missing, state it as an assumption or ask a concrete clarification inside checklist.",
    "Do not propose a training session unless the coach explicitly asks for one.",
    "For query mode, answer the coach's tactical question directly and practically.",
    "For critic mode, identify tactical risks, tradeoffs, and mitigations.",
    "For match mode, produce Plan A/B/C for a match context.",
    "Do not invent medical load recommendations when age, level, and medical context are incomplete.",
    "Only return linkedExercises when the coach explicitly asks for exercises; otherwise return an empty array.",
    "Every list field must be an array of strings: assumptions, abpSuggestions, risks, why, checklist, linkedExercises.",
    "Return ONLY valid JSON. No markdown. No prose outside the JSON object.",
    "",
    "JSON shape:",
    JSON.stringify({
      mode,
      assumptions: ["string"],
      confidence: 0.65,
      planA: "string",
      planB: "string",
      planC: "optional string",
      abpSuggestions: ["string"],
      risks: ["string"],
      why: ["string"],
      checklist: ["string"],
      linkedExercises: ["exercise-id"],
    }),
    "",
    "CONTEXT:",
    JSON.stringify(
      {
        mode,
        team: {
          name: context.teamName,
          gameModel: context.model,
          statusCounts: statusCounts(context.players),
          physicalProfile: averageAttributes(
            context.players.filter((player) => player.status === "available"),
          ),
          availablePlayers: available,
          unavailablePlayers: unavailable,
        },
        matchContext: {
          rival: "not provided",
          expectedOwnSystem: "read from coachRequest when present",
          expectedRivalSystem: "not provided",
          weather: "not provided",
          pitch: "not provided",
          matchObjective: "not provided",
        },
        selectedExercise: compactExercise(context.selectedExercise),
        session: {
          id: context.session.id,
          name: context.session.name,
          blocks: context.session.blocks,
          staffNotes: context.session.staffNotes,
        },
        microcycle: context.microcycle.days,
        coachRequest: context.prompt || "none",
      },
      null,
      2,
    ),
  ].join("\n");
}
