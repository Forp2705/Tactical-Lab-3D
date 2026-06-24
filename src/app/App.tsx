import { type Layer, catalog } from "@/data";
import { loadSnapshot, saveSnapshot } from "@/state/db";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { AppShell } from "@/ui/AppShell";
import { ViewerCanvasHud } from "@/viewer/ViewerCanvasHud";
import { getMatchFrame } from "@/viewer/lib/matchEngine";
import { useViewerKeyboard } from "@/viewer/useKeyboard";
import { Suspense, lazy, useEffect, useMemo } from "react";
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
const TacticalBoardView = lazy(() =>
  import("@/board/TacticalBoardView").then((m) => ({
    default: m.TacticalBoardView,
  })),
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

function slugifyForFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "ejercicio";
}

async function exportCurrentCanvasImage() {
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
  const today = new Date().toISOString().slice(0, 10);
  const filename = `romboiq-${slugifyForFilename(exercise.title)}-${today}.png`;

  try {
    store.setExportStatus({ phase: "recording", format: "png" });
    const { exportCanvasImage } = await import("@/export/media");
    await exportCanvasImage(canvas, filename);
  } finally {
    useAppStore.getState().setExportStatus(null);
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
        libraryFavoriteIds: state.libraryFavoriteIds,
        libraryRecentOpens: state.libraryRecentOpens,
        sketches: state.sketches,
        tacticalBoards: state.tacticalBoards,
        activeBoardId: state.activeBoardId,
        activeBoardSceneId: state.activeBoardSceneId,
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
        {view === "board" ? <TacticalBoardView /> : null}
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
  // Unico call-site del match engine en el viewer: se computa aca y se inyecta
  // a Scene3D y al HUD (antes cada uno lo recalculaba por su cuenta, 2x/frame).
  const frame = useMemo(
    () => getMatchFrame(selectedExercise, time, { personalSpace }),
    [selectedExercise, time, personalSpace],
  );

  return (
    <section className="viewer-layout">
      <div className="stage-card viewer-stage">
        <div className="stage-header">
          <div>
            <h3>{selectedExercise.title}</h3>
            <p>
              {selectedExercise.phase} - {selectedExercise.principle} -{" "}
              {selectedExercise.players.min}-{selectedExercise.players.max} jugadores
            </p>
            <div className="viewer-team-legend" aria-label="Leyenda de equipos">
              <span>
                <i className="own" />
                Equipo propio
              </span>
              <span>
                <i className="rival" />
                Rival
              </span>
            </div>
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
          {exportStatus ? (
            <div className="export-overlay">
              <span className="export-spinner" />
              {exportStatus.format === "png"
                ? "Generando imagen..."
                : exportStatus.phase === "recording"
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
            frame={frame}
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
            frame={frame}
          />
        </div>
        <ViewerInsightStrip exercise={selectedExercise} phase={phase} />
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

          <div className="viewer-cta-row">
            <button
              type="button"
              className="viewer-primary-action"
              onClick={() => useAppStore.getState().addToSession(selectedExercise.id)}
            >
              Agregar a sesion
            </button>
            <button
              type="button"
              className="viewer-primary-action secondary-cta"
              disabled={!!exportStatus}
              onClick={() => void exportCurrentCanvasImage()}
              title="Descarga una imagen PNG de la escena actual para compartir con el plantel"
            >
              {exportStatus?.format === "png"
                ? "Generando imagen..."
                : "Exportar imagen / Compartir con jugadores"}
            </button>
          </div>

          <details className="viewer-advanced-panel">
            <summary>Ajustes avanzados</summary>
            <div>
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
            <div className="viewer-export-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => useAppStore.getState().duplicateSelectedExercise()}
              >
                Duplicar variante
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exportStatus}
                onClick={() => void exportCurrentCanvas("mp4")}
              >
                {exportStatus?.format === "mp4" ? "Exportando..." : "MP4"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!!exportStatus}
                onClick={() => void exportCurrentCanvas("gif")}
              >
                {exportStatus?.format === "gif" ? "Exportando..." : "GIF"}
              </button>
            </div>
          </details>
        </aside>
      )}
    </section>
  );
}

function ViewerInsightStrip({
  exercise,
  phase,
}: {
  exercise: (typeof catalog)[number];
  phase: (typeof catalog)[number]["scene"]["phases"][number];
}) {
  const insightItems = [
    {
      label: "Foco de coaching",
      value: exercise.coaching[0] ?? "Abrir linea de pase antes de recibir.",
    },
    {
      label: "Exito de la tarea",
      value: exercise.success,
    },
    {
      label: "Clave",
      value:
        exercise.coaching[1] ??
        exercise.rules[0] ??
        phase.notes ??
        "Mantener la intencion tactica visible.",
    },
  ];

  return (
    <div className="viewer-insight-strip">
      {insightItems.map((item, index) => (
        <article key={item.label}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <b>{item.label}</b>
            <p>{item.value}</p>
          </div>
        </article>
      ))}
    </div>
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
