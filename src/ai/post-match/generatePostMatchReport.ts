import dotenv from "dotenv";
import OpenAI from "openai";
import { COACH_AGENT_SYSTEM_PROMPT } from "../CoachAgentPrompt.js";
import { COACH_RULES } from "../CoachRules.js";
import { FOOTBALL_IDENTITY } from "../FootballIdentity.js";
import { MATCH_MEMORY } from "../MatchMemory.js";
import { TEAM_CONTEXT } from "../TeamContext.js";
import { retrieveRelevantContext } from "../retrieveRelevantContext.js";
import { retrieveRelevantGeneratedMemory } from "../retrieveRelevantGeneratedMemory.js";
import { retrieveRelevantKnowledge } from "../retrieveRelevantKnowledge.js";
import { TEAM_IDENTITY } from "../teamIdentity.js";
import {
  type PostMatchInput,
  PostMatchInputSchema,
  PostMatchReportSchema,
} from "./schemas.js";

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
  const relevantContext = retrieveRelevantContext(searchableInput);
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
  const reportId = `pmr_${Date.now()}`;
  const ownTeamProblems = buildOwnTeamProblems(parsed);
  const conditioningContext = buildConditioningContext(input, parsed);
  const report = {
    ...parsed,
    id: parsed.id ?? reportId,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    matchContext: input.matchContext,
    ownStrengths: Array.isArray(parsed.ownStrengths) ? parsed.ownStrengths : [],
    ownProblems: Array.isArray(parsed.ownProblems) ? parsed.ownProblems : [],
    ownTeamProblems,
    conditioningContext,
    rivalVulnerabilities: Array.isArray(parsed.rivalVulnerabilities)
      ? parsed.rivalVulnerabilities
      : [],
    observedRisks: filterConditioningRisks(parsed.observedRisks),
    tacticalTradeoffs: Array.isArray(parsed.tacticalTradeoffs)
      ? parsed.tacticalTradeoffs
      : [],
    flankAsymmetries: Array.isArray(parsed.flankAsymmetries)
      ? parsed.flankAsymmetries
      : [],
    tacticalInferences: Array.isArray(parsed.tacticalInferences)
      ? parsed.tacticalInferences
      : [],
    memoryInfluence: Array.isArray(parsed.memoryInfluence)
      ? parsed.memoryInfluence
      : [],
    grounding: {
      resultPerspective:
        input.matchContext.interpretedResult?.label ??
        "resultado no interpretable",
      evidenceUsed: Array.isArray(parsed.grounding?.evidenceUsed)
        ? parsed.grounding.evidenceUsed
        : [],
      unsupportedClaims: Array.isArray(parsed.grounding?.unsupportedClaims)
        ? parsed.grounding.unsupportedClaims
        : [],
      subjectAttributionWarnings: Array.isArray(
        parsed.grounding?.subjectAttributionWarnings,
      )
        ? parsed.grounding.subjectAttributionWarnings
        : [],
    },
    memoryCandidates: Array.isArray(parsed.memoryCandidates)
      ? parsed.memoryCandidates.map(
          (candidate: { id?: string; category?: string }, index: number) =>
            normalizeMemoryCandidate(candidate, index),
        )
      : [],
  };

  return PostMatchReportSchema.parse(report);
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

Team context:
${TEAM_CONTEXT}

Current team identity:
${JSON.stringify(TEAM_IDENTITY, null, 2)}

Football identity:
${FOOTBALL_IDENTITY}

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
};

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
      text: [tag.label, tag.zone, tag.note].filter(Boolean).join(" | "),
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
  if (Array.isArray(parsed.ownTeamProblems) && parsed.ownTeamProblems.length) {
    return parsed.ownTeamProblems;
  }

  if (Array.isArray(parsed.ownProblems) && parsed.ownProblems.length) {
    return parsed.ownProblems;
  }

  if (!Array.isArray(parsed.mainProblems)) {
    return [];
  }

  return parsed.mainProblems.map((problem) => {
    const item = problem as Record<string, unknown>;
    return {
      problem: stringOrFallback(item.problem, "Problema propio sin titulo"),
      evidence: stringArray(item.examplesToReview),
      severity: severityOrMedium(item.severity),
      probableCause: stringOrFallback(item.probableCause, ""),
    };
  });
}

function buildConditioningContext(
  input: PostMatchInput,
  parsed: { conditioningContext?: unknown; observedRisks?: unknown },
) {
  const context = new Set<string>();

  for (const item of stringArray(parsed.conditioningContext)) {
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
  candidate: { id?: string; category?: string },
  index: number,
) {
  const statement =
    "statement" in candidate ? stringOrFallback(candidate.statement, "") : "";
  const evidence =
    "evidence" in candidate ? stringArray(candidate.evidence) : [];
  const textForCategory = `${statement} ${evidence.join(" ")}`;
  const category = isSideAsymmetryText(textForCategory)
    ? "sideAsymmetry"
    : validMemoryCategory(candidate.category);

  return {
    ...candidate,
    id: candidate.id ?? `mc_${index + 1}`,
    category,
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

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function severityOrMedium(value: unknown) {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
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
