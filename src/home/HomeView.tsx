import { listPostMatchReports } from "@/ai/post-match/postMatchClient";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import { catalog } from "@/data";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { summarizeVideoEvidence } from "@/video/videoEvidence";
import { useEffect, useMemo, useState } from "react";
import { TeamTimeline } from "./TeamTimeline";

export function HomeView() {
  const team = useAppStore((state) => state.team);
  const session = useAppStore((state) => state.session);
  const microcycle = useAppStore((state) => state.microcycle);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const tags = useAppStore((state) => state.tags);
  const tracks = useAppStore((state) => state.tracks);
  const lineupLab = useAppStore((state) => state.lineupLab);
  const [reports, setReports] = useState<SavedPostMatchReport[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const selectedExercise = getExerciseById(selectedExerciseId);
  const availablePlayers = team.players.filter(
    (player) => player.status === "available",
  ).length;
  const evidence = useMemo(
    () => summarizeVideoEvidence(tags, tracks),
    [tags, tracks],
  );
  const activeDay = currentMicrocycleDay(microcycle.days);

  useEffect(() => {
    let mounted = true;
    listPostMatchReports()
      .then((items) => {
        if (!mounted) return;
        setReports(
          [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 3),
        );
        setReportsError(null);
      })
      .catch(() => {
        if (!mounted) return;
        setReportsError("No se pudo cargar el historial.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="view-enter grid" style={{ gap: 16 }}>
      <section className="hero">
        <span className="eyebrow">Matchday cockpit / {activeDay.label}</span>
        <h2>¿Qué querés resolver hoy?</h2>
        <p>
          Arrancá por una observación, convertíla en diagnóstico con evidencia
          y cerrá el ciclo con sesión, post-partido y memoria validada.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => useAppStore.getState().setView("viewer")}
          >
            Abrir visor tactico
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              useAppStore.getState().setAiMode("coach");
              useAppStore.getState().setView("ai");
            }}
          >
            Consultar al asistente
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => useAppStore.getState().setView("team")}
          >
            Editar XI
          </button>
        </div>
      </section>

      <TacticalHomeActions />

      <section className="stat-row">
        <Stat eyebrow="Plantel" big={`${availablePlayers}/${team.players.length}`} sub="jugadores disponibles" />
        <Stat eyebrow="Sesion" big={session.blocks.length} sub={`${session.computed?.totalDuration ?? 0} min planificados`} />
        <Stat eyebrow="Evidencia video" big={evidence.total} sub={`${evidence.assistedTracks} asistidos / ${evidence.confirmedTracks} validados`} accent />
        <Stat eyebrow="Shapes" big={lineupLab.shapes.length} sub={`${lineupLab.savedTransitions.length} transiciones guardadas`} />
      </section>

      <section className="home-grid">
        <div className="grid" style={{ gap: 16 }}>
          <MicrocycleCard />
          <SessionCard />
          <TeamTimeline reports={reports} />
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <ReportsCard reports={reports} error={reportsError} />
          <div className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Biblioteca</span>
                <h3>Ejercicio actual</h3>
              </div>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => useAppStore.getState().setView("library")}
              >
                Abrir
              </button>
            </div>
            <div className="list">
              <div className="list-row">
                <div className="lr-icon">3D</div>
                <div>
                  <b>{selectedExercise.title}</b>
                  <small>
                    {selectedExercise.phase} / {selectedExercise.principle}
                  </small>
                </div>
                <span className="tag-pill">
                  {selectedExercise.players.min}-{selectedExercise.players.max}
                </span>
              </div>
              <div className="list-row">
                <div className="lr-icon">CAT</div>
                <div>
                  <b>{catalog.length} ejercicios base</b>
                  <small>Catalogo disponible para visor y sesiones.</small>
                </div>
                <span className="tag-pill">curado</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TacticalHomeActions() {
  const actions = [
    {
      title: "Consultar al Coach",
      eyebrow: "Observacion -> diagnostico",
      body: "Plantea un problema táctico. Si falta evidencia, el agente entrevista antes de diagnosticar.",
      code: "AI",
      onClick: () => {
        useAppStore.getState().setAiMode("coach");
        useAppStore.getState().setView("ai");
      },
    },
    {
      title: "Cargar post-partido simple",
      eyebrow: "Partido -> reporte",
      body: "Resultado, rival y tres notas. Suficiente para generar un informe corto sin abrumar.",
      code: "PM",
      onClick: () => {
        useAppStore.getState().setAiMode("postMatch");
        useAppStore.getState().setView("ai");
      },
    },
    {
      title: "Armar sesión desde diagnóstico",
      eyebrow: "Diagnostico -> entrenamiento",
      body: "Revisá bloques, carga y ejercicios sugeridos para convertir ajustes en trabajo de cancha.",
      code: "MD",
      onClick: () => useAppStore.getState().setView("sessions"),
    },
    {
      title: "Trabajar shape / XI",
      eyebrow: "Lineup Lab -> evidencia objetiva",
      body: "Ajustá el equipo, guardá shapes y usá métricas geométricas como contexto del Coach.",
      code: "XI",
      onClick: () => useAppStore.getState().setView("team"),
    },
  ];

  return (
    <section className="home-grid">
      {actions.map((action) => (
        <button
          type="button"
          className="card list-row"
          key={action.title}
          onClick={action.onClick}
          style={{ alignItems: "flex-start", textAlign: "left" }}
        >
          <div className="lr-icon">{action.code}</div>
          <div>
            <span className="eyebrow">{action.eyebrow}</span>
            <b>{action.title}</b>
            <small>{action.body}</small>
          </div>
        </button>
      ))}
    </section>
  );
}

function Stat({
  eyebrow,
  big,
  sub,
  accent,
}: {
  eyebrow: string;
  big: string | number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="stat-tile">
      <span className="eyebrow">{eyebrow}</span>
      <b style={accent ? { color: "var(--accent)" } : undefined}>{big}</b>
      <small>{sub}</small>
    </div>
  );
}

function MicrocycleCard() {
  const microcycle = useAppStore((state) => state.microcycle);
  const entries = Object.entries(microcycle.days);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Microciclo semanal</span>
          <h3>Distribucion de carga</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => useAppStore.getState().setView("sessions")}
        >
          Planificar
        </button>
      </div>
      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: 8,
          gridTemplateColumns: `repeat(${entries.length}, 1fr)`,
          height: 150,
        }}
      >
        {entries.map(([day, config]) => {
          const load = loadPercent(config.targetLoad);
          const active = day === currentMicrocycleDay(microcycle.days).label;
          return (
            <div
              key={day}
              style={{
                display: "grid",
                gap: 6,
                gridTemplateRows: "1fr auto",
                height: "100%",
              }}
            >
              <div style={{ alignItems: "end", display: "flex" }}>
                <div
                  title={`${config.objective} / ${load}%`}
                  style={{
                    background: active
                      ? "linear-gradient(180deg,var(--accent),color-mix(in oklch,var(--accent) 40%,transparent))"
                      : "color-mix(in oklch,var(--accent) 24%,transparent)",
                    border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                    borderRadius: "7px 7px 4px 4px",
                    height: `${load}%`,
                    minHeight: 8,
                    width: "100%",
                  }}
                />
              </div>
              <div className="mono" style={{ color: active ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 700, textAlign: "center" }}>
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard() {
  const session = useAppStore((state) => state.session);
  const blocks = session.blocks.slice(0, 4);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Sesion activa</span>
          <h3>{session.name}</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => useAppStore.getState().setView("sessions")}
        >
          Abrir
        </button>
      </div>
      {blocks.length ? (
        <div className="list">
          {blocks.map((block, index) => {
            const exercise = getExerciseById(block.exerciseId);
            return (
              <div className="list-row" key={block.id}>
                <div className="lr-icon">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <b>{exercise.title}</b>
                  <small>{block.durationMin} min / {exercise.objective.primary}</small>
                </div>
                <span className="chip">{block.durationMin}'</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Todavia no hay bloques. Agrega ejercicios desde Biblioteca o Visor.
        </p>
      )}
    </div>
  );
}

function ReportsCard({
  reports,
  error,
}: {
  reports: SavedPostMatchReport[];
  error: string | null;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Post-partido</span>
          <h3>Ultimos reports</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            useAppStore.getState().setAiMode("postMatch");
            useAppStore.getState().setView("ai");
          }}
        >
          Abrir
        </button>
      </div>
      {error ? <p style={{ color: "var(--muted)" }}>{error}</p> : null}
      {reports.length ? (
        <div className="list">
          {reports.map((report) => (
            <button
              type="button"
              className="list-row"
              key={report.id}
              onClick={() => {
                useAppStore.getState().setAiMode("postMatch");
                useAppStore.getState().setView("ai");
              }}
            >
              <div className="lr-icon">{report.report.matchContext.result}</div>
              <div>
                <b>vs {report.report.matchContext.opponent}</b>
                <small>{report.report.matchContext.date ?? report.savedAt.slice(0, 10)}</small>
              </div>
              <span className="tag-pill">guardado</span>
            </button>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Sin reportes guardados todavia.
        </p>
      )}
    </div>
  );
}

function currentMicrocycleDay(days: Record<string, { targetLoad: string }>) {
  const preferred = Object.keys(days).find((day) => day === "MD-3");
  return { label: preferred ?? Object.keys(days)[0] ?? "MD-3" };
}

function loadPercent(load: string) {
  if (load === "high") return 92;
  if (load === "med") return 64;
  return 32;
}
