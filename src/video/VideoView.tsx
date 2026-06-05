import {
  type VideoTag,
  type VideoTrack,
  useAppStore,
  videoMomentFromTime,
} from "@/state/useAppStore";
import {
  formatVideoEvidenceTime,
  getVideoEvidenceItems,
  summarizeVideoEvidence,
  videoEvidenceToTagsText,
} from "@/video/videoEvidence";
import {
  VIDEO_PATTERN_DEFINITIONS,
  consolidateVideoPatternScan,
  type VideoPatternId,
  type VideoPatternScanBatchResponse,
  type VideoPatternScanFrame,
  type VideoPatternScanResult,
  videoPatternScanToEvidenceText,
} from "@/video/videoPatternScan";
import { requestVideoPatternScanBatch } from "@/video/videoPatternScanClient";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type PixelPoint = { x: number; y: number };

type PatchDescriptor = {
  values: Uint8Array;
  size: number;
};

type TrackerRuntime = {
  template: PatchDescriptor;
  lastPoint: PixelPoint;
  lastSampleTime: number;
  added: number;
};

type TrackerUiState = {
  armed: boolean;
  active: boolean;
  confidence: number | null;
  added: number;
  message: string;
};

type VideoPatternScanUiConfig = {
  sampleEverySeconds: number;
  maxFrames: number;
  ownColor: string;
  rivalColor: string;
  attackDirectionFirstHalf: "leftToRight" | "rightToLeft" | "unknown";
  patterns: VideoPatternId[];
};

type VideoPatternScanUiState = {
  running: boolean;
  progress: string;
  sampled: number;
  analyzed: number;
  error: string | null;
  result: VideoPatternScanResult | null;
};

const TRACK_INTERVAL_SECONDS = 0.22;
const TRACK_PATCH_SIZE = 28;
const TRACK_DESCRIPTOR_SIZE = 12;
const TRACK_SEARCH_RADIUS = 52;
const TRACK_SEARCH_STEP = 4;
const TRACK_MIN_CONFIDENCE = 0.58;
const PATTERN_SCAN_BATCH_SIZE = 6;

export function VideoView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRuntimeRef = useRef<TrackerRuntime | null>(null);
  const rafRef = useRef<number | null>(null);
  const tags = useAppStore((state) => state.tags);
  const tracks = useAppStore((state) => state.tracks);
  const players = useAppStore((state) => state.team.players);
  const updateTrack = useAppStore((state) => state.updateTrack);
  const removeTrack = useAppStore((state) => state.removeTrack);
  const clearAssistedTracks = useAppStore((state) => state.clearAssistedTracks);
  const [matchId, setMatchId] = useState("current-match");
  const [playerId, setPlayerId] = useState("");
  const [zone, setZone] = useState("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<VideoTag["severity"]>("medium");
  const [tracker, setTracker] = useState<TrackerUiState>({
    armed: false,
    active: false,
    confidence: null,
    added: 0,
    message: "Listo para tracking manual.",
  });
  const [scanConfig, setScanConfig] = useState<VideoPatternScanUiConfig>({
    sampleEverySeconds: 10,
    maxFrames: 180,
    ownColor: "",
    rivalColor: "",
    attackDirectionFirstHalf: "unknown",
    patterns: VIDEO_PATTERN_DEFINITIONS.map(
      (definition) => definition.id,
    ) as VideoPatternId[],
  });
  const [scanState, setScanState] = useState<VideoPatternScanUiState>({
    running: false,
    progress: "Listo para escanear patrones.",
    sampled: 0,
    analyzed: 0,
    error: null,
    result: null,
  });
  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players],
  );
  const currentMatchId = normalizeMatchId(matchId);
  const evidenceItems = useMemo(
    () => getVideoEvidenceItems(tags, tracks, currentMatchId),
    [currentMatchId, tags, tracks],
  );
  const evidenceSummary = useMemo(
    () => summarizeVideoEvidence(tags, tracks, currentMatchId),
    [currentMatchId, tags, tracks],
  );
  const assistedTrackCount = useMemo(
    () =>
      tracks.filter(
        (track) =>
          track.matchId === currentMatchId && track.label.startsWith("assist-"),
      ).length,
    [currentMatchId, tracks],
  );
  const recentTracks = useMemo(
    () =>
      [...tracks]
        .filter((track) => track.matchId === currentMatchId)
        .sort((a, b) => b.time - a.time)
        .slice(0, 12),
    [currentMatchId, tracks],
  );

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
    drawVideoOrTrackingCanvas(
      videoRef.current,
      canvasRef.current,
      tracks,
      trackerRuntimeRef.current?.lastPoint,
    );
  }, [tracks]);

  useEffect(() => {
    if (!tracker.active) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      processAssistedTracking();
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [tracker.active]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    drawVideoOrTrackingCanvas(
      video,
      canvas,
      tracks,
      trackerRuntimeRef.current?.lastPoint,
    );
  }

  function markTrackFromClick(event: PointerEvent<HTMLCanvasElement>) {
    if (tracker.armed) {
      startAssistedTracking(event);
      return;
    }

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const time = videoRef.current?.currentTime ?? 0;
    useAppStore.getState().addTrack({
      matchId: normalizeMatchId(matchId),
      time,
      x: clampPercent(x),
      y: clampPercent(y),
      label: "manual",
      moment: videoMomentFromTime(time),
      playerId: selectedPlayer?.id,
      playerName: selectedPlayer?.name,
      zone: optionalText(zone),
      note: optionalText(note),
    });
  }

  function armAssistedTracking() {
    captureFrame();
    setTracker({
      armed: true,
      active: false,
      confidence: null,
      added: 0,
      message: "Click sobre el jugador en el canvas para iniciar.",
    });
  }

  function stopAssistedTracking(message = "Tracking asistido detenido.") {
    trackerRuntimeRef.current = null;
    setTracker((current) => ({
      ...current,
      armed: false,
      active: false,
      message,
    }));
  }

  function startAssistedTracking(event: PointerEvent<HTMLCanvasElement>) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setTracker((current) => ({
        ...current,
        message: "No hay frame de video disponible para inicializar.",
      }));
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    const frame = drawVideoToFrameCanvas(video, canvas);
    const template = extractPatchDescriptor(
      frame.context,
      point,
      TRACK_PATCH_SIZE,
      TRACK_DESCRIPTOR_SIZE,
    );
    if (!template) {
      setTracker((current) => ({
        ...current,
        message: "Ese punto esta muy cerca del borde. Elegi otro frame/punto.",
      }));
      return;
    }

    trackerRuntimeRef.current = {
      template,
      lastPoint: point,
      lastSampleTime: video.currentTime,
      added: 0,
    };
    addAssistedTrack(point, "assist-start", 1);
    drawVideoOrTrackingCanvas(video, canvas, tracks, point);
    setTracker({
      armed: false,
      active: true,
      confidence: 1,
      added: 0,
      message: "Tracking asistido activo. Reproducí el video para sumar puntos.",
    });
  }

  function processAssistedTracking() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const runtime = trackerRuntimeRef.current;
    if (!video || !canvas || !runtime || !video.videoWidth) return;
    if (video.paused || video.ended) return;
    if (video.currentTime - runtime.lastSampleTime < TRACK_INTERVAL_SECONDS) {
      return;
    }

    const frame = drawVideoToFrameCanvas(video, canvas);
    const match = findBestPatchMatch(
      frame.context,
      runtime.template,
      runtime.lastPoint,
      TRACK_SEARCH_RADIUS,
      TRACK_SEARCH_STEP,
      TRACK_PATCH_SIZE,
    );
    runtime.lastSampleTime = video.currentTime;

    if (!match || match.confidence < TRACK_MIN_CONFIDENCE) {
      stopAssistedTracking(
        "Baja confianza. Tracking pausado; rearmalo en otro frame.",
      );
      drawVideoOrTrackingCanvas(video, canvas, tracks);
      return;
    }

    runtime.lastPoint = match.point;
    runtime.template = blendDescriptors(runtime.template, match.descriptor, 0.1);
    runtime.added += 1;
    addAssistedTrack(match.point, "assist-track", match.confidence);
    drawVideoOrTrackingCanvas(video, canvas, tracks, match.point);
    setTracker({
      armed: false,
      active: true,
      confidence: match.confidence,
      added: runtime.added,
      message: "Tracking asistido activo.",
    });
  }

  function addAssistedTrack(
    point: PixelPoint,
    label: "assist-start" | "assist-track",
    confidence: number,
  ) {
    const canvas = canvasRef.current;
    const time = videoRef.current?.currentTime ?? 0;
    if (!canvas) return;
    useAppStore.getState().addTrack({
      matchId: normalizeMatchId(matchId),
      time,
      x: clampPercent((point.x / canvas.width) * 100),
      y: clampPercent((point.y / canvas.height) * 100),
      label,
      moment: videoMomentFromTime(time),
      playerId: selectedPlayer?.id,
      playerName: selectedPlayer?.name,
      zone: optionalText(zone),
      note: [
        optionalText(note),
        `tracking asistido confianza ${Math.round(confidence * 100)}%`,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }

  function drawVideoToFrameCanvas(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
  ) {
    const frameCanvas = frameCanvasRef.current ?? document.createElement("canvas");
    frameCanvasRef.current = frameCanvas;
    frameCanvas.width = canvas.width;
    frameCanvas.height = canvas.height;
    const context = frameCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No se pudo leer el canvas de tracking.");
    context.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
    return { canvas: frameCanvas, context };
  }

  function addVideoTag(label: string) {
    const time = videoRef.current?.currentTime ?? 0;
    useAppStore.getState().addTag({
      matchId: normalizeMatchId(matchId),
      label,
      time,
      moment: videoMomentFromTime(time),
      playerId: selectedPlayer?.id,
      playerName: selectedPlayer?.name,
      zone: optionalText(zone),
      note: optionalText(note),
      severity,
    });
  }

  function confirmTrack(track: VideoTrack) {
    updateTrack(track.id, {
      label: track.label.startsWith("assist-")
        ? "confirmed-track"
        : track.label,
      note: [track.note, "validado por staff"].filter(Boolean).join("; "),
    });
  }

  function sendEvidenceToPostMatch() {
    const evidenceText = videoEvidenceToTagsText(tags, tracks, currentMatchId);
    const store = useAppStore.getState();
    store.setPendingPostMatchImport({
      threadId: store.weeklyDecisionThread?.id ?? null,
      source: "videoEvidence",
      observationIds: [],
      evidenceText,
    });
    store.setAiMode("postMatch");
    store.setView("ai");
  }

  async function runPatternScan() {
    const video = videoRef.current;
    if (!video?.src || !Number.isFinite(video.duration) || !video.videoWidth) {
      setScanState((current) => ({
        ...current,
        error: "Carga el video y espera a que tenga metadata antes de escanear.",
      }));
      return;
    }
    if (!scanConfig.patterns.length) {
      setScanState((current) => ({
        ...current,
        error: "Elegi al menos un patron tactico para buscar.",
      }));
      return;
    }

    const previousTime = video.currentTime;
    const wasPaused = video.paused;
    const batches: VideoPatternScanBatchResponse[] = [];
    setScanState({
      running: true,
      progress: "Muestreando frames del partido...",
      sampled: 0,
      analyzed: 0,
      error: null,
      result: null,
    });

    try {
      video.pause();
      const sampledFrames = await extractVideoPatternFrames(video, scanConfig);
      if (!sampledFrames.length) {
        throw new Error("No se pudieron extraer frames analizables del video.");
      }
      setScanState((current) => ({
        ...current,
        sampled: sampledFrames.length,
        progress: `Frames muestreados: ${sampledFrames.length}. Enviando a IA visual...`,
      }));

      for (let index = 0; index < sampledFrames.length; index += PATTERN_SCAN_BATCH_SIZE) {
        const batch = sampledFrames.slice(index, index + PATTERN_SCAN_BATCH_SIZE);
        const batchResponse = await requestVideoPatternScanBatch({
          matchId: currentMatchId,
          ownColor: optionalText(scanConfig.ownColor),
          rivalColor: optionalText(scanConfig.rivalColor),
          attackDirectionFirstHalf: scanConfig.attackDirectionFirstHalf,
          patterns: scanConfig.patterns,
          frames: batch,
        });
        batches.push(batchResponse);
        const analyzed = Math.min(index + batch.length, sampledFrames.length);
        setScanState((current) => ({
          ...current,
          analyzed,
          progress: `Analizados ${analyzed}/${sampledFrames.length} frames.`,
        }));
      }

      const result = consolidateVideoPatternScan({
        matchId: currentMatchId,
        sampledFrames: sampledFrames.length,
        batches,
      });
      setScanState({
        running: false,
        progress: "Scan terminado. Revisar patrones antes de enviarlos como evidencia.",
        sampled: sampledFrames.length,
        analyzed: sampledFrames.length,
        error: null,
        result,
      });
    } catch (error) {
      setScanState((current) => ({
        ...current,
        running: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar el scan visual.",
      }));
    } finally {
      await seekVideo(video, previousTime).catch(() => undefined);
      if (!wasPaused) void video.play().catch(() => undefined);
    }
  }

  function toggleScanPattern(patternId: VideoPatternId) {
    setScanConfig((current) => ({
      ...current,
      patterns: current.patterns.includes(patternId)
        ? current.patterns.filter((id) => id !== patternId)
        : [...current.patterns, patternId],
    }));
  }

  function sendPatternScanToPostMatch() {
    if (!scanState.result) return;
    const store = useAppStore.getState();
    store.setPendingPostMatchImport({
      threadId: store.weeklyDecisionThread?.id ?? null,
      source: "videoEvidence",
      observationIds: [],
      evidenceText: videoPatternScanToEvidenceText(scanState.result),
    });
    store.setAiMode("postMatch");
    store.setView("ai");
  }

  function sendPatternScanToCoach() {
    if (!scanState.result) return;
    const store = useAppStore.getState();
    store.setAiPrompt(
      [
        "Analiza este Video Pattern Scan como evidencia asistida.",
        "No lo trates como tracking automatico perfecto: usa confianza, patrones repetidos y limitaciones.",
        videoPatternScanToEvidenceText(scanState.result),
      ].join("\n\n"),
    );
    store.setAiMode("coach");
    store.setView("ai");
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
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            Partido
            <input
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
              placeholder="vs Cantinas FC"
            />
          </label>
          <label>
            Jugador
            <select
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
            >
              <option value="">Sin jugador</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.num} {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zona
            <input
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="banda izquierda, carril central..."
            />
          </label>
          <label>
            Severidad
            <select
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as VideoTag["severity"])
              }
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </label>
        </div>
        <label className="stacked-field" style={{ marginTop: 12 }}>
          Nota para el siguiente tag/track
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej: el lateral queda alto y no llega a cerrar."
          />
        </label>
        <div className="video-evidence-panel">
          <div className="section-title">
            <div>
              <span className="panel-eyebrow">Circuito post-partido</span>
              <h4>Evidencia lista para IA</h4>
            </div>
            <button
              type="button"
              disabled={!evidenceSummary.total}
              onClick={sendEvidenceToPostMatch}
            >
              Enviar evidencia a post-partido
            </button>
          </div>
          <EvidenceSummaryStrip summary={evidenceSummary} />
          {evidenceSummary.assistedTracks ? (
            <p className="video-evidence-warning">
              El tracking asistido entra con confianza baja hasta que el staff
              lo confirme.
            </p>
          ) : null}
          {evidenceItems.length ? (
            <div className="video-evidence-preview">
              {evidenceItems.slice(0, 6).map((item) => (
                <article
                  className={`video-evidence-item ${item.kind} ${item.confidence}`}
                  key={item.id}
                >
                  <span>{formatVideoEvidenceTime(item.time)}</span>
                  <b>{item.label}</b>
                  <small>
                    {item.sourceLabel} - {item.confidenceLabel}
                    {item.zone ? ` - ${item.zone}` : ""}
                    {item.playerName ? ` - ${item.playerName}` : ""}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-panel">
              Marca tags o puntos de tracking para armar evidencia del partido.
            </p>
          )}
        </div>
        <div className="video-scan-panel">
          <div className="section-title">
            <div>
              <span className="panel-eyebrow">Avanzado / IA visual</span>
              <h4>Escaneo avanzado de video</h4>
            </div>
            <button
              type="button"
              disabled={scanState.running}
              onClick={runPatternScan}
            >
              {scanState.running ? "Escaneando..." : "Escanear patrones"}
            </button>
          </div>
          <p className="muted-panel">
            Muestrea frames del partido y busca patrones tacticos visibles. Es
            una capa secundaria de evidencia asistida: no reemplaza la revision
            del staff ni forma parte del loop principal.
          </p>
          <div className="form-grid video-scan-controls">
            <label>
              Cada
              <select
                value={scanConfig.sampleEverySeconds}
                onChange={(event) =>
                  setScanConfig((current) => ({
                    ...current,
                    sampleEverySeconds: Number(event.target.value),
                  }))
                }
              >
                <option value={5}>5 segundos</option>
                <option value={10}>10 segundos</option>
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
              </select>
            </label>
            <label>
              Max frames
              <input
                type="number"
                min={30}
                max={600}
                step={30}
                value={scanConfig.maxFrames}
                onChange={(event) =>
                  setScanConfig((current) => ({
                    ...current,
                    maxFrames: clampNumber(Number(event.target.value), 30, 600),
                  }))
                }
              />
            </label>
            <label>
              Tu color
              <input
                value={scanConfig.ownColor}
                onChange={(event) =>
                  setScanConfig((current) => ({
                    ...current,
                    ownColor: event.target.value,
                  }))
                }
                placeholder="camiseta blanca"
              />
            </label>
            <label>
              Rival
              <input
                value={scanConfig.rivalColor}
                onChange={(event) =>
                  setScanConfig((current) => ({
                    ...current,
                    rivalColor: event.target.value,
                  }))
                }
                placeholder="camiseta azul"
              />
            </label>
          </div>
          <label className="stacked-field">
            Direccion de ataque 1T
            <select
              value={scanConfig.attackDirectionFirstHalf}
              onChange={(event) =>
                setScanConfig((current) => ({
                  ...current,
                  attackDirectionFirstHalf: event.target.value as
                    | "leftToRight"
                    | "rightToLeft"
                    | "unknown",
                }))
              }
            >
              <option value="unknown">No lo se</option>
              <option value="leftToRight">Izquierda a derecha</option>
              <option value="rightToLeft">Derecha a izquierda</option>
            </select>
          </label>
          <div className="video-scan-patterns">
            {VIDEO_PATTERN_DEFINITIONS.map((definition) => (
              <button
                type="button"
                key={definition.id}
                className={
                  scanConfig.patterns.includes(definition.id)
                    ? "scan-pattern active"
                    : "scan-pattern"
                }
                onClick={() => toggleScanPattern(definition.id)}
              >
                {definition.label}
              </button>
            ))}
          </div>
          <div className="tracking-status">
            <b>{scanState.running ? "Analizando" : "Estado"}</b>
            <span>{scanState.progress}</span>
            {scanState.sampled ? <small>{scanState.sampled} frames</small> : null}
            {scanState.result ? (
              <small>Confianza {scanState.result.confidence}</small>
            ) : null}
          </div>
          {scanState.error ? (
            <p className="video-evidence-warning">{scanState.error}</p>
          ) : null}
          {scanState.result ? (
            <div className="video-scan-results">
              <div className="section-title compact-title">
                <div>
                  <span className="panel-eyebrow">Resultado</span>
                  <h4>{scanState.result.summary}</h4>
                </div>
                <div className="toolbar compact-actions">
                  <button type="button" onClick={sendPatternScanToCoach}>
                    Consultar Coach
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={sendPatternScanToPostMatch}
                  >
                    Enviar a post-match
                  </button>
                </div>
              </div>
              {scanState.result.patterns.length ? (
                <div className="video-scan-pattern-list">
                  {scanState.result.patterns.slice(0, 5).map((pattern) => (
                    <article className="video-scan-result" key={pattern.patternId}>
                      <div>
                        <b>{pattern.label}</b>
                        <small>
                          {pattern.count} apariciones - confianza{" "}
                          {Math.round(pattern.avgConfidence * 100)}% -{" "}
                          {pattern.severity}
                        </small>
                      </div>
                      <span>
                        {pattern.timestamps
                          .map(formatVideoEvidenceTime)
                          .join(", ")}
                      </span>
                      <p>{pattern.evidence[0]}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted-panel">
                  No aparecieron patrones con evidencia suficiente en el muestreo.
                </p>
              )}
            </div>
          ) : null}
        </div>
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
              onClick={() => addVideoTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div>
          {tags.map((tag) => (
            <div className="tag-item" key={tag.id}>
              <span>
                <b>{tag.label}</b> · {formatTime(tag.time)}
                {tag.zone ? ` · ${tag.zone}` : ""}
                {tag.playerName ? ` · ${tag.playerName}` : ""}
                {tag.note ? ` · ${tag.note}` : ""}
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
            className={tracker.active ? "danger" : "secondary"}
            onClick={() =>
              tracker.active
                ? stopAssistedTracking()
                : armAssistedTracking()
            }
          >
            {tracker.active ? "Detener asistido" : "Armar asistido"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => exportTracksCsv(tracks)}
          >
            Export CSV
          </button>
        </div>
        <div className="tracking-status">
          <b>{tracker.active ? "Activo" : tracker.armed ? "Armado" : "Manual"}</b>
          <span>{tracker.message}</span>
          {tracker.confidence !== null ? (
            <small>Confianza {Math.round(tracker.confidence * 100)}%</small>
          ) : null}
          {tracker.added ? <small>Puntos sugeridos {tracker.added}</small> : null}
        </div>
        <div className="track-review">
          <div className="track-review-head">
            <div>
              <b>Revision de tracks</b>
              <small>{recentTracks.length} puntos del partido actual</small>
            </div>
            <button
              type="button"
              className="secondary tiny-button"
              disabled={!assistedTrackCount}
              onClick={() => clearAssistedTracks(currentMatchId)}
            >
              Limpiar asistidos
            </button>
          </div>
          {recentTracks.length ? (
            <div className="track-list">
              {recentTracks.map((track) => (
                <div className="track-review-item" key={track.id}>
                  <div>
                    <b>
                      {formatTime(track.time)} · {track.label}
                    </b>
                    <small>
                      {[
                        track.playerName,
                        track.zone,
                        `${track.x.toFixed(1)}%/${track.y.toFixed(1)}%`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    {track.note ? <small>{track.note}</small> : null}
                  </div>
                  <div className="track-review-actions">
                    <button
                      type="button"
                      className="secondary tiny-button"
                      onClick={() => confirmTrack(track)}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="danger tiny-button"
                      onClick={() => removeTrack(track.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-panel">
              Todavia no hay puntos para este partido.
            </p>
          )}
        </div>
        <p className="muted-panel">
          Click normal marca un punto manual. En modo asistido, el primer click
          toma una muestra visual del jugador y sigue esa zona en frames cercanos.
        </p>
      </div>
    </section>
  );
}

function EvidenceSummaryStrip({
  summary,
}: {
  summary: ReturnType<typeof summarizeVideoEvidence>;
}) {
  return (
    <div className="video-evidence-summary">
      <EvidenceCount label="Total" value={summary.total} />
      <EvidenceCount label="Tags" value={summary.tags} />
      <EvidenceCount label="Tracks manuales" value={summary.manualTracks} />
      <EvidenceCount label="Validados" value={summary.confirmedTracks} />
      <EvidenceCount label="Asistidos" value={summary.assistedTracks} tone="low" />
    </div>
  );
}

function EvidenceCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "low";
}) {
  return (
    <div className={`video-evidence-count ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

async function extractVideoPatternFrames(
  video: HTMLVideoElement,
  config: Pick<
    VideoPatternScanUiConfig,
    "sampleEverySeconds" | "maxFrames"
  >,
): Promise<VideoPatternScanFrame[]> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration || !video.videoWidth || !video.videoHeight) return [];

  const rawTimes: number[] = [];
  const startAt = duration > 12 ? 5 : 0;
  const endAt = Math.max(startAt, duration - 2);
  for (
    let time = startAt;
    time <= endAt;
    time += Math.max(5, config.sampleEverySeconds)
  ) {
    rawTimes.push(Math.round(time));
  }

  const times = downsampleTimes(rawTimes, config.maxFrames);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return [];

  const frames: VideoPatternScanFrame[] = [];
  for (const timestampSec of times) {
    await seekVideo(video, timestampSec);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({
      timestampSec,
      imageDataUrl: canvas.toDataURL("image/jpeg", 0.62),
    });
  }

  return frames;
}

function downsampleTimes(times: number[], maxFrames: number) {
  const safeMax = clampNumber(maxFrames, 30, 600);
  if (times.length <= safeMax) return times;
  const step = times.length / safeMax;
  const selected: number[] = [];
  for (let index = 0; index < safeMax; index += 1) {
    selected.push(times[Math.floor(index * step)] ?? times[times.length - 1] ?? 0);
  }
  return [...new Set(selected)];
}

function seekVideo(video: HTMLVideoElement, timestampSec: number) {
  return new Promise<void>((resolve, reject) => {
    const target = clampNumber(timestampSec, 0, video.duration || timestampSec);
    if (Math.abs(video.currentTime - target) < 0.05) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timeout buscando frame del video."));
    }, 3500);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("No se pudo leer el frame del video."));
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = target;
  });
}

function formatTime(sec: number) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function drawVideoOrTrackingCanvas(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  tracks: VideoTrack[],
  activePoint?: PixelPoint,
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  if (video?.videoWidth) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    drawTrackingCanvas(canvas, []);
  }
  drawTrackMarkers(context, canvas, tracks);
  if (activePoint) drawActiveTrackPoint(context, activePoint);
}

function drawTrackingCanvas(
  canvas: HTMLCanvasElement | null,
  tracks: VideoTrack[],
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

function drawActiveTrackPoint(
  context: CanvasRenderingContext2D,
  point: PixelPoint,
) {
  context.save();
  context.beginPath();
  context.arc(point.x, point.y, 13, 0, Math.PI * 2);
  context.strokeStyle = "#38bdf8";
  context.lineWidth = 3;
  context.stroke();
  context.beginPath();
  context.arc(point.x, point.y, 3, 0, Math.PI * 2);
  context.fillStyle = "#e0f2fe";
  context.fill();
  context.restore();
}

function drawTrackMarkers(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  tracks: VideoTrack[],
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

function extractPatchDescriptor(
  context: CanvasRenderingContext2D,
  center: PixelPoint,
  patchSize: number,
  descriptorSize: number,
): PatchDescriptor | null {
  const half = patchSize / 2;
  const sourceX = Math.round(center.x - half);
  const sourceY = Math.round(center.y - half);
  if (
    sourceX < 0 ||
    sourceY < 0 ||
    sourceX + patchSize >= context.canvas.width ||
    sourceY + patchSize >= context.canvas.height
  ) {
    return null;
  }

  const image = context.getImageData(sourceX, sourceY, patchSize, patchSize);
  const values = new Uint8Array(descriptorSize * descriptorSize);
  const cell = patchSize / descriptorSize;

  for (let row = 0; row < descriptorSize; row += 1) {
    for (let col = 0; col < descriptorSize; col += 1) {
      let sum = 0;
      let count = 0;
      const startX = Math.floor(col * cell);
      const endX = Math.min(patchSize, Math.floor((col + 1) * cell));
      const startY = Math.floor(row * cell);
      const endY = Math.min(patchSize, Math.floor((row + 1) * cell));

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const index = (y * patchSize + x) * 4;
          const red = image.data[index] ?? 0;
          const green = image.data[index + 1] ?? 0;
          const blue = image.data[index + 2] ?? 0;
          sum += red * 0.299 + green * 0.587 + blue * 0.114;
          count += 1;
        }
      }

      values[row * descriptorSize + col] = count ? Math.round(sum / count) : 0;
    }
  }

  return { values, size: descriptorSize };
}

function findBestPatchMatch(
  context: CanvasRenderingContext2D,
  template: PatchDescriptor,
  lastPoint: PixelPoint,
  radius: number,
  step: number,
  patchSize: number,
) {
  let best:
    | { point: PixelPoint; descriptor: PatchDescriptor; confidence: number }
    | null = null;

  for (let y = lastPoint.y - radius; y <= lastPoint.y + radius; y += step) {
    for (let x = lastPoint.x - radius; x <= lastPoint.x + radius; x += step) {
      const point = { x, y };
      const descriptor = extractPatchDescriptor(
        context,
        point,
        patchSize,
        template.size,
      );
      if (!descriptor) continue;
      const confidence = compareDescriptors(template, descriptor);
      if (!best || confidence > best.confidence) {
        best = { point, descriptor, confidence };
      }
    }
  }

  return best;
}

function compareDescriptors(a: PatchDescriptor, b: PatchDescriptor) {
  let diff = 0;
  const length = Math.min(a.values.length, b.values.length);
  for (let index = 0; index < length; index += 1) {
    diff += Math.abs((a.values[index] ?? 0) - (b.values[index] ?? 0));
  }
  const averageDiff = diff / Math.max(1, length);
  return clamp01(1 - averageDiff / 255);
}

function blendDescriptors(
  a: PatchDescriptor,
  b: PatchDescriptor,
  amount: number,
): PatchDescriptor {
  const values = new Uint8Array(a.values.length);
  for (let index = 0; index < a.values.length; index += 1) {
    values[index] = Math.round(
      (a.values[index] ?? 0) * (1 - amount) + (b.values[index] ?? 0) * amount,
    );
  }
  return { values, size: a.size };
}

function exportTracksCsv(tracks: VideoTrack[]) {
  const rows = [
    [
      "match_id",
      "time_seconds",
      "moment",
      "x_percent",
      "y_percent",
      "label",
      "player",
      "zone",
      "note",
    ],
    ...tracks.map((track) => [
      track.matchId,
      track.time.toFixed(2),
      track.moment,
      track.x.toFixed(2),
      track.y.toFixed(2),
      track.label,
      track.playerName ?? "",
      track.zone ?? "",
      track.note ?? "",
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

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeMatchId(value: string) {
  return value.trim() || "current-match";
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}
