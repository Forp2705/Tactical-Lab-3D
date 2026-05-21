import { useEffect, useRef } from "react";
import { useAppStore } from "@/state/useAppStore";

export function VideoView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tags = useAppStore((state) => state.tags);

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

  return (
    <section className="video-layout">
      <div className="team-card">
        <h3>Video + tagging</h3>
        <input type="file" accept="video/*" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !videoRef.current) return;
          const url = URL.createObjectURL(file);
          videoRef.current.src = url;
        }} />
        <video ref={videoRef} controls />
        <div className="tag-row">
          {["pérdida", "recuperación", "presión", "salida", "centro", "remate"].map((tag) => (
            <button key={tag} onClick={() => useAppStore.getState().addTag(tag, videoRef.current?.currentTime ?? 0)}>
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
        <p className="muted-panel">Modo honesto: tagging y tracking manual para validar clips, no promesa de análisis automático completo.</p>
        <canvas
          id="trackingCanvas"
          width={720}
          height={405}
          ref={(canvas) => {
            const context = canvas?.getContext("2d");
            if (!canvas || !context) return;
            context.fillStyle = "#0a1418";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.strokeStyle = "#5eead4";
            context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
            context.fillStyle = "#eff7fa";
            context.fillText("Captura de frame / tracking manual", 28, 36);
          }}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={() => useAppStore.getState().addTrack(50, 50, videoRef.current?.currentTime ?? 0)}>Marcar punto</button>
          <button className="secondary">Export CSV</button>
        </div>
      </div>
    </section>
  );
}

function formatTime(sec: number) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
