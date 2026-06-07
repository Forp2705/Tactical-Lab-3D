import type {
  MemoryCandidate,
  PostMatchInput,
  PostMatchReport,
  SavedPostMatchReport,
  StaffReview,
} from "./schemas";
import { pilotReportsSeed } from "@/demo/pilotReports";

type ApiError = {
  error?: string;
};

type ReportsListener = (reports: SavedPostMatchReport[]) => void;

let reportsCache: SavedPostMatchReport[] | null = pilotReportsSeed;
let reportsRequest: Promise<SavedPostMatchReport[]> | null = null;
const reportsListeners = new Set<ReportsListener>();

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
  const saved = await postJson<SavedPostMatchReport>("/api/post-match/reports", {
    report,
    sourceInput,
    staffReview,
  });

  setReportsCache([
    saved,
    ...(reportsCache ?? []).filter((item) => item.id !== saved.id),
  ]);

  return saved;
}

export async function commitMemoryCandidates({
  reportId,
  candidates,
}: {
  reportId: string;
  candidates: MemoryCandidate[];
}): Promise<{
  committedCount: number;
  skippedDuplicates: number;
  rejectedByTrustGuard: number;
  committedCandidateIds: string[];
}> {
  const result = await postJson<{
    committedCount: number;
    skippedDuplicates: number;
    rejectedByTrustGuard?: number;
    committedCandidateIds?: string[];
  }>("/api/post-match/memory", { reportId, candidates });

  // Only IDs the server explicitly confirms as committed may be marked
  // "accepted" on the client. Falling back to "everything the staff selected"
  // would make a TrustGuard veto invisible — the staff would see their
  // selection reflected as saved even though the server rejected it.
  const committedCandidateIds = result.committedCandidateIds ?? [];

  if (reportsCache) {
    const accepted = new Set(committedCandidateIds);
    setReportsCache(
      reportsCache.map((savedReport) => {
        if (savedReport.id !== reportId) return savedReport;
        return {
          ...savedReport,
          staffReview: {
            ...savedReport.staffReview,
            acceptedMemoryCandidateIds: Array.from(
              new Set([
                ...savedReport.staffReview.acceptedMemoryCandidateIds,
                ...accepted,
              ]),
            ),
          },
          report: {
            ...savedReport.report,
            memoryCandidates: savedReport.report.memoryCandidates.map(
              (candidate) => ({
                ...candidate,
                selectedByStaff:
                  candidate.selectedByStaff || accepted.has(candidate.id),
                status: accepted.has(candidate.id)
                  ? "accepted"
                  : candidate.status,
              }),
            ),
          },
        };
      }),
    );
  }

  return {
    committedCount: result.committedCount,
    skippedDuplicates: result.skippedDuplicates,
    rejectedByTrustGuard: result.rejectedByTrustGuard ?? 0,
    committedCandidateIds,
  };
}

export async function listPostMatchReports(
  options: { force?: boolean } = {},
): Promise<SavedPostMatchReport[]> {
  if (!options.force && reportsCache) {
    return reportsCache;
  }

  if (!options.force && reportsRequest) {
    return reportsRequest;
  }

  reportsRequest = (async () => {
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

    const reports =
      Array.isArray(payload) && payload.length ? payload : pilotReportsSeed;
    setReportsCache(reports);
    return reports;
  })().finally(() => {
    reportsRequest = null;
  });

  return reportsRequest;
}

export function subscribePostMatchReports(listener: ReportsListener) {
  reportsListeners.add(listener);

  if (reportsCache) {
    listener(reportsCache);
  }

  return () => {
    reportsListeners.delete(listener);
  };
}

export function getCachedPostMatchReports() {
  return reportsCache;
}

export async function refreshPostMatchReports() {
  return listPostMatchReports({ force: true });
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

function setReportsCache(reports: SavedPostMatchReport[]) {
  reportsCache = reports;
  for (const listener of reportsListeners) {
    listener(reports);
  }
}

function isApiError(payload: unknown): payload is ApiError {
  return typeof payload === "object" && payload !== null && "error" in payload;
}
