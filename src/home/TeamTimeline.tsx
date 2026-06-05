import { memo, useMemo } from "react";
import { detectTeamPatterns, type TeamPattern } from "@/ai/patternDetection";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import { PatternCard } from "@/ui/tacticalPrimitives";
import { useAppStore } from "@/state/useAppStore";

export const TeamTimeline = memo(function TeamTimeline({
  reports,
}: { reports: SavedPostMatchReport[] }) {
  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 5),
    [reports],
  );
  const patterns = useMemo(
    () => detectTeamPatterns(reports, { limit: 5 }),
    [reports],
  );
  const recurring = patterns.filter((pattern) => pattern.kind === "repeatedProblem");
  const improvements = patterns.filter((pattern) => pattern.kind === "improvement");
  const regressions = patterns.filter((pattern) => pattern.kind === "regression");

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
          <span>Se repite</span>
          <b>{recurring.length}</b>
        </div>
        <div className="timeline-summary-pill">
          <span>Mejora</span>
          <b>{improvements.length}</b>
        </div>
        <div className="timeline-summary-pill">
          <span>Retroceso</span>
          <b>{regressions.length}</b>
        </div>
      </div>

      {patterns.length ? (
        <div className="list" style={{ marginBottom: 14 }}>
          {patterns.map((pattern) => (
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
      ) : null}
    </div>
  );
});

function patternKindLabel(kind: TeamPattern["kind"]) {
  if (kind === "repeatedProblem") return "Problema recurrente";
  if (kind === "newProblem") return "Problema nuevo";
  if (kind === "improvement") return "Mejora";
  if (kind === "regression") return "Retroceso";
  if (kind === "problemNotTrained") return "No entrenado";
  return "Contradice el modelo";
}
