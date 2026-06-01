import { detectTeamPatterns, type TeamPattern } from "@/ai/patternDetection";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";

export function TeamTimeline({ reports }: { reports: SavedPostMatchReport[] }) {
  const sortedReports = [...reports]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 5);
  const patterns = detectTeamPatterns(reports, { limit: 5 });

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Evolucion del equipo</span>
          <h3>Timeline tactico</h3>
        </div>
        <span className="tag-pill">{reports.length} reports</span>
      </div>

      {patterns.length ? (
        <div className="list" style={{ marginBottom: 14 }}>
          {patterns.map((pattern) => (
            <PatternTimelineRow key={pattern.id} pattern={pattern} />
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
          Todavia no hay suficientes reportes para detectar tendencias. La app
          no inventa evolución si no hay historial.
        </p>
      )}

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
}

function PatternTimelineRow({ pattern }: { pattern: TeamPattern }) {
  return (
    <div className="list-row">
      <div className="lr-icon">{patternKindShort(pattern.kind)}</div>
      <div>
        <b>{patternKindLabel(pattern.kind)}</b>
        <small>{pattern.statement}</small>
      </div>
      <span className="tag-pill">{pattern.confidence}</span>
    </div>
  );
}

function patternKindShort(kind: TeamPattern["kind"]) {
  if (kind === "repeatedProblem") return "REP";
  if (kind === "newProblem") return "NEW";
  if (kind === "improvement") return "UP";
  return "DOWN";
}

function patternKindLabel(kind: TeamPattern["kind"]) {
  if (kind === "repeatedProblem") return "Problema recurrente";
  if (kind === "newProblem") return "Problema nuevo";
  if (kind === "improvement") return "Mejora posible";
  return "Retroceso posible";
}
