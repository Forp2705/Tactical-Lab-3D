import type { ReactNode } from "react";

export type ConfidenceTone = "ok" | "medium" | "warn";

export function ConfidenceMeter({
  value,
  label,
  reason,
  compact = false,
}: {
  value: number;
  label?: string;
  reason?: string;
  compact?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone: ConfidenceTone =
    percent >= 75 ? "ok" : percent >= 55 ? "medium" : "warn";

  return (
    <div className={`tl-confidence ${tone} ${compact ? "compact" : ""}`}>
      <div className="tl-confidence-head">
        <span>{label ?? "Confianza"}</span>
        <b>{percent}%</b>
      </div>
      <div className="tl-meter" aria-label={`Confianza ${percent}%`}>
        <i style={{ width: `${percent}%` }} />
      </div>
      {reason && !compact ? <small>{reason}</small> : null}
    </div>
  );
}

export function EvidenceChip({
  type,
  label,
  relevance,
}: {
  type: "metric" | "report" | "knowledge" | "memory" | "staff" | "shape" | "observation" | "inference";
  label: string;
  relevance?: number;
}) {
  return (
    <span className={`tl-evidence-chip ${type}`}>
      <span className="tl-evidence-icon">{evidenceCode(type)}</span>
      <span>{label}</span>
      {typeof relevance === "number" ? (
        <b>{Math.round(Math.max(0, Math.min(1, relevance)) * 100)}%</b>
      ) : null}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: "question" | "hypothesis" | "diagnosis" | null }) {
  const resolved = mode ?? "diagnosis";
  const labels = {
    question: "Entrevista",
    hypothesis: "Hipotesis",
    diagnosis: "Diagnostico",
  };
  return <span className={`tl-mode-badge ${resolved}`}>{labels[resolved]}</span>;
}

export type PitchOverlay =
  | { type: "zone"; x: number; y: number; w: number; h: number; tone?: "good" | "warn" | "danger" | "info"; label?: string }
  | { type: "line"; from: { x: number; y: number }; to: { x: number; y: number }; tone?: "good" | "warn" | "danger" | "info"; label?: string }
  | { type: "blockHeight"; x: number; tone?: "good" | "warn" | "danger" | "info"; label?: string };

export function PitchViz({
  title,
  subtitle,
  overlays = [],
  players = [],
  compact = false,
  state,
  emptyMessage,
}: {
  title?: string;
  subtitle?: string;
  overlays?: PitchOverlay[];
  players?: Array<{ id: string; x: number; y: number; label?: string; tone?: "own" | "rival" | "risk" }>;
  compact?: boolean;
  state?: "empty" | "analysis" | "simulation";
  emptyMessage?: string;
}) {
  const resolvedState =
    state ?? (overlays.length || players.length ? "analysis" : "empty");
  return (
    <div className={`tl-pitch-viz ${compact ? "compact" : ""} ${resolvedState}`}>
      {(title || subtitle) && (
        <div className="tl-pitch-viz-head">
          {title ? <b>{title}</b> : null}
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      )}
      <svg viewBox="0 0 100 64" role="img" aria-label={title ?? "Cancha tactica"}>
        <PitchLines />
        <g className="tl-pitch-lanes">
          <line x1="0" y1="12.8" x2="100" y2="12.8" />
          <line x1="0" y1="25.6" x2="100" y2="25.6" />
          <line x1="0" y1="38.4" x2="100" y2="38.4" />
          <line x1="0" y1="51.2" x2="100" y2="51.2" />
        </g>
        {overlays.map((overlay, index) => renderOverlay(overlay, index))}
        {players.map((player) => (
          <g key={player.id} className={`tl-pitch-player ${player.tone ?? "own"}`}>
            <circle cx={player.x} cy={player.y} r="2.3" />
            {player.label ? (
              <text x={player.x} y={player.y - 3.5} textAnchor="middle">
                {player.label}
              </text>
            ) : null}
          </g>
        ))}
        {resolvedState === "empty" ? (
          <g className="tl-pitch-empty">
            <text x="50" y="32" textAnchor="middle">
              {emptyMessage ?? "Sin lectura espacial"}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function LoopProgress({
  active,
}: {
  active: "observar" | "diagnosticar" | "entrenar" | "revisar" | "evolucionar";
}) {
  const steps = ["observar", "diagnosticar", "entrenar", "revisar", "evolucionar"] as const;
  const activeIndex = steps.indexOf(active);
  return (
    <div className="tl-loop-progress" aria-label="Loop tactico">
      {steps.map((step, index) => (
        <span
          className={index <= activeIndex ? "active" : ""}
          key={step}
        >
          <i />
          {step}
        </span>
      ))}
    </div>
  );
}

export function PatternCard({
  kind,
  title,
  body,
  meta,
}: {
  kind: "improvement" | "repeatedProblem" | "regression" | "newProblem" | "problemNotTrained" | "gameModelContradiction";
  title: string;
  body: string;
  meta?: string;
}) {
  return (
    <article className={`tl-pattern-card ${kind}`}>
      <span>{patternLabel(kind)}</span>
      <b>{title}</b>
      <p>{body}</p>
      {meta ? <small>{meta}</small> : null}
    </article>
  );
}

export function FitChip({
  level,
  children,
}: {
  level: "risk" | "warning" | "strength";
  children: ReactNode;
}) {
  return <span className={`tl-fit-chip ${level}`}>{children}</span>;
}

export function LoadMeter({
  load,
  label,
}: {
  load: "low" | "med" | "high";
  label?: string;
}) {
  const percent = load === "high" ? 92 : load === "med" ? 62 : 32;
  return (
    <div className={`tl-load-meter ${load}`}>
      <div>
        <span>{label ?? "Carga"}</span>
        <b>{load === "high" ? "Alta" : load === "med" ? "Media" : "Baja"}</b>
      </div>
      <div className="tl-meter">
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <g className="tl-pitch-lines">
      <rect x="2" y="2" width="96" height="60" rx="1.5" />
      <line x1="50" y1="2" x2="50" y2="62" />
      <circle cx="50" cy="32" r="8" />
      <circle cx="50" cy="32" r="0.8" />
      <rect x="2" y="19" width="12" height="26" />
      <rect x="86" y="19" width="12" height="26" />
      <rect x="2" y="26" width="5" height="12" />
      <rect x="93" y="26" width="5" height="12" />
    </g>
  );
}

function renderOverlay(overlay: PitchOverlay, index: number) {
  const tone = overlay.tone ?? "info";
  if (overlay.type === "zone") {
    return (
      <g key={`zone-${index}`} className={`tl-pitch-overlay ${tone}`}>
        <rect x={overlay.x} y={overlay.y} width={overlay.w} height={overlay.h} rx="2" />
        {overlay.label ? (
          <text
            className="tl-pitch-tag"
            x={overlay.x + 2}
            y={Math.max(overlay.y - 2, 5)}
          >
            {overlay.label}
          </text>
        ) : null}
      </g>
    );
  }
  if (overlay.type === "line") {
    return (
      <g key={`line-${index}`} className={`tl-pitch-measure ${tone}`}>
        <line x1={overlay.from.x} y1={overlay.from.y} x2={overlay.to.x} y2={overlay.to.y} />
        {overlay.label ? (
        <text x={(overlay.from.x + overlay.to.x) / 2} y={(overlay.from.y + overlay.to.y) / 2 - 2} textAnchor="middle">
            {overlay.label}
          </text>
        ) : null}
      </g>
    );
  }
  return (
    <g key={`height-${index}`} className={`tl-pitch-measure ${tone}`}>
      <line x1={overlay.x} y1="3" x2={overlay.x} y2="61" />
      {overlay.label ? (
        <text className="tl-pitch-tag" x={overlay.x + 1.5} y="7">
          {overlay.label}
        </text>
      ) : null}
    </g>
  );
}

function evidenceCode(type: Parameters<typeof EvidenceChip>[0]["type"]) {
  const codes = {
    metric: "MET",
    report: "REP",
    knowledge: "KNO",
    memory: "MEM",
    staff: "STA",
    shape: "SHP",
    observation: "OBS",
    inference: "INF",
  };
  return codes[type];
}

function patternLabel(kind: Parameters<typeof PatternCard>[0]["kind"]) {
  const labels = {
    improvement: "Mejora",
    repeatedProblem: "Recurrente",
    regression: "Retroceso",
    newProblem: "Nuevo",
    problemNotTrained: "No entrenado",
    gameModelContradiction: "Contra modelo",
  };
  return labels[kind];
}
