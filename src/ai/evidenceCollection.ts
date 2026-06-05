import type {
  CollectedAnswer,
  EvidenceAudit,
  EvidenceStrength,
  EvidenceTarget,
  ImpliedClaim,
  TacticalIntent,
} from "./CoachSchemas.js";
import type { RetrievedEvidence } from "./CoachAgent.js";

export type EvidenceSignal = {
  target: EvidenceTarget;
  value: string;
  source: "userAnswer" | "userInput" | "report" | "memory" | "knowledge" | "video";
  confidence: "low" | "medium" | "high";
};

export function normalizeCollectedEvidence(
  answers: CollectedAnswer[],
): EvidenceSignal[] {
  return answers
    .filter((answer) => {
      const value = answer.rawAnswer.trim();
      return value && !isUncertainEvidenceAnswer(value);
    })
    .map((answer) => ({
      target: answer.evidenceTarget,
      value: answer.rawAnswer.trim(),
      source: "userAnswer",
      confidence: answer.answerKind === "shortText" ? "low" : "medium",
    }));
}

export function buildEvidenceAudit({
  claims,
  signals,
  retrieved,
  intent,
}: {
  claims: ImpliedClaim[];
  signals: EvidenceSignal[];
  retrieved: RetrievedEvidence[];
  intent?: TacticalIntent | null;
}): EvidenceAudit {
  const covered = new Set<EvidenceTarget>();

  for (const signal of signals) {
    covered.add(signal.target);
  }

  for (const item of retrieved) {
    if (item.evidenceTargets?.length) {
      for (const target of item.evidenceTargets) covered.add(target);
      continue;
    }
    if (item.sourceType === "observation" || item.sourceType === "report") {
      covered.add("matchContext");
    }
    if (item.sourceType === "video") {
      covered.add("matchContext");
      covered.add("moment");
    }
    if (item.sourceType === "report") {
      covered.add("frequency");
    }
    if (item.sourceType === "memory") {
      covered.add("frequency");
    }
  }

  const requiredTargets = new Set<EvidenceTarget>();
  for (const claim of claims) {
    for (const target of claim.requiredEvidence) {
      requiredTargets.add(target);
    }
  }

  if (!requiredTargets.size) {
    requiredTargets.add("cause");
    if (intent?.specificity === "general") {
      requiredTargets.add("zone");
    }
  }

  const missing = [...requiredTargets]
    .filter((target) => !covered.has(target))
    .map((target) => ({
      target,
      reason: reasonForMissingTarget(target),
    }));

  return {
    covered: [...covered],
    missing,
    criticalMissingCount: missing.length,
    evidenceStrength: evidenceStrengthFor(covered.size, missing.length),
  };
}

export function mergeUserAnswersIntoEvidence(
  prior: EvidenceSignal[],
  answers: CollectedAnswer[],
): EvidenceSignal[] {
  const next = new Map(
    prior.map((signal) => [`${signal.source}:${signal.target}:${signal.value}`, signal]),
  );

  for (const signal of normalizeCollectedEvidence(answers)) {
    next.set(`${signal.source}:${signal.target}:${signal.value}`, signal);
  }

  return [...next.values()];
}

export function capConfidence(
  rawConfidence: number,
  audit: EvidenceAudit,
  skipped: boolean,
) {
  const safeRaw = Math.min(1, Math.max(0, rawConfidence));
  if (skipped) return Math.min(safeRaw, 0.55);

  return Math.min(safeRaw, capForEvidenceStrength(audit.evidenceStrength));
}

export function isUncertainEvidenceAnswer(value: string) {
  const normalized = normalizeAnswer(value);
  return (
    normalized === "s d" ||
    normalized === "sd" ||
    /\b(no se|no estoy seguro|no lo tengo claro|no tengo claro)\b/.test(
      normalized,
    ) ||
    /\b(depende|no aplica|no definido|sin dato)\b/.test(normalized)
  );
}

export function capForEvidenceStrength(strength: EvidenceStrength) {
  if (strength === "none") return 0.45;
  if (strength === "weak") return 0.55;
  if (strength === "partial") return 0.68;
  return 0.9;
}

function evidenceStrengthFor(
  coveredCount: number,
  missingCount: number,
): EvidenceStrength {
  if (!coveredCount) return "none";
  if (missingCount === 0) return "sufficient";
  if (coveredCount === 1) return "weak";
  return "partial";
}

function reasonForMissingTarget(target: EvidenceTarget) {
  const labels: Record<EvidenceTarget, string> = {
    ownTeam: "Falta confirmar si el problema es del equipo propio.",
    rival: "Falta confirmar que comportamiento del rival condiciona la jugada.",
    phase: "Falta ubicar en que fase aparece el problema.",
    playerProfile: "Falta relacionar el ajuste con perfiles de jugadores.",
    zone: "Falta ubicar la zona donde aparece el problema.",
    trigger: "Falta confirmar que accion dispara el problema.",
    frequency: "Falta saber si es un patron repetido o una jugada puntual.",
    moment: "Falta ubicar el momento del partido.",
    matchContext: "Falta contexto del partido o rival.",
    cause: "Falta evidencia para sostener una causa probable.",
    risk: "Falta medir el riesgo del ajuste.",
  };

  return labels[target];
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
