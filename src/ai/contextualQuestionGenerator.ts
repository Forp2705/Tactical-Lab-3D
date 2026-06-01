import { z } from "zod";
import {
  ContextualQuestionSchema,
  ImpliedClaimSchema,
  TacticalIntentSchema,
  type CollectedAnswer,
  type ContextualQuestion,
  type EvidenceAudit,
  type EvidenceTarget,
  type ImpliedClaim,
  type TacticalDomain,
  type TacticalIntent,
} from "./CoachSchemas.js";
import { COACH_QUESTION_SYSTEM_PROMPT } from "./CoachQuestionPrompt.js";
import type { RetrievedEvidence } from "./CoachAgent.js";
import {
  buildEvidenceAudit,
  capForEvidenceStrength,
  normalizeCollectedEvidence,
} from "./evidenceCollection.js";
import { extractJsonObject } from "./coachResponseParsing.js";

export type QuestionLlmFn = (args: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<string>;

export type GenerateQuestionsInput = {
  userInput: string;
  evidenceCatalog: RetrievedEvidence[];
  collectedEvidence: CollectedAnswer[];
  priorIntent?: TacticalIntent | null;
  priorClaims?: ImpliedClaim[];
};

export type GenerateQuestionsResult = {
  intent: TacticalIntent;
  temptingClaims: ImpliedClaim[];
  selectedQuestions: ContextualQuestion[];
  blockedClaims: ImpliedClaim[];
  evidenceAudit: EvidenceAudit;
  recommendedResponseMode: "question" | "hypothesis" | "diagnosis";
  confidenceCap: number;
};

const LlmQuestionDraftSchema = z.object({
  intent: TacticalIntentSchema,
  temptingClaims: z.array(ImpliedClaimSchema).default([]),
  questionCandidates: z.array(ContextualQuestionSchema).default([]),
});

export async function generateContextualQuestions(
  input: GenerateQuestionsInput,
  runLlm: QuestionLlmFn,
): Promise<GenerateQuestionsResult> {
  const draft = await loadQuestionDraft(input, runLlm);
  const intent = input.priorIntent ?? draft.intent;
  const temptingClaims = input.priorClaims?.length
    ? input.priorClaims
    : draft.temptingClaims.length
      ? draft.temptingClaims
      : fallbackClaims(intent);
  const collectedSignals = normalizeCollectedEvidence(input.collectedEvidence);
  const evidenceAudit = buildEvidenceAudit({
    claims: temptingClaims,
    signals: collectedSignals,
    retrieved: input.evidenceCatalog,
    intent,
  });

  const candidates = [
    ...draft.questionCandidates,
    ...fallbackQuestionsForIntent(intent, temptingClaims),
  ];
  const scored = candidates
    .filter((question) => belongsToIntent(question, intent))
    .filter((question) => !wasAlreadyAnswered(question, input.collectedEvidence))
    .map((question) => ({
      ...question,
      score: scoreQuestion(question, intent, temptingClaims, input.collectedEvidence),
    }))
    .sort((a, b) => b.score - a.score);
  const selectedQuestions = diversifyQuestions(
    scored,
    maxQuestionsFor(intent, evidenceAudit),
  );
  const blockedClaims = temptingClaims.filter((claim) =>
    selectedQuestions.some((question) =>
      question.blocksClaimIds.includes(claim.id),
    ),
  );
  const recommendedResponseMode = responseModeFor(
    evidenceAudit,
    selectedQuestions,
  );

  return {
    intent,
    temptingClaims,
    selectedQuestions,
    blockedClaims,
    evidenceAudit,
    recommendedResponseMode,
    confidenceCap: confidenceCapFor(evidenceAudit, selectedQuestions),
  };
}

export function scoreQuestion(
  question: ContextualQuestion,
  intent: TacticalIntent,
  claims: ImpliedClaim[],
  collected: CollectedAnswer[],
) {
  let score = 0;
  const blockedClaims = claims.filter((claim) =>
    question.blocksClaimIds.includes(claim.id),
  );

  if (blockedClaims.some((claim) => claim.riskIfWrong === "high")) score += 3;
  if (question.expectedImpactOnDiagnosis === "high") score += 3;
  if (question.evidenceTarget === "ownTeam" || question.evidenceTarget === "rival") {
    score += 2;
  }
  if (question.evidenceTarget === "zone" || question.evidenceTarget === "moment") {
    score += 2;
  }
  if (question.evidenceTarget === "frequency") score += 1;
  if (wasAlreadyAnswered(question, collected)) score -= 3;
  if (!belongsToIntent(question, intent)) score -= 2;
  if (intent.specificity === "general" && question.purpose === "assessRisk") {
    score -= 1;
  }
  if (question.informationValue === "high") score += 2;
  if (question.informationValue === "medium") score += 1;

  return score;
}

export function diversifyQuestions(
  scored: Array<ContextualQuestion & { score: number }>,
  max: number,
) {
  const selected: ContextualQuestion[] = [];
  const usedPairs = new Set<string>();

  for (const question of scored) {
    if (selected.length >= max) break;
    const pair = `${question.evidenceTarget}:${question.purpose}`;
    if (usedPairs.has(pair)) continue;
    selected.push(stripScore(question));
    usedPairs.add(pair);
  }

  return selected;
}

export function maxQuestionsFor(
  intent: TacticalIntent,
  audit: EvidenceAudit,
) {
  if (audit.evidenceStrength === "sufficient") return 0;
  if (audit.criticalMissingCount === 1 && intent.specificity === "specific") {
    return 1;
  }
  if (intent.requestType === "generalExplanation") return 0;
  return 3;
}

export function wasAlreadyAnswered(
  question: ContextualQuestion,
  collected: CollectedAnswer[],
) {
  return collected.some(
    (answer) =>
      answer.category === question.category &&
      answer.evidenceTarget === question.evidenceTarget &&
      Boolean(answer.rawAnswer.trim()),
  );
}

export function confidenceCapFor(
  audit: EvidenceAudit,
  selected: ContextualQuestion[],
) {
  if (selected.length && audit.evidenceStrength === "none") return 0.45;
  if (selected.length) return Math.min(0.65, capForEvidenceStrength(audit.evidenceStrength));
  return capForEvidenceStrength(audit.evidenceStrength);
}

function responseModeFor(
  audit: EvidenceAudit,
  questions: ContextualQuestion[],
): "question" | "hypothesis" | "diagnosis" {
  if (audit.evidenceStrength === "sufficient" && !questions.length) {
    return "diagnosis";
  }
  if (questions.length && audit.evidenceStrength === "none") return "question";
  if (questions.length) return "hypothesis";
  return audit.evidenceStrength === "none" ? "question" : "hypothesis";
}

async function loadQuestionDraft(
  input: GenerateQuestionsInput,
  runLlm: QuestionLlmFn,
) {
  try {
    const raw = await runLlm({
      systemPrompt: COACH_QUESTION_SYSTEM_PROMPT,
      userPrompt: buildQuestionUserPrompt(input),
    });
    const parsed = JSON.parse(extractJsonObject(raw));
    return LlmQuestionDraftSchema.parse(parsed);
  } catch {
    const intent = input.priorIntent ?? fallbackIntent(input.userInput);
    return {
      intent,
      temptingClaims: input.priorClaims?.length
        ? input.priorClaims
        : fallbackClaims(intent),
      questionCandidates: [],
    };
  }
}

function buildQuestionUserPrompt(input: GenerateQuestionsInput) {
  return JSON.stringify(
    {
      userInput: input.userInput,
      evidenceCatalog: input.evidenceCatalog.slice(0, 8),
      collectedEvidence: input.collectedEvidence,
      priorIntent: input.priorIntent,
      priorClaims: input.priorClaims,
    },
    null,
    2,
  );
}

function fallbackIntent(userInput: string): TacticalIntent {
  const domain = inferDomain(userInput);
  const words = userInput.trim().split(/\s+/).filter(Boolean).length;

  return {
    domains: [domain],
    specificity: words >= 8 ? "specific" : "general",
    requestType: /explic|como funciona/i.test(userInput)
      ? "generalExplanation"
      : /plan|accion|hacemos|correg/i.test(userInput)
        ? "actionPlan"
        : "diagnosis",
    impliedClaims: [],
  };
}

function inferDomain(userInput: string): TacticalDomain {
  const text = userInput.toLowerCase();
  if (/salida|salir|limpio|constru/i.test(text)) return "buildUp";
  if (/perd|transicion|largo|partido/i.test(text)) return "defensiveTransition";
  if (/presion|apretar|saltar/i.test(text)) return "pressing";
  if (/bloque|hund|linea/i.test(text)) return "block";
  if (/banda|lateral|costado/i.test(text)) return "defense";
  if (/abp|pelota parada|corner|tiro libre/i.test(text)) return "setPieces";
  if (/duelo|mano a mano|marca/i.test(text)) return "duels";
  if (/gener|situacion|9|delanter|atac/i.test(text)) return "attack";
  return "defense";
}

function fallbackClaims(intent: TacticalIntent): ImpliedClaim[] {
  const domain = intent.domains[0] ?? "defense";
  return [
    {
      id: `claim_${domain}_cause`,
      claim: "La causa principal del problema todavia no esta confirmada.",
      domain,
      subject: "unknown",
      riskIfWrong: "high",
      requiredEvidence: ["cause", "zone", "ownTeam"],
    },
  ];
}

function fallbackQuestionsForIntent(
  intent: TacticalIntent,
  claims: ImpliedClaim[],
): ContextualQuestion[] {
  const domain = intent.domains[0] ?? "defense";
  const claimId = claims[0]?.id ?? `claim_${domain}_cause`;
  const common = {
    category: domain,
    informationValue: "high" as const,
    expectedImpactOnDiagnosis: "high" as const,
    blocksClaimIds: [claimId],
  };

  if (domain === "buildUp") {
    return [
      makeQuestion(common, "q_build_zone", "zone", "locateZone", "singleChoice", "Donde se corta mas la salida?", "El ajuste cambia segun si la perdida nace en centrales, laterales, arquero o mediocentro.", ["centrales", "laterales", "arquero", "mediocentro", "no estoy seguro"]),
      makeQuestion(common, "q_build_rival", "rival", "identifySubject", "singleChoice", "El rival los presiona alto o ustedes se apuran aun sin presion?", "Distingue un problema provocado por el rival de un problema propio de pausa o decision.", ["presion alta rival", "nos apuramos sin presion", "ambas", "no estoy seguro"]),
      makeQuestion(common, "q_build_support", "cause", "separateCauseFromSymptom", "singleChoice", "El receptor tiene apoyos cerca o queda solo?", "Si queda solo, el problema es de estructura; si tiene apoyos, puede ser perfil corporal o eleccion de pase.", ["tiene apoyos", "queda solo", "depende de la jugada"]),
    ];
  }

  if (domain === "setPieces") {
    return [
      makeQuestion(common, "q_abp_type", "phase", "classifyProblem", "singleChoice", "El dano viene en corners, tiros libres laterales o segundas pelotas?", "Cada pelota parada tiene responsabilidades distintas.", ["corners", "tiros libres laterales", "segundas pelotas", "varias"]),
      makeQuestion(common, "q_abp_cause", "cause", "separateCauseFromSymptom", "singleChoice", "Pierden por altura, bloqueo o marca perdida?", "Distingue problema fisico de problema organizativo.", ["altura", "bloqueo", "marca perdida", "no estoy seguro"]),
      makeQuestion(common, "q_abp_system", "ownTeam", "identifySubject", "singleChoice", "Defienden al hombre, en zona o mixto?", "El ajuste depende del sistema defensivo usado.", ["hombre", "zona", "mixto", "no definido"]),
    ];
  }

  if (domain === "attack") {
    return [
      makeQuestion(common, "q_attack_phase", "phase", "classifyProblem", "singleChoice", "El problema es llegar a tres cuartos o terminar cerca del area?", "Separa un problema de progresion de uno de finalizacion.", ["llegar a tres cuartos", "terminar jugadas", "ambas"]),
      makeQuestion(common, "q_attack_9", "playerProfile", "identifySubject", "singleChoice", "El 9 recibe de espaldas, ataca espacio o casi no toca la pelota?", "Define si falta conexion, profundidad o presencia en area.", ["recibe de espaldas", "ataca espacio", "no toca la pelota", "no aplica"]),
      makeQuestion(common, "q_attack_route", "zone", "locateZone", "singleChoice", "Atacan mas por banda, por dentro o con pelota larga?", "Permite saber si hay un camino claro o ataques aislados.", ["banda", "por dentro", "pelota larga", "sin patron claro"]),
    ];
  }

  if (domain === "defensiveTransition") {
    return [
      makeQuestion(common, "q_trans_line", "ownTeam", "identifySubject", "singleChoice", "Tras la perdida, quien queda mas lejos: delanteros, volantes o defensa?", "Identifica que linea rompe la compactacion.", ["delanteros", "volantes", "defensa", "no lo tengo claro"]),
      makeQuestion(common, "q_trans_zone", "zone", "locateZone", "singleChoice", "La perdida suele ser por dentro o en banda?", "Cambia la primera reaccion defensiva.", ["por dentro", "en banda", "ambas"]),
      makeQuestion(common, "q_trans_rest", "cause", "separateCauseFromSymptom", "singleChoice", "Quedan 2 o 3 jugadores por detras de la pelota al atacar?", "Mide si el problema nace antes de perderla, en la estructura de resguardo.", ["si", "no", "depende"]),
    ];
  }

  return [
    makeQuestion(common, "q_def_zone", "zone", "locateZone", "singleChoice", "El rival les hace dano mas por dentro, por banda o a la espalda?", "Ubica si el problema es estructura central, cobertura lateral o defensa de profundidad.", ["por dentro", "por banda", "a la espalda", "no lo tengo claro"]),
    makeQuestion(common, "q_def_block", "ownTeam", "identifySubject", "singleChoice", "Cuando defienden, el equipo queda junto o se parte entre lineas?", "Si queda partido, el ajuste es de distancias; si queda junto pero sufre, puede ser zona o duelos.", ["queda junto", "se parte", "depende"]),
    makeQuestion(common, "q_def_phase", "phase", "classifyProblem", "singleChoice", "El problema aparece mas cuando el rival inicia jugada o cuando ustedes pierden la pelota?", "Separa defensa organizada de transicion defensiva.", ["rival inicia", "tras perdida nuestra", "ambas"]),
  ];
}

function makeQuestion(
  base: Pick<
    ContextualQuestion,
    "category" | "informationValue" | "expectedImpactOnDiagnosis" | "blocksClaimIds"
  >,
  id: string,
  evidenceTarget: EvidenceTarget,
  purpose: ContextualQuestion["purpose"],
  answerKind: ContextualQuestion["answerKind"],
  question: string,
  whyItMatters: string,
  options?: string[],
): ContextualQuestion {
  return {
    ...base,
    id,
    question,
    whyItMatters,
    tacticalRiskReduced: "Evita diagnosticar una causa sin evidencia.",
    evidenceTarget,
    purpose,
    answerKind,
    ...(options ? { options } : {}),
  };
}

function belongsToIntent(question: ContextualQuestion, intent: TacticalIntent) {
  return intent.domains.includes(question.category);
}

function stripScore(
  question: ContextualQuestion & { score: number },
): ContextualQuestion {
  const { score: _score, ...rest } = question;
  return rest;
}
