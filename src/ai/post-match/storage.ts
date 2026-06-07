import fs from "node:fs/promises";
import path from "node:path";
import { TacticalMemorySchema } from "../CoachSchemas.js";
import { writableDataPath } from "../serverDataPaths.js";
import { z } from "zod";
import {
  CommitMemoryCandidatesRequestSchema,
  SavePostMatchReportRequestSchema,
  SavedPostMatchReportSchema,
  type MemoryCandidate,
  type SavedPostMatchReport,
} from "./schemas.js";
import {
  appendVersionedMemoryEntries,
  revertVersionedMemoryEntry,
  seedVersionedMemoryLedger,
} from "../versionedMemory.js";
import {
  type EvidenceLike,
  extractEvidenceIds,
  hasCommitGradeEvidence,
} from "./evidenceStrength.js";

const REPORTS_PATH = "src/ai/post-match/reports.json";
const GENERATED_MEMORY_PATH = "src/ai/generated/tactical-memory.json";

let reportsCache: SavedPostMatchReport[] | null = null;
let reportsCachePromise: Promise<SavedPostMatchReport[]> | null = null;
let generatedMemoryCache: z.infer<typeof TacticalMemorySchema> | null = null;
let generatedMemoryPromise: Promise<z.infer<typeof TacticalMemorySchema>> | null =
  null;

export async function savePostMatchReport(payload: unknown) {
  const request = SavePostMatchReportRequestSchema.parse(payload);
  const reports = await loadReports();
  const id = request.report.id ?? `pmr_${Date.now()}`;
  const savedAt = new Date().toISOString();
  const savedReport: SavedPostMatchReport = {
    id,
    savedAt,
    report: {
      ...request.report,
      id,
      createdAt: request.report.createdAt ?? savedAt,
    },
    sourceInput: request.sourceInput,
    staffReview: request.staffReview,
  };
  const nextReports = [
    savedReport,
    ...reports.filter((report) => report.id !== id),
  ];

  await writeJson(REPORTS_PATH, nextReports);
  reportsCache = nextReports;
  reportsCachePromise = Promise.resolve(nextReports);
  return savedReport;
}

export async function loadSavedPostMatchReports() {
  return loadReports();
}

export async function commitMemoryCandidates(payload: unknown) {
  const request = CommitMemoryCandidatesRequestSchema.parse(payload);
  const reports = await loadReports();
  const savedReport = reports.find((report) => report.id === request.reportId);
  if (!savedReport) {
    throw new Error("No se encontro el reporte guardado para validar memoria.");
  }

  const savedCandidates = new Map(
    savedReport.report.memoryCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const eligibleCandidates = request.candidates
    .map((candidate) => {
      const savedCandidate = savedCandidates.get(candidate.id);
      if (!savedCandidate) return null;
      return {
        ...savedCandidate,
        selectedByStaff:
          candidate.selectedByStaff ||
          savedCandidate.selectedByStaff ||
          savedReport.staffReview.acceptedMemoryCandidateIds.includes(candidate.id),
      };
    })
    .filter((candidate): candidate is MemoryCandidate =>
      Boolean(candidate && canCommitMemoryCandidate(candidate, savedReport)),
    );

  const memory = await loadGeneratedMemory();
  const existingPatterns = new Set(
    memory.map((item) => normalize(item.pattern)),
  );
  const today = new Date().toISOString().slice(0, 10);
  // Keep each candidate paired with the memory item generated from it, end to
  // end — this is what lets us report committedCandidateIds by stable ID
  // instead of re-matching commits back to candidates by statement-text
  // equality (which collides when two candidates share similar wording).
  const committedPairs = eligibleCandidates
    .filter((candidate) => !existingPatterns.has(normalize(candidate.statement)))
    .map((candidate) => ({
      candidate,
      memoryItem: memoryItemFromCandidate(candidate, request.reportId, today),
    }));
  const committed = committedPairs.map((pair) => pair.memoryItem);
  const committedCandidateIds = committedPairs.map((pair) => pair.candidate.id);

  if (committed.length) {
    await seedVersionedMemoryLedger(memory);
    await appendVersionedMemoryEntries({
      reportId: request.reportId,
      candidates: committedPairs.map((pair) => pair.candidate),
      memoryItems: committed,
      createdAt: new Date(`${today}T00:00:00.000Z`).toISOString(),
    });
    const nextMemory = [...memory, ...committed];
    await writeJson(GENERATED_MEMORY_PATH, nextMemory);
    generatedMemoryCache = nextMemory;
    generatedMemoryPromise = Promise.resolve(nextMemory);
  }

  await markCommittedCandidates(request.reportId, committedCandidateIds);

  return {
    committedCount: committed.length,
    skippedDuplicates: eligibleCandidates.length - committed.length,
    rejectedByTrustGuard: request.candidates.length - eligibleCandidates.length,
    committedCandidateIds,
  };
}

export async function revertCommittedMemory(payload: unknown) {
  const request = z
    .object({
      id: z.string().min(1),
      reason: z.string().min(1),
      revertedBy: z.string().min(1).default("staff"),
    })
    .parse(payload);
  const entry = await revertVersionedMemoryEntry(request);
  generatedMemoryCache = null;
  generatedMemoryPromise = null;
  return { reverted: Boolean(entry), entry };
}

async function loadReports() {
  if (reportsCache) return reportsCache;
  if (reportsCachePromise) return reportsCachePromise;

  const reportsPath = writableDataPath(REPORTS_PATH);
  reportsCachePromise = (async () => {
    try {
      const raw = await fs.readFile(reportsPath, "utf-8");
      const parsed = JSON.parse(raw);
      const reports = SavedPostMatchReportSchema.array().parse(parsed);
      reportsCache = reports;
      return reports;
    } catch {
      reportsCache = [];
      return [];
    } finally {
      reportsCachePromise = null;
    }
  })();

  return reportsCachePromise;
}

async function loadGeneratedMemory() {
  if (generatedMemoryCache) return generatedMemoryCache;
  if (generatedMemoryPromise) return generatedMemoryPromise;

  const runtimePath = writableDataPath(GENERATED_MEMORY_PATH);
  generatedMemoryPromise = (async () => {
    try {
      const raw = await fs.readFile(runtimePath, "utf-8");
      const parsed = JSON.parse(raw);
      const memory = TacticalMemorySchema.parse(parsed);
      generatedMemoryCache = memory;
      return memory;
    } catch {
      generatedMemoryCache = [];
      return [];
    } finally {
      generatedMemoryPromise = null;
    }
  })();

  return generatedMemoryPromise;
}

async function markCommittedCandidates(reportId: string, candidateIds: string[]) {
  const reports = await loadReports();
  if (!reports.length) return;

  const nextReports = reports.map((savedReport) => {
    if (savedReport.id !== reportId) return savedReport;
    const accepted = new Set([
      ...savedReport.staffReview.acceptedMemoryCandidateIds,
      ...candidateIds,
    ]);

    return {
      ...savedReport,
      staffReview: {
        ...savedReport.staffReview,
        acceptedMemoryCandidateIds: Array.from(accepted),
      },
      report: {
        ...savedReport.report,
        memoryCandidates: savedReport.report.memoryCandidates.map(
          (candidate) => ({
            ...candidate,
            selectedByStaff:
              candidate.selectedByStaff || accepted.has(candidate.id),
            status: accepted.has(candidate.id) ? "accepted" : candidate.status,
          }),
        ),
      },
    };
  });

  await writeJson(REPORTS_PATH, nextReports);
  reportsCache = nextReports;
  reportsCachePromise = Promise.resolve(nextReports);
}

function canCommitMemoryCandidate(
  candidate: MemoryCandidate,
  savedReport: SavedPostMatchReport,
) {
  if (!candidate.selectedByStaff) return false;
  if (candidate.status === "rejected" || candidate.status === "needs_review") {
    return false;
  }
  if (candidate.confidence === "low") return false;
  if (!candidate.evidence.length) return false;

  const evidenceById = buildSavedEvidenceLedger(savedReport);
  const evidenceIds = candidate.evidence.flatMap(extractEvidenceIds);
  if (!evidenceIds.length) return false;
  if (evidenceIds.some((id) => !evidenceById.has(id))) return false;

  // Same shared classification as guardMemoryCandidate's grounding check, but
  // with the stricter commit-time bar: strong evidence, or moderate evidence
  // when the candidate itself represents a staff-validated repeating pattern.
  // See evidenceStrength.ts — this is the single source of truth that keeps
  // guardMemoryCandidate and canCommitMemoryCandidate from diverging.
  return hasCommitGradeEvidence(candidate.evidence, evidenceById, {
    allowValidatedModerate: candidate.scope === "validated",
  });
}

function buildSavedEvidenceLedger(savedReport: SavedPostMatchReport) {
  const sourceInput = savedReport.sourceInput;
  const evidence = new Map<string, EvidenceLike>();

  evidence.set("EV-RESULT", {
    source: "result",
    text: savedReport.report.matchContext.result,
  });

  if (sourceInput?.planBeforeMatch?.trim()) {
    evidence.set("EV-PLAN", {
      source: "plan",
      text: sourceInput.planBeforeMatch.trim(),
    });
  }

  if (sourceInput?.staffNotes?.trim()) {
    evidence.set("EV-NOTES", {
      source: "staffNotes",
      text: sourceInput.staffNotes.trim(),
    });
  }

  sourceInput?.tags.forEach((tag, index) => {
    evidence.set(`EV-TAG-${index + 1}`, {
      source: "tag",
      text: [tag.label, tag.zone, tag.note].filter(Boolean).join(" | "),
      severity: tag.severity,
    });
  });

  return evidence;
}

function memoryItemFromCandidate(
  candidate: MemoryCandidate,
  reportId: string,
  lastSeen: string,
) {
  return {
    category: candidate.category,
    pattern: candidate.statement,
    impact: [
      `Aprendizaje validado desde reporte ${reportId}.`,
      candidate.evidence.length
        ? `Evidencia: ${candidate.evidence.join(" | ")}`
        : "Evidencia: validado manualmente por staff.",
    ].join(" "),
    frequency: candidate.scope === "validated" ? 2 : 1,
    severityScore: confidenceToScore(candidate.confidence),
    lastSeen,
  };
}

function confidenceToScore(confidence: MemoryCandidate["confidence"]) {
  if (confidence === "high") return 0.85;
  if (confidence === "medium") return 0.6;
  return 0.35;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function writeJson(filePath: string, payload: unknown) {
  const runtimePath = writableDataPath(filePath);
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(
    runtimePath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
}
