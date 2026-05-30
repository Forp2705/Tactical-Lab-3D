import dotenv from "dotenv"
import OpenAI from "openai"

import { COACH_AGENT_SYSTEM_PROMPT } from "./CoachAgentPrompt.js"
import {
  isJsonModeUnsupportedError,
  parseCoachAdvice,
  resolveModelLadder,
} from "./coachResponseParsing.js"
import { TEAM_CONTEXT } from "./TeamContext.js"
import { COACH_RULES } from "./CoachRules.js"
import { FOOTBALL_IDENTITY } from "./FootballIdentity.js"
import { MATCH_MEMORY } from "./MatchMemory.js"
import { retrieveRelevantContext } from "./retrieveRelevantContext.js"
import { retrieveRelevantKnowledge } from "./retrieveRelevantKnowledge.js"
import { TEAM_IDENTITY } from "./teamIdentity.js"
import { retrieveRelevantGeneratedMemory } from "./retrieveRelevantGeneratedMemory.js"
import { loadSavedPostMatchReports } from "./post-match/storage.js"
import { catalog } from "../data/exercises/catalog.js"
import { retrieveRelevantReports } from "./retrieveRelevantReports.js"
import { buildEvidenceCitation } from "./retrievalScoring.js"
import type { CoachMatchAdvice } from "./CoachSchemas.js"
import type { SavedPostMatchReport } from "./post-match/schemas.js"

dotenv.config({
  path: ".env.local",
})

const apiKey = process.env.OPENROUTER_API_KEY
const modelName =
  process.env.OPENROUTER_MODEL ??
  "deepseek/deepseek-chat-v3-0324:free"

function getClient() {
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY")
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })
}


export async function generateCoachResponse(
  userInput: string,
  coachContext?: unknown,
) {
  if (!userInput.trim()) {
    throw new Error("User input cannot be empty")
  }
  const relevantContext =
  await retrieveRelevantContext(userInput)

  const relevantGeneratedMemory =
  await retrieveRelevantGeneratedMemory(userInput)

  const relevantKnowledge =
  await retrieveRelevantKnowledge(userInput)

  const relevantReports =
  await retrieveRelevantReports(userInput)

  const recentReports =
  await loadSavedPostMatchReports()

  const recentReportContext =
  formatRecentReports(recentReports)

  const temporalContext =
  formatTemporalContext(userInput, recentReports)

  const runtimeCoachContext =
  formatRuntimeCoachContext(coachContext)

  const coachingStaffContext =
  formatCoachingStaffContext()

  const catalogIndex =
  formatCatalogIndex()

  const evidenceCatalog = [
    ...relevantGeneratedMemory,
    ...relevantContext,
    ...relevantKnowledge,
    ...relevantReports,
  ]

  const evidenceCatalogText =
  formatEvidenceCatalog(evidenceCatalog)

  const prompt = `
Respond ONLY with valid JSON using this exact structure:

{
  "tacticalReading": "string",
  "probableCause": "string",
  "mainAdjustment": "string",
  "onFieldInstructions": ["string", "string", "string"],
  "wednesdayTest": "string",
  "saturdayFocus": "string",
  "adjustmentRisks": ["string", "string"],
  "successSignals": ["string", "string"],
  "reflection": {
    "mainUncertainty": "string",
    "missingInformation": "string",
    "alternativeInterpretation": "string",
    "confidence": 0.0
  },
  "linkedExercises": ["exercise-id"],
  "evidenceCitations": [
    {
      "sourceType": "knowledge|memory|observation|report",
      "sourceId": "exact-source-id-from-evidence-catalog",
      "title": "string",
      "excerpt": "string",
      "relevance": 0.0
    }
  ],
  "actions": [
    {
      "type": "openExercise|addToSession|createExerciseVariant|applyLineup|applyShape|createExerciseFromShape",
      "label": "string",
      "exerciseId": "exercise-id optional",
      "lineupId": "lineup-id optional",
      "shapeId": "shape-id optional",
      "title": "string optional",
      "rationale": "string optional"
    }
  ]
}

Action rules:
- linkedExercises must use exact IDs from Catalog index. If no real match exists, return [].
- actions must be executable. Use openExercise/addToSession/createExerciseVariant only with exact exerciseId from Catalog index.
- Use applyLineup only when Runtime coaching context contains a saved lineup id that fits the request.
- Use applyShape only when Runtime coaching context contains a Lineup Lab shape id that fits the request.
- Use createExerciseFromShape when the user asks to turn a tactical shape into a field task and a matching Lineup Lab shape id exists.
- Do not invent exerciseId, lineupId or shapeId.
- Max 3 linkedExercises and max 4 actions.

Evidence citation rules:
- evidenceCitations must cite only sourceId values listed in Evidence catalog.
- Prefer current match/report evidence over generic principles.
- If no evidence supports a claim, state the uncertainty in reflection instead of fabricating a citation.
- Max 4 evidenceCitations.

Coaching staff context:
${coachingStaffContext}

Catalog index:
${catalogIndex}

Match memory:
${MATCH_MEMORY}

Relevant generated tactical memory:
${JSON.stringify(relevantGeneratedMemory, null, 2)}

Relevant tactical observations:
${JSON.stringify(relevantContext, null, 2)}

Relevant tactical knowledge:
${JSON.stringify(relevantKnowledge, null, 2)}

Relevant post-match reports:
${JSON.stringify(relevantReports, null, 2)}

Evidence catalog for traceability:
${evidenceCatalogText}

Temporal context:
${temporalContext}

Recent post-match reports:
${recentReportContext}

Runtime coaching context:
${runtimeCoachContext}

Coach rules:
${COACH_RULES}


User request:
${userInput}
`

  const client = getClient()
  const models = resolveModelLadder(
    modelName,
    process.env.OPENROUTER_FALLBACK_MODELS,
  )

  let lastError: unknown

  // Recorremos la escalera de modelos; por cada uno, hasta 2 intentos.
  // Importante: parseamos DENTRO del try, asi un JSON invalido tambien
  // dispara reintento/fallback en vez de cortar en seco.
  for (const model of models) {
    let useJsonMode = true
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await requestCoachCompletion({
          client,
          model,
          prompt,
          useJsonMode,
        })

        const rawText =
          completion.choices[0]?.message?.content ?? ""

        return attachEvidenceCitations(
          parseCoachAdvice(rawText),
          evidenceCatalog,
        )
      } catch (error) {
        lastError = error
        if (useJsonMode && isJsonModeUnsupportedError(error)) {
          useJsonMode = false
          console.log(
            `Coach JSON mode unsupported; retrying without response_format (model=${model})`,
          )
          try {
            const completion = await requestCoachCompletion({
              client,
              model,
              prompt,
              useJsonMode: false,
            })
            const rawText =
              completion.choices[0]?.message?.content ?? ""
            return attachEvidenceCitations(
              parseCoachAdvice(rawText),
              evidenceCatalog,
            )
          } catch (fallbackError) {
            lastError = fallbackError
          }
        }
        console.log(
          `Coach attempt failed (model=${model}, intento=${attempt}, jsonMode=${useJsonMode})`,
        )
        await new Promise((resolve) =>
          setTimeout(resolve, 1200 * attempt)
        )
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter did not return a valid response")
}

async function requestCoachCompletion({
  client,
  model,
  prompt,
  useJsonMode,
}: {
  client: OpenAI
  model: string
  prompt: string
  useJsonMode: boolean
}) {
  return client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: COACH_AGENT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.4,
    ...(useJsonMode
      ? { response_format: { type: "json_object" as const } }
      : {}),
  })
}

function formatCoachingStaffContext() {
  return `
CONTEXTO DEL CUERPO TECNICO

[Weekly context]
${TEAM_CONTEXT.trim()}

[Team identity]
${JSON.stringify(TEAM_IDENTITY, null, 2)}

[Football identity]
${FOOTBALL_IDENTITY.trim()}

[Coach rules]
${COACH_RULES.trim()}
`.trim()
}

function formatCatalogIndex() {
  return catalog
    .slice(0, 160)
    .map((exercise) =>
      [
        exercise.id,
        exercise.title,
        exercise.phase,
        exercise.principle,
        exercise.objective.primary,
      ].join(" | ")
    )
    .join("\n")
}

function formatRecentReports(reports: SavedPostMatchReport[]) {
  if (!reports.length) {
    return "No recent post-match reports saved."
  }

  return reports
    .slice(0, 3)
    .map((savedReport) => {
      const report = savedReport.report
      const date = report.matchContext.date ?? savedReport.savedAt.slice(0, 10)
      return [
        `- ${date} vs ${report.matchContext.opponent} (${report.matchContext.result})`,
        `summary=${report.executiveSummary}`,
        `focus=${report.saturdayFocus.slice(0, 2).join("; ")}`,
      ].join(" | ")
    })
    .join("\n")
}

function formatTemporalContext(
  userInput: string,
  reports: SavedPostMatchReport[],
) {
  const today = new Date().toISOString().slice(0, 10)
  const latestReport = [...reports].sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  )[0]

  return [
    `today=${today}`,
    latestReport
      ? `latestReport=${latestReport.report.matchContext.date ?? latestReport.savedAt.slice(0, 10)} vs ${latestReport.report.matchContext.opponent}`
      : "latestReport=none",
    `requestMentionsNextMatch=${/\b(proximo|siguiente|sabado|partido)\b/i.test(
      userInput,
    )}`,
  ].join("\n")
}

function formatRuntimeCoachContext(coachContext: unknown) {
  if (!coachContext) {
    return "No runtime UI context provided."
  }

  try {
    return JSON.stringify(coachContext, null, 2)
  } catch {
    return "Runtime UI context could not be serialized."
  }
}

type EvidenceCatalogItem = {
  id: string
  sourceType: "knowledge" | "memory" | "observation" | "report"
  title: string
  excerpt: string
  score: number
}

function formatEvidenceCatalog(evidenceCatalog: EvidenceCatalogItem[]) {
  if (!evidenceCatalog.length) {
    return "No ranked evidence retrieved."
  }

  return evidenceCatalog
    .slice(0, 12)
    .map((item) =>
      [
        `- sourceId=${item.id}`,
        `type=${item.sourceType}`,
        `score=${Math.min(1, Math.max(0, item.score)).toFixed(3)}`,
        `title=${item.title}`,
        `excerpt=${item.excerpt}`,
      ].join(" | ")
    )
    .join("\n")
}

function attachEvidenceCitations(
  advice: CoachMatchAdvice,
  evidenceCatalog: EvidenceCatalogItem[],
): CoachMatchAdvice {
  const byId = new Map(evidenceCatalog.map((item) => [item.id, item]))
  const validCitations = advice.evidenceCitations
    .map((citation) => byId.get(citation.sourceId))
    .filter((item): item is EvidenceCatalogItem => Boolean(item))

  // Deduplicamos por sourceId y limitamos a 4. No inventamos citas que el
  // modelo no eligio: si cito una fuente inexistente, simplemente se descarta.
  const deduped = [
    ...new Map(validCitations.map((item) => [item.id, item])).values(),
  ].slice(0, 4)

  return {
    ...advice,
    evidenceCitations: deduped.map(buildEvidenceCitation),
  }
}
