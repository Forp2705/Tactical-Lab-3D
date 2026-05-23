import fs from "node:fs/promises";
import path from "node:path";
import { TacticalMemorySchema } from "../CoachSchemas.js";
import { writableDataPath } from "../serverDataPaths.js";
import {
  CommitMemoryCandidatesRequestSchema,
  SavePostMatchReportRequestSchema,
  SavedPostMatchReportSchema,
  type MemoryCandidate,
  type SavedPostMatchReport,
} from "./schemas.js";

const REPORTS_PATH = "src/ai/post-match/reports.json";
const GENERATED_MEMORY_PATH = "src/ai/generated/tactical-memory.json";

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
    staffReview: request.staffReview,
  };
  const nextReports = [
    savedReport,
    ...reports.filter((report) => report.id !== id),
  ];

  await writeJson(REPORTS_PATH, nextReports);
  return savedReport;
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
    await writeJson(GENERATED_MEMORY_PATH, [...memory, ...committed]);
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

async function loadReports() {
  const reportsPath = writableDataPath(REPORTS_PATH);

  try {
    const raw = await fs.readFile(reportsPath, "utf-8");
    const parsed = JSON.parse(raw);
    return SavedPostMatchReportSchema.array().parse(parsed);
  } catch {
    return [];
  }
}

async function loadGeneratedMemory() {
  const runtimePath = writableDataPath(GENERATED_MEMORY_PATH);

  try {
    const raw = await fs.readFile(runtimePath, "utf-8");
    const parsed = JSON.parse(raw);
    return TacticalMemorySchema.parse(parsed);
  } catch {
    return [];
  }
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
