import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  commitMemoryCandidates,
  savePostMatchReport,
} from "../src/ai/post-match/storage";
import type { MemoryCandidate, PostMatchReport } from "../src/ai/post-match/schemas";

let previousDataDir: string | undefined;

const baseReportFields = {
  matchContext: {
    opponent: "Rival de fondo",
    result: "2-1",
    ownSystem: "4-3-3",
  },
  executiveSummary: "Resumen ejecutivo de prueba.",
  matchStory: "Historia del partido para fixture de test.",
  keyPatterns: [],
  mainProblems: [],
  wednesdayTest: [],
  reflection: {
    mainUncertainty: "Falta confirmar con video.",
    alternativeInterpretation: "El resultado pudo distorsionar la lectura.",
    confidence: 0.6,
  },
} satisfies Partial<PostMatchReport>;

/**
 * Seeds a saved report whose evidence ledger contains a high-severity tag
 * (EV-TAG-1) — i.e. commit-grade evidence per evidenceStrength.ts — and whose
 * memoryCandidates list contains the given candidates. This is required by
 * the TrustGuard: commitMemoryCandidates now looks the candidates up in the
 * saved report and re-validates them server-side before writing memory.
 */
async function seedReportWithCandidates(
  reportId: string,
  candidates: MemoryCandidate[],
) {
  await savePostMatchReport({
    report: {
      ...baseReportFields,
      id: reportId,
      memoryCandidates: candidates,
    },
    sourceInput: {
      matchContext: baseReportFields.matchContext,
      staffNotes: "Notas manuales del staff sobre el partido.",
      tags: [
        {
          label: "Perdida en salida con presion alta",
          zone: "Carril izquierdo",
          severity: "high",
        },
      ],
    },
    staffReview: { notes: "", acceptedMemoryCandidateIds: [] },
  });
}

describe("validated tactical memory commit", () => {
  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.TACTICAL_LAB_DATA_DIR;
    } else {
      process.env.TACTICAL_LAB_DATA_DIR = previousDataDir;
    }
  });

  it("escribe candidates validados en tactical-memory.json runtime", async () => {
    previousDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tl3d-memory-"));
    process.env.TACTICAL_LAB_DATA_DIR = tempDir;

    const candidate: MemoryCandidate = {
      id: "mem-1",
      statement: "El bloque se parte cuando los volantes saltan sin defensa.",
      category: "teamPattern",
      evidence: ["EV-TAG-1"],
      confidence: "medium",
      scope: "validated",
      status: "candidate",
      selectedByStaff: true,
    };
    await seedReportWithCandidates("report-1", [candidate]);

    const result = await commitMemoryCandidates({
      reportId: "report-1",
      candidates: [candidate],
    });

    const raw = await fs.readFile(
      path.join(tempDir, "src/ai/generated/tactical-memory.json"),
      "utf-8",
    );
    const memory = JSON.parse(raw) as Array<{ pattern: string }>;

    expect(result.committedCount).toBe(1);
    expect(result.committedCandidateIds).toEqual(["mem-1"]);
    expect(memory[0]?.pattern).toContain("bloque se parte");
  });

  it("no colisiona candidatos con statement identico al reportar committedCandidateIds", async () => {
    previousDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tl3d-memory-dup-"));
    process.env.TACTICAL_LAB_DATA_DIR = tempDir;

    const sharedStatement =
      "El lateral derecho queda solo en transicion defensiva.";
    const candidateA: MemoryCandidate = {
      id: "mc-dup-a",
      statement: sharedStatement,
      category: "playerPattern",
      evidence: ["EV-TAG-1"],
      confidence: "high",
      scope: "validated",
      status: "candidate",
      selectedByStaff: true,
    };
    const candidateB: MemoryCandidate = {
      id: "mc-dup-b",
      statement: sharedStatement,
      category: "teamPattern",
      evidence: ["EV-TAG-1"],
      confidence: "high",
      scope: "validated",
      status: "candidate",
      selectedByStaff: true,
    };
    await seedReportWithCandidates("report-dup", [candidateA, candidateB]);

    const result = await commitMemoryCandidates({
      reportId: "report-dup",
      candidates: [candidateA, candidateB],
    });

    // Both candidates are distinct, commit-grade-evidenced, staff-selected
    // patterns that merely happen to share their statement text. Mapping
    // commits back to candidates by statement equality would collapse them
    // onto a single id (or drop one); stable-ID tracking must keep both.
    expect(result.committedCount).toBe(2);
    expect(result.committedCandidateIds).toHaveLength(2);
    expect(new Set(result.committedCandidateIds)).toEqual(
      new Set(["mc-dup-a", "mc-dup-b"]),
    );
  });

  it("vetoes a candidate backed only by weak manual staff notes — it must not become accepted memory", async () => {
    previousDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tl3d-memory-veto-"));
    process.env.TACTICAL_LAB_DATA_DIR = tempDir;

    // EV-NOTES here is plain staff narrative with no corroboration language —
    // classifyEvidenceStrength rates it "weak" (manual notes default to
    // unconfirmed). A oneOff-scope candidate backed only by that must be
    // vetoed: weak evidence is below both the strong bar and the
    // moderate+validated upgrade path.
    const weakCandidate: MemoryCandidate = {
      id: "mc-weak-notes",
      statement: "El equipo se desordena cuando pierde la pelota cerca del area.",
      category: "teamPattern",
      evidence: ["EV-NOTES"],
      confidence: "medium",
      scope: "oneOff",
      status: "candidate",
      selectedByStaff: true,
    };
    await seedReportWithCandidates("report-weak", [weakCandidate]);

    const result = await commitMemoryCandidates({
      reportId: "report-weak",
      candidates: [weakCandidate],
    });

    expect(result.committedCount).toBe(0);
    expect(result.committedCandidateIds).toEqual([]);
    expect(result.rejectedByTrustGuard).toBe(1);

    const raw = await fs
      .readFile(path.join(tempDir, "src/ai/generated/tactical-memory.json"), "utf-8")
      .catch(() => "[]");
    const memory = JSON.parse(raw) as Array<{ pattern: string }>;
    expect(memory.some((item) => item.pattern.includes("se desordena"))).toBe(false);
  });
});
