import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCoachRagIndex,
  queryCoachRagIndex,
} from "../src/ai/ragIndex";

let priorDataDir: string | undefined;
let tempDir: string;

describe("coach persistent RAG index", () => {
  beforeEach(async () => {
    priorDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coach-rag-"));
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

  it("persiste vectores y permite consultar evidencia de video", async () => {
    const index = await buildCoachRagIndex({
      reports: [],
      videoObservations: [
        {
          id: "VID-test-1",
          matchId: "m1",
          timestampSec: 751,
          title: "Tag manual 12:31",
          text: "12:31 | bloque largo | carril central | severidad: alta | confianza: alta",
          zone: "carril central",
          severity: "high",
          confidence: "high",
          source: "manualTag",
        },
      ],
    });
    const ranked = await queryCoachRagIndex("bloque largo por dentro", {
      sourceTypes: ["video"],
      limit: 3,
    });

    expect(index.documentCount).toBeGreaterThan(0);
    expect(index.entries.some((entry) => entry.vector.length > 0)).toBe(true);
    expect(ranked[0]?.id).toBe("VID-test-1");
    expect(ranked[0]?.evidenceTargets).toContain("moment");
  });
});
