import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activeMemoryFromLedger,
  appendVersionedMemoryEntries,
  loadVersionedMemoryLedger,
  revertVersionedMemoryEntry,
  seedVersionedMemoryLedger,
} from "../src/ai/versionedMemory";

let priorDataDir: string | undefined;
let tempDir: string;

describe("versioned tactical memory", () => {
  beforeEach(async () => {
    priorDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coach-memory-"));
    process.env.TACTICAL_LAB_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    if (priorDataDir === undefined) {
      delete process.env.TACTICAL_LAB_DATA_DIR;
    } else {
      process.env.TACTICAL_LAB_DATA_DIR = priorDataDir;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("siembra, agrega y revierte memoria sin perder trazabilidad", async () => {
    await seedVersionedMemoryLedger([
      {
        category: "buildUp",
        pattern: "El 5 sufre si recibe de espaldas.",
        impact: "Condiciona la salida interior.",
        frequency: 2,
        severityScore: 0.7,
        lastSeen: "2026-06-01",
      },
    ]);
    const [entry] = await appendVersionedMemoryEntries({
      reportId: "pmr_1",
      createdAt: "2026-06-04T00:00:00.000Z",
      candidates: [
        {
          id: "mc_1",
          statement: "El bloque se parte tras perdida.",
          category: "teamPattern",
          evidence: ["72' perdida y contra"],
          confidence: "high",
          scope: "validated",
          selectedByStaff: true,
        },
      ],
      memoryItems: [
        {
          category: "defensiveTransition",
          pattern: "El bloque se parte tras perdida.",
          impact: "Genera carreras largas hacia propia area.",
          frequency: 2,
          severityScore: 0.82,
          lastSeen: "2026-06-04",
        },
      ],
    });

    let ledger = await loadVersionedMemoryLedger();
    expect(ledger.entries).toHaveLength(2);
    expect(activeMemoryFromLedger(ledger)).toHaveLength(2);

    await revertVersionedMemoryEntry({
      id: entry.id,
      reason: "No se repitio en revision posterior.",
    });
    ledger = await loadVersionedMemoryLedger();

    expect(ledger.entries.find((item) => item.id === entry.id)?.status).toBe(
      "reverted",
    );
    expect(activeMemoryFromLedger(ledger).map((item) => item.pattern)).not.toContain(
      "El bloque se parte tras perdida.",
    );
  });
});
