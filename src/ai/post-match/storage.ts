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
  const memory = await loadGeneratedMemory();
  const existingPatterns = new Set(
    memory.map((item) => normalize(item.pattern)),
  );
  const today = new Date().toISOString().slice(0, 10);
  const committed = request.candidates
    .filter((candidate) => !existingPatterns.has(normalize(candidate.statement)))
    .map((candidate) =>
      memoryItemFromCandidate(candidate, request.reportId, today),
    );

  if (committed.length) {
    await seedVersionedMemoryLedger(memory);
    await appendVersionedMemoryEntries({
      reportId: request.reportId,
      candidates: request.candidates,
      memoryItems: committed,
      createdAt: new Date(`${today}T00:00:00.000Z`).toISOString(),
    });
    const nextMemory = [...memory, ...committed];
    await writeJson(GENERATED_MEMORY_PATH, nextMemory);
    generatedMemoryCache = nextMemory;
    generatedMemoryPromise = Promise.resolve(nextMemory);
  }

  await markCommittedCandidates(
    request.reportId,
    request.candidates.map((candidate) => candidate.id),
  );

  return {
    committedCount: committed.length,
    skippedDuplicates: request.candidates.length - committed.length,
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
          }),
        ),
      },
    };
  });

  await writeJson(REPORTS_PATH, nextReports);
  reportsCache = nextReports;
  reportsCachePromise = Promise.resolve(nextReports);
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
