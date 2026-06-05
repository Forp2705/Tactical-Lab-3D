import type {
  VideoPatternId,
  VideoPatternScanBatchResponse,
  VideoPatternScanFrame,
} from "./videoPatternScan";

export type VideoPatternScanBatchRequest = {
  matchId: string;
  ownTeam?: string;
  ownColor?: string;
  rivalColor?: string;
  attackDirectionFirstHalf?: "leftToRight" | "rightToLeft" | "unknown";
  patterns: VideoPatternId[];
  frames: VideoPatternScanFrame[];
};

export async function requestVideoPatternScanBatch(
  payload: VideoPatternScanBatchRequest,
): Promise<VideoPatternScanBatchResponse> {
  const response = await fetch("/api/video/pattern-scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "No se pudo analizar el lote de video.";
    try {
      const error = (await response.json()) as { error?: string; code?: string };
      message = error.error ?? error.code ?? message;
    } catch {
      message = `${message} HTTP ${response.status}`;
    }
    throw new Error(message);
  }

  return (await response.json()) as VideoPatternScanBatchResponse;
}
