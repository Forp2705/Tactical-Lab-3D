import type {
  MemoryCandidate,
  PostMatchInput,
  PostMatchReport,
  SavedPostMatchReport,
  StaffReview,
} from "./schemas";

type ApiError = {
  error?: string;
};

export async function requestPostMatchReport(
  input: PostMatchInput,
): Promise<PostMatchReport> {
  return postJson<PostMatchReport>("/api/post-match/generate", input);
}

export async function savePostMatchReport(
  report: PostMatchReport,
  sourceInput: PostMatchInput,
  staffReview: StaffReview,
): Promise<SavedPostMatchReport> {
  return postJson<SavedPostMatchReport>("/api/post-match/reports", {
    report,
    sourceInput,
    staffReview,
  });
}

export async function commitMemoryCandidates({
  reportId,
  candidates,
}: {
  reportId: string;
  candidates: MemoryCandidate[];
}): Promise<{ committedCount: number; skippedDuplicates: number }> {
  return postJson("/api/post-match/memory", { reportId, candidates });
}

export async function listPostMatchReports(): Promise<SavedPostMatchReport[]> {
  const response = await fetch("/api/post-match/reports");
  const payload = (await response.json().catch(() => null)) as
    | SavedPostMatchReport[]
    | ApiError
    | null;

  if (!response.ok) {
    const message =
      isApiError(payload) && payload.error
        ? payload.error
        : "Post-match history request failed.";
    throw new Error(message);
  }

  return Array.isArray(payload) ? payload : [];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiError
    | null;

  if (!response.ok) {
    const message =
      isApiError(payload) && payload.error
        ? payload.error
        : "Post-match request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function isApiError(payload: unknown): payload is ApiError {
  return typeof payload === "object" && payload !== null && "error" in payload;
}
