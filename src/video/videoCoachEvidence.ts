import { formatVideoEvidenceTime } from "./videoEvidence";
import type {
  ConsolidatedVideoPattern,
  VideoPatternScanResult,
} from "./videoPatternScan";

export type VideoCoachObservation = {
  id: string;
  matchId: string;
  timestampSec?: number;
  title: string;
  text: string;
  zone?: string;
  severity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  source:
    | "manualTag"
    | "manualTrack"
    | "confirmedTrack"
    | "assistedTrack"
    | "patternScan"
    | "runtimeText";
};

export function normalizeRuntimeVideoEvidenceText(
  text: string,
  matchId = "current-match",
): VideoCoachObservation[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line, index) => observationFromRuntimeLine(line, index, matchId));
}

export function videoPatternScanToCoachObservations(
  result: VideoPatternScanResult,
): VideoCoachObservation[] {
  return result.patterns.slice(0, 12).map((pattern, index) =>
    observationFromPattern(pattern, index, result.matchId),
  );
}

function observationFromRuntimeLine(
  line: string,
  index: number,
  matchId: string,
): VideoCoachObservation {
  const timestampSec = parseTimestampSec(line);
  const severity = inferSeverity(line);
  const confidence = inferConfidence(line);
  const source = inferSource(line);
  const zone = inferZone(line);
  const label = line
    .replace(/^\d{1,2}:\d{2}\s*\|?\s*/, "")
    .split("|")[0]
    ?.trim();

  return {
    id: `VID-${index + 1}`,
    matchId,
    timestampSec,
    title: `${sourceLabel(source)}${timestampSec != null ? ` ${formatVideoEvidenceTime(timestampSec)}` : ""}`,
    text: line,
    zone,
    severity,
    confidence,
    source,
  };
}

function observationFromPattern(
  pattern: ConsolidatedVideoPattern,
  index: number,
  matchId: string,
): VideoCoachObservation {
  const timestampSec = pattern.timestamps[0];

  return {
    id: `VID-SCAN-${index + 1}-${slug(pattern.patternId)}`,
    matchId,
    timestampSec,
    title: `Pattern scan: ${pattern.label}`,
    text: [
      `${pattern.label}: aparece ${pattern.count} veces`,
      `severidad=${pattern.severity}`,
      `confianza=${Math.round(pattern.avgConfidence * 100)}%`,
      pattern.zones.length ? `zonas=${pattern.zones.join(", ")}` : "",
      pattern.timestamps.length
        ? `timestamps=${pattern.timestamps.map(formatVideoEvidenceTime).join(", ")}`
        : "",
      pattern.evidence.length ? `evidencia=${pattern.evidence.join(" || ")}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    zone: pattern.zones[0],
    severity: pattern.severity,
    confidence:
      pattern.avgConfidence >= 0.72
        ? "high"
        : pattern.avgConfidence >= 0.45
          ? "medium"
          : "low",
    source: "patternScan",
  };
}

function parseTimestampSec(line: string) {
  const match = line.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function inferSeverity(line: string): VideoCoachObservation["severity"] {
  const normalized = normalize(line);
  if (/\b(severidad:?\s*alta|severity:?\s*high|grave|critico)\b/.test(normalized)) {
    return "high";
  }
  if (/\b(severidad:?\s*baja|severity:?\s*low|leve)\b/.test(normalized)) {
    return "low";
  }
  return "medium";
}

function inferConfidence(line: string): VideoCoachObservation["confidence"] {
  const normalized = normalize(line);
  if (/\b(confianza:?\s*alta|validado|confirmado)\b/.test(normalized)) {
    return "high";
  }
  if (/\b(confianza:?\s*baja|asistido|no confirmado)\b/.test(normalized)) {
    return "low";
  }
  return "medium";
}

function inferSource(line: string): VideoCoachObservation["source"] {
  const normalized = normalize(line);
  if (normalized.includes("pattern scan")) return "patternScan";
  if (normalized.includes("tag manual")) return "manualTag";
  if (normalized.includes("track confirmado")) return "confirmedTrack";
  if (normalized.includes("tracking asistido")) return "assistedTrack";
  if (normalized.includes("track manual")) return "manualTrack";
  return "runtimeText";
}

function inferZone(line: string) {
  const parts = line.split("|").map((part) => part.trim());
  return parts.find((part) =>
    /\b(carril|zona|banda|central|area|medio|izquierda|derecha)\b/i.test(part),
  );
}

function sourceLabel(source: VideoCoachObservation["source"]) {
  const labels: Record<VideoCoachObservation["source"], string> = {
    manualTag: "Tag manual",
    manualTrack: "Track manual",
    confirmedTrack: "Track validado",
    assistedTrack: "Track asistido",
    patternScan: "Pattern scan",
    runtimeText: "Evidencia video",
  };
  return labels[source];
}

function slug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
