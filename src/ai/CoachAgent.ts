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
import {
  inferDomainsFromText,
  matchExercisesForDiagnosis,
} from "./exerciseMatching.js"
import {
  detectTeamPatterns,
  formatPatternsForCoach,
} from "./patternDetection.js"
import { retrieveRelevantReports } from "./retrieveRelevantReports.js"
import { buildEvidenceCitation } from "./retrievalScoring.js"
import { generateContextualQuestions } from "./contextualQuestionGenerator.js"
import {
  buildEvidenceAudit,
  capConfidence,
  normalizeCollectedEvidence,
} from "./evidenceCollection.js"
import type {
  CoachInterviewState,
  CoachMatchAdvice,
  CoachResponse,
  CollectedAnswer,
  EvidenceAudit,
  ImpliedClaim,
  TacticalIntent,
} from "./CoachSchemas.js"
import type { SavedPostMatchReport } from "./post-match/schemas.js"

export type RetrievedEvidence = {
  id: string
  sourceType: "knowledge" | "memory" | "observation" | "report"
  title: string
  excerpt: string
  score: number
}

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
  prefetched?: Awaited<ReturnType<typeof retrieveCoachEvidence>>,
) {
  if (!userInput.trim()) {
    throw new Error("User input cannot be empty")
  }
  const evidence = prefetched ?? await retrieveCoachEvidence(userInput)
  const {
    relevantContext,
    relevantGeneratedMemory,
    relevantKnowledge,
    relevantReports,
    recentReports,
    evidenceCatalog,
  } = evidence

  const recentReportContext =
  formatRecentReports(recentReports)
  const teamPatternsContext =
  formatPatternsForCoach(detectTeamPatterns(recentReports, { limit: 5 }))

  const temporalContext =
  formatTemporalContext(userInput, recentReports)

  const runtimeCoachContext =
  formatRuntimeCoachContext(coachContext)

  const coachingStaffContext =
  formatCoachingStaffContext()

  const catalogIndex =
  formatCatalogIndex()

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

Validated staff memory (historical context, not current evidence):
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

Cross-report team patterns:
${teamPatternsContext}

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

        return enrichAdviceWithExerciseMatches(
          attachEvidenceCitations(
            parseCoachAdvice(rawText),
            evidenceCatalog,
          ),
          userInput,
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
            return enrichAdviceWithExerciseMatches(
              attachEvidenceCitations(
                parseCoachAdvice(rawText),
                evidenceCatalog,
              ),
              userInput,
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

export async function runCoachTurn({
  input,
  coachContext,
  collectedEvidence = [],
  interviewState = null,
  skipInterview = false,
}: {
  input: string
  coachContext?: unknown
  collectedEvidence?: CollectedAnswer[]
  interviewState?: CoachInterviewState | null
  skipInterview?: boolean
}): Promise<CoachResponse> {
  const prefetched = await retrieveCoachEvidence(input)
  const intent = interviewState?.intent ?? fallbackIntent(input)
  const temptingClaims = interviewState?.temptingClaims.length
    ? interviewState.temptingClaims
    : fallbackClaims(intent)
  const collectedSignals = normalizeCollectedEvidence(collectedEvidence)
  const evidenceAudit = buildEvidenceAudit({
    claims: temptingClaims,
    signals: collectedSignals,
    retrieved: prefetched.evidenceCatalog,
    intent,
  })
  const enrichedCoachContext = withInterviewEvidence(
    coachContext,
    collectedEvidence,
    evidenceAudit,
  )

  if (
    interviewState &&
    (evidenceAudit.evidenceStrength === "sufficient" || collectedEvidence.length)
  ) {
    const advice = await generateCoachResponse(input, enrichedCoachContext, prefetched)
    const cappedAdvice = withCappedAdvice(
      advice,
      evidenceAudit,
      skipInterview || evidenceAudit.evidenceStrength !== "sufficient",
    )

    return evidenceAudit.evidenceStrength === "sufficient" && !skipInterview
      ? {
          mode: "diagnosis",
          advice: cappedAdvice,
          intent,
          evidenceAudit,
        }
      : {
          mode: "hypothesis",
          advice: cappedAdvice,
          confidenceCap: capConfidence(
            advice.reflection.confidence,
            evidenceAudit,
            true,
          ),
          intent,
          evidenceAudit,
          followUpQuestions: [],
        }
  }

  if (skipInterview) {
    const advice = await generateCoachResponse(input, enrichedCoachContext, prefetched)
    return {
      mode: "hypothesis",
      advice: withCappedAdvice(advice, evidenceAudit, true),
      confidenceCap: capConfidence(advice.reflection.confidence, evidenceAudit, true),
      intent,
      evidenceAudit,
      followUpQuestions: [],
    }
  }

  let questionResult: Awaited<ReturnType<typeof generateContextualQuestions>>
  try {
    const client = getClient()
    questionResult = await generateContextualQuestions(
      {
        userInput: input,
        evidenceCatalog: prefetched.evidenceCatalog,
        collectedEvidence,
        priorIntent: interviewState?.intent ?? null,
        priorClaims: interviewState?.temptingClaims ?? [],
      },
      async ({ systemPrompt, userPrompt }) => {
        const completion = await requestQuestionCompletion({
          client,
          model: modelName,
          systemPrompt,
          userPrompt,
        })
        return completion.choices[0]?.message?.content ?? ""
      },
    )
  } catch (error) {
    questionResult = await generateContextualQuestions(
      {
        userInput: input,
        evidenceCatalog: prefetched.evidenceCatalog,
        collectedEvidence,
        priorIntent: interviewState?.intent ?? null,
        priorClaims: interviewState?.temptingClaims ?? [],
      },
      async () => {
        throw error
      },
    )
  }

  return {
    mode: "question",
    intent: questionResult.intent,
    selectedQuestions: questionResult.selectedQuestions,
    blockedClaims: questionResult.temptingClaims,
    evidenceAudit: questionResult.evidenceAudit,
    confidenceCap: questionResult.confidenceCap,
  }
}

export async function retrieveCoachEvidence(userInput: string) {
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

  const evidenceCatalog = [
    ...relevantGeneratedMemory,
    ...relevantContext,
    ...relevantKnowledge,
    ...relevantReports,
  ].map(toRetrievedEvidence)

  return {
    relevantContext,
    relevantGeneratedMemory,
    relevantKnowledge,
    relevantReports,
    recentReports,
    evidenceCatalog,
  }
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

async function requestQuestionCompletion({
  client,
  model,
  systemPrompt,
  userPrompt,
}: {
  client: OpenAI
  model: string
  systemPrompt: string
  userPrompt: string
}) {
  return client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" as const },
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

  if (typeof coachContext !== "object" || Array.isArray(coachContext)) {
    return "Runtime UI context could not be read as structured data."
  }

  const context = coachContext as Record<string, unknown>
  const lines = [
    formatTeamRuntimeContext(context),
    formatShapeRuntimeContext(context.shapeContext),
    formatLineupLabRuntimeContext(context),
    formatInterviewRuntimeContext(context),
  ].filter(Boolean)

  return lines.length
    ? lines.join("\n\n")
    : "Runtime UI context provided without relevant tactical fields."
}

function formatTeamRuntimeContext(context: Record<string, unknown>) {
  const teamModel = stringValue(context.teamModel)
  const available = arrayValue(context.availableSquad)
  const unavailable = arrayValue(context.unavailableSquad)

  return [
    "TEAM CONTEXT",
    teamModel ? `- Modelo: ${teamModel}` : "",
    available.length
      ? `- Disponibles: ${available
          .slice(0, 14)
          .map(formatSquadPlayer)
          .filter(Boolean)
          .join("; ")}`
      : "",
    unavailable.length
      ? `- No disponibles: ${unavailable
          .slice(0, 8)
          .map(formatSquadPlayer)
          .filter(Boolean)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function formatShapeRuntimeContext(shapeContext: unknown) {
  if (!shapeContext || typeof shapeContext !== "object" || Array.isArray(shapeContext)) {
    return ""
  }
  const shape = shapeContext as Record<string, unknown>
  const metrics = metricObject(shape.currentMetrics)
  const shapeSummaries = arrayValue(shape.shapes)
    .slice(0, 4)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return ""
      const entry = item as Record<string, unknown>
      return [
        `- ${stringValue(entry.name) ?? "shape"} (${stringValue(entry.phase) ?? "fase"})`,
        stringValue(entry.summary) ? `: ${stringValue(entry.summary)}` : "",
        (() => {
          const metrics = metricObject(entry.metrics)
          return metrics ? ` | metricas ${formatMetrics(metrics)}` : ""
        })(),
      ].join("")
    })
    .filter(Boolean)

  return [
    "LINEUP LAB OBJECTIVE EVIDENCE",
    `- Formacion actual: ${stringValue(shape.formation) ?? "sin dato"}`,
    stringValue(shape.selectedShapeName)
      ? `- Shape activo: ${stringValue(shape.selectedShapeName)}`
      : "",
    stringValue(shape.currentBoardSummary)
      ? `- Resumen tablero: ${stringValue(shape.currentBoardSummary)}`
      : "",
    metrics ? `- Metricas shape actual: ${formatMetrics(metrics)}` : "",
    shapeSummaries.length ? `- Shapes guardados:\n${shapeSummaries.join("\n")}` : "",
    "- Uso táctico: estas métricas son evidencia geométrica objetiva del tablero, pero no prueban por sí solas una causa. No subir confianza solo por geometría sin evidencia actual.",
  ]
    .filter(Boolean)
    .join("\n")
}

function formatLineupLabRuntimeContext(context: Record<string, unknown>) {
  const transitions = arrayValue(context.lineupLabTransitions)
  if (!transitions.length) return ""

  return [
    "LINEUP LAB TRANSITIONS",
    ...transitions.slice(0, 4).map((transition) => {
      if (!transition || typeof transition !== "object" || Array.isArray(transition)) {
        return ""
      }
      const item = transition as Record<string, unknown>
      return `- ${stringValue(item.name) ?? "transicion"}: ${
        stringValue(item.fromShapeName) ?? "shape A"
      } -> ${stringValue(item.toShapeName) ?? "shape B"}${
        stringValue(item.notes) ? ` (${stringValue(item.notes)})` : ""
      }`
    }),
  ]
    .filter(Boolean)
    .join("\n")
}

function formatInterviewRuntimeContext(context: Record<string, unknown>) {
  const interviewEvidence = arrayValue(context.interviewEvidence)
  if (!interviewEvidence.length) return ""

  return [
    "INTERVIEW EVIDENCE FROM CURRENT USER",
    ...interviewEvidence.slice(0, 6).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return ""
      const answer = item as Record<string, unknown>
      return `- ${stringValue(answer.category) ?? "evidencia"} / ${
        stringValue(answer.target) ?? "target"
      }: ${stringValue(answer.answer) ?? ""}`
    }),
  ]
    .filter(Boolean)
    .join("\n")
}

function formatSquadPlayer(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return ""
  const player = item as Record<string, unknown>
  const positions = arrayValue(player.positions).join("/")
  return `#${numberValue(player.num) ?? "?"} ${stringValue(player.name) ?? "Jugador"}${
    positions ? ` (${positions})` : ""
  }${stringValue(player.profile) ? ` - ${stringValue(player.profile)}` : ""}`
}

function formatMetrics(metrics: Record<string, unknown>) {
  const lineDistances = metricObject(metrics.lineDistances)
  return [
    `ancho ${formatMeters(metrics.width)}`,
    `profundidad ${formatMeters(metrics.depth)}`,
    `compacidad ${formatMeters(metrics.compactness)}`,
    `altura bloque ${formatMeters(metrics.blockHeight)}`,
    lineDistances?.defenseToMidfield !== undefined
      ? `def-med ${formatMeters(lineDistances.defenseToMidfield)}`
      : "",
    lineDistances?.midfieldToAttack !== undefined
      ? `med-ata ${formatMeters(lineDistances.midfieldToAttack)}`
      : "",
    numberValue(metrics.duels) !== undefined ? `duelos cercanos ${numberValue(metrics.duels)}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}

function formatMeters(value: unknown) {
  const number = numberValue(value)
  return number === undefined ? "s/d" : `${number.toFixed(1)}m`
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function metricObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

type EvidenceCatalogItem = RetrievedEvidence

function toRetrievedEvidence(item: EvidenceCatalogItem): RetrievedEvidence {
  return {
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    excerpt: item.excerpt,
    score: item.score,
  }
}

function fallbackIntent(userInput: string): TacticalIntent {
  return {
    domains: [inferFallbackDomain(userInput)],
    specificity: userInput.trim().split(/\s+/).length >= 8
      ? "specific"
      : "general",
    requestType: /plan|accion|hacer|correg/i.test(userInput)
      ? "actionPlan"
      : "diagnosis",
    impliedClaims: [],
  }
}

function fallbackClaims(intent: TacticalIntent): ImpliedClaim[] {
  const domain = intent.domains[0] ?? "defense"

  return [
    {
      id: `claim_${domain}_cause`,
      claim: "La causa principal del problema todavia no esta confirmada.",
      domain,
      subject: "unknown" as const,
      riskIfWrong: "high" as const,
      requiredEvidence: ["cause", "zone", "ownTeam"],
    },
  ]
}

function inferFallbackDomain(userInput: string): TacticalIntent["domains"][number] {
  const normalized = userInput.toLowerCase()
  if (/salida|salir|constru/i.test(normalized)) return "buildUp"
  if (/transicion|perd/i.test(normalized)) return "defensiveTransition"
  if (/presion|presionar|saltar/i.test(normalized)) return "pressing"
  if (/bloque|largo|corto|hund/i.test(normalized)) return "block"
  if (/abp|pelota parada|corner|tiro libre/i.test(normalized)) return "setPieces"
  if (/atac|gener|9|delanter/i.test(normalized)) return "attack"
  return "defense"
}

function fallbackEvidenceAudit(
  retrievedCount: number,
  collectedCount: number,
): EvidenceAudit {
  const covered = collectedCount ? ["cause" as const] : []
  const evidenceStrength =
    collectedCount >= 2 || retrievedCount >= 2
      ? "sufficient"
      : collectedCount || retrievedCount
        ? "partial"
        : "none"

  return {
    covered,
    missing: evidenceStrength === "sufficient"
      ? []
      : [{ target: "cause", reason: "Falta evidencia concreta del caso." }],
    criticalMissingCount: evidenceStrength === "sufficient" ? 0 : 1,
    evidenceStrength,
  }
}

function withCappedAdvice(
  advice: CoachMatchAdvice,
  audit: EvidenceAudit,
  skipped: boolean,
): CoachMatchAdvice {
  return {
    ...advice,
    reflection: {
      ...advice.reflection,
      confidence: capConfidence(advice.reflection.confidence, audit, skipped),
    },
  }
}

function withInterviewEvidence(
  coachContext: unknown,
  collectedEvidence: CollectedAnswer[],
  audit: EvidenceAudit,
) {
  if (!collectedEvidence.length) return coachContext

  const interviewEvidence = collectedEvidence.map((answer) => ({
    target: answer.evidenceTarget,
    category: answer.category,
    answerKind: answer.answerKind,
    answer: answer.rawAnswer,
  }))

  if (
    coachContext &&
    typeof coachContext === "object" &&
    !Array.isArray(coachContext)
  ) {
    return {
      ...coachContext,
      interviewEvidence,
      interviewEvidenceAudit: audit,
    }
  }

  return {
    baseContext: coachContext ?? null,
    interviewEvidence,
    interviewEvidenceAudit: audit,
  }
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

function enrichAdviceWithExerciseMatches(
  advice: CoachMatchAdvice,
  userInput: string,
): CoachMatchAdvice {
  const domains = inferDomainsFromText(
    [
      userInput,
      advice.tacticalReading,
      advice.probableCause,
      advice.mainAdjustment,
      advice.wednesdayTest,
      advice.saturdayFocus,
    ].join(" "),
  )
  const matches = matchExercisesForDiagnosis({
    domains,
    query: [
      userInput,
      advice.tacticalReading,
      advice.probableCause,
      advice.mainAdjustment,
    ].join(" "),
    exercises: catalog,
    limit: 3,
  })
  const structuredExerciseIds = matches.map((match) => match.exercise.id)
  const linkedExercises = [
    ...structuredExerciseIds,
    ...advice.linkedExercises,
  ]
    .filter(
      (id, index, list) =>
        catalog.some((exercise) => exercise.id === id) &&
        list.indexOf(id) === index,
    )
    .slice(0, 3)
  const existingActionKeys = new Set(
    advice.actions.map((action) => `${action.type}:${action.exerciseId ?? ""}`),
  )
  const structuredActions = structuredExerciseIds.flatMap((exerciseId) => {
    const exercise = catalog.find((item) => item.id === exerciseId)
    if (!exercise) return []
    const action = {
      type: "addToSession" as const,
      label: `Agregar ${exercise.title} a la sesion`,
      exerciseId,
      rationale: "Sugerido por mapeo estructurado dominio tactico -> ejercicio.",
    }
    const key = `${action.type}:${exerciseId}`
    return existingActionKeys.has(key) ? [] : [action]
  })

  return {
    ...advice,
    linkedExercises,
    actions: [...structuredActions, ...advice.actions].slice(0, 4),
  }
}
