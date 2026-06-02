import { listPostMatchReports } from "@/ai/post-match/postMatchClient";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import { detectTeamPatterns, type TeamPattern } from "@/ai/patternDetection";
import { catalog } from "@/data";
import { buildOpponentGamePlan, hasOpponentScoutData } from "@/scout/opponentScout";
import {
  exportEvolutionHtml,
  exportMatchPlanHtml,
  exportTrainingWeekHtml,
} from "@/export/premiumExports";
import { LoopProgress, PatternCard } from "@/ui/tacticalPrimitives";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { summarizeVideoEvidence } from "@/video/videoEvidence";
import { useEffect, useMemo, useState } from "react";
import { TeamTimeline } from "./TeamTimeline";

export function HomeView() {
  const team = useAppStore((state) => state.team);
  const gameModel = useAppStore((state) => state.gameModel);
  const opponentScout = useAppStore((state) => state.opponentScout);
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
  const patterns = useMemo(
    () =>
      detectTeamPatterns(reports, {
        limit: 3,
        gameModel,
        sessionObjectives: session.computed?.primaryObjectives ?? [],
      }),
    [gameModel, reports, session.computed?.primaryObjectives],
  );
  const opponentPlan = useMemo(
    () => buildOpponentGamePlan(opponentScout, gameModel),
    [gameModel, opponentScout],
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
      <section className="hero calm-hero">
        <span className="eyebrow">Matchday cockpit / {activeDay.label}</span>
        <h2 className="home-title">Sala del cuerpo tecnico</h2>
        <p className="home-subtitle">Prioridad semanal, evidencia disponible y proximo paso.</p>
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
        <div style={{ marginTop: 20 }}>
          <LoopProgress active={loopStage(session.blocks.length, reports.length, patterns.length)} />
        </div>
      </section>

      <TesterOnboarding />

      <TacticalHomeActions />

      <section className="home-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Modelo de juego</span>
              <h3>Vara tactica activa</h3>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => useAppStore.getState().setView("team")}
            >
              Editar
            </button>
          </div>
          <p style={{ color: "var(--muted)", lineHeight: 1.45, marginTop: 0 }}>
            Modelo activo configurado.
          </p>
          <div className="list">
            {gameModel.nonNegotiables.slice(0, 3).map((item) => (
              <div className="list-row" key={item}>
                <div className="lr-icon">ID</div>
                <div>
                  <b>No negociable</b>
                  <small>{item}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Proximo rival</span>
              <h3>{opponentScout.rival}</h3>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => useAppStore.getState().setView("team")}
            >
              Scout
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                exportMatchPlanHtml({
                  scout: opponentScout,
                  plan: opponentPlan,
                  gameModel,
                })
              }
            >
              Exportar
            </button>
          </div>
          {hasOpponentScoutData(opponentScout) ? (
            <div className="list">
              {opponentPlan.weeklyTrainingFocus.slice(0, 3).map((item) => (
                <div className="list-row" key={item}>
                  <div className="lr-icon">WK</div>
                  <div>
                    <b>Foco semanal</b>
                    <small>{item}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
              Carga presion, salida y vulnerabilidades del rival para convertirlo
              en plan de partido.
            </p>
          )}
        </div>
      </section>

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
          <PatternCommandCard patterns={patterns} />
          <div className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Exportables premium</span>
                <h3>Salidas para staff</h3>
              </div>
            </div>
            <div className="toolbar compact">
              <button
                type="button"
                className="secondary"
                onClick={() => exportTrainingWeekHtml(session)}
              >
                Semana
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => exportEvolutionHtml(reports)}
              >
                Evolucion
              </button>
            </div>
          </div>
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

function TesterOnboarding() {
  return (
    <details className="tester-onboarding">
      <summary>Recorrido de 5 minutos para tester</summary>
      <div>
        <span>1. Diagnosticar</span>
        <span>2. Responder entrevista</span>
        <span>3. Crear sesion</span>
        <span>4. Cargar post-match</span>
        <span>5. Revisar evolucion</span>
      </div>
    </details>
  );
}

function TacticalHomeActions() {
  const actions = [
    {
      title: "Coach",
      eyebrow: "Observacion -> diagnostico",
      body: "Plantea un problema táctico. Si falta evidencia, el agente entrevista antes de diagnosticar.",
      code: "AI",
      onClick: () => {
        useAppStore.getState().setAiMode("coach");
        useAppStore.getState().setView("ai");
      },
    },
    {
      title: "Post-match",
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
      title: "XI",
      eyebrow: "Lineup Lab -> evidencia objetiva",
      body: "Ajustá el equipo, guardá shapes y usá métricas geométricas como contexto del Coach.",
      code: "XI",
      onClick: () => useAppStore.getState().setView("team"),
    },
  ];

  return (
    <section className="home-action-strip">
      {actions.map((action) => (
        <button
          type="button"
          className="home-action"
          key={action.title}
          onClick={action.onClick}
        >
          <div className="lr-icon">{action.code}</div>
          <div>
            <b>{action.code === "MD" ? "Sesion" : action.title}</b>
            <small>{action.eyebrow}</small>
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

function PatternCommandCard({ patterns }: { patterns: TeamPattern[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Pattern Intelligence</span>
          <h3>Problema recurrente</h3>
        </div>
        <span className="tag-pill">{patterns.length}</span>
      </div>
      {patterns.length ? (
        <div className="list">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              kind={pattern.kind}
              title={patternKindLabel(pattern.kind)}
              body={pattern.statement}
              meta={pattern.confidence}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Sin historial suficiente para afirmar patron. Carga post-match simple
          para empezar a medir evolucion.
        </p>
      )}
    </div>
  );
}

function patternKindLabel(kind: TeamPattern["kind"]) {
  const labels: Record<TeamPattern["kind"], string> = {
    repeatedProblem: "Se repite",
    newProblem: "Nuevo",
    improvement: "Mejora",
    regression: "Retroceso",
    problemNotTrained: "No entrenado",
    gameModelContradiction: "Contra modelo",
  };
  return labels[kind];
}

function loopStage(
  sessionBlocks: number,
  reports: number,
  patterns: number,
): "observar" | "diagnosticar" | "entrenar" | "revisar" | "evolucionar" {
  if (patterns > 0) return "evolucionar";
  if (reports > 0) return "revisar";
  if (sessionBlocks > 0) return "entrenar";
  return "diagnosticar";
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
