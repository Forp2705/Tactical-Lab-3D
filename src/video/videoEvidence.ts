import type {
  VideoEventSeverity,
  VideoTag,
  VideoTrack,
} from "@/state/useAppStore";

export type VideoEvidenceKind =
  | "manualTag"
  | "manualTrack"
  | "confirmedTrack"
  | "assistedTrack";

export type VideoEvidenceConfidence = "high" | "medium" | "low";

export type VideoEvidenceItem = {
  id: string;
  matchId: string;
  time: number;
  label: string;
  zone?: string;
  note?: string;
  playerName?: string;
  kind: VideoEvidenceKind;
  sourceLabel: string;
  confidence: VideoEvidenceConfidence;
  confidenceLabel: string;
  severity: VideoEventSeverity;
  line: string;
};

export type VideoEvidenceSummary = {
  total: number;
  tags: number;
  manualTracks: number;
  confirmedTracks: number;
  assistedTracks: number;
};

export function getVideoEvidenceItems(
  tags: VideoTag[],
  tracks: VideoTrack[],
  matchId?: string,
): VideoEvidenceItem[] {
  const tagItems = tags
    .filter((tag) => !matchId || tag.matchId === matchId)
    .map(videoTagToEvidenceItem);
  const trackItems = tracks
    .filter((track) => !matchId || track.matchId === matchId)
    .map(videoTrackToEvidenceItem);

  return [...tagItems, ...trackItems].sort((a, b) => a.time - b.time);
}

export function summarizeVideoEvidence(
  tags: VideoTag[],
  tracks: VideoTrack[],
  matchId?: string,
): VideoEvidenceSummary {
  const items = getVideoEvidenceItems(tags, tracks, matchId);
  return {
    total: items.length,
    tags: items.filter((item) => item.kind === "manualTag").length,
    manualTracks: items.filter((item) => item.kind === "manualTrack").length,
    confirmedTracks: items.filter((item) => item.kind === "confirmedTrack")
      .length,
    assistedTracks: items.filter((item) => item.kind === "assistedTrack")
      .length,
  };
}

export function videoEvidenceToTagsText(
  tags: VideoTag[],
  tracks: VideoTrack[],
  matchId?: string,
) {
  return getVideoEvidenceItems(tags, tracks, matchId)
    .map((item) => item.line)
    .join("\n");
}

export function formatVideoEvidenceTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function videoTagToEvidenceItem(tag: VideoTag): VideoEvidenceItem {
  const note = [
    "fuente: tag manual",
    tag.playerName,
    tag.note,
    `severidad: ${tag.severity}`,
    "confianza: alta",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    id: tag.id,
    matchId: tag.matchId,
    time: tag.time,
    label: tag.label,
    zone: tag.zone,
    note,
    playerName: tag.playerName,
    kind: "manualTag",
    sourceLabel: "Tag manual",
    confidence: "high",
    confidenceLabel: "Confianza alta",
    severity: tag.severity,
    line: buildEvidenceLine({
      time: tag.time,
      label: tag.label,
      zone: tag.zone,
      note,
    }),
  };
}

function videoTrackToEvidenceItem(track: VideoTrack): VideoEvidenceItem {
  const meta = trackEvidenceMeta(track);
  const note = [
    meta.source,
    track.playerName,
    `punto ${track.x.toFixed(1)}%/${track.y.toFixed(1)}%`,
    track.note,
    `severidad: ${meta.severity}`,
    `confianza: ${meta.confidence === "high" ? "alta" : "baja"}`,
  ]
    .filter(Boolean)
    .join("; ");

  return {
    id: track.id,
    matchId: track.matchId,
    time: track.time,
    label: meta.label,
    zone: track.zone,
    note,
    playerName: track.playerName,
    kind: meta.kind,
    sourceLabel: meta.sourceLabel,
    confidence: meta.confidence,
    confidenceLabel:
      meta.confidence === "high" ? "Confianza alta" : "Confianza baja",
    severity: meta.severity,
    line: buildEvidenceLine({
      time: track.time,
      label: meta.label,
      zone: track.zone,
      note,
    }),
  };
}

function trackEvidenceMeta(track: VideoTrack): {
  kind: VideoEvidenceKind;
  label: string;
  source: string;
  sourceLabel: string;
  confidence: VideoEvidenceConfidence;
  severity: VideoEventSeverity;
} {
  if (track.label === "confirmed-track") {
    return {
      kind: "confirmedTrack",
      label: "tracking validado",
      source: "fuente: track confirmado por staff",
      sourceLabel: "Track validado",
      confidence: "high",
      severity: "high",
    };
  }
  if (track.label === "manual") {
    return {
      kind: "manualTrack",
      label: "tracking manual",
      source: "fuente: track manual del staff",
      sourceLabel: "Track manual",
      confidence: "high",
      severity: "high",
    };
  }
  if (track.label === "assist-start") {
    return {
      kind: "assistedTrack",
      label: "tracking asistido inicio",
      source: "fuente: tracking asistido no confirmado",
      sourceLabel: "Track asistido",
      confidence: "low",
      severity: "low",
    };
  }
  if (track.label === "assist-track") {
    return {
      kind: "assistedTrack",
      label: "tracking asistido sugerido",
      source: "fuente: tracking asistido no confirmado",
      sourceLabel: "Track asistido",
      confidence: "low",
      severity: "low",
    };
  }
  return {
    kind: "manualTrack",
    label: track.label,
    source: "fuente: track de video",
    sourceLabel: "Track",
    confidence: "medium",
    severity: "medium",
  };
}

function buildEvidenceLine({
  time,
  label,
  zone,
  note,
}: {
  time: number;
  label: string;
  zone?: string;
  note?: string;
}) {
  return [formatVideoEvidenceTime(time), [label, zone, note].filter(Boolean).join(" | ")]
    .filter(Boolean)
    .join(" ");
}
