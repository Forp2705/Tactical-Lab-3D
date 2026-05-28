import { type Layer, catalog } from "@/data";
import { loadSnapshot, saveSnapshot } from "@/state/db";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { AppShell } from "@/ui/AppShell";
import { useViewerKeyboard } from "@/viewer/useKeyboard";
import { Suspense, lazy, useEffect } from "react";
import "./theme.css";

// Code-splitting: cada vista y el visor 3D (Three.js) se cargan bajo demanda
// para sacarlos del bundle inicial.
const Scene3D = lazy(() =>
  import("@/viewer/Scene3D").then((m) => ({ default: m.Scene3D })),
);
const LibraryView = lazy(() =>
  import("@/library/LibraryView").then((m) => ({ default: m.LibraryView })),
);
const TeamView = lazy(() =>
  import("@/team/TeamView").then((m) => ({ default: m.TeamView })),
);
const SessionsView = lazy(() =>
  import("@/sessions/SessionsView").then((m) => ({ default: m.SessionsView })),
);
const VideoView = lazy(() =>
  import("@/video/VideoView").then((m) => ({ default: m.VideoView })),
);
const AiView = lazy(() =>
  import("@/ai/AiView").then((m) => ({ default: m.AiView })),
);
const PlayerView = lazy(() =>
  import("@/export/PlayerView").then((m) => ({ default: m.PlayerView })),
);

function ViewFallback() {
  return <div className="view-loading">Cargando modulo...</div>;
}

async function exportCurrentCanvas(format: "mp4" | "gif") {
  const canvas = document.querySelector(
    ".canvas-wrap canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) return;

  const store = useAppStore.getState();
  if (store.exportStatus) return; // ya hay una exportacion en curso

  const exercise =
    store.viewerExerciseOverride ??
    getExerciseById(store.selectedExerciseId) ??
    catalog[0];
  // Grabamos la jugada completa: desde t=0 hasta el final de la escena.
  const duration = Math.max(1, Math.ceil(exercise.scene.duration));

  // Estado de reproduccion previo, para restaurarlo al terminar.
  const previous = {
    time: store.time,
    playing: store.playing,
    speed: store.speed,
  };

  try {
    // Reproducimos la escena desde el inicio, a 1x, mientras se graba.
    store.setTime(0);
    store.setSpeed(1);
    if (!useAppStore.getState().playing) store.togglePlaying();

    const { exportCanvasMedia } = await import("@/export/media");
    await exportCanvasMedia(canvas, format, duration, (phase) =>
      useAppStore.getState().setExportStatus({ phase, format }),
    );
  } finally {
    const after = useAppStore.getState();
    after.setTime(previous.time);
    after.setSpeed(previous.speed);
    if (after.playing !== previous.playing) after.togglePlaying();
    after.setExportStatus(null);
  }
}

const TACTICAL_LAYERS: { id: Layer; label: string }[] = [
  { id: "withBall", label: "Con pelota" },
  { id: "withoutBall", label: "Sin pelota" },
  { id: "press", label: "Presion" },
  { id: "cover", label: "Coberturas" },
  { id: "altA", label: "Alt A" },
  { id: "altB", label: "Alt B" },
  { id: "rival", label: "Rival" },
  { id: "abp", label: "ABP" },
  { id: "notes", label: "Notas" },
];

export function App() {
  useViewerKeyboard();
  const view = useAppStore((state) => state.view);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const viewerExerciseOverride = useAppStore(
    (state) => state.viewerExerciseOverride,
  );
  const presentationMode = useAppStore((state) => state.presentationMode);
  const selectedExercise =
    viewerExerciseOverride ?? getExerciseById(selectedExerciseId) ?? catalog[0];
  const camera = useAppStore((state) => state.camera);
  const viewerQuality = useAppStore((state) => state.viewerQuality);
  const time = useAppStore((state) => state.time);
  const playing = useAppStore((state) => state.playing);
  const speed = useAppStore((state) => state.speed);
  const showZones = useAppStore((state) => state.showZones);
  const showRuns = useAppStore((state) => state.showRuns);
  const showPasses = useAppStore((state) => state.showPasses);
  const showPress = useAppStore((state) => state.showPress);
  const personalSpace = useAppStore((state) => state.personalSpace);
  const layers = useAppStore((state) => state.layers);
  const exportStatus = useAppStore((state) => state.exportStatus);

  useEffect(() => {
    let mounted = true;
    loadSnapshot().then((snapshot) => {
      if (!mounted || !snapshot) return;
      useAppStore.getState().loadSnapshot(snapshot);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleSave = () => {
      const state = useAppStore.getState();
      void saveSnapshot({
        version: state.version,
        selectedExerciseId: state.selectedExerciseId,
        view: state.view,
        camera: state.camera,
        viewerQuality: state.viewerQuality,
        time: state.time,
        speed: state.speed,
        playing: state.playing,
        search: state.search,
        phase: state.phase,
        level: state.level,
        principle: state.principle,
        exerciseVariants: state.exerciseVariants,
        showZones: state.showZones,
        showRuns: state.showRuns,
        showPasses: state.showPasses,
        showPress: state.showPress,
        personalSpace: state.personalSpace,
        layers: state.layers,
        team: state.team,
        session: state.session,
        microcycle: state.microcycle,
        tags: state.tags,
        tracks: state.tracks,
        aiPrompt: state.aiPrompt,
      });
    };
    const id = window.setInterval(handleSave, 8000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AppShell>
      <Suspense fallback={<ViewFallback />}>
        {view === "library" ? <LibraryView /> : null}
      {view === "viewer" ? (
        <section className="viewer-layout">
          <div className="stage-card">
            <div className="stage-header">
              <div>
                <h3>{selectedExercise.title}</h3>
                <p>
                  {selectedExercise.phase} · {selectedExercise.principle} ·{" "}
                  {selectedExercise.players.min}-{selectedExercise.players.max}{" "}
                  jugadores
                </p>
              </div>
              <div className="segmented">
                {(["top", "iso", "broadcast"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={camera === item ? "active" : ""}
                    onClick={() => useAppStore.getState().setCamera(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {presentationMode ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    useAppStore.getState().setPresentationMode(false)
                  }
                >
                  Salir
                </button>
              ) : null}
            </div>
            <div className="canvas-wrap">
              <div className="phase-badge">
                {phaseLabel(selectedExercise, time)}
              </div>
              {exportStatus ? (
                <div className="export-overlay">
                  <span className="export-spinner" />
                  {exportStatus.phase === "recording"
                    ? `Grabando escena (${exportStatus.format.toUpperCase()})...`
                    : "Procesando video..."}
                </div>
              ) : null}
              <Scene3D
                exercise={selectedExercise}
                time={time}
                cameraMode={camera}
                quality={viewerQuality}
                showZones={showZones}
                showRuns={showRuns}
                showPasses={showPasses}
                showPress={showPress}
                layers={layers}
                personalSpace={personalSpace}
              />
            </div>
            <div className="timeline">
              <button
                type="button"
                onClick={() => useAppStore.getState().togglePlaying()}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => useAppStore.getState().setTime(0)}
              >
                Reiniciar
              </button>
              <input
                type="range"
                min={0}
                max={selectedExercise.scene.duration}
                step={0.01}
                value={time}
                onChange={(event) =>
                  useAppStore.getState().setTime(Number(event.target.value))
                }
              />
              <span>{time.toFixed(1)}s</span>
              <label>
                Velocidad
                <select
                  value={speed}
                  onChange={(event) =>
                    useAppStore.getState().setSpeed(Number(event.target.value))
                  }
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>
            </div>
          </div>
          {presentationMode ? null : (
            <aside className="team-card viewer-side">
              <h3>Lectura del ejercicio</h3>
              <p>
                <b>Objetivo:</b> {selectedExercise.objective.primary}
              </p>
              <p>
                <b>Éxito:</b> {selectedExercise.success}
              </p>
              <div className="layer-grid">
                <label>
                  Calidad
                  <select
                    value={viewerQuality}
                    onChange={(event) =>
                      useAppStore
                        .getState()
                        .setViewerQuality(
                          event.target.value as typeof viewerQuality,
                        )
                    }
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showZones}
                    onChange={() =>
                      useAppStore.getState().toggleLayer("showZones")
                    }
                  />{" "}
                  Zonas
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRuns}
                    onChange={() =>
                      useAppStore.getState().toggleLayer("showRuns")
                    }
                  />{" "}
                  Carreras
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showPasses}
                    onChange={() =>
                      useAppStore.getState().toggleLayer("showPasses")
                    }
                  />{" "}
                  Pases
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showPress}
                    onChange={() =>
                      useAppStore.getState().toggleLayer("showPress")
                    }
                  />{" "}
                  Presión
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={personalSpace}
                    onChange={() =>
                      useAppStore.getState().togglePersonalSpace()
                    }
                  />{" "}
                  Separación auto
                </label>
              </div>
              <div className="layer-grid" style={{ marginTop: 12 }}>
                {TACTICAL_LAYERS.map((layer) => (
                  <label key={layer.id}>
                    <input
                      type="checkbox"
                      checked={layers[layer.id]}
                      onChange={() =>
                        useAppStore.getState().toggleTacticalLayer(layer.id)
                      }
                    />{" "}
                    {layer.label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  useAppStore.getState().addToSession(selectedExercise.id)
                }
              >
                Agregar a sesión
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  useAppStore.getState().duplicateSelectedExercise()
                }
              >
                Duplicar como variante
              </button>
              <button
                type="button"
                disabled={!!exportStatus}
                onClick={() => void exportCurrentCanvas("mp4")}
              >
                {exportStatus?.format === "mp4" ? "Exportando..." : "Exportar MP4"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exportStatus}
                onClick={() => void exportCurrentCanvas("gif")}
              >
                {exportStatus?.format === "gif" ? "Exportando..." : "Exportar GIF"}
              </button>
            </aside>
          )}
        </section>
      ) : null}
      {view === "team" ? <TeamView /> : null}
      {view === "sessions" ? <SessionsView /> : null}
      {view === "video" ? <VideoView /> : null}
      {view === "ai" ? <AiView /> : null}
        {view === "player" ? <PlayerView /> : null}
      </Suspense>
    </AppShell>
  );
}

function phaseLabel(exercise: (typeof catalog)[number], time: number) {
  const phase =
    exercise.scene.phases.find(
      (item) => time >= item.start && time <= item.end,
    ) ?? exercise.scene.phases[0];
  return phase?.name ?? "Setup";
}
