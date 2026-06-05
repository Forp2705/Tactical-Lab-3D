import { memo, useEffect, useMemo } from "react";
import {
  buildWeeklyDecisionSummary,
  detectTeamPatterns,
  type TeamPattern,
} from "@/ai/patternDetection";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import { PatternCard } from "@/ui/tacticalPrimitives";
import { useAppStore } from "@/state/useAppStore";
import { resolveWeeklyDecisionThreadProgress } from "@/state/weeklyDecisionThread";

export const TeamTimeline = memo(function TeamTimeline({
  reports,
}: { reports: SavedPostMatchReport[] }) {
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const syncWeeklyThreadProgress = useAppStore(
    (state) => state.syncWeeklyThreadProgress,
  );
  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 5),
    [reports],
  );
  const patterns = useMemo(
    () => detectTeamPatterns(reports, { limit: 5 }),
    [reports],
  );
  const weeklyDecision = useMemo(
    () => buildWeeklyDecisionSummary(patterns),
    [patterns],
  );
  const threadProgress = useMemo(
    () => resolveWeeklyDecisionThreadProgress(weeklyDecisionThread, patterns),
    [patterns, weeklyDecisionThread],
  );

  useEffect(() => {
    if (!threadProgress) return;
    syncWeeklyThreadProgress(threadProgress, sortedReports[0]?.id);
  }, [sortedReports, syncWeeklyThreadProgress, threadProgress]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Evolucion del equipo</span>
          <h3>Timeline tactico</h3>
        </div>
        <span className="tag-pill">{reports.length} reportes</span>
      </div>

      <div className="timeline-summary-strip">
        <div className="timeline-summary-pill">
          <span>Abiertos</span>
          <b>{weeklyDecision.openProblems.length}</b>
        </div>
        <div className="timeline-summary-pill">
          <span>Mejoran</span>
          <b>{weeklyDecision.improvedProblems.length}</b>
        </div>
        <div className="timeline-summary-pill">
          <span>Vuelven</span>
          <b>{weeklyDecision.returnedProblems.length}</b>
        </div>
      </div>

      {weeklyDecision.recommendedFocus ? (
        <div className="timeline-weekly-decision">
          <span className="eyebrow">Decision de la proxima semana</span>
          <h4>{weeklyDecision.recommendedFocus.title}</h4>
          <p>{weeklyDecision.recommendedFocus.pattern.statement}</p>
          <small>{weeklyDecision.recommendedFocus.reason}</small>
        </div>
      ) : null}

      {weeklyDecisionThread ? (
        <div className="timeline-weekly-decision">
          <span className="eyebrow">Hilo semanal activo</span>
          <h4>{labelForThreadProgress(threadProgress)}</h4>
          <p>{weeklyDecisionThread.problem}</p>
          <small>
            {threadProgressExplanation(threadProgress, weeklyDecisionThread)}
          </small>
        </div>
      ) : null}

      {patterns.length ? (
        <div className="timeline-decision-grid" style={{ marginBottom: 14 }}>
          <PatternGroup
            title="Problemas abiertos"
            empty="Sin problemas abiertos relevantes."
            patterns={weeklyDecision.openProblems}
          />
          <PatternGroup
            title="Problemas recurrentes"
            empty="Nada repetido por ahora."
            patterns={weeklyDecision.recurringProblems}
          />
          <PatternGroup
            title="Problemas mejorados"
            empty="Todavia no hay mejoras sostenidas."
            patterns={weeklyDecision.improvedProblems}
          />
          <PatternGroup
            title="Problemas que volvieron"
            empty="No hay retrocesos claros."
            patterns={weeklyDecision.returnedProblems}
          />
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
          Todavia no hay suficientes reportes para detectar tendencias. RomboIQ
          no inventa evolucion si no hay historial comparable.
        </p>
      )}

      <div className="timeline-retention-card">
        <div>
          <span className="eyebrow">Volver despues del partido</span>
          <h4>Que cambia semana a semana</h4>
          <p>
            Cada reporte valida si el problema sigue, mejora o cambia de forma.
            Esta es la memoria operativa que vuelve vendible el producto.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            useAppStore.getState().setAiMode("postMatch");
            useAppStore.getState().setView("ai");
          }}
        >
          Cargar nuevo post-partido
        </button>
      </div>

      {sortedReports.length ? (
        <details className="timeline-history-details">
          <summary>Ver historial reciente</summary>
          <div className="list">
            {sortedReports.map((report) => (
              <div className="list-row" key={report.id}>
                <div className="lr-icon">{report.report.matchContext.result}</div>
                <div>
                  <b>vs {report.report.matchContext.opponent}</b>
                  <small>
                    {report.report.matchContext.date ?? report.savedAt.slice(0, 10)}
                  </small>
                </div>
                <span className="chip">{report.report.matchContext.ownSystem}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
});

function PatternGroup({
  title,
  empty,
  patterns,
}: {
  title: string;
  empty: string;
  patterns: TeamPattern[];
}) {
  return (
    <section className="timeline-pattern-group">
      <div className="timeline-pattern-head">
        <strong>{title}</strong>
        <span>{patterns.length}</span>
      </div>
      {patterns.length ? (
        <div className="list">
          {patterns.slice(0, 2).map((pattern) => (
            <PatternCard
              key={pattern.id}
              kind={pattern.kind}
              title={patternKindLabel(pattern.kind)}
              body={pattern.statement}
              meta={pattern.evidence.slice(0, 2).join(" / ")}
            />
          ))}
        </div>
      ) : (
        <p className="muted-panel">{empty}</p>
      )}
    </section>
  );
}

function patternKindLabel(kind: TeamPattern["kind"]) {
  if (kind === "repeatedProblem") return "Problema recurrente";
  if (kind === "newProblem") return "Problema nuevo";
  if (kind === "improvement") return "Mejora";
  if (kind === "regression") return "Retroceso";
  if (kind === "problemNotTrained") return "No entrenado";
  return "Contradice el modelo";
}

function labelForThreadProgress(
  progress: ReturnType<typeof resolveWeeklyDecisionThreadProgress>,
) {
  if (progress === "returned") return "El problema volvio";
  if (progress === "recurring") return "El problema sigue abierto";
  if (progress === "improved") return "El problema mejoro";
  if (progress === "evolved") return "El hilo puede cerrarse por ahora";
  return "El hilo sigue abierto";
}

function threadProgressExplanation(
  progress: ReturnType<typeof resolveWeeklyDecisionThreadProgress>,
  thread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"],
) {
  if (progress === "returned") {
    return "El ultimo reporte sugiere que el problema regreso o aumento su severidad.";
  }
  if (progress === "recurring") {
    return "Aparece en mas de una semana y todavia necesita foco explicito.";
  }
  if (progress === "improved") {
    return "La historia reciente sugiere una mejora, pero todavia conviene sostenerla.";
  }
  if (progress === "evolved") {
    return "No hay una señal fuerte de que siga abierto en el ultimo corte.";
  }
  return thread?.sessionIntent?.reviewCriteria
    ? `Revision pendiente: ${thread.sessionIntent.reviewCriteria}`
    : "Todavia falta un post-partido claro para decidir si sigue abierto.";
}
