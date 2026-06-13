import type {
  CoachMatchAdvice,
  CoachResponse,
  EvidenceAudit,
} from "@/ai/CoachSchemas";
import type { WeeklyDecisionThread } from "@/state/weeklyDecisionThread";

export type WeeklyDecisionCardModel = {
  problem: string;
  why: string;
  confidence: number;
  confidenceLabel: string;
  confidenceSummary: string;
  whatToTrain: string;
  whatToWatch: string;
  whatIsMissing: string;
  updatedAt: string;
};

type BuildWeeklyDecisionCardModelOptions = {
  thread: WeeklyDecisionThread | null;
  advice?: CoachMatchAdvice | null;
  responseMode?: CoachResponse["mode"] | null;
  evidenceAudit?: EvidenceAudit | null;
};

export function buildWeeklyDecisionCardModel({
  thread,
  advice,
  responseMode,
  evidenceAudit,
}: BuildWeeklyDecisionCardModelOptions): WeeklyDecisionCardModel | null {
  if (!thread && !advice) return null;

  const problem =
    advice?.tacticalReading?.trim() ||
    thread?.problem?.trim() ||
    "Problema semanal a definir.";
  const confidence = advice?.reflection.confidence ?? thread?.confidence ?? 0;
  const evidenceCount = thread?.evidenceIds.length ?? 0;
  const mode = responseMode ?? thread?.mode ?? "hypothesis";
  const evidenceStrength = evidenceAudit?.evidenceStrength;
  const confidencePercent = Math.round(confidence * 100);

  const why =
    advice?.probableCause?.trim() ||
    (mode === "diagnosis"
      ? evidenceCount
        ? `La lectura se sostiene con ${evidenceCount} evidencia(s) del caso y sigue abierta a contraste.`
        : "La lectura sigue abierta porque todavia no hay evidencia suficiente del caso."
      : evidenceCount
        ? `Es una hipotesis de trabajo apoyada por ${evidenceCount} senal(es) inicial(es), no un cierre definitivo.`
        : "Es una hipotesis inicial del staff y todavia necesita evidencia del caso.");

  const whatIsMissing =
    advice?.reflection.missingInformation?.trim() ||
    (evidenceStrength === "weak" || evidenceStrength === "none" || confidence < 0.55
      ? "Todavia falta confirmar con evidencia del caso, observacion de campo o post-partido."
      : "Conviene seguir contrastando la lectura antes de darla por cerrada.");

  return {
    problem,
    why,
    confidence,
    confidenceLabel:
      confidence >= 0.75 ? "Alta" : confidence >= 0.55 ? "Media" : "Baja",
    confidenceSummary:
      evidenceStrength === "sufficient"
        ? `${confidencePercent}% - evidencia suficiente para una decision operativa.`
        : evidenceStrength === "partial"
          ? `${confidencePercent}% - lectura util, pero todavia parcial.`
          : `${confidencePercent}% - usar como hipotesis de trabajo, no como verdad cerrada.`,
    whatToTrain:
      advice?.mainAdjustment?.trim() ||
      thread?.sessionIntent?.objective?.trim() ||
      `Ajustar el comportamiento asociado a: ${problem}`,
    whatToWatch:
      advice?.saturdayFocus?.trim() ||
      thread?.nextReviewCriteria[0]?.trim() ||
      thread?.sessionIntent?.reviewCriteria?.trim() ||
      "Definir que revisar en el proximo partido.",
    whatIsMissing,
    updatedAt: formatWeeklyDecisionTimestamp(
      advice ? new Date().toISOString() : thread?.updatedAt,
    ),
  };
}

export function WeeklyDecisionCard({
  model,
  eyebrow = "Decision semanal",
  title = "Tarjeta de decision",
  detailsLabel,
}: {
  model: WeeklyDecisionCardModel | null;
  eyebrow?: string;
  title?: string;
  detailsLabel?: string;
}) {
  if (!model) return null;

  return (
    <section className="coach-report-card weekly-decision-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">{eyebrow}</span>
          <h4>{title}</h4>
        </div>
        <div className="weekly-decision-confidence">
          <b>{model.confidenceLabel}</b>
          <small>{Math.round(model.confidence * 100)}%</small>
        </div>
      </div>
      <div className="weekly-decision-grid">
        <div className="weekly-decision-item weekly-decision-item-strong">
          <span>Problema de la semana</span>
          <b>{model.problem}</b>
        </div>
        <div className="weekly-decision-item">
          <span>Por que creemos esto</span>
          <b>{model.why}</b>
        </div>
        <div className="weekly-decision-item">
          <span>Confianza</span>
          <b>{model.confidenceSummary}</b>
        </div>
        <div className="weekly-decision-item">
          <span>Que entrenar esta semana</span>
          <b>{model.whatToTrain}</b>
        </div>
        <div className="weekly-decision-item">
          <span>Que mirar el proximo partido</span>
          <b>{model.whatToWatch}</b>
        </div>
        <div className="weekly-decision-item">
          <span>Que falta confirmar</span>
          <b>{model.whatIsMissing}</b>
        </div>
      </div>
      <div className="weekly-decision-footer">
        <small>Ultima actualizacion: {model.updatedAt}</small>
        {detailsLabel ? <small>{detailsLabel}</small> : null}
      </div>
    </section>
  );
}

function formatWeeklyDecisionTimestamp(value?: string | null) {
  if (!value?.trim()) return "Sin actualizar";
  const safe = value.trim().slice(0, 16);
  return safe.replace("T", " ");
}
