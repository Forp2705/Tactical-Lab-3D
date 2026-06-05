import { describe, expect, it } from "vitest";
import {
  consolidateVideoPatternScan,
  videoPatternScanToEvidenceText,
} from "../src/video/videoPatternScan";

describe("videoPatternScan", () => {
  it("consolidates repeated visual findings by tactical pattern", () => {
    const result = consolidateVideoPatternScan({
      matchId: "vs-rival",
      sampledFrames: 4,
      batches: [
        {
          batchSummary: "lote 1",
          frameFindings: [
            {
              timestampSec: 60,
              phase: "salida",
              uncertainty: "",
              findings: [
                {
                  patternId: "team-stretched",
                  label: "Equipo largo",
                  confidence: 0.7,
                  evidence: "los mediocampistas quedan lejos de la linea defensiva",
                  zone: "carril central",
                  severity: "medium",
                },
              ],
            },
            {
              timestampSec: 120,
              phase: "transicion defensiva",
              uncertainty: "",
              findings: [
                {
                  patternId: "team-stretched",
                  label: "Equipo largo",
                  confidence: 0.8,
                  evidence: "hay distancia alta entre delanteros y defensores",
                  zone: "zona central",
                  severity: "high",
                },
                {
                  patternId: "wide-2v1",
                  label: "2v1 en banda",
                  confidence: 0.6,
                  evidence: "el lateral queda expuesto ante dos rivales",
                  zone: "banda derecha",
                  severity: "high",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.patterns[0]).toMatchObject({
      patternId: "team-stretched",
      count: 2,
      severity: "high",
    });
    expect(result.patterns[0]?.avgConfidence).toBeCloseTo(0.75);
    expect(result.patterns[0]?.timestamps).toEqual([60, 120]);
    expect(result.confidence).toBe("medium");
  });

  it("turns scan output into evidence text for coach and post-match", () => {
    const result = consolidateVideoPatternScan({
      matchId: "vs-rival",
      sampledFrames: 2,
      batches: [
        {
          batchSummary: "lote",
          frameFindings: [
            {
              timestampSec: 90,
              phase: "ataque",
              uncertainty: "frame aislado",
              findings: [
                {
                  patternId: "isolated-nine",
                  label: "9 aislado",
                  confidence: 0.64,
                  evidence: "el 9 esta lejos de los volantes y sin apoyo cercano",
                  zone: "ultimo tercio",
                  severity: "medium",
                },
              ],
            },
          ],
        },
      ],
    });

    const evidence = videoPatternScanToEvidenceText(result);

    expect(evidence).toContain("Video Pattern Scan vs-rival");
    expect(evidence).toContain("9 aislado");
    expect(evidence).toContain("confianza=64%");
    expect(evidence).toContain("1:30");
  });
});
