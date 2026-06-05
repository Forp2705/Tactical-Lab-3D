import { describe, expect, it } from "vitest";
import {
  normalizeRuntimeVideoEvidenceText,
  videoPatternScanToCoachObservations,
} from "../src/video/videoCoachEvidence";

describe("video-to-coach evidence pipeline", () => {
  it("normaliza tags runtime en observaciones citables", () => {
    const [observation] = normalizeRuntimeVideoEvidenceText(
      "12:31 | bloque largo | carril central | fuente: tag manual; severidad: alta; confianza: alta",
    );

    expect(observation.id).toBe("VID-1");
    expect(observation.timestampSec).toBe(751);
    expect(observation.severity).toBe("high");
    expect(observation.confidence).toBe("high");
    expect(observation.source).toBe("manualTag");
  });

  it("convierte pattern scan consolidado en evidencia para el Coach", () => {
    const [observation] = videoPatternScanToCoachObservations({
      id: "scan_1",
      matchId: "match_1",
      createdAt: "2026-06-04T00:00:00.000Z",
      sampledFrames: 6,
      analyzedFrames: 6,
      confidence: "high",
      summary: "Equipo largo.",
      frameFindings: [],
      patterns: [
        {
          patternId: "team-stretched",
          label: "Equipo largo",
          count: 4,
          avgConfidence: 0.78,
          severity: "high",
          timestamps: [120, 180],
          evidence: ["2:00: lineas separadas"],
          zones: ["carril central"],
        },
      ],
    });

    expect(observation.id).toContain("VID-SCAN");
    expect(observation.confidence).toBe("high");
    expect(observation.text).toContain("timestamps=2:00, 3:00");
  });
});
