import { useAppStore } from "@/state/useAppStore";
import { type PointerEvent, useEffect, useRef } from "react";

export function VideoView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tags = useAppStore((state) => state.tags);
  const tracks = useAppStore((state) => state.tracks);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      const current = video.currentTime;
      document.title = `Video ${current.toFixed(1)}s`;
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  useEffect(() => {
    drawTrackingCanvas(canvasRef.current, tracks);
  }, [tracks]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context || !video.videoWidth) {
      drawTrackingCanvas(canvas, tracks);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawTrackMarkers(context, canvas, tracks);
  }

  function markTrackFromClick(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    useAppStore
      .getState()
      .addTrack(
        clampPercent(x),
        clampPercent(y),
        videoRef.current?.currentTime ?? 0,
      );
  }

  return (
    <section className="video-layout">
      <div className="team-card">
        <h3>Video + tagging</h3>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !videoRef.current) return;
            const url = URL.createObjectURL(file);
            videoRef.current.src = url;
          }}
        />
        <video ref={videoRef} controls>
          <track kind="captions" label="Sin subtitulos" />
        </video>
        <div className="tag-row">
          {[
            "pérdida",
            "recuperación",
            "presión",
            "salida",
            "centro",
            "remate",
          ].map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() =>
                useAppStore
                  .getState()
                  .addTag(tag, videoRef.current?.currentTime ?? 0)
              }
            >
              {tag}
            </button>
          ))}
        </div>
        <div>
          {tags.map((tag, index) => (
            <div className="tag-item" key={`${tag.label}-${index}`}>
              <span>
                <b>{tag.label}</b> · {formatTime(tag.time)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="team-card">
        <h3>Tracking asistido</h3>
        <p className="muted-panel">
          Modo honesto: tagging y tracking manual para validar clips, no promesa
          de análisis automático completo.
        </p>
        <canvas
          id="trackingCanvas"
          width={720}
          height={405}
          ref={canvasRef}
          onPointerDown={markTrackFromClick}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" onClick={captureFrame}>
            Capturar frame
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => exportTracksCsv(tracks)}
          >
            Export CSV
          </button>
        </div>
        <p className="muted-panel">
          Click sobre el canvas para marcar el punto real en ese frame.
        </p>
      </div>
    </section>
  );
}

function formatTime(sec: number) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function drawTrackingCanvas(
  canvas: HTMLCanvasElement | null,
  tracks: { time: number; x: number; y: number; label: string }[],
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.fillStyle = "#0a1418";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#5eead4";
  context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  context.fillStyle = "#eff7fa";
  context.fillText("Captura de frame / tracking manual", 28, 36);
  drawTrackMarkers(context, canvas, tracks);
}

function drawTrackMarkers(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  tracks: { time: number; x: number; y: number; label: string }[],
) {
  for (const track of tracks) {
    const x = (track.x / 100) * canvas.width;
    const y = (track.y / 100) * canvas.height;
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fillStyle = "#facc15";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#061018";
    context.stroke();
    context.fillStyle = "#eff7fa";
    context.fillText(formatTime(track.time), x + 10, y - 10);
  }
}

function exportTracksCsv(
  tracks: { time: number; x: number; y: number; label: string }[],
) {
  const rows = [
    ["time_seconds", "x_percent", "y_percent", "label"],
    ...tracks.map((track) => [
      track.time.toFixed(2),
      track.x.toFixed(2),
      track.y.toFixed(2),
      track.label,
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tracking-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}
