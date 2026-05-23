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
  const input = PostMatchInputSchema.parse(rawInput);
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
