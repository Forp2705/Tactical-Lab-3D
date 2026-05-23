import { getExerciseById, useAppStore } from "@/state/useAppStore";
import type { ChangeEvent, ReactNode } from "react";

type NavView =
  | "library"
  | "viewer"
  | "team"
  | "sessions"
  | "video"
  | "ai"
  | "player";

export function AppShell({ children }: { children: ReactNode }) {
  const view = useAppStore((state) => state.view);
  const session = useAppStore((state) => state.session);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const presentationMode = useAppStore((state) => state.presentationMode);
  const selectedExercise = getExerciseById(selectedExerciseId);
  const exerciseLabel = selectedExercise?.title ?? selectedExerciseId ?? "-";

  return (
    <div
      className={`app-shell ${presentationMode ? "presentation-shell" : ""}`}
    >
      {presentationMode ? null : (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">TL</div>
            <div>
              <span className="brand-kicker">COACH ROOM / PRO 3D</span>
              <h1>Tactical Lab Pro 3D</h1>
              <p>Matchday cockpit para entrenadores</p>
            </div>
          </div>
          <nav className="nav">
            <NavButton view="library" label="Biblioteca" code="LIB" />
            <NavButton view="viewer" label="Visor tactico" code="3D" />
            <NavButton view="team" label="Equipo" code="XI" />
            <NavButton view="sessions" label="Sesion" code="MD" />
            <NavButton view="video" label="Video" code="VID" />
            <NavButton view="ai" label="Asistente" code="AI" />
            <NavButton view="player" label="Modo jugador" code="PL" />
          </nav>
          <div className="quick-status">
            <span className="panel-eyebrow">Estado de campo</span>
            <div className="status-row">
              <span>Vista</span>
              <b>{view.toUpperCase()}</b>
            </div>
            <div className="status-row">
              <span>Ejercicio</span>
              <b>{exerciseLabel}</b>
            </div>
            <div className="status-row">
              <span>Sesion</span>
              <b>{session.blocks.length} bloques</b>
            </div>
          </div>
          <div className="project-actions">
            <span className="panel-eyebrow">Proyecto local</span>
            <button type="button" onClick={() => void saveProject()}>
              Guardar local
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => exportProject()}
            >
              Exportar JSON
            </button>
            <label className="file-label">
              Importar JSON
              <input
                type="file"
                accept="application/json"
                onChange={importProject}
              />
            </label>
          </div>
        </aside>
      )}
      <main className="main">
        {presentationMode ? null : (
          <header className="topbar">
            <div className="topbar-copy">
              <span className="topbar-kicker">TACTICAL LAB / FIELD READY</span>
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
              <button
                type="button"
                onClick={() => {
                  useAppStore.getState().setView("viewer");
                  useAppStore.getState().setPresentationMode(true);
                }}
              >
                Modo presentacion
              </button>
              <button
                type="button"
                className="secondary"
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
  view,
  label,
  code,
}: { view: NavView; label: string; code: string }) {
  const active = useAppStore((state) => state.view === view);
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      onClick={() => useAppStore.getState().setView(view)}
    >
      <span className="nav-code">{code}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

function titleFor(view: string) {
  return (
    {
      library: "Biblioteca de ejercicios",
      viewer: "Visor tactico 3D integrado",
      team: "Sistema de equipo",
      sessions: "Sesiones y microciclo",
      video: "Video + tracking asistido",
      ai: "Asistente tactico local",
      player: "Modo jugador",
    }[view] ?? "Tactical Lab Pro 3D"
  );
}

function subtitleFor(view: string) {
  return (
    {
      library:
        "Catalogo curado, filtros simples y escenas entendibles en 5 segundos.",
      viewer: "Reproduccion 3D con camaras, capas y fases.",
      team: "Plantel, atributos, alineaciones y validaciones basicas.",
      sessions:
        "Planificador practico con carga estimada y exportacion simple.",
      video: "Tagging manual, marcadores y tracking asistido.",
      ai: "Sugerencias contextuales con guardrails visibles.",
      player: "Vista limpia para jugadores sin ruido del staff.",
    }[view] ?? ""
  );
}

async function saveProject() {
  const { saveSnapshot } = await import("@/state/db");
  const { useAppStore } = await import("@/state/useAppStore");
  await saveSnapshot(snapshotFromState(useAppStore.getState()));
}

function exportProject() {
  import("@/state/useAppStore").then(({ useAppStore }) => {
    const snapshot = snapshotFromState(useAppStore.getState());
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tactical-lab-3d-project.json";
    link.click();
  });
}

async function importProject(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const { parseSnapshot } = await import("@/state/db");
  const snapshot = parseSnapshot(JSON.parse(text));
  if (!snapshot) return;
  const { useAppStore } = await import("@/state/useAppStore");
  useAppStore.getState().loadSnapshot(snapshot);
}

function exportViewerPng() {
  const canvas = document.querySelector(
    ".canvas-wrap canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "tactical-lab-3d-scene.png";
  link.click();
}

function snapshotFromState(state: ReturnType<typeof useAppStore.getState>) {
  return {
    version: state.version,
    selectedExerciseId: state.selectedExerciseId,
    view: state.view,
    camera: state.camera,
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
  };
}
