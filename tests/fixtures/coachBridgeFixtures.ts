// Shared Board->Coach bridge fixtures for slice 4.
// Consumed by task 4 (coachOutputGuard firewall tests) and task 9 (imports `hyp`).
// Pure builders — no behavior, just packet / advice / response factories.
import type {
  BoardEvidencePacket,
  BoardFactualClaim,
} from "@/board/boardEvidencePacket";
import type {
  CoachBoardClaimReference,
  CoachMatchAdvice,
  CoachResponse,
  TacticalIntent,
} from "@/ai/CoachSchemas";

// Default board claims: one grounded zone-count, one grounded coverage, one
// ungrounded zone-count (drives the `ungrounded-support` branch).
const defaultClaims: BoardFactualClaim[] = [
  {
    id: "presion-zona-3",
    kind: "zone-count",
    zoneLabel: "Presión zona 3",
    own: 3,
    rival: 2,
    delta: 1,
    grounded: true,
  },
  {
    id: "espacio-a-la-espalda",
    kind: "coverage",
    zoneId: "espacio-a-la-espalda",
    zoneLabel: "Espacio a la espalda",
    covering: 1,
    grounded: true,
    excludes: "backs",
  },
  {
    id: "zona-ciega",
    kind: "zone-count",
    zoneLabel: "Zona ciega",
    own: 1,
    rival: 2,
    delta: -1,
    grounded: false,
  },
];

export function packet(
  over: { factualClaims?: BoardFactualClaim[] } = {},
): BoardEvidencePacket {
  return {
    source: "boardScenario",
    scope: "drawnSituation",
    scenarioId: "raise-block",
    title: "Subir el bloque",
    readout: {
      confidence: "medium",
      evidenceLevel: "partial",
      expectedBenefit: "Recuperar más arriba.",
      mainRisk: "Espacio a la espalda de la última línea.",
    },
    boardEvidence: {
      authority: "high",
      evidenceStrength: "partial",
      hasGroundedMetrics: true,
      factualClaims: over.factualClaims ?? defaultClaims,
    },
  };
}

export const baseAdvice: CoachMatchAdvice = {
  tacticalReading: "El equipo presiona alto pero deja espacio a la espalda.",
  problemBreakdown: {
    zone: "Zona 3",
    moment: "Salida rival",
    trigger: "Pase al pivote",
    ownVsRival: "3 vs 2 a favor en la presión",
  },
  probableCause: "La última línea no acompaña la subida del bloque.",
  mainAdjustment: "Coordinar el salto de la línea con la presión.",
  onFieldInstructions: ["Subir juntos", "Achicar el espacio interior"],
  alternativeAdjustments: [],
  wednesdayTest: "Rondo de presión 3 vs 2 con línea alta.",
  saturdayFocus: "Sincronía línea-presión.",
  adjustmentRisks: ["Quedar expuestos a la espalda"],
  successSignals: ["Recuperaciones más altas"],
  reflection: {
    mainUncertainty: "No sé si el rival cambia de banda rápido.",
    missingInformation: "Velocidad del delantero rival.",
    alternativeInterpretation: "Quizá el problema sea de marca individual.",
    confidence: 0.6,
  },
  linkedExercises: [],
  actions: [],
  evidenceCitations: [],
  modelContrast: {
    aligned: [],
    contradictions: [],
    insufficientEvidence: [],
  },
  playerFitWarnings: [],
  supportingFacts: [],
};

const intent: TacticalIntent = {
  domains: ["pressing"],
  specificity: "specific",
  requestType: "diagnosis",
  impliedClaims: [],
};

const evidenceAudit = {
  covered: [],
  missing: [],
  criticalMissingCount: 0,
  evidenceStrength: "partial" as const,
};

export function hyp(
  supportingFacts: CoachBoardClaimReference[],
): CoachResponse {
  return {
    mode: "hypothesis",
    advice: { ...baseAdvice, supportingFacts },
    confidenceCap: 0.7,
    intent,
    evidenceAudit,
    followUpQuestions: [],
  };
}

export function diag(
  supportingFacts: CoachBoardClaimReference[],
): CoachResponse {
  return {
    mode: "diagnosis",
    advice: { ...baseAdvice, supportingFacts },
    intent,
    evidenceAudit,
  };
}
