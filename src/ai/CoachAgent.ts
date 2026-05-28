import dotenv from "dotenv"
import OpenAI from "openai"

import { CoachMatchAdviceSchema } from "./CoachSchemas.js"
import { COACH_AGENT_SYSTEM_PROMPT } from "./CoachAgentPrompt.js"
import { TEAM_CONTEXT } from "./TeamContext.js"
import { COACH_RULES } from "./CoachRules.js"
import { FOOTBALL_IDENTITY } from "./FootballIdentity.js"
import { MATCH_MEMORY } from "./MatchMemory.js"
import { retrieveRelevantContext } from "./retrieveRelevantContext.js"
import { retrieveRelevantKnowledge } from "./retrieveRelevantKnowledge.js"
import { TEAM_IDENTITY } from "./teamIdentity.js"
import { retrieveRelevantGeneratedMemory } from "./retrieveRelevantGeneratedMemory.js"
import { loadSavedPostMatchReports } from "./post-match/storage.js"

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
  }
}

Coaching staff context:
${coachingStaffContext}

Match memory:
${MATCH_MEMORY}

Relevant generated tactical memory:
${JSON.stringify(relevantGeneratedMemory, null, 2)}

Relevant tactical observations:
${JSON.stringify(relevantContext, null, 2)}

Relevant tactical knowledge:
${JSON.stringify(relevantKnowledge, null, 2)}

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

  let completion
  const client = getClient()

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      completion = await client.chat.completions.create({
        model: modelName,
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
      })

      break
    } catch (error) {
      console.log(`Attempt ${attempt} failed`)

      if (attempt === 3) {
        throw error
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000 * attempt)
      )
    }
  }

  if (!completion) {
    throw new Error("OpenRouter did not return a response")
  }

  const rawText =
    completion.choices[0]?.message?.content ?? ""

  const cleanText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()

  const parsedJson = JSON.parse(cleanText)

  const validatedResponse =
    CoachMatchAdviceSchema.parse(parsedJson)

  return validatedResponse
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

function formatRuntimeCoachContext(context: unknown) {
  if (!context || typeof context !== "object") {
    return "No runtime context available."
  }

  const record = context as {
    teamModel?: string
    availableSquad?: Array<{
      name: string
      num: number
      positions: string[]
      profile: string
      attributes?: Record<string, number>
    }>
    unavailableSquad?: Array<{
      name: string
      num: number
      positions: string[]
      status?: string
      profile: string
    }>
    shapeContext?: unknown
  }

  const available = (record.availableSquad ?? [])
    .slice(0, 18)
    .map((player) => {
      const attributes =
        player.attributes
          ? `vel ${player.attributes.speed ?? "-"} / pase ${player.attributes.pass ?? "-"} / tact ${player.attributes.tactical ?? "-"} / duelo ${player.attributes.duel ?? "-"}`
          : ""

      return `- #${player.num} ${player.name} (${player.positions.join(" / ")}) — ${player.profile}${attributes ? ` [${attributes}]` : ""}`
    })
    .join("\n")

  const unavailable = (record.unavailableSquad ?? [])
    .slice(0, 12)
    .map((player) =>
      `- #${player.num} ${player.name} (${player.positions.join(" / ")}) — ${player.status ?? "no disponible"}${player.profile ? ` — ${player.profile}` : ""}`
    )
    .join("\n")

  return `
Modelo actual del equipo:
${record.teamModel ?? "No definido."}

PLANTEL DISPONIBLE para esta consulta:
${available || "- Sin datos de disponibilidad."}

NO DISPONIBLES / EN DUDA:
${unavailable || "- Sin bajas cargadas."}

Lineup Lab 3D context (use it only if it is relevant to the user request):
${record.shapeContext ? JSON.stringify(record.shapeContext, null, 2) : "No shape context available."}
`.trim()
}

function formatRecentReports(
  reports: Awaited<ReturnType<typeof loadSavedPostMatchReports>>
) {
  const recent = reports
    .sort((a, b) =>
      (b.report.matchContext.date ?? b.savedAt)
        .localeCompare(a.report.matchContext.date ?? a.savedAt)
    )
    .slice(0, 3)

  if (!recent.length) {
    return "No recent post-match reports available."
  }

  return recent
    .map((savedReport) => {
      const report = savedReport.report
      const date = report.matchContext.date ?? savedReport.savedAt.slice(0, 10)
      const mainProblem =
        report.ownTeamProblems[0]?.problem ??
        report.mainProblems[0]?.problem ??
        report.executiveSummary
      const saturdayFocus =
        report.saturdayFocus[0]

      return `- ${date} vs ${report.matchContext.opponent} (${report.matchContext.result}): ${mainProblem}${saturdayFocus ? ` | foco: ${saturdayFocus}` : ""}`
    })
    .join("\n")
}

function formatTemporalContext(
  userInput: string,
  reports: Awaited<ReturnType<typeof loadSavedPostMatchReports>>
) {
  const today = new Date()
  const todayLabel = formatDate(today)
  const nextSaturday = getNextWeekday(today, 6)
  const nextMatchDate = formatDate(nextSaturday)
  const knownOpponent =
    resolveKnownOpponentFromQuery(userInput, reports)

  const knownOpponentReport = knownOpponent
    ? reports.find((savedReport) =>
        normalizeText(savedReport.report.matchContext.opponent) ===
        normalizeText(knownOpponent)
      )
    : undefined

  return [
    `Hoy es ${todayLabel}.`,
    `El próximo partido oficial cae el sábado ${nextMatchDate}${knownOpponent ? ` vs ${knownOpponent}` : ""}.`,
    knownOpponentReport
      ? `Existe antecedente cargado contra ${knownOpponent}: ${knownOpponentReport.report.matchContext.result} (${knownOpponentReport.report.matchContext.date ?? "sin fecha"}).`
      : knownOpponent
        ? `No hay reporte previo cargado contra ${knownOpponent}.`
        : "El sistema no tiene un próximo rival explícito cargado; solo conoce el calendario semanal miércoles/sábado.",
  ].join("\n")
}

function resolveKnownOpponentFromQuery(
  userInput: string,
  reports: Awaited<ReturnType<typeof loadSavedPostMatchReports>>
) {
  const normalizedInput =
    normalizeText(userInput)

  return reports
    .map((savedReport) => savedReport.report.matchContext.opponent)
    .find((opponent) =>
      normalizedInput.includes(normalizeText(opponent))
    )
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Buenos_Aires",
  }).format(date)
}

function getNextWeekday(baseDate: Date, weekday: number) {
  const next = new Date(baseDate)
  const diff = (weekday - next.getDay() + 7) % 7 || 7
  next.setDate(next.getDate() + diff)
  return next
}
