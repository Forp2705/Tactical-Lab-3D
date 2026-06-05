import type {
  CoachMatchAdvice,
  CollectedAnswer,
  EvidenceAudit,
  EvidenceStrength,
  ImpliedClaim,
  TacticalDomain,
  TacticalIntent,
} from "./CoachSchemas.js";
import { inferDomainsFromText } from "./exerciseMatching.js";
import {
  buildEvidenceAudit,
  normalizeCollectedEvidence,
  type EvidenceSignal,
} from "./evidenceCollection.js";
import type { RetrievedEvidence } from "./CoachAgent.js";
import { inferCoachPromptMode, type CoachPromptMode } from "./CoachModePrompts.js";

export type CoachPipelineTrace = {
  intent: TacticalIntent;
  retrievalQuery: string;
  evidenceSignalCount: number;
  retrievedEvidenceCount: number;
  promptMode: CoachPromptMode;
  selfCheck: CoachSelfCheck;
};

export type CoachSelfCheck = {
  overconfidenceRisk: boolean;
  missingCitationRisk: boolean;
  nonExecutableActionRisk: boolean;
  notes: string[];
};

export function classifyCoachIntent(input: string): TacticalIntent {
  const domains = inferDomainsFromText(input);
  return {
    domains: domains.length ? domains : [fallbackDomain(input)],
    specificity: input.trim().split(/\s+/).length >= 8 ? "specific" : "general",
    requestType:
      inferCoachPromptMode(input) === "generalExplanation"
        ? "generalExplanation"
        : /plan|sesion|entren|microciclo|ejercicio/i.test(input)
          ? "actionPlan"
          : "diagnosis",
    impliedClaims: [],
  };
}

export function buildCoachRetrievalQuery(
  input: string,
  collectedEvidence: CollectedAnswer[],
): string {
  if (!collectedEvidence.length) return input;

  const answers = collectedEvidence
    .map((answer) => answer.rawAnswer?.trim())
    .filter((text): text is string => Boolean(text));

  return answers.length ? [input, ...answers].join(". ") : input;
}

export function collectCoachEvidenceSignals(
  collectedEvidence: CollectedAnswer[],
): EvidenceSignal[] {
  return normalizeCollectedEvidence(collectedEvidence);
}

export function auditCoachEvidence({
  claims,
  signals,
  retrieved,
  intent,
}: {
  claims: ImpliedClaim[];
  signals: EvidenceSignal[];
  retrieved: RetrievedEvidence[];
  intent: TacticalIntent;
}): EvidenceAudit {
  return buildEvidenceAudit({ claims, signals, retrieved, intent });
}

export function selectCoachPromptMode({
  input,
  evidenceStrength,
  skipInterview,
}: {
  input: string;
  evidenceStrength: EvidenceStrength;
  skipInterview: boolean;
}): CoachPromptMode {
  const inferred = inferCoachPromptMode(input);
  if (inferred === "generalExplanation" || inferred === "sessionPlan") {
    return inferred;
  }
  if (!skipInterview && evidenceStrength === "sufficient") return "diagnosis";
  return "hypothesis";
}

export function selfCheckCoachAdvice(
  advice: CoachMatchAdvice,
  audit: EvidenceAudit,
): CoachSelfCheck {
  const notes: string[] = [];
  const overconfidenceRisk =
    audit.evidenceStrength !== "sufficient" && advice.reflection.confidence > 0.68;
  const missingCitationRisk =
    audit.evidenceStrength !== "none" && advice.evidenceCitations.length === 0;
  const nonExecutableActionRisk = advice.actions.some(
    (action) =>
      ["openExercise", "addToSession", "createExerciseVariant"].includes(action.type) &&
      !action.exerciseId,
  );

  if (overconfidenceRisk) notes.push("confidence above evidence strength");
  if (missingCitationRisk) notes.push("evidence available but no citation attached");
  if (nonExecutableActionRisk) notes.push("action references an exercise command without exerciseId");

  return {
    overconfidenceRisk,
    missingCitationRisk,
    nonExecutableActionRisk,
    notes,
  };
}

export function buildCoachPipelineTrace({
  input,
  collectedEvidence,
  retrieved,
  audit,
  advice,
  skipInterview,
}: {
  input: string;
  collectedEvidence: CollectedAnswer[];
  retrieved: RetrievedEvidence[];
  audit: EvidenceAudit;
  advice?: CoachMatchAdvice;
  skipInterview: boolean;
}): CoachPipelineTrace {
  return {
    intent: classifyCoachIntent(input),
    retrievalQuery: buildCoachRetrievalQuery(input, collectedEvidence),
    evidenceSignalCount: collectCoachEvidenceSignals(collectedEvidence).length,
    retrievedEvidenceCount: retrieved.length,
    promptMode: selectCoachPromptMode({
      input,
      evidenceStrength: audit.evidenceStrength,
      skipInterview,
    }),
    selfCheck: advice
      ? selfCheckCoachAdvice(advice, audit)
      : {
          overconfidenceRisk: false,
          missingCitationRisk: false,
          nonExecutableActionRisk: false,
          notes: [],
        },
  };
}

function fallbackDomain(input: string): TacticalDomain {
  const normalized = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/salida|pivote|progres|primer pase/.test(normalized)) return "buildUp";
  if (/presion|apretar|bloque alto/.test(normalized)) return "pressing";
  if (/transicion|perdida|contra/.test(normalized)) return "defensiveTransition";
  if (/atacar|gol|area|9/.test(normalized)) return "attack";
  return "defense";
}
