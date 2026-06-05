import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadCoachObservabilitySnapshot,
  recordCoachObservabilityEvent,
} from "../src/ai/coachObservability";

let priorDataDir: string | undefined;
let tempDir: string;

describe("coach observability", () => {
  beforeEach(async () => {
    priorDataDir = process.env.TACTICAL_LAB_DATA_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coach-obs-"));
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

  it("agrega latencia, modos, evidencia y feedback", async () => {
    await recordCoachObservabilityEvent({
      event: "turn",
      mode: "hypothesis",
      evidenceStrength: "weak",
      confidence: 0.7,
      citationCount: 0,
      durationMs: 100,
    });
    await recordCoachObservabilityEvent({
      event: "completion",
      model: "openrouter/test",
      durationMs: 180,
    });
    await recordCoachObservabilityEvent({
      event: "feedback",
      feedbackRating: "missingEvidence",
    });

    const snapshot = await loadCoachObservabilitySnapshot();

    expect(snapshot.turnCount).toBe(1);
    expect(snapshot.avgLatencyMs).toBe(140);
    expect(snapshot.modeRate.hypothesis).toBe(1);
    expect(snapshot.feedbackRate.missingEvidence).toBe(1);
    expect(snapshot.invalidOrWeakCitationTurns).toBe(1);
  });
});
