import { resolveExerciseSelection } from "@/app/viewerSelection";
import { catalog } from "@/data";
import {
  APP_SNAPSHOT_VERSION,
  parseSnapshot,
  saveSnapshot,
} from "@/state/db";
import { useAppStore } from "@/state/useAppStore";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useState,
} from "react";

type NavView =
  | "home"
  | "library"
  | "viewer"
  | "team"
  | "sessions"
  | "video"
  | "ai"
  | "player"
  | "board";

type NavItem = {
  code: string;
  label: string;
  view: NavView;
};

// Nav W21 (#3 y #9 del audit W20): el flujo principal es el ciclo semanal
// completo — Sala > Diagnostico > Pizarra > Sesion > Evolucion — asi que
// Pizarra y Sesion suben desde "Avanzado". Diagnostico es puerta UNICA a la
// vista combinada `ai`: Post-Partido se alcanza por su tab interno o por los
// links contextuales del flujo (que setean aiMode explicitamente). El boton
// de nav NO toca aiMode — setView nunca toca aiMode (invariante W17) y asi
// un click de nav no pisa el tab activo ni resetea la entrevista del coach
// (setAiMode reinicia coachInterview).
const PLAN_NAV: NavItem[] = [
  { view: "home", code: "01", label: "Sala" },
  { view: "ai", code: "02", label: "Diagnostico" },
  { view: "board", code: "03", label: "Pizarra" },
  { view: "sessions", code: "04", label: "Sesion" },
  { view: "team", code: "05", label: "Evolucion" },
];

const TOOLS_NAV: NavItem[] = [
  { view: "viewer", code: "06", label: "Cancha 3D" },
  { view: "video", code: "07", label: "Video + Tracking" },
];

const ADVANCED_NAV: NavItem[] = [
  { view: "library", code: "08", label: "Biblioteca" },
  { view: "player", code: "09", label: "Briefing" },
];

// Label de la vista activa para el subtitulo de marca (E2). Sala se lee como
// INICIO (texto de producto del mockup), el resto reusa su eyebrow.
function brandViewLabel(view: NavView) {
  return view === "home" ? "Inicio" : metaFor(view)[0];
}

// Duplicado deliberado de currentMicrocycleDay (HomeView.tsx): importar el
// helper desde src/home acoplaria el shell a una vista. Es una preferencia
// fija a MD-3, no un derivado de fecha.
function focoDayLabel(days: Record<string, unknown>) {
  const preferred = Object.keys(days).find((day) => day === "MD-3");
  return preferred ?? Object.keys(days)[0] ?? "MD-3";
}

export function AppShell({ children }: { children: ReactNode }) {
  const view = useAppStore((state) => state.view);
  const session = useAppStore((state) => state.session);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const presentationMode = useAppStore((state) => state.presentationMode);
  const microcycleDays = useAppStore((state) => state.microcycle.days);
  const baseFormation = useAppStore(
    (state) => state.teamIdentity.baseFormation,
  );
  const [navOpen, setNavOpen] = useState(false);
  // E2: INICIO · MD-3 · 4-3-3 (W13: sin prefijo "Foco", entra en 1 linea);
  // el segmento formacion se omite si esta vacia (workspace real sin setup)
  // — nunca se muestra un placeholder.
  const brandSubtitle = [
    brandViewLabel(view),
    focoDayLabel(microcycleDays),
    baseFormation.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const { exercise: selectedExercise, missing: selectedExerciseMissing } =
    resolveExerciseSelection(selectedExerciseId, [
      ...catalog,
      ...exerciseVariants,
    ]);

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
              <h1>
                Rombo<span className="brand-iq">IQ</span>
              </h1>
              <p className="brand-subtitle">{brandSubtitle}</p>
            </div>
          </div>
          <nav className="nav">
            <span className="nav-section-label">El plan de la semana</span>
            {PLAN_NAV.map((item) => (
              <NavButton
                key={`${item.code}-${item.label}`}
                item={item}
                onNavigate={() => setNavOpen(false)}
              />
            ))}
            <span className="nav-section-label">Herramientas</span>
            {TOOLS_NAV.map((item) => (
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
            <StaffProfileBlock />
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
      {/* main-home: hook estable para el override compacto de padding de la
          vista Sala (addendum W10) sin depender de :has() en CSS.
          W15: la Pizarra (primera vista reformada) respira el felt-stage
          compartido detras de su contenido. */}
      <main
        className={
          view === "home"
            ? "main main-home"
            : view === "board"
              ? "main felt-stage"
              : "main"
        }
      >
        {!presentationMode && view === "home" ? (
          // Riesgo 2 (acceptance seccion 4): el topbar no se renderiza en
          // Sala, asi que a <=1180 la nav quedaba inalcanzable. Este boton
          // flotante reusa el show/hide existente de .menu-toggle (visible
          // solo <=1180) y abre el mismo off-canvas navOpen + scrim.
          <button
            type="button"
            className="icon-btn menu-toggle sala-menu-toggle"
            aria-label="Abrir menu"
            onClick={() => setNavOpen(true)}
          >
            Menu
          </button>
        ) : null}
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
                <b>
                  {selectedExerciseMissing ? "-" : selectedExercise.players.min}
                  v
                </b>
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
              {/* W16: exportViewerPng busca el canvas 3D (.canvas-wrap) — en
                  la Pizarra no existe y el boton era un no-op silencioso
                  (catalogo gate W15). El board tiene su propio export en el
                  panel IA (useBoardActions.exportImage). */}
              {view === "board" ? null : (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={exportViewerPng}
                >
                  Exportar PNG
                </button>
              )}
            </div>
          </header>
        )}
        {children}
      </main>
    </div>
  );
}

// E5 — bloque usuario: perfil staff local editable in situ, sin sesion ni
// link salir. Fallback honesto sin nombre: avatar CT + "Cuerpo tecnico".
function StaffProfileBlock() {
  const staffProfile = useAppStore((state) => state.staffProfile);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const name = staffProfile.name.trim();
  const role = staffProfile.role.trim();
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("")
    : "CT";

  function startEditing() {
    setDraftName(name);
    setDraftRole(role);
    setEditing(true);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    useAppStore.getState().setStaffProfile({
      name: draftName,
      role: draftRole,
    });
    setEditing(false);
    // Persistencia inmediata: sin esto el perfil dependeria del proximo tick
    // de autosave (8s) para sobrevivir un reload.
    void saveProject();
  }

  if (editing) {
    return (
      <form className="staff-profile staff-profile-form" onSubmit={save}>
        <label className="staff-profile-field">
          Nombre
          <input
            type="text"
            value={draftName}
            maxLength={60}
            placeholder="Nombre y apellido"
            onChange={(event) => setDraftName(event.target.value)}
          />
        </label>
        <label className="staff-profile-field">
          Rol
          <input
            type="text"
            value={draftRole}
            maxLength={60}
            placeholder="Cuerpo tecnico"
            onChange={(event) => setDraftRole(event.target.value)}
          />
        </label>
        <div className="staff-profile-form-actions">
          <button type="submit" className="btn ghost">
            Guardar
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="staff-profile">
      <span className="staff-profile-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="staff-profile-copy">
        <b className="staff-profile-name">{name || "Cuerpo tecnico"}</b>
        <span className="staff-profile-role-row">
          {role ? <span className="staff-profile-role">{role}</span> : null}
          {role ? (
            <span className="staff-profile-role-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <button
            type="button"
            className="staff-profile-edit"
            aria-label="Editar perfil de staff"
            onClick={startEditing}
          >
            Editar
          </button>
        </span>
      </div>
    </div>
  );
}

function NavButton({
  item,
  onNavigate,
}: { item: NavItem; onNavigate?: () => void }) {
  const active = useAppStore((state) => state.view === item.view);
  return (
    <button
      type="button"
      className={`nav-btn ${active ? "active" : ""}`}
      onClick={() => {
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
      board: ["Pizarra"],
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
      board: "Pizarra tactica",
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
      board: "Modelar la respuesta tactica y conectarla al foco semanal.",
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
    staffProfile: state.staffProfile,
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
  };
}
