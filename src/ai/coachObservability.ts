import fs from "node:fs/promises";
import path from "node:path";
import { writableDataPath } from "./serverDataPaths.js";

const OBSERVABILITY_PATH = "src/ai/generated/coach-observability.jsonl";

export type CoachObservabilityEvent = {
  event: "turn" | "completion" | "feedback" | "eval";
  createdAt?: string;
  mode?: string;
  model?: string;
  configuredModel?: string;
  fallbackUsed?: boolean;
  jsonMode?: boolean;
  attempts?: number;
  durationMs?: number;
  evidenceStrength?: string;
  citationCount?: number;
  confidence?: number | null;
  followUpQuestionCount?: number;
  feedbackRating?: string;
  evalScore?: number;
  failureCount?: number;
};

export type CoachObservabilitySnapshot = {
  eventCount: number;
  turnCount: number;
  completionCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgConfidence: number;
  modeRate: Record<string, number>;
  evidenceStrengthRate: Record<string, number>;
  modelUsage: Record<string, number>;
  feedbackRate: Record<string, number>;
  invalidOrWeakCitationTurns: number;
  lastEventAt: string | null;
};

export async function recordCoachObservabilityEvent(
  event: CoachObservabilityEvent,
) {
  try {
    const runtimePath = writableDataPath(OBSERVABILITY_PATH);
    await fs.mkdir(path.dirname(runtimePath), { recursive: true });
    await fs.appendFile(
      runtimePath,
      `${JSON.stringify({ ...event, createdAt: event.createdAt ?? new Date().toISOString() })}\n`,
      "utf-8",
    );
  } catch {
    // Observability must never affect coach responses.
  }
}

export async function loadCoachObservabilitySnapshot(options: {
  limit?: number;
} = {}): Promise<CoachObservabilitySnapshot> {
  const events = await loadCoachObservabilityEvents(options.limit ?? 500);
  const turns = events.filter((event) => event.event === "turn");
  const completions = events.filter((event) => event.event === "completion");
  const latencies = events
    .map((event) => event.durationMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  const confidences = turns
    .map((event) => event.confidence)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    eventCount: events.length,
    turnCount: turns.length,
    completionCount: completions.length,
    avgLatencyMs: average(latencies),
    p95LatencyMs: percentile(latencies, 0.95),
    avgConfidence: average(confidences),
    modeRate: countBy(turns, "mode"),
    evidenceStrengthRate: countBy(turns, "evidenceStrength"),
    modelUsage: countBy(events, "model", "configuredModel"),
    feedbackRate: countBy(events, "feedbackRating"),
    invalidOrWeakCitationTurns: turns.filter(
      (event) =>
        (event.evidenceStrength === "none" || event.evidenceStrength === "weak") &&
        (event.confidence ?? 0) > 0.55,
    ).length,
    lastEventAt: events[0]?.createdAt ?? null,
  };
}

async function loadCoachObservabilityEvents(limit: number) {
  try {
    const raw = await fs.readFile(writableDataPath(OBSERVABILITY_PATH), "utf-8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as CoachObservabilityEvent);
  } catch {
    return [];
  }
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * percentileValue) - 1),
  );
  return values[index];
}

function countBy(
  events: CoachObservabilityEvent[],
  primaryKey: keyof CoachObservabilityEvent,
  fallbackKey?: keyof CoachObservabilityEvent,
) {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const raw = event[primaryKey] ?? (fallbackKey ? event[fallbackKey] : undefined);
    if (typeof raw !== "string" || !raw) continue;
    counts[raw] = (counts[raw] ?? 0) + 1;
  }
  return counts;
}
