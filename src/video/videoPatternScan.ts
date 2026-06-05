import { z } from "zod";
import { formatVideoEvidenceTime } from "./videoEvidence.js";

export const VIDEO_PATTERN_DEFINITIONS = [
  {
    id: "block-height",
    label: "Altura del bloque",
    prompt:
      "Detectar si el equipo observado esta en bloque bajo, medio o alto y si queda demasiado hundido o expuesto.",
  },
  {
    id: "team-stretched",
    label: "Equipo largo",
    prompt:
      "Detectar distancia excesiva entre lineas, equipo partido o apoyos demasiado lejos.",
  },
  {
    id: "isolated-nine",
    label: "9 aislado",
    prompt:
      "Detectar si el delantero centro queda solo, sin apoyos cercanos ni segunda jugada.",
  },
  {
    id: "wide-2v1",
    label: "2v1 en banda",
    prompt:
      "Detectar superioridades del rival o riesgo defensivo por banda, lateral expuesto o extremo que no vuelve.",
  },
  {
    id: "build-up-pressure",
    label: "Salida bajo presion",
    prompt:
      "Detectar salida presionada, pivote de espaldas, centrales sin pase interior o perdida potencial en inicio.",
  },
  {
    id: "uncoordinated-press",
    label: "Presion descoordinada",
    prompt:
      "Detectar saltos de presion sin acompaniamiento, lineas separadas o rival con salida libre.",
  },
  {
    id: "box-occupation",
    label: "Poca ocupacion del area",
    prompt:
      "Detectar ataques con poca presencia en area, centros sin rematadores o llegadas tardias.",
  },
] as const;

export type VideoPatternId = (typeof VIDEO_PATTERN_DEFINITIONS)[number]["id"];

export type VideoPatternScanFrame = {
  timestampSec: number;
  imageDataUrl: string;
};

export type VideoPatternScanConfig = {
  matchId: string;
  ownTeam?: string;
  ownColor?: string;
  rivalColor?: string;
  attackDirectionFirstHalf?: "leftToRight" | "rightToLeft" | "unknown";
  sampleEverySeconds: number;
  maxFrames: number;
  patterns: VideoPatternId[];
};

export const VideoPatternFindingSchema = z.object({
  patternId: z.string(),
  label: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
  zone: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const VideoPatternFrameFindingSchema = z.object({
  timestampSec: z.number().min(0),
  phase: z.string().default("fase a confirmar"),
  findings: z.array(VideoPatternFindingSchema).default([]),
  uncertainty: z.string().default(""),
});

export const VideoPatternScanBatchResponseSchema = z.object({
  frameFindings: z.array(VideoPatternFrameFindingSchema).default([]),
  batchSummary: z.string().default(""),
});

export type VideoPatternFinding = z.infer<typeof VideoPatternFindingSchema>;
export type VideoPatternFrameFinding = z.infer<typeof VideoPatternFrameFindingSchema>;
export type VideoPatternScanBatchResponse = z.infer<
  typeof VideoPatternScanBatchResponseSchema
>;

export type ConsolidatedVideoPattern = {
  patternId: string;
  label: string;
  count: number;
  avgConfidence: number;
  severity: "low" | "medium" | "high";
  timestamps: number[];
  evidence: string[];
  zones: string[];
};

export type VideoPatternScanResult = {
  id: string;
  matchId: string;
  createdAt: string;
  sampledFrames: number;
  analyzedFrames: number;
  patterns: ConsolidatedVideoPattern[];
  frameFindings: VideoPatternFrameFinding[];
  summary: string;
  confidence: "low" | "medium" | "high";
};

export function consolidateVideoPatternScan({
  matchId,
  sampledFrames,
  batches,
}: {
  matchId: string;
  sampledFrames: number;
  batches: VideoPatternScanBatchResponse[];
}): VideoPatternScanResult {
  const frameFindings = batches
    .flatMap((batch) => batch.frameFindings)
    .sort((a, b) => a.timestampSec - b.timestampSec);
  const grouped = new Map<string, ConsolidatedVideoPattern>();

  for (const frame of frameFindings) {
    for (const finding of frame.findings) {
      const existing = grouped.get(finding.patternId) ?? {
        patternId: finding.patternId,
        label: finding.label,
        count: 0,
        avgConfidence: 0,
        severity: "low" as const,
        timestamps: [],
        evidence: [],
        zones: [],
      };
      const nextCount = existing.count + 1;
      existing.count = nextCount;
      existing.avgConfidence =
        (existing.avgConfidence * (nextCount - 1) + finding.confidence) / nextCount;
      existing.severity = maxSeverity(existing.severity, finding.severity);
      existing.timestamps = uniqueNumbers([...existing.timestamps, frame.timestampSec]).slice(0, 8);
      existing.evidence = uniqueStrings([
        ...existing.evidence,
        `${formatVideoEvidenceTime(frame.timestampSec)}: ${finding.evidence}`,
      ]).slice(0, 5);
      existing.zones = finding.zone
        ? uniqueStrings([...existing.zones, finding.zone]).slice(0, 4)
        : existing.zones;
      grouped.set(finding.patternId, existing);
    }
  }

  const patterns = [...grouped.values()].sort((a, b) => {
    const severityDelta = severityWeight(b.severity) - severityWeight(a.severity);
    if (severityDelta) return severityDelta;
    return b.count * b.avgConfidence - a.count * a.avgConfidence;
  });
  const avgConfidence = patterns.length
    ? patterns.reduce((sum, pattern) => sum + pattern.avgConfidence, 0) / patterns.length
    : 0;

  return {
    id: `vps_${Date.now()}`,
    matchId,
    createdAt: new Date().toISOString(),
    sampledFrames,
    analyzedFrames: frameFindings.length,
    patterns,
    frameFindings,
    summary: buildScanSummary(patterns, frameFindings.length),
    confidence:
      avgConfidence >= 0.72 && patterns.some((pattern) => pattern.count >= 3)
        ? "high"
        : avgConfidence >= 0.45
          ? "medium"
          : "low",
  };
}

export function videoPatternScanToEvidenceText(result: VideoPatternScanResult) {
  if (!result.patterns.length) {
    return [
      `Video Pattern Scan ${result.matchId}`,
      `frames analizados=${result.analyzedFrames}/${result.sampledFrames}`,
      "No se detectaron patrones tacticos con evidencia suficiente.",
    ].join("\n");
  }

  return [
    `Video Pattern Scan ${result.matchId}`,
    `frames analizados=${result.analyzedFrames}/${result.sampledFrames}`,
    `confianza global=${result.confidence}`,
    ...result.patterns.slice(0, 6).map((pattern) =>
      [
        `${pattern.label}: aparece ${pattern.count} veces`,
        `confianza=${Math.round(pattern.avgConfidence * 100)}%`,
        pattern.zones.length ? `zonas=${pattern.zones.join(", ")}` : "",
        `timestamps=${pattern.timestamps.map(formatVideoEvidenceTime).join(", ")}`,
        `evidencia=${pattern.evidence.join(" || ")}`,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  ].join("\n");
}

function buildScanSummary(
  patterns: ConsolidatedVideoPattern[],
  analyzedFrames: number,
) {
  if (!patterns.length) {
    return "No hay patrones visuales consolidados. Revisar sampling, calidad de video o patrones seleccionados.";
  }
  const top = patterns.slice(0, 3).map((pattern) => pattern.label).join(", ");
  return `Scan visual sobre ${analyzedFrames} frames. Patrones principales: ${top}. Usar como evidencia asistida, no tracking automatico.`;
}

function maxSeverity(
  a: "low" | "medium" | "high",
  b: "low" | "medium" | "high",
) {
  return severityWeight(b) > severityWeight(a) ? b : a;
}

function severityWeight(value: "low" | "medium" | "high") {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.map((value) => Math.round(value)))];
}
