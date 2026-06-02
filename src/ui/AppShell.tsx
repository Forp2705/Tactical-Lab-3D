import {
  APP_SNAPSHOT_VERSION,
  parseSnapshot,
  saveSnapshot,
} from "@/state/db";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { useEffect } from "react";

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

const PRIMARY_NAV: NavItem[] = [
  { view: "home", code: "ROOM", label: "Sala del cuerpo tecnico" },
  { view: "viewer", code: "OBS", label: "Observar en cancha" },
  { view: "team", code: "XI", label: "Equipo · Lineup" },
  {
    view: "ai",
    code: "DIAG",
    label: "Diagnosticar",
    isActive: (view, aiMode) => view === "ai" && aiMode !== "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("coach"),
  },
  { view: "video", code: "EVID", label: "Recolectar evidencia" },
  {
    view: "ai",
    code: "REV",
    label: "Revisar post-partido",
    isActive: (view, aiMode) => view === "ai" && aiMode === "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("postMatch"),
  },
];

const SECONDARY_NAV: NavItem[] = [
  { view: "sessions", code: "TRAIN", label: "Entrenar semana" },
  { view: "library", code: "LIB", label: "Biblioteca curada" },
  { view: "player", code: "BRIEF", label: "Briefing jugadores" },
];

const LOOP_NAV: NavItem[] = [
  { view: "home", code: "01", label: "Sala" },
  {
    view: "ai",
    code: "02",
    label: "Diagnosticar",
    isActive: (view, aiMode) => view === "ai" && aiMode !== "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("coach"),
  },
  { view: "sessions", code: "03", label: "Entrenar" },
  {
    view: "ai",
    code: "04",
    label: "Revisar",
    isActive: (view, aiMode) => view === "ai" && aiMode === "postMatch",
    onSelect: () => useAppStore.getState().setAiMode("postMatch"),
  },
  { view: "team", code: "05", label: "Preparar" },
];

const TOOL_NAV: NavItem[] = [
  { view: "viewer", code: "3D", label: "Visor" },
  { view: "video", code: "VID", label: "Video" },
  { view: "library", code: "LIB", label: "Biblioteca" },
  { view: "player", code: "PL", label: "Jugadores" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const view = useAppStore((state) => state.view);
  const session = useAppStore((state) => state.session);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const presentationMode = useAppStore((state) => state.presentationMode);
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<"cockpit" | "broadcast" | "pizarra">(
    () =>
      (localStorage.getItem("tactical-lab-theme") as
        | "cockpit"
        | "broadcast"
        | "pizarra"
        | null) ?? "cockpit",
  );
  const selectedExercise = getExerciseById(selectedExerciseId);
  const exerciseLabel = selectedExercise?.title ?? selectedExerciseId ?? "-";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tactical-lab-theme", theme);
  }, [theme]);

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
            <div className="brand-mark">TL</div>
            <div>
              <span className="eyebrow">Coach room / Pro 3D</span>
              <h1>Tactical Lab Pro</h1>
            </div>
          </div>
          <nav className="nav">
            {LOOP_NAV.map((item) => (
              <NavButton
                key={`${item.code}-${item.label}`}
                item={item}
                onNavigate={() => setNavOpen(false)}
              />
            ))}
            <details className="nav-more">
              <summary>Mas herramientas</summary>
              {TOOL_NAV.map((item) => (
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
              <label className="field">
                Tema visual
                <select
                  value={theme}
                  onChange={(event) =>
                    setTheme(
                      event.target.value as "cockpit" | "broadcast" | "pizarra",
                    )
                  }
                >
                  <option value="cockpit">Cockpit</option>
                  <option value="broadcast">Broadcast</option>
                  <option value="pizarra">Pizarra</option>
                </select>
              </label>
              <details className="project-more">
                <summary>Proyecto local</summary>
                <button type="button" className="btn ghost" onClick={() => void saveProject()}>
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
                  Menu
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
                Sesion guardada
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
      home: ["Matchday cockpit"],
      library: ["Biblioteca"],
      viewer: ["Cancha"],
      team: ["Sistema de equipo"],
      sessions: ["Microciclo"],
      video: ["Analisis"],
      ai: ["Asistente local"],
      player: ["Jugadores"],
    }[view] ?? ["Tactical Lab"]
  );
}

function titleFor(view: string) {
  return (
    {
      home: "Centro de mando del cuerpo tecnico",
      library: "Biblioteca de ejercicios",
      viewer: "Visor tactico 3D",
      team: "Equipo · Lineup Lab",
      sessions: "Sesiones y microciclo",
      video: "Video + tracking asistido",
      ai: "Asistente tactico",
      player: "Briefing para jugadores",
    }[view] ?? "Tactical Lab Pro 3D"
  );
}

function subtitleFor(view: string) {
  return (
    {
      home: "Lo importante de la semana en un vistazo.",
      library:
        "Catalogo curado, filtros simples y escenas entendibles en 5 segundos.",
      viewer: "Reproduccion 3D con camaras, capas y fases.",
      team: "Plantel, shapes y snapshot contextual para el asistente.",
      sessions:
        "Planificador practico con carga estimada y exportacion simple.",
      video: "Tagging manual, marcadores y tracking asistido.",
      ai: "Consulta tactica y analisis post-partido con salida estructurada.",
      player: "Vista limpia para jugadores sin ruido del staff.",
    }[view] ?? ""
  );
}

async function saveProject() {
  await saveSnapshot(snapshotFromState(useAppStore.getState()));
}

function exportProject() {
  const envelope = {
    app: "tactical-lab-3d",
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
  link.download = `tactical-lab-3d-project-${stamp}.json`;
  link.click();
}

async function importProject(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    // Acepta el formato nuevo con envelope { snapshot } y tambien un snapshot
    // plano exportado por versiones anteriores. En ambos casos se valida y
    // migra igual que al abrir la app.
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
    // Permite reimportar el mismo archivo dos veces seguidas.
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
  link.download = "tactical-lab-3d-scene.png";
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
    gameModel: state.gameModel,
    opponentScout: state.opponentScout,
    session: state.session,
    microcycle: state.microcycle,
    lineupLab: state.lineupLab,
    tags: state.tags,
    tracks: state.tracks,
    aiPrompt: state.aiPrompt,
  };
}
