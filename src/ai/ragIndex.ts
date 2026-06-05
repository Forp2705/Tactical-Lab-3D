import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inferEvidenceTargets } from "./evidenceTargets.js";
import { loadGeneratedMemory } from "./loadGeneratedMemory.js";
import { loadKnowledgeBase } from "./loadKnowledgeBase.js";
import { loadSavedPostMatchReports } from "./post-match/storage.js";
import type { SavedPostMatchReport } from "./post-match/schemas.js";
import {
  rankDocuments,
  type RankedRetrievalDocument,
  type RetrievalDocument,
  type RetrievalSourceType,
} from "./retrievalScoring.js";
import { writableDataPath } from "./serverDataPaths.js";
import type { EvidenceTarget } from "./CoachSchemas.js";
import type { VideoCoachObservation } from "../video/videoCoachEvidence.js";

const INDEX_PATH = "src/ai/generated/coach-rag-index.json";
const INDEX_VERSION = 1;
const EMBEDDING_MODEL = "local-tactical-hash-v1";
const EMBEDDING_DIMENSIONS = 192;

export type CoachRagPayload =
  | { kind: "knowledge"; value: unknown }
  | { kind: "memory"; value: unknown }
  | { kind: "report"; value: SavedPostMatchReport }
  | { kind: "video"; value: VideoCoachObservation };

export type CoachRagDocument = RetrievalDocument<CoachRagPayload> & {
  updatedAt?: string;
};

export type CoachRagIndexEntry = CoachRagDocument & {
  fingerprint: string;
  vector: number[];
};

export type CoachRagIndex = {
  version: number;
  builtAt: string;
  embeddingModel: string;
  dimensions: number;
  documentCount: number;
  entries: CoachRagIndexEntry[];
};

export async function buildCoachRagIndex(options: {
  reports?: SavedPostMatchReport[];
  videoObservations?: VideoCoachObservation[];
} = {}): Promise<CoachRagIndex> {
  const documents = await buildCoachRagDocuments(options);
  const index: CoachRagIndex = {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    documentCount: documents.length,
    entries: documents.map((document) => ({
      ...document,
      evidenceTargets: document.evidenceTargets?.length
        ? document.evidenceTargets
        : inferEvidenceTargets(`${document.title}\n${document.text}`),
      fingerprint: fingerprintDocument(document),
      vector: embedLocal(documentText(document)),
    })),
  };

  await writeCoachRagIndex(index);
  return index;
}

export async function queryCoachRagIndex(
  query: string,
  options: {
    sourceTypes?: RetrievalSourceType[];
    limit: number;
    minScore?: number;
  },
): Promise<Array<RankedRetrievalDocument<CoachRagPayload>>> {
  const index = await loadCoachRagIndex();
  if (!index) return [];

  const allowed = options.sourceTypes?.length
    ? new Set<RetrievalSourceType>(options.sourceTypes)
    : null;
  const queryVector = embedLocal(query);
  const keywordRanked = rankDocuments(query, index.entries, {
    limit: index.entries.length,
    minScore: 0,
  });
  const keywordScoreById = new Map(
    keywordRanked.map((document) => [document.id, document.score]),
  );

  return index.entries
    .filter((entry) => !allowed || allowed.has(entry.sourceType))
    .map((entry) => {
      const semantic = Math.max(0, cosineSimilarity(queryVector, entry.vector));
      const keywordScore = Math.max(0, keywordScoreById.get(entry.id) ?? 0);
      const score =
        semantic * 0.68 +
        Math.min(1, keywordScore) * 0.22 +
        (entry.recencyScore ?? 0) * 0.06 +
        (entry.authorityScore ?? 0) * 0.04;

      return {
        ...entry,
        score,
        matchedTerms: keywordRanked.find((item) => item.id === entry.id)?.matchedTerms ?? [],
        excerpt: makeExcerpt(entry.text),
      };
    })
    .filter((entry) => entry.score >= (options.minScore ?? 0.18))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit);
}

export async function loadCoachRagIndex(): Promise<CoachRagIndex | null> {
  try {
    const raw = await fs.readFile(writableDataPath(INDEX_PATH), "utf-8");
    const parsed = JSON.parse(raw) as CoachRagIndex;
    if (
      parsed.version === INDEX_VERSION &&
      parsed.embeddingModel === EMBEDDING_MODEL &&
      parsed.dimensions === EMBEDDING_DIMENSIONS &&
      Array.isArray(parsed.entries)
    ) {
      return parsed;
    }
  } catch {
    // Missing index is acceptable; retrieval falls back to live hybrid ranking.
  }
  return null;
}

export async function buildCoachRagDocuments(options: {
  reports?: SavedPostMatchReport[];
  videoObservations?: VideoCoachObservation[];
} = {}): Promise<CoachRagDocument[]> {
  const [knowledge, memory, reports] = await Promise.all([
    loadKnowledgeBase(),
    loadGeneratedMemory(),
    options.reports ? Promise.resolve(options.reports) : loadSavedPostMatchReports(),
  ]);

  const knowledgeDocs = knowledge.map((item, index): CoachRagDocument => ({
    id: `KN-${item.category}-${index + 1}`,
    sourceType: "knowledge",
    title: `${item.category}: ${item.principle.slice(0, 80)}`,
    text: [item.category, item.principle, item.context, item.risk, item.tags.join(" ")].join("\n"),
    tags: item.tags,
    evidenceTargets: inferEvidenceTargets(
      [item.category, item.principle, item.context, item.risk].join(" "),
    ),
    payload: { kind: "knowledge", value: item },
    authorityScore: 0.8,
  }));

  const memoryDocs = memory.map((item, index): CoachRagDocument => ({
    id: `MEM-${index + 1}-${item.lastSeen}`,
    sourceType: "memory",
    title: `${item.category}: ${item.pattern.slice(0, 90)}`,
    text: [item.category, item.pattern, item.impact].join("\n"),
    tags: [item.category],
    evidenceTargets: uniqueTargets([
      ...inferEvidenceTargets([item.category, item.pattern, item.impact].join(" ")),
      "frequency",
    ]),
    payload: { kind: "memory", value: item },
    recencyScore: recencyScore(item.lastSeen),
    authorityScore: (Math.min(item.frequency, 10) / 10) * 0.35 + item.severityScore * 0.65,
    updatedAt: item.lastSeen,
  }));

  const reportDocs = reports.map((savedReport): CoachRagDocument => {
    const report = savedReport.report;
    const date = report.matchContext.date ?? savedReport.savedAt.slice(0, 10);
    const title = `${date} vs ${report.matchContext.opponent} (${report.matchContext.result})`;
    const text = [
      title,
      report.executiveSummary,
      report.matchStory,
      ...report.ownStrengths.map((item) => item.strength),
      ...report.ownTeamProblems.map((item) => item.problem),
      ...report.rivalVulnerabilities.map((item) => item.vulnerability),
      ...report.tacticalTradeoffs.map((item) => item.decision),
      ...report.flankAsymmetries.map((item) => item.description),
      ...report.keyPatterns.map((item) => item.pattern),
      ...report.saturdayFocus,
      ...report.risksOfOvercorrection,
      savedReport.sourceInput?.staffNotes ?? "",
      ...(savedReport.sourceInput?.tags ?? []).map((tag) =>
        [tag.minute != null ? `${tag.minute}'` : "", tag.label, tag.zone, tag.note]
          .filter(Boolean)
          .join(" | "),
      ),
    ].join("\n");

    return {
      id: `REP-${savedReport.id}`,
      sourceType: "report",
      title,
      text,
      tags: [
        report.matchContext.opponent,
        report.matchContext.ownSystem,
        report.matchContext.opponentSystem ?? "",
        report.matchContext.interpretedResult?.outcome ?? "",
      ].filter(Boolean),
      evidenceTargets: uniqueTargets([
        ...inferEvidenceTargets(text),
        "matchContext",
        "frequency",
      ]),
      payload: { kind: "report", value: savedReport },
      recencyScore: recencyScore(date),
      authorityScore: 0.9,
      updatedAt: savedReport.savedAt,
    };
  });

  const videoDocs = (options.videoObservations ?? []).map((observation): CoachRagDocument => ({
    id: observation.id,
    sourceType: "video",
    title: observation.title,
    text: observation.text,
    tags: [
      observation.matchId,
      observation.zone ?? "",
      observation.severity,
      observation.confidence,
      observation.source,
    ].filter(Boolean),
    evidenceTargets: uniqueTargets([
      ...inferEvidenceTargets(observation.text),
      "matchContext",
      "moment",
    ]),
    payload: { kind: "video", value: observation },
    recencyScore: 1,
    authorityScore:
      observation.confidence === "high"
        ? 0.9
        : observation.confidence === "medium"
          ? 0.65
          : 0.35,
    updatedAt: new Date().toISOString(),
  }));

  return [...knowledgeDocs, ...memoryDocs, ...reportDocs, ...videoDocs];
}

async function writeCoachRagIndex(index: CoachRagIndex) {
  const runtimePath = writableDataPath(INDEX_PATH);
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
}

function embedLocal(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = normalize(text).split(/\s+/).filter((token) => token.length >= 3);
  for (const token of tokens) {
    const hash = crypto.createHash("sha256").update(token).digest();
    const index = hash.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
  }
  return dot;
}

function documentText(document: Pick<CoachRagDocument, "title" | "text" | "tags">) {
  return [document.title, document.text, ...(document.tags ?? [])].join("\n");
}

function fingerprintDocument(document: CoachRagDocument) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        id: document.id,
        sourceType: document.sourceType,
        text: documentText(document),
        updatedAt: document.updatedAt ?? "",
      }),
    )
    .digest("hex");
}

function makeExcerpt(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 260);
}

function recencyScore(date: string) {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 0.2;
  const daysAgo = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 10) return 1;
  if (daysAgo <= 35) return 0.75;
  if (daysAgo <= 120) return 0.45;
  return 0.15;
}

function uniqueTargets(targets: EvidenceTarget[]) {
  return [...new Set(targets)];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
