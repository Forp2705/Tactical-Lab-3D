import dotenv from "dotenv";
import OpenAI from "openai";
import { COACH_AGENT_SYSTEM_PROMPT } from "../CoachAgentPrompt.js";
import { COACH_RULES } from "../CoachRules.js";
import { MATCH_MEMORY } from "../MatchMemory.js";
import { retrieveRelevantContext } from "../retrieveRelevantContext.js";
import { retrieveRelevantGeneratedMemory } from "../retrieveRelevantGeneratedMemory.js";
import { retrieveRelevantKnowledge } from "../retrieveRelevantKnowledge.js";
import {
  type PostMatchInput,
  PostMatchInputSchema,
  type PostMatchReport,
  PostMatchReportSchema,
} from "./schemas.js";
import {
  type EvidenceLike,
  extractEvidenceIds,
  hasGroundingEvidence,
  referencesValidEvidence,
} from "./evidenceStrength.js";

dotenv.config({
  path: ".env.local",
});

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName =
  process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free";

function getClient() {
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

export async function generatePostMatchReport(rawInput: unknown) {
  const input = withInterpretedResult(PostMatchInputSchema.parse(rawInput));
  const evidenceLedger = buildEvidenceLedger(input);
  const searchableInput = buildSearchableInput(input);
  const relevantContext = await retrieveRelevantContext(searchableInput);
  const relevantGeneratedMemory =
    await retrieveRelevantGeneratedMemory(searchableInput);
  const relevantKnowledge = await retrieveRelevantKnowledge(searchableInput);
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: COACH_AGENT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildPrompt({
          input,
          evidenceLedger,
          relevantContext,
          relevantGeneratedMemory,
          relevantKnowledge,
        }),
      },
    ],
    temperature: 0.35,
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  const cleanText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(cleanText);
  const normalized = normalizePostMatchReport(parsed, input);
  const result = PostMatchReportSchema.safeParse(normalized);

  if (!result.success) {
    console.error("[post-match] normalized report failed schema validation", {
      issues: result.error.issues,
      normalized,
    });
    throw result.error;
  }

  return validatePostMatchGrounding(result.data, input);
}

function buildSearchableInput(input: PostMatchInput) {
  return [
    input.matchContext.opponent,
    input.matchContext.result,
    input.matchContext.ownSystem,
    input.matchContext.opponentSystem,
    input.planBeforeMatch,
    input.staffNotes,
    ...input.tags.flatMap((tag) => [tag.label, tag.zone, tag.note]),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt({
  input,
  evidenceLedger,
  relevantContext,
  relevantGeneratedMemory,
  relevantKnowledge,
}: {
  input: PostMatchInput;
  evidenceLedger: EvidenceItem[];
  relevantContext: unknown;
  relevantGeneratedMemory: unknown;
  relevantKnowledge: unknown;
}) {
  return `
Modo: ANALISIS POST-PARTIDO.

Trabajas como asistente de staff. No inventes el partido. Usá solo contexto, notas, tags y evidencia disponible. Si falta evidencia, declaralo en missingInformation o reflection.

Regla de resultado:
- El resultado SIEMPRE esta cargado desde la perspectiva del equipo propio.
- Resultado cargado: ${input.matchContext.result}
- Interpretacion obligatoria: ${input.matchContext.interpretedResult?.label ?? "resultado no interpretable"}
- Si outcome es "win", NO describas el partido como derrota propia.
- Si outcome es "loss", NO describas el partido como victoria propia.
- Si outcome es "draw", describilo como empate.

Reglas de grounding y atribucion de sujeto:
- No inventes minutos, clips, eventos ni secuencias. Solo podes mencionar minutos si aparecen en tags.
- Toda evidencia debe referenciar el ledger de evidencia por ID (ej: EV-NOTES, EV-TAG-1).
- Los tags tienen severidad/confiabilidad: high = validado/manual por staff; medium = evidencia util sin confirmacion extra; low = tracking asistido no confirmado.
- No bases conclusiones centrales solo en tags low. Si usas evidencia low, tratala como indicio a revisar o informacion faltante salvo que este confirmada por notas/staff.
- Prioriza evidencia high sobre medium y medium sobre low cuando haya contradicciones.
- Si algo no aparece en el ledger de evidencia, tratálo como inferencia o informacion faltante, no como hecho.
- No conviertas vulnerabilidades del rival en problemas propios.
- Si las notas dicen que el rival defendio con linea alta o defensores lentos, eso es vulnerabilidad del rival, no problema propio.
- No atribuyas memoria previa al partido actual salvo que haya evidencia actual explicita.
- Diferencia evidencia actual, inferencia tactica y memoria previa.
- Si usas memoria previa, ponela en memoryInfluence y aclara si es contextOnly o supportedByCurrentEvidence.
- No digas que el bloque propio se hundio, que los delanteros propios retrocedieron o que hubo un problema recurrente si eso no esta en notas/tags del partido actual.
- Si aparece jugar con 10, expulsion, lesiones, clima/cancha, partido liquidado o superioridad/inferioridad numerica, ponelo en conditioningContext, no como riesgo observado.
- No recomiendes genericamente "bajar el bloque". Si el problema es bloque partido o defensa que no achica, formula la recomendacion como coordinacion de alturas: si puntas y volantes saltan, la defensa achica; si la defensa no puede achicar, los volantes no deben saltar tan alto.
- Para problemas del equipo propio, prioriza ownTeamProblems. mainProblems queda solo por compatibilidad y no debe duplicar ownTeamProblems.
- Si detectas asimetria izquierda/derecha del equipo propio, el memoryCandidate debe usar category "sideAsymmetry" y scope "repeatWatch", no "opponentPattern".

Regla critica:
- NO actualices memoria.
- Solo propone memoryCandidates.
- El staff humano decide despues si esos aprendizajes pasan a memoria.
- No generes microciclo completo.
- Si sugeris algo para la semana, enfocalo como test del miercoles contra suplentes/reserva o foco simple para el sabado.

Respond ONLY with valid JSON using this exact structure:

{
  "executiveSummary": "string",
  "matchStory": "string",
  "ownStrengths": [
    {
      "strength": "string",
      "evidence": ["string"]
    }
  ],
  "ownProblems": [
    {
      "problem": "string",
      "evidence": ["string"],
      "severity": "low|medium|high"
    }
  ],
  "ownTeamProblems": [
    {
      "problem": "string",
      "evidence": ["string"],
      "severity": "low|medium|high",
      "probableCause": "string"
    }
  ],
  "conditioningContext": ["string"],
  "rivalVulnerabilities": [
    {
      "vulnerability": "string",
      "evidence": ["string"],
      "howWeExploitedIt": "string"
    }
  ],
  "observedRisks": [
    {
      "risk": "string",
      "evidence": ["string"],
      "owner": "own|rival|both|unknown"
    }
  ],
  "tacticalTradeoffs": [
    {
      "decision": "string",
      "upside": "string",
      "downside": "string",
      "subject": "own|rival|both|unknown",
      "evidence": ["string"]
    }
  ],
  "flankAsymmetries": [
    {
      "flank": "left|right|central|both",
      "description": "string",
      "subject": "own|rival|both|unknown",
      "evidence": ["string"],
      "implication": "string"
    }
  ],
  "tacticalInferences": [
    {
      "inference": "string",
      "basedOn": ["string"],
      "confidence": "low|medium|high"
    }
  ],
  "memoryInfluence": [
    {
      "memoryItem": "string",
      "usedAs": "contextOnly|supportedByCurrentEvidence",
      "currentEvidence": ["string"]
    }
  ],
  "grounding": {
    "resultPerspective": "string",
    "evidenceUsed": ["string"],
    "unsupportedClaims": ["string"],
    "subjectAttributionWarnings": ["string"]
  },
  "keyPatterns": [
    {
      "pattern": "string",
      "evidence": ["string"],
      "tacticalImpact": "string"
    }
  ],
  "mainProblems": [
    {
      "problem": "string",
      "probableCause": "string",
      "severity": "low|medium|high",
      "examplesToReview": ["string"]
    }
  ],
  "positives": ["string"],
  "wednesdayTest": [
    {
      "hypothesis": "string",
      "test": "string",
      "successSignals": ["string"],
      "fallbackIfFails": "string"
    }
  ],
  "saturdayFocus": ["string"],
  "risksOfOvercorrection": ["string"],
  "missingInformation": ["string"],
  "memoryCandidates": [
    {
      "id": "mc_1",
      "statement": "string",
      "category": "teamPattern|playerPattern|opponentPattern|staffPrinciple|sideAsymmetry",
      "evidence": ["string"],
      "confidence": "low|medium|high",
      "scope": "oneOff|repeatWatch|validated",
      "selectedByStaff": false
    }
  ],
  "reflection": {
    "mainUncertainty": "string",
    "alternativeInterpretation": "string",
    "confidence": 0.0
  }
}

Team setup:
No asumir formacion base, pressing identity o build-up style si no aparecen en el input, la evidencia o la memoria validada.

Match memory:
${MATCH_MEMORY}

Relevant generated tactical memory:
${JSON.stringify(relevantGeneratedMemory, null, 2)}

Relevant tactical observations:
${JSON.stringify(relevantContext, null, 2)}

Relevant tactical knowledge:
${JSON.stringify(relevantKnowledge, null, 2)}

Coach rules:
${COACH_RULES}

Evidence ledger:
${JSON.stringify(evidenceLedger, null, 2)}

Post-match input:
${JSON.stringify(input, null, 2)}
`;
}

type EvidenceItem = {
  id: string;
  source: "result" | "plan" | "staffNotes" | "tag";
  text: string;
  minute?: number;
  severity?: "low" | "medium" | "high";
};

export function normalizePostMatchReport(
  rawReport: unknown,
  input: PostMatchInput,
) {
  const parsed = objectRecord(rawReport);
  const reportId = `pmr_${Date.now()}`;
  const ownTeamProblems = buildOwnTeamProblems(parsed);
  const conditioningContext = buildConditioningContext(input, parsed);

  return {
    id: stringOrFallback(parsed.id, reportId),
    createdAt: stringOrFallback(parsed.createdAt, new Date().toISOString()),
    matchContext: input.matchContext,
    executiveSummary: stringOrFallback(parsed.executiveSummary, ""),
    matchStory: stringOrFallback(parsed.matchStory, ""),
    ownStrengths: objectArray(parsed.ownStrengths).map((item) => ({
      strength: stringOrFallback(item.strength, ""),
      evidence: coerceStringArray(item.evidence),
    })),
    ownProblems: objectArray(parsed.ownProblems).map((item) => ({
      problem: stringOrFallback(item.problem, ""),
      evidence: coerceStringArray(item.evidence),
      severity: severityOrMedium(item.severity),
    })),
    ownTeamProblems,
    conditioningContext,
    rivalVulnerabilities: objectArray(parsed.rivalVulnerabilities).map(
      (item) => ({
        vulnerability: stringOrFallback(item.vulnerability, ""),
        evidence: coerceStringArray(item.evidence),
        howWeExploitedIt: optionalString(item.howWeExploitedIt),
      }),
    ),
    observedRisks: filterConditioningRisks(parsed.observedRisks).map((risk) => {
      const item = objectRecord(risk);
      return {
        risk: stringOrFallback(item.risk, ""),
        evidence: coerceStringArray(item.evidence),
        owner: normalizeSubject(item.owner),
      };
    }),
    tacticalTradeoffs: objectArray(parsed.tacticalTradeoffs).map((item) => ({
      decision: stringOrFallback(item.decision, ""),
      upside: stringOrFallback(item.upside, ""),
      downside: stringOrFallback(item.downside, ""),
      subject: normalizeSubject(item.subject),
      evidence: coerceStringArray(item.evidence),
    })),
    flankAsymmetries: objectArray(parsed.flankAsymmetries).map((item) => ({
      flank: normalizeFlank(item.flank),
      description: stringOrFallback(item.description, ""),
      subject: normalizeSubject(item.subject),
      evidence: coerceStringArray(item.evidence),
      implication: optionalString(item.implication),
    })),
    tacticalInferences: objectArray(parsed.tacticalInferences).map((item) => ({
      inference: stringOrFallback(item.inference, ""),
      basedOn: coerceStringArray(item.basedOn),
      confidence: confidenceOrMedium(item.confidence),
    })),
    memoryInfluence: objectArray(parsed.memoryInfluence).map((item) => ({
      memoryItem: stringOrFallback(item.memoryItem, ""),
      usedAs:
        item.usedAs === "supportedByCurrentEvidence"
          ? "supportedByCurrentEvidence"
          : "contextOnly",
      currentEvidence: coerceStringArray(item.currentEvidence),
    })),
    grounding: normalizeGrounding(parsed.grounding, input),
    keyPatterns: objectArray(parsed.keyPatterns).map((item) => ({
      pattern: stringOrFallback(item.pattern, ""),
      evidence: coerceStringArray(item.evidence),
      tacticalImpact: stringOrFallback(item.tacticalImpact, ""),
    })),
    mainProblems: objectArray(parsed.mainProblems).map((item) => ({
      problem: stringOrFallback(item.problem, ""),
      probableCause: stringOrFallback(item.probableCause, ""),
      severity: severityOrMedium(item.severity),
      examplesToReview: coerceStringArray(item.examplesToReview),
    })),
    positives: coerceStringArray(parsed.positives),
    wednesdayTest: objectArray(parsed.wednesdayTest).map((item) => ({
      hypothesis: stringOrFallback(item.hypothesis, ""),
      test: stringOrFallback(item.test, ""),
      successSignals: coerceStringArray(item.successSignals),
      fallbackIfFails: optionalString(item.fallbackIfFails),
    })),
    saturdayFocus: coerceStringArray(parsed.saturdayFocus),
    risksOfOvercorrection: coerceStringArray(parsed.risksOfOvercorrection),
    missingInformation: coerceStringArray(parsed.missingInformation),
    memoryCandidates: objectArray(parsed.memoryCandidates).map(
      (candidate, index) => normalizeMemoryCandidate(candidate, index),
    ),
    reflection: normalizeReflection(parsed.reflection),
  };
}

export function validatePostMatchGrounding(
  report: PostMatchReport,
  input: PostMatchInput,
) {
  const evidenceLedger = buildEvidenceLedger(input);
  const evidenceById = new Map(evidenceLedger.map((item) => [item.id, item]));
  const validEvidenceIds = new Set(evidenceById.keys());
  const filterEvidence = (evidence: string[]) =>
    evidence.filter((item) => referencesValidEvidence(item, validEvidenceIds));
  const hasStrongEvidence = (evidence: string[]) =>
    hasGroundingEvidence(filterEvidence(evidence), evidenceById);
  const hasUnsupportedClaims = report.grounding.unsupportedClaims.length > 0;
  const evidenceUsed = filterEvidence(report.grounding.evidenceUsed);
  const groundedMemoryCandidates = report.memoryCandidates.map((candidate) =>
    guardMemoryCandidate(candidate, evidenceById, validEvidenceIds),
  );

  return {
    ...report,
    matchContext: input.matchContext,
    ownProblems: report.ownProblems.map((problem) => ({
      ...problem,
      evidence: filterEvidence(problem.evidence),
      severity: hasStrongEvidence(problem.evidence)
        ? problem.severity
        : downgradeSeverity(problem.severity),
    })),
    ownTeamProblems: report.ownTeamProblems.map((problem) => ({
      ...problem,
      evidence: filterEvidence(problem.evidence),
      severity: hasStrongEvidence(problem.evidence)
        ? problem.severity
        : downgradeSeverity(problem.severity),
    })),
    tacticalInferences: report.tacticalInferences.map((inference) => ({
      ...inference,
      basedOn: filterEvidence(inference.basedOn),
      confidence: hasStrongEvidence(inference.basedOn)
        ? inference.confidence
        : downgradeConfidence(inference.confidence),
    })),
    memoryInfluence: report.memoryInfluence.map((item) => ({
      ...item,
      usedAs:
        item.usedAs === "supportedByCurrentEvidence" &&
        hasStrongEvidence(item.currentEvidence)
          ? "supportedByCurrentEvidence"
          : "contextOnly",
      currentEvidence: filterEvidence(item.currentEvidence),
    })),
    memoryCandidates: groundedMemoryCandidates,
    reflection: {
      ...report.reflection,
      confidence:
        hasUnsupportedClaims || !hasGroundingEvidence(evidenceUsed, evidenceById)
          ? Math.min(report.reflection.confidence, 0.55)
          : report.reflection.confidence,
    },
    grounding: {
      ...report.grounding,
      resultPerspective:
        input.matchContext.interpretedResult?.label ??
        report.grounding.resultPerspective,
      evidenceUsed,
      unsupportedClaims: [
        ...report.grounding.unsupportedClaims,
        ...collectUnsupportedEvidenceWarnings(report, validEvidenceIds),
      ],
    },
  };
}

function guardMemoryCandidate(
  candidate: PostMatchReport["memoryCandidates"][number],
  evidenceById: Map<string, EvidenceLike>,
  validEvidenceIds: Set<string>,
): PostMatchReport["memoryCandidates"][number] {
  const evidence = candidate.evidence.filter((item) =>
    referencesValidEvidence(item, validEvidenceIds),
  );
  // Grounding-time check: is there at least moderate-or-better evidence
  // behind this candidate? This decides whether the AI's claimed
  // confidence/scope survive or get downgraded — it intentionally uses the
  // *same* shared classification the commit-time gate uses, so a candidate
  // that looks "fine" here won't be silently re-judged differently later.
  const grounded = hasGroundingEvidence(evidence, evidenceById);

  return {
    ...candidate,
    evidence,
    confidence: grounded ? candidate.confidence : downgradeConfidence(candidate.confidence),
    scope: grounded ? candidate.scope : "oneOff",
    status: grounded && candidate.confidence !== "low" ? candidate.status : "needs_review",
    selectedByStaff: false,
  };
}

function collectUnsupportedEvidenceWarnings(
  report: PostMatchReport,
  validEvidenceIds: Set<string>,
) {
  const warnings = new Set<string>();
  const check = (evidence: string[], context: string) => {
    for (const item of evidence) {
      if (!extractEvidenceIds(item).length) continue;
      if (!referencesValidEvidence(item, validEvidenceIds)) {
        warnings.add(`${context}: evidencia no encontrada (${item})`);
      }
    }
  };

  for (const item of report.ownProblems) check(item.evidence, item.problem);
  for (const item of report.ownTeamProblems) check(item.evidence, item.problem);
  for (const item of report.tacticalInferences) {
    check(item.basedOn, item.inference);
  }
  for (const item of report.memoryCandidates) {
    check(item.evidence, item.statement);
  }
  check(report.grounding.evidenceUsed, "grounding");

  return Array.from(warnings);
}

function downgradeConfidence(value: "low" | "medium" | "high") {
  if (value === "high") return "medium";
  return "low";
}

function downgradeSeverity(value: "low" | "medium" | "high") {
  if (value === "high") return "medium";
  return "low";
}

function buildEvidenceLedger(input: PostMatchInput): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      id: "EV-RESULT",
      source: "result",
      text:
        input.matchContext.interpretedResult?.label ??
        `resultado cargado: ${input.matchContext.result}`,
    },
  ];

  if (input.planBeforeMatch?.trim()) {
    evidence.push({
      id: "EV-PLAN",
      source: "plan",
      text: input.planBeforeMatch.trim(),
    });
  }

  if (input.staffNotes?.trim()) {
    evidence.push({
      id: "EV-NOTES",
      source: "staffNotes",
      text: input.staffNotes.trim(),
    });
  }

  input.tags.forEach((tag, index) => {
    evidence.push({
      id: `EV-TAG-${index + 1}`,
      source: "tag",
      text: [
        tag.label,
        tag.zone,
        tag.note,
        `confiabilidad: ${tag.severity}`,
      ]
        .filter(Boolean)
        .join(" | "),
      severity: tag.severity,
      ...(typeof tag.minute === "number" ? { minute: tag.minute } : {}),
    });
  });

  return evidence;
}

function buildOwnTeamProblems(parsed: {
  ownTeamProblems?: unknown;
  ownProblems?: unknown;
  mainProblems?: unknown;
}) {
  const ownTeamProblems = objectArray(parsed.ownTeamProblems);
  if (ownTeamProblems.length) {
    return ownTeamProblems.map((problem) => ({
      problem: stringOrFallback(problem.problem, "Problema propio sin titulo"),
      evidence: coerceStringArray(problem.evidence),
      severity: severityOrMedium(problem.severity),
      probableCause: optionalString(problem.probableCause),
    }));
  }

  const ownProblems = objectArray(parsed.ownProblems);
  if (ownProblems.length) {
    return ownProblems.map((problem) => ({
      problem: stringOrFallback(problem.problem, "Problema propio sin titulo"),
      evidence: coerceStringArray(problem.evidence),
      severity: severityOrMedium(problem.severity),
      probableCause: optionalString(problem.probableCause),
    }));
  }

  const mainProblems = objectArray(parsed.mainProblems);
  if (!mainProblems.length) {
    return [];
  }

  return mainProblems.map((problem) => ({
    problem: stringOrFallback(problem.problem, "Problema propio sin titulo"),
    evidence: coerceStringArray(problem.examplesToReview),
    severity: severityOrMedium(problem.severity),
    probableCause: optionalString(problem.probableCause),
  }));
}

function buildConditioningContext(
  input: PostMatchInput,
  parsed: { conditioningContext?: unknown; observedRisks?: unknown },
) {
  const context = new Set<string>();

  for (const item of coerceStringArray(parsed.conditioningContext)) {
    context.add(item);
  }
  collectConditioningFromText(input.staffNotes, context);
  collectConditioningFromText(input.planBeforeMatch, context);
  for (const tag of input.tags) {
    collectConditioningFromText(tag.label, context);
    collectConditioningFromText(tag.note, context);
  }

  if (Array.isArray(parsed.observedRisks)) {
    for (const risk of parsed.observedRisks) {
      const item = risk as Record<string, unknown>;
      const text = stringOrFallback(item.risk, "");
      if (isConditioningText(text)) {
        context.add(text);
      }
    }
  }

  return Array.from(context);
}

function filterConditioningRisks(observedRisks: unknown) {
  if (!Array.isArray(observedRisks)) return [];
  return observedRisks.filter((risk) => {
    const item = risk as Record<string, unknown>;
    return !isConditioningText(stringOrFallback(item.risk, ""));
  });
}

function normalizeMemoryCandidate(
  candidate: Record<string, unknown>,
  index: number,
) {
  const statement =
    "statement" in candidate ? stringOrFallback(candidate.statement, "") : "";
  const evidence =
    "evidence" in candidate ? coerceStringArray(candidate.evidence) : [];
  const textForCategory = `${statement} ${evidence.join(" ")}`;
  const category = isSideAsymmetryText(textForCategory)
    ? "sideAsymmetry"
    : validMemoryCategory(optionalString(candidate.category));

  return {
    ...candidate,
    id: stringOrFallback(candidate.id, `mc_${index + 1}`),
    statement,
    category,
    evidence,
    confidence: confidenceOrMedium(candidate.confidence),
    scope: validMemoryScope(candidate.scope),
    status: validMemoryCandidateStatus(candidate.status),
    selectedByStaff: false,
  };
}

function collectConditioningFromText(
  text: string | undefined,
  context: Set<string>,
) {
  if (!text || !isConditioningText(text)) return;

  if (/\b10\b|diez|expul/i.test(text)) {
    context.add("El partido tuvo condicionante de inferioridad o expulsion.");
  }
  if (/lesion|molestia|tocado/i.test(text)) {
    context.add("Hubo condicionante de lesion o disponibilidad fisica.");
  }
  if (/clima|lluvia|viento|cancha|campo|cesped|barro/i.test(text)) {
    context.add("El clima o la cancha condicionaron el partido.");
  }
  if (/liquidado|resuelto|partido roto/i.test(text)) {
    context.add("El resultado o el contexto dejo el partido liquidado/roto.");
  }
  if (/superioridad|inferioridad/i.test(text)) {
    context.add("Hubo superioridad o inferioridad numerica relevante.");
  }
}

function isConditioningText(text: string) {
  return /\b10\b|diez|expul|lesion|molestia|tocado|clima|lluvia|viento|cancha|campo|cesped|barro|liquidado|resuelto|partido roto|superioridad|inferioridad/i.test(
    text,
  );
}

function isSideAsymmetryText(text: string) {
  return /asimetr|izquierda|derecha|banda|carril|lado fuerte|lado debil/i.test(
    text,
  );
}

function validMemoryCategory(category: string | undefined) {
  if (
    category === "teamPattern" ||
    category === "playerPattern" ||
    category === "opponentPattern" ||
    category === "staffPrinciple" ||
    category === "sideAsymmetry"
  ) {
    return category;
  }

  return "teamPattern";
}

function validMemoryScope(value: unknown) {
  if (value === "oneOff" || value === "repeatWatch" || value === "validated") {
    return value;
  }

  return "repeatWatch";
}

function validMemoryCandidateStatus(value: unknown) {
  if (
    value === "candidate" ||
    value === "needs_review" ||
    value === "accepted" ||
    value === "rejected"
  ) {
    return value;
  }

  return "candidate";
}

function normalizeGrounding(rawGrounding: unknown, input: PostMatchInput) {
  const grounding = objectRecord(rawGrounding);

  return {
    resultPerspective:
      input.matchContext.interpretedResult?.label ??
      stringOrFallback(
        grounding.resultPerspective,
        "resultado no interpretable",
      ),
    evidenceUsed: coerceStringArray(grounding.evidenceUsed),
    unsupportedClaims: coerceStringArray(grounding.unsupportedClaims),
    subjectAttributionWarnings: coerceStringArray(
      grounding.subjectAttributionWarnings,
    ),
  };
}

function normalizeReflection(rawReflection: unknown) {
  const reflection = objectRecord(rawReflection);

  return {
    mainUncertainty: stringOrFallback(
      reflection.mainUncertainty,
      "No se declaro incertidumbre principal.",
    ),
    alternativeInterpretation: stringOrFallback(
      reflection.alternativeInterpretation,
      "No se declaro interpretacion alternativa.",
    ),
    confidence: normalizeNumber(reflection.confidence, 0.55),
  };
}

function normalizeFlank(value: unknown) {
  const normalized = normalizeToken(value);

  if (
    ["left", "izquierda", "izquierdo", "lado izquierdo"].includes(normalized)
  ) {
    return "left";
  }
  if (["right", "derecha", "derecho", "lado derecho"].includes(normalized)) {
    return "right";
  }
  if (["central", "centro", "centre", "center"].includes(normalized)) {
    return "central";
  }
  if (["both", "ambos", "ambas", "dos bandas"].includes(normalized)) {
    return "both";
  }

  return "both";
}

function normalizeSubject(value: unknown) {
  const normalized = normalizeToken(value);

  if (
    ["own", "propio", "equipo propio", "nosotros", "rojo fc"].includes(
      normalized,
    )
  ) {
    return "own";
  }
  if (["rival", "opponent", "contrario", "ellos"].includes(normalized)) {
    return "rival";
  }
  if (["both", "ambos", "ambas", "los dos"].includes(normalized)) {
    return "both";
  }

  return "unknown";
}

function confidenceOrMedium(value: unknown) {
  const normalized = normalizeToken(value);

  if (normalized === "low" || normalized === "baja" || normalized === "bajo") {
    return "low";
  }
  if (normalized === "high" || normalized === "alta" || normalized === "alto") {
    return "high";
  }

  return "medium";
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => coerceStringArray(item))
      .filter((item) => item.trim());
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  return [];
}

function objectArray(value: unknown) {
  if (!Array.isArray(value)) {
    const record = objectRecord(value);
    return Object.keys(record).length ? [record] : [];
  }

  return value.map(objectRecord).filter((item) => Object.keys(item).length > 0);
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp01(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").trim());
    if (Number.isFinite(parsed)) {
      return clamp01(parsed > 1 ? parsed / 100 : parsed);
    }
  }

  return fallback;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeToken(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase()
    : "";
}

function severityOrMedium(value: unknown) {
  const normalized = normalizeToken(value);

  if (normalized === "low" || normalized === "baja" || normalized === "bajo") {
    return "low";
  }
  if (normalized === "high" || normalized === "alta" || normalized === "alto") {
    return "high";
  }

  return "medium";
}

function withInterpretedResult(input: PostMatchInput): PostMatchInput {
  const interpretedResult = parseOwnPerspectiveResult(
    input.matchContext.result,
  );

  return {
    ...input,
    matchContext: {
      ...input.matchContext,
      ...(interpretedResult ? { interpretedResult } : {}),
    },
  };
}

export function parseOwnPerspectiveResult(result: string) {
  const normalized = result.trim();
  const match = normalized.match(/^(\d{1,2})\s*[-:x]\s*(\d{1,2})$/i);
  if (!match) return null;

  const ownGoals = Number(match[1]);
  const rivalGoals = Number(match[2]);
  const outcome =
    ownGoals > rivalGoals ? "win" : ownGoals < rivalGoals ? "loss" : "draw";
  const outcomeLabel =
    outcome === "win"
      ? "victoria propia"
      : outcome === "loss"
        ? "derrota propia"
        : "empate";

  return {
    ownGoals,
    rivalGoals,
    outcome,
    label: `${outcomeLabel} ${ownGoals} a ${rivalGoals}`,
  } as const;
}
