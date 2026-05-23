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
  PostMatchInputSchema,
  PostMatchReportSchema,
  type PostMatchInput,
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
          relevantContext,
          relevantGeneratedMemory,
          relevantKnowledge,
        }),
      },
    ],
    temperature: 0.35,
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanText);
  const reportId = `pmr_${Date.now()}`;
  const report = {
    ...parsed,
    id: parsed.id ?? reportId,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    matchContext: input.matchContext,
    ownStrengths: Array.isArray(parsed.ownStrengths)
      ? parsed.ownStrengths
      : [],
    ownProblems: Array.isArray(parsed.ownProblems) ? parsed.ownProblems : [],
    rivalVulnerabilities: Array.isArray(parsed.rivalVulnerabilities)
      ? parsed.rivalVulnerabilities
      : [],
    observedRisks: Array.isArray(parsed.observedRisks)
      ? parsed.observedRisks
      : [],
    tacticalInferences: Array.isArray(parsed.tacticalInferences)
      ? parsed.tacticalInferences
      : [],
    memoryInfluence: Array.isArray(parsed.memoryInfluence)
      ? parsed.memoryInfluence
      : [],
    memoryCandidates: Array.isArray(parsed.memoryCandidates)
      ? parsed.memoryCandidates.map((candidate: { id?: string }, index: number) => ({
          ...candidate,
          id: candidate.id ?? `mc_${index + 1}`,
          selectedByStaff: false,
        }))
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
  relevantContext,
  relevantGeneratedMemory,
  relevantKnowledge,
}: {
  input: PostMatchInput;
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
- No conviertas vulnerabilidades del rival en problemas propios.
- Si las notas dicen que el rival defendio con linea alta o defensores lentos, eso es vulnerabilidad del rival, no problema propio.
- No atribuyas memoria previa al partido actual salvo que haya evidencia actual explicita.
- Diferencia evidencia actual, inferencia tactica y memoria previa.
- Si usas memoria previa, ponela en memoryInfluence y aclara si es contextOnly o supportedByCurrentEvidence.
- No digas que el bloque propio se hundio, que los delanteros propios retrocedieron o que hubo un problema recurrente si eso no esta en notas/tags del partido actual.

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
      "owner": "own|rival|both|unclear"
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
      "category": "teamPattern|playerPattern|opponentPattern|staffPrinciple",
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

Post-match input:
${JSON.stringify(input, null, 2)}
`;
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
