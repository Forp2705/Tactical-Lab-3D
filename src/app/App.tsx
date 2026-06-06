import { type Layer, catalog } from "@/data";
import { loadSnapshot, saveSnapshot } from "@/state/db";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { AppShell } from "@/ui/AppShell";
import { ViewerCanvasHud } from "@/viewer/ViewerCanvasHud";
import { useViewerKeyboard } from "@/viewer/useKeyboard";
import { Suspense, lazy, useEffect } from "react";
import "./theme.css";
import "./tactical-ui.css";
import "@/ui/tacticalPrimitives.css";

const Scene3D = lazy(() =>
  import("@/viewer/Scene3D").then((m) => ({ default: m.Scene3D })),
);
const LibraryView = lazy(() =>
  import("@/library/LibraryView").then((m) => ({ default: m.LibraryView })),
);
const HomeView = lazy(() =>
  import("@/home/HomeView").then((m) => ({ default: m.HomeView })),
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
  if (store.exportStatus) return;

  const exercise =
    store.viewerExerciseOverride ??
    getExerciseById(store.selectedExerciseId) ??
    catalog[0];
  const duration = Math.max(1, Math.ceil(exercise.scene.duration));
  const previous = {
    time: store.time,
    playing: store.playing,
    speed: store.speed,
  };

  try {
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

const VIEWER_TOGGLES = [
  {
    id: "showZones",
    label: "Zonas",
    description: "Sectores y referencias",
    toggle: () => useAppStore.getState().toggleLayer("showZones"),
  },
  {
    id: "showRuns",
    label: "Carreras",
    description: "Desmarques activos",
    toggle: () => useAppStore.getState().toggleLayer("showRuns"),
  },
  {
    id: "showPasses",
    label: "Pases",
    description: "Rutas del balon",
    toggle: () => useAppStore.getState().toggleLayer("showPasses"),
  },
  {
    id: "showPress",
    label: "Presion",
    description: "Saltos y gatillos",
    toggle: () => useAppStore.getState().toggleLayer("showPress"),
  },
  {
    id: "personalSpace",
    label: "Separacion",
    description: "Ajuste automatico",
    toggle: () => useAppStore.getState().togglePersonalSpace(),
  },
] as const;

export function App() {
  useViewerKeyboard();
  const initialized = useAppStore((state) => state.initialized);
  const view = useAppStore((state) => state.view);

  useEffect(() => {
    let mounted = true;

    loadSnapshot()
      .then((snapshot) => {
        if (!mounted) return;
        if (snapshot) {
          useAppStore.getState().loadSnapshot(snapshot);
          return;
        }
        useAppStore.getState().markInitialized();
      })
      .catch(() => {
        if (!mounted) return;
        useAppStore.getState().markInitialized();
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

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
        workspaceMode: state.workspaceMode,
        teamIdentity: state.teamIdentity,
        gameModel: state.gameModel,
        opponentScout: state.opponentScout,
        session: state.session,
        microcycle: state.microcycle,
        lineupLab: state.lineupLab,
        tags: state.tags,
        tracks: state.tracks,
        manualObservations: state.manualObservations,
        weeklyDecisionThread: state.weeklyDecisionThread,
        aiPrompt: state.aiPrompt,
      });
    };

    const id = window.setInterval(handleSave, 8000);
    return () => window.clearInterval(id);
  }, [initialized]);

  if (!initialized) {
    return (
      <AppShell>
        <ViewFallback />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<ViewFallback />}>
        {view === "home" ? <HomeView /> : null}
        {view === "library" ? <LibraryView /> : null}
        {view === "viewer" ? <ViewerWorkspace /> : null}
        {view === "team" ? <TeamView /> : null}
        {view === "sessions" ? <SessionsView /> : null}
        {view === "video" ? <VideoView /> : null}
        {view === "ai" ? <AiView /> : null}
        {view === "player" ? <PlayerView /> : null}
      </Suspense>
    </AppShell>
  );
}

function ViewerWorkspace() {
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
  const phase =
    selectedExercise.scene.phases.find(
      (item) => time >= item.start && time <= item.end,
    ) ?? selectedExercise.scene.phases[0];
  const visibleToggles = [
    { id: "showZones", active: showZones },
    { id: "showRuns", active: showRuns },
    { id: "showPasses", active: showPasses },
    { id: "showPress", active: showPress },
    { id: "personalSpace", active: personalSpace },
  ] as const;

  return (
    <section className="viewer-layout">
      <div className="stage-card">
        <div className="stage-header">
          <div>
            <h3>{selectedExercise.title}</h3>
            <p>
              {selectedExercise.phase} - {selectedExercise.principle} -{" "}
              {selectedExercise.players.min}-{selectedExercise.players.max} jugadores
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
              onClick={() => useAppStore.getState().setPresentationMode(false)}
            >
              Salir
            </button>
          ) : null}
        </div>
        <div className="canvas-wrap">
          <div className="phase-badge">{phaseLabel(selectedExercise, time)}</div>
          {exportStatus ? (
            <div className="export-overlay">
              <span className="export-spinner" />
              {exportStatus.phase === "recording"
                ? `Grabando escena (${exportStatus.format.toUpperCase()})...`
                : "Procesando video..."}
            </div>
          ) : null}
          <ViewerCanvasHud
            exercise={selectedExercise}
            time={time}
            cameraMode={camera}
            showZones={showZones}
            showRuns={showRuns}
            showPasses={showPasses}
            showPress={showPress}
            layers={layers}
            personalSpace={personalSpace}
          />
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
          <div className="viewer-panel-card">
            <span className="panel-eyebrow">Lectura del ejercicio</span>
            <h3>{selectedExercise.title}</h3>
            <p>{selectedExercise.objective.primary}</p>
            <div className="viewer-summary-grid">
              <ViewerStatCard label="Fase viva" value={phase.name} />
              <ViewerStatCard label="Principio" value={selectedExercise.principle} />
              <ViewerStatCard
                label="Jugadores"
                value={`${selectedExercise.players.min}-${selectedExercise.players.max}`}
              />
              <ViewerStatCard label="Exito" value={selectedExercise.success} />
            </div>
          </div>

          <div className="viewer-panel-card">
            <div className="section-title">
              <div>
                <span className="panel-eyebrow">Vista</span>
                <h3>Claridad tactica</h3>
              </div>
              <label className="viewer-quality-select">
                Calidad
                <select
                  value={viewerQuality}
                  onChange={(event) =>
                    useAppStore
                      .getState()
                      .setViewerQuality(event.target.value as typeof viewerQuality)
                  }
                >
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </label>
            </div>
            <div className="viewer-toggle-grid">
              {VIEWER_TOGGLES.map((toggle) => {
                const active =
                  visibleToggles.find((item) => item.id === toggle.id)?.active ??
                  false;
                return (
                  <button
                    type="button"
                    key={toggle.id}
                    className={`viewer-toggle-card ${active ? "active" : ""}`}
                    onClick={toggle.toggle}
                  >
                    <b>{toggle.label}</b>
                    <span>{toggle.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="viewer-panel-card">
            <span className="panel-eyebrow">Capas tacticas</span>
            <div className="viewer-layer-pills">
              {TACTICAL_LAYERS.map((layer) => (
                <button
                  type="button"
                  key={layer.id}
                  className={`viewer-layer-pill ${
                    layers[layer.id] ? "active" : ""
                  }`}
                  onClick={() =>
                    useAppStore.getState().toggleTacticalLayer(layer.id)
                  }
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          <div className="viewer-panel-card">
            <span className="panel-eyebrow">Coaching</span>
            <p>{phase.notes ?? "Sin nota tactica especifica para esta fase."}</p>
            <ul className="viewer-note-list">
              {selectedExercise.coaching.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => useAppStore.getState().addToSession(selectedExercise.id)}
          >
            Agregar a sesion
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => useAppStore.getState().duplicateSelectedExercise()}
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
  );
}

function ViewerStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="viewer-stat-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function phaseLabel(exercise: (typeof catalog)[number], time: number) {
  const phase =
    exercise.scene.phases.find(
      (item) => time >= item.start && time <= item.end,
    ) ?? exercise.scene.phases[0];
  return phase?.name ?? "Setup";
}
