import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { TacticalMemoryItemSchema, TacticalMemorySchema } from "./CoachSchemas.js";
import { writableDataPath } from "./serverDataPaths.js";
import type { MemoryCandidate } from "./post-match/schemas.js";

const LEDGER_PATH = "src/ai/generated/tactical-memory-ledger.json";
const ACTIVE_MEMORY_PATH = "src/ai/generated/tactical-memory.json";
const LEDGER_VERSION = 1;

export const VersionedMemoryEntrySchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  status: z.enum(["active", "reverted", "decayed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  source: z.object({
    type: z.enum(["postMatchReport", "manualImport", "migration"]),
    reportId: z.string().optional(),
    candidateId: z.string().optional(),
    evidence: z.array(z.string()).default([]),
  }),
  decay: z.object({
    halfLifeDays: z.number().min(1),
    lastEvaluatedAt: z.string(),
    score: z.number().min(0).max(1),
  }),
  memory: TacticalMemoryItemSchema,
  supersedes: z.string().optional(),
  revertedAt: z.string().optional(),
  revertedBy: z.string().optional(),
  revertReason: z.string().optional(),
});

export const VersionedMemoryLedgerSchema = z.object({
  version: z.literal(LEDGER_VERSION),
  updatedAt: z.string(),
  entries: z.array(VersionedMemoryEntrySchema).default([]),
});

export type VersionedMemoryEntry = z.infer<typeof VersionedMemoryEntrySchema>;
export type VersionedMemoryLedger = z.infer<typeof VersionedMemoryLedgerSchema>;

export async function loadVersionedMemoryLedger(): Promise<VersionedMemoryLedger> {
  try {
    const raw = await fs.readFile(writableDataPath(LEDGER_PATH), "utf-8");
    return VersionedMemoryLedgerSchema.parse(JSON.parse(raw));
  } catch {
    return emptyLedger();
  }
}

export async function appendVersionedMemoryEntries({
  reportId,
  candidates,
  memoryItems,
  createdAt = new Date().toISOString(),
}: {
  reportId: string;
  candidates: MemoryCandidate[];
  memoryItems: z.infer<typeof TacticalMemoryItemSchema>[];
  createdAt?: string;
}) {
  const ledger = await loadVersionedMemoryLedger();
  const byCandidateId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const nextEntries = memoryItems.map((memory, index) => {
    const candidate = candidates[index];
    const sourceCandidate = candidate ? byCandidateId.get(candidate.id) : undefined;
    return makeLedgerEntry({
      reportId,
      candidate: sourceCandidate,
      memory,
      version: nextVersionForPattern(ledger.entries, memory.pattern),
      createdAt,
    });
  });

  const nextLedger: VersionedMemoryLedger = {
    version: LEDGER_VERSION,
    updatedAt: createdAt,
    entries: [...ledger.entries, ...nextEntries],
  };
  await writeLedger(nextLedger);
  await writeActiveMemoryFromLedger(nextLedger);
  return nextEntries;
}

export async function seedVersionedMemoryLedger(
  memoryItems: z.infer<typeof TacticalMemoryItemSchema>[],
) {
  const ledger = await loadVersionedMemoryLedger();
  if (ledger.entries.length || !memoryItems.length) return ledger;

  const now = new Date().toISOString();
  const seeded: VersionedMemoryLedger = {
    version: LEDGER_VERSION,
    updatedAt: now,
    entries: memoryItems.map((memory) => ({
      id: `vmem_seed_${hash(memory.pattern).slice(0, 16)}`,
      version: 1,
      status: "active",
      createdAt: now,
      updatedAt: now,
      source: {
        type: "migration",
        evidence: [],
      },
      decay: {
        halfLifeDays: 120,
        lastEvaluatedAt: now,
        score: initialDecayScore(memory),
      },
      memory,
    })),
  };
  await writeLedger(seeded);
  return seeded;
}

export async function revertVersionedMemoryEntry({
  id,
  reason,
  revertedBy = "staff",
}: {
  id: string;
  reason: string;
  revertedBy?: string;
}) {
  const ledger = await loadVersionedMemoryLedger();
  const now = new Date().toISOString();
  let found = false;
  const nextLedger: VersionedMemoryLedger = {
    ...ledger,
    updatedAt: now,
    entries: ledger.entries.map((entry) => {
      if (entry.id !== id) return entry;
      found = true;
      return {
        ...entry,
        status: "reverted",
        updatedAt: now,
        revertedAt: now,
        revertedBy,
        revertReason: reason,
      };
    }),
  };

  if (!found) {
    throw new Error(`Versioned memory entry not found: ${id}`);
  }

  await writeLedger(nextLedger);
  await writeActiveMemoryFromLedger(nextLedger);
  return nextLedger.entries.find((entry) => entry.id === id);
}

export async function rebuildActiveMemoryFromLedger() {
  const ledger = await loadVersionedMemoryLedger();
  await writeActiveMemoryFromLedger(ledger);
  return activeMemoryFromLedger(ledger);
}

export function activeMemoryFromLedger(ledger: VersionedMemoryLedger) {
  const activeByPattern = new Map<string, VersionedMemoryEntry>();
  for (const entry of ledger.entries) {
    if (entry.status !== "active") continue;
    if (decayedScore(entry) < 0.12) continue;
    const key = normalize(entry.memory.pattern);
    const current = activeByPattern.get(key);
    if (!current || entry.version >= current.version) {
      activeByPattern.set(key, entry);
    }
  }
  return TacticalMemorySchema.parse([...activeByPattern.values()].map((entry) => entry.memory));
}

function makeLedgerEntry({
  reportId,
  candidate,
  memory,
  version,
  createdAt,
}: {
  reportId: string;
  candidate?: MemoryCandidate;
  memory: z.infer<typeof TacticalMemoryItemSchema>;
  version: number;
  createdAt: string;
}): VersionedMemoryEntry {
  const score = initialDecayScore(memory);
  return {
    id: `vmem_${hash(`${reportId}:${candidate?.id ?? memory.pattern}:${version}`).slice(0, 16)}`,
    version,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    source: {
      type: "postMatchReport",
      reportId,
      candidateId: candidate?.id,
      evidence: candidate?.evidence ?? [],
    },
    decay: {
      halfLifeDays: candidate?.scope === "validated" ? 180 : 75,
      lastEvaluatedAt: createdAt,
      score,
    },
    memory,
  };
}

function nextVersionForPattern(entries: VersionedMemoryEntry[], pattern: string) {
  const key = normalize(pattern);
  return (
    entries
      .filter((entry) => normalize(entry.memory.pattern) === key)
      .reduce((max, entry) => Math.max(max, entry.version), 0) + 1
  );
}

function decayedScore(entry: VersionedMemoryEntry) {
  const ageDays =
    (Date.now() - new Date(entry.decay.lastEvaluatedAt).getTime()) /
    (1000 * 60 * 60 * 24);
  if (!Number.isFinite(ageDays) || ageDays <= 0) return entry.decay.score;
  const decayFactor = Math.pow(0.5, ageDays / entry.decay.halfLifeDays);
  return entry.decay.score * decayFactor;
}

function initialDecayScore(memory: z.infer<typeof TacticalMemoryItemSchema>) {
  return Math.min(1, Math.max(0.15, memory.severityScore * 0.72 + Math.min(memory.frequency, 5) * 0.056));
}

async function writeActiveMemoryFromLedger(ledger: VersionedMemoryLedger) {
  await writeJson(ACTIVE_MEMORY_PATH, activeMemoryFromLedger(ledger));
}

async function writeLedger(ledger: VersionedMemoryLedger) {
  await writeJson(LEDGER_PATH, VersionedMemoryLedgerSchema.parse(ledger));
}

async function writeJson(filePath: string, payload: unknown) {
  const runtimePath = writableDataPath(filePath);
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function emptyLedger(): VersionedMemoryLedger {
  return {
    version: LEDGER_VERSION,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value || String(Date.now())).digest("hex");
}
