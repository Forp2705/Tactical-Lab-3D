import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { commitMemoryCandidates } from "../src/ai/post-match/storage";

let previousDataDir: string | undefined;

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

    const result = await commitMemoryCandidates({
      reportId: "report-1",
      candidates: [
        {
          id: "mem-1",
          statement: "El bloque se parte cuando los volantes saltan sin defensa.",
          category: "teamPattern",
          evidence: ["Validado por staff"],
          confidence: "medium",
          scope: "validated",
          selectedByStaff: true,
        },
      ],
    });

    const raw = await fs.readFile(
      path.join(tempDir, "src/ai/generated/tactical-memory.json"),
      "utf-8",
    );
    const memory = JSON.parse(raw) as Array<{ pattern: string }>;

    expect(result.committedCount).toBe(1);
    expect(memory[0]?.pattern).toContain("bloque se parte");
  });
});
