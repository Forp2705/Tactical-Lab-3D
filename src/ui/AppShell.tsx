import {
  APP_SNAPSHOT_VERSION,
  parseSnapshot,
  saveSnapshot,
} from "@/state/db";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { type ChangeEvent, type ReactNode, useState } from "react";

type NavView =
  | "home"
  | "library"
  | "viewer"
  | "team"
  | "sessions"
  | "video"
  | "ai"
  | "player";

type NavItem = {
  code: string;
  label: string;
  view: NavView;
  isActive?: (view: NavView, aiMode: string) => boolean;
  onSelect?: () => void;
};

const LOOP_NAV: NavItem[] = [
  { view: "home", code: "01", label: "Sala" },
  {
    view: "ai",
    code: "02",
    label: "Diagnostico",
    isActive: (view, aiMode) => view === "ai" && aiMode !== "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("coach"),
  },
  { view: "sessions", code: "03", label: "Sesion" },
  {
    view: "ai",
    code: "04",
    label: "Post-partido",
    isActive: (view, aiMode) => view === "ai" && aiMode === "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("postMatch"),
  },
  { view: "team", code: "05", label: "Evolucion" },
];

const ADVANCED_NAV: NavItem[] = [
  { view: "viewer", code: "3D", label: "Cancha 3D" },
  { view: "video", code: "VID", label: "Video" },
  { view: "library", code: "LIB", label: "Biblioteca" },
  { view: "player", code: "PL", label: "Briefing" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const view = useAppStore((state) => state.view);
  const session = useAppStore((state) => state.session);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const presentationMode = useAppStore((state) => state.presentationMode);
  const [navOpen, setNavOpen] = useState(false);
  const selectedExercise = getExerciseById(selectedExerciseId);

  return (
    <div
      className={`app-shell ${presentationMode ? "presentation-shell" : ""} ${navOpen ? "nav-open" : ""}`}
    >
      {!presentationMode && navOpen ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Cerrar menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      {presentationMode ? null : (
        <aside className="sidebar">
          <div className="brand">
            <img className="brand-mark" src="/romboiq-mark.svg" alt="RomboIQ" />
            <div>
              <h1>RomboIQ</h1>
            </div>
          </div>
          <nav className="nav">
            <span className="nav-section-label">Flujo semanal</span>
            {LOOP_NAV.map((item) => (
              <NavButton
                key={`${item.code}-${item.label}`}
                item={item}
                onNavigate={() => setNavOpen(false)}
              />
            ))}
            <details className="nav-more">
              <summary>Avanzado</summary>
              <p className="nav-details-copy">
                Herramientas de apoyo. El flujo principal sigue arriba.
              </p>
              {ADVANCED_NAV.map((item) => (
                <NavButton
                  key={`${item.code}-${item.label}`}
                  item={item}
                  onNavigate={() => setNavOpen(false)}
                />
              ))}
            </details>
          </nav>
          <div className="side-foot">
            <div className="status-card project-actions compact-project-actions">
              <details className="project-more">
                <summary>Proyecto local</summary>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void saveProject()}
                >
                  Guardar local
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => exportProject()}
                >
                  Exportar JSON
                </button>
                <label className="file-label btn ghost">
                  Importar JSON
                  <input
                    type="file"
                    accept="application/json"
                    onChange={importProject}
                  />
                </label>
              </details>
            </div>
          </div>
        </aside>
      )}
      <main className="main">
        {presentationMode || view === "home" ? null : (
          <header className="topbar">
            <div className="topbar-copy">
              <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="icon-btn menu-toggle"
                  onClick={() => setNavOpen(true)}
                >
                  Abrir menu
                </button>
                <span className="eyebrow">{metaFor(view)[0]}</span>
              </div>
              <h2>{titleFor(view)}</h2>
              <p>{subtitleFor(view)}</p>
            </div>
            <div className="top-stat-strip" aria-label="Resumen operativo">
              <div>
                <span>Bloques</span>
                <b>{session.blocks.length}</b>
              </div>
              <div>
                <span>Actual</span>
                <b>{selectedExercise?.players.min ?? "-"}v</b>
              </div>
              <div>
                <span>Modo</span>
                <b>{presentationMode ? "LIVE" : "PLAN"}</b>
              </div>
            </div>
            <div className="top-actions">
              <span className="chip">
                <span className="status-dot available" />
                Proyecto local
              </span>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  useAppStore.getState().setView("viewer");
                  useAppStore.getState().setPresentationMode(true);
                }}
              >
                Modo presentacion
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={exportViewerPng}
              >
                Exportar PNG
              </button>
            </div>
          </header>
        )}
        {children}
      </main>
    </div>
  );
}

function NavButton({
  item,
  onNavigate,
}: { item: NavItem; onNavigate?: () => void }) {
  const active = useAppStore((state) =>
    item.isActive
      ? item.isActive(state.view, state.aiMode)
      : state.view === item.view,
  );
  return (
    <button
      type="button"
      className={`nav-btn ${active ? "active" : ""}`}
      onClick={() => {
        item.onSelect?.();
        useAppStore.getState().setView(item.view);
        onNavigate?.();
      }}
    >
      <span className="nav-code">{item.code}</span>
      <span className="nav-label">{item.label}</span>
      <span className="nav-dot" />
    </button>
  );
}

function metaFor(view: string) {
  return (
    {
      home: ["Sala"],
      library: ["Biblioteca"],
      viewer: ["Cancha"],
      team: ["Evolucion"],
      sessions: ["Sesion"],
      video: ["Observacion"],
      ai: ["Coach"],
      player: ["Briefing"],
    }[view] ?? ["RomboIQ"]
  );
}

function titleFor(view: string) {
  return (
    {
      home: "Sala de control tactico",
      library: "Biblioteca de ejercicios",
      viewer: "Visor tactico 3D",
      team: "Evolucion semanal",
      sessions: "Sesion semanal",
      video: "Video y evidencia",
      ai: "Diagnostico y post-partido",
      player: "Briefing para jugadores",
    }[view] ?? "RomboIQ"
  );
}

function subtitleFor(view: string) {
  return (
    {
      home: "Todo lo importante de la semana en un solo lugar.",
      library:
        "Catalogo curado para bajar el diagnostico al campo sin salir del flujo.",
      viewer: "Reproduccion 3D con camaras, capas tacticas y fases.",
      team: "Plantel, lineup y veredicto semanal del equipo.",
      sessions: "Plan semanal conectado al problema tactico que queres resolver.",
      video: "Tagging manual y evidencia asistida para revisar partidos.",
      ai: "Decision tactica, evidencia visible y siguiente accion.",
      player: "Vista limpia para presentar ideas a jugadores y staff.",
    }[view] ?? ""
  );
}

async function saveProject() {
  await saveSnapshot(snapshotFromState(useAppStore.getState()));
}

function exportProject() {
  const envelope = {
    app: "romboiq",
    version: APP_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    snapshot: snapshotFromState(useAppStore.getState()),
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
  const stamp = envelope.exportedAt.slice(0, 10);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `romboiq-project-${stamp}.json`;
  link.click();
}

async function importProject(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const raw =
      parsed && typeof parsed === "object" && "snapshot" in parsed
        ? (parsed as { snapshot: unknown }).snapshot
        : parsed;
    const snapshot = parseSnapshot(raw);
    if (!snapshot) {
      window.alert("El archivo no contiene un proyecto valido.");
      return;
    }
    useAppStore.getState().loadSnapshot(snapshot);
  } catch {
    window.alert("No se pudo leer el archivo de proyecto.");
  } finally {
    event.target.value = "";
  }
}

function exportViewerPng() {
  const canvas = document.querySelector(
    ".canvas-wrap canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "romboiq-scene.png";
  link.click();
}

function snapshotFromState(state: ReturnType<typeof useAppStore.getState>) {
  return {
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
  };
}
