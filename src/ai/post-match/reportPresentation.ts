import type { PostMatchReport } from "./schemas";

type OwnTeamProblem = {
  problem: string;
  evidence: string[];
  severity: "low" | "medium" | "high";
  probableCause?: string;
};

const BLOCK_COORDINATION_ADVICE =
  "Coordinar la altura del bloque: si puntas y volantes saltan, la defensa achica; si la defensa no puede achicar, los volantes no deben saltar tan alto.";

export function getOwnTeamProblems(report: PostMatchReport): OwnTeamProblem[] {
  if (report.ownTeamProblems.length) {
    return report.ownTeamProblems;
  }

  if (report.ownProblems.length) {
    return report.ownProblems;
  }

  return report.mainProblems.map((problem) => ({
    problem: problem.problem,
    evidence: problem.examplesToReview,
    severity: problem.severity,
    probableCause: problem.probableCause,
  }));
}

export function getAcceptanceCriteria(report: PostMatchReport) {
  const criteria = report.wednesdayTest.flatMap((test) => test.successSignals);

  if (criteria.length) {
    return unique(criteria.map(humanizeReportText));
  }

  return unique(
    [
      ...report.saturdayFocus,
      ...report.missingInformation.map(
        (item) => `Confirmar o descartar: ${item}`,
      ),
    ].map(humanizeReportText),
  );
}

export function humanizeEvidenceList(items: string[]) {
  return unique(
    items
      .map(formatEvidenceSource)
      .filter((item): item is string => Boolean(item)),
  );
}

export function humanizeReportText(text: string) {
  const normalized = text.trim();

  if (!normalized) return normalized;

  if (
    /bajar\s+(un\s+poco\s+)?el\s+bloque|bloque\s+demasiado\s+alto/i.test(
      normalized,
    )
  ) {
    return BLOCK_COORDINATION_ADVICE;
  }

  return normalized
    .replace(/\bcontextOnly\b/g, "")
    .replace(/\bsupportedByCurrentEvidence\b/g, "")
    .replace(/\bEV-(RESULT|PLAN|NOTES|TAG-\d+)\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatEvidenceSource(value: string) {
  const text = humanizeReportText(value);

  if (!text) return null;
  if (value === "EV-RESULT") return "Fuente: resultado cargado";
  if (value === "EV-PLAN") return "Fuente: plan previo";
  if (value === "EV-NOTES") return "Fuente: notas del staff";

  const tagMatch = value.match(/^EV-TAG-(\d+)$/);
  if (tagMatch) {
    return `Fuente: tag manual ${tagMatch[1]}`;
  }

  if (/^EV-/.test(value)) {
    return "Fuente: evidencia registrada";
  }

  return text;
}

export function subjectLabel(subject: string) {
  if (subject === "own") return "Equipo propio";
  if (subject === "rival") return "Rival";
  if (subject === "both") return "Ambos equipos";
  return "No confirmado";
}

export function memoryCategoryLabel(category: string) {
  if (category === "teamPattern") return "Patron del equipo";
  if (category === "playerPattern") return "Patron de jugador";
  if (category === "opponentPattern") return "Patron del rival";
  if (category === "staffPrinciple") return "Principio de staff";
  if (category === "sideAsymmetry") return "Asimetria por banda";
  return category;
}

export function memoryScopeLabel(scope: string) {
  if (scope === "oneOff") return "Observacion puntual";
  if (scope === "repeatWatch") return "Requiere repetir observacion";
  if (scope === "validated") return "Validado por staff";
  return scope;
}

/**
 * User-facing copy for a memory candidate's trust-guard lifecycle status.
 * This is the single source of truth for what staff sees about whether a
 * selected candidate actually became tactical memory — the wording for
 * "accepted" / "needs_review" / "rejected" is fixed by product requirements
 * so staff never mistakes a vetoed candidate for a saved one.
 */
export function memoryStatusLabel(status: string) {
  if (status === "accepted") return "Guardado como aprendizaje";
  if (status === "needs_review") return "Pendiente de revision";
  if (status === "rejected") return "No guardado: evidencia insuficiente";
  return "Propuesta sin revisar";
}

export function memoryStatusModifierClass(status: string) {
  if (status === "accepted") return "is-accepted";
  if (status === "needs_review") return "is-needs-review";
  if (status === "rejected") return "is-rejected";
  return "is-candidate";
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
