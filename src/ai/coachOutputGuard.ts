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
  citationCount: number;
  currentEvidenceCount: number;
  hasCaseEvidence: boolean;
  hasOnlyHistoricalOrContextEvidence: boolean;
  missingCitationRisk: boolean;
  reliesMostlyOnMemoryOrPrinciples: boolean;
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
  const citationCount = citedEvidence.length;
  const hasCitation = citationCount > 0;
  const currentEvidenceCount = citedEvidence.filter((item) =>
    ["observation", "video"].includes(item.sourceType),
  ).length;
  const hasCaseEvidence = currentEvidenceCount > 0;
  const hasOnlyHistoricalOrContextEvidence = hasCitation && currentEvidenceCount === 0;
  const reliesMostlyOnMemoryOrPrinciples =
    hasCitation &&
    citedEvidence.every((item) => ["knowledge", "memory"].includes(item.sourceType));
  const missingCitationRisk = citationCount === 0;
  const hasHistoricalEvidence = citedEvidence.some((item) =>
    ["report", "memory"].includes(item.sourceType),
  );
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
    confidenceCap = Math.min(confidenceCap, 0.52);
  }

  if (missingCitationRisk) {
    uncertaintyNotes.push(
      "Guard: no hay citas validas de evidencia/knowledge en la salida; no elevar confianza.",
    );
    confidenceCap = Math.min(confidenceCap, 0.45);
  }

  if (!currentEvidenceCount) {
    uncertaintyNotes.push(
      hasHistoricalEvidence
        ? "Guard: no hay evidencia actual citada; la lectura depende de memoria o reportes previos."
        : "Guard: no hay evidencia actual citada; mantener como hipotesis.",
    );
    confidenceCap = Math.min(confidenceCap, 0.55);
  }

  if (reliesMostlyOnMemoryOrPrinciples) {
    uncertaintyNotes.push(
      "Guard: la salida se apoya sobre todo en memoria o principios tacticos; no tratarla como diagnostico cerrado.",
    );
    confidenceCap = Math.min(confidenceCap, 0.5);
  }

  if (hasOnlyHistoricalOrContextEvidence && makesStrongClaim) {
    uncertaintyNotes.push(
      "Guard: la respuesta hace afirmaciones fuertes sin evidencia actual del caso; usar como hipotesis.",
    );
    confidenceCap = Math.min(confidenceCap, 0.48);
  }

  return {
    notes: uncertaintyNotes,
    confidenceCap,
    missingPrimaryDomain,
    hasCitation,
    citationCount,
    currentEvidenceCount,
    hasCaseEvidence,
    hasOnlyHistoricalOrContextEvidence,
    missingCitationRisk,
    reliesMostlyOnMemoryOrPrinciples,
    makesStrongClaim,
    requiresHypothesisMode:
      missingPrimaryDomain ||
      missingCitationRisk ||
      currentEvidenceCount === 0 ||
      reliesMostlyOnMemoryOrPrinciples ||
      (hasOnlyHistoricalOrContextEvidence && makesStrongClaim),
  };
}

function appendNote(current: string, note: string) {
  return current.trim() ? `${current.trim()} ${note}` : note;
}
