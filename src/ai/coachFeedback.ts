import type { CoachResponse } from "./CoachSchemas";

export type CoachFeedbackRating =
  | "useful"
  | "weak"
  | "invented"
  | "missingEvidence"
  | "goodExercise";

export type CoachFeedbackEntry = {
  id: string;
  createdAt: string;
  rating: CoachFeedbackRating;
  prompt: string;
  responseMode: CoachResponse["mode"] | null;
  evidenceStrength?: string;
  confidence?: number;
  citationCount?: number;
};

const STORAGE_KEY = "romboiq.coachFeedback.v1";

export function saveCoachFeedback(
  entry: Omit<CoachFeedbackEntry, "id" | "createdAt">,
) {
  if (typeof window === "undefined") return null;

  const next: CoachFeedbackEntry = {
    ...entry,
    id: `fb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const entries = listCoachFeedback();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...entries].slice(0, 200)),
  );
  void fetch("/api/coach-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  }).catch(() => {
    // Local feedback is already persisted; server observability is best-effort.
  });
  return next;
}

export function listCoachFeedback(): CoachFeedbackEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isFeedbackEntry) : [];
  } catch {
    return [];
  }
}

function isFeedbackEntry(value: unknown): value is CoachFeedbackEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "rating" in value &&
      "createdAt" in value,
  );
}
