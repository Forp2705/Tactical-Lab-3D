import type { CoachMatchAdvice, TacticalDomain } from "./CoachSchemas.js";
import { inferDomainsFromText } from "./exerciseMatching.js";

export type GuardEvidence = {
  id: string;
  sourceType: "knowledge" | "memory" | "observation" | "report" | "video";
};

export type CoachTrustAssessment = {
  notes: string[];
  confidenceCap: number;
  missingPrimaryDomain: boolean;
  hasCitation: boolean;
  hasCaseEvidence: boolean;
  hasOnlyContextEvidence: boolean;
  makesStrongClaim: boolean;
  requiresHypothesisMode: boolean;
};

const DOMAIN_LABELS: Record<TacticalDomain, string> = {
  defense: "defensa",
  pressing: "presion",
  block: "bloque",
  buildUp: "salida",
  defensiveTransition: "transicion defensiva",
  offensiveTransition: "transicion ofensiva",
  attack: "ataque",
  setPieces: "pelota parada",
  duels: "duelos",
  physicalEmotional: "fisico/emocional",
  systemLineup: "sistema",
};

export function guardCoachAdvice(
  advice: CoachMatchAdvice,
  {
    userInput,
    evidenceCatalog,
  }: {
    userInput: string;
    evidenceCatalog: GuardEvidence[];
  },
): CoachMatchAdvice {
  const assessment = assessCoachAdviceTrust(advice, {
    userInput,
    evidenceCatalog,
  });

  if (!assessment.notes.length) return advice;

  return {
    ...advice,
    reflection: {
      ...advice.reflection,
      mainUncertainty: appendNote(
        advice.reflection.mainUncertainty,
        assessment.notes.join(" "),
      ),
      confidence: Math.min(advice.reflection.confidence, assessment.confidenceCap),
    },
  };
}

export function assessCoachAdviceTrust(
  advice: CoachMatchAdvice,
  {
    userInput,
    evidenceCatalog,
  }: {
    userInput: string;
    evidenceCatalog: GuardEvidence[];
  },
): CoachTrustAssessment {
  const expectedDomains = inferDomainsFromText(userInput);
  const adviceText = [
    advice.tacticalReading,
    advice.probableCause,
    advice.mainAdjustment,
    advice.wednesdayTest,
    advice.saturdayFocus,
  ].join(" ");
  const adviceDomains = inferDomainsFromText(adviceText);
  const missingPrimaryDomain = expectedDomains.some(
    (domain) => !adviceDomains.includes(domain),
  );
  const citedIds = new Set(advice.evidenceCitations.map((citation) => citation.sourceId));
  const citedEvidence = evidenceCatalog.filter((item) => citedIds.has(item.id));
  const hasCitation = citedEvidence.length > 0;
  const hasCaseEvidence = citedEvidence.some((item) =>
    ["report", "observation", "video"].includes(item.sourceType),
  );
  const hasOnlyContextEvidence = hasCitation && !hasCaseEvidence;
  const makesStrongClaim = advice.reflection.confidence >= 0.68 || [
    advice.probableCause,
    advice.mainAdjustment,
    advice.wednesdayTest,
    advice.saturdayFocus,
  ].some((text) =>
    /\b(confirmad|evident|claro|principal|seguro|debe|hay que)\b/i.test(text),
  );

  const uncertaintyNotes: string[] = [];
  let confidenceCap = advice.reflection.confidence;

  if (missingPrimaryDomain) {
    uncertaintyNotes.push(
      `Guard: la respuesta puede estar derivando de fase; el pedido apunta a ${expectedDomains
        .map((domain) => DOMAIN_LABELS[domain])
        .join(", ")}.`,
    );
    confidenceCap = Math.min(confidenceCap, 0.55);
  }

  if (!hasCitation) {
    uncertaintyNotes.push(
      "Guard: no hay citas validas de evidencia/knowledge en la salida; no elevar confianza.",
    );
    confidenceCap = Math.min(confidenceCap, 0.5);
  } else if (hasOnlyContextEvidence && makesStrongClaim) {
    uncertaintyNotes.push(
      "Guard: la respuesta hace afirmaciones fuertes sin evidencia actual/reportes del caso; usar como hipotesis.",
    );
    confidenceCap = Math.min(confidenceCap, 0.62);
  }

  return {
    notes: uncertaintyNotes,
    confidenceCap,
    missingPrimaryDomain,
    hasCitation,
    hasCaseEvidence,
    hasOnlyContextEvidence,
    makesStrongClaim,
    requiresHypothesisMode:
      missingPrimaryDomain ||
      !hasCitation ||
      (hasOnlyContextEvidence && makesStrongClaim),
  };
}

function appendNote(current: string, note: string) {
  return current.trim() ? `${current.trim()} ${note}` : note;
}
