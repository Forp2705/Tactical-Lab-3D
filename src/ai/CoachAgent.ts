import dotenv from "dotenv"
import OpenAI from "openai"

import { COACH_AGENT_SYSTEM_PROMPT } from "./CoachAgentPrompt.js"
import {
  getCoachModeInstructions,
  inferCoachPromptMode,
  type CoachPromptMode,
} from "./CoachModePrompts.js"
import {
  isJsonModeUnsupportedError,
  parseCoachAdvice,
  resolveModelLadder,
} from "./coachResponseParsing.js"
import { TEAM_CONTEXT } from "./TeamContext.js"
import { COACH_RULES } from "./CoachRules.js"
import { FOOTBALL_IDENTITY } from "./FootballIdentity.js"
import {
  contrastTextWithGameModel,
  normalizeGameModel,
  summarizeGameModel,
} from "../data/gameModel.js"
import { summarizeOpponentScout } from "../scout/opponentScout.js"
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
import { retrieveRelevantReportsFromSaved } from "./retrieveRelevantReports.js"
import { buildEvidenceCitation } from "./retrievalScoring.js"
import { queryCoachRagIndex } from "./ragIndex.js"
import {
  assessCoachAdviceTrust,
  guardCoachAdvice,
} from "./coachOutputGuard.js"
import { recordCoachObservabilityEvent } from "./coachObservability.js"
import {
  buildCoachPipelineTrace,
  buildCoachRetrievalQuery,
} from "./CoachPipeline.js"
import { generateContextualQuestions } from "./contextualQuestionGenerator.js"
import { inferEvidenceTargets } from "./evidenceTargets.js"
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
  ContextualQuestion,
  EvidenceAudit,
  EvidenceTarget,
  ImpliedClaim,
  TacticalIntent,
} from "./CoachSchemas.js"
import type { SavedPostMatchReport } from "./post-match/schemas.js"
import { normalizeRuntimeVideoEvidenceText } from "../video/videoCoachEvidence.js"

export type RetrievedEvidence = {
  id: string
  sourceType: "knowledge" | "memory" | "observation" | "report" | "video"
  title: string
  excerpt: string
  score: number
  evidenceTargets?: EvidenceTarget[]
}

dotenv.config({
  path: ".env.local",
})

const apiKey = process.env.OPENROUTER_API_KEY
const modelName =
  process.env.OPENROUTER_MODEL ??
  "openai/gpt-4o-mini"
const COACH_COMPLETION_TIMEOUT_MS =
  Number(process.env.COACH_COMPLETION_TIMEOUT_MS) || 18000

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
  promptMode: CoachPromptMode = inferCoachPromptMode(userInput),
) {
  const startedAt = Date.now()
  if (!userInput.trim()) {
    throw new Error("User input cannot be empty")
  }
  const evidence = prefetched ?? await retrieveCoachEvidence(userInput, coachContext)
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
  const structuredGameModel =
  formatStructuredGameModel(coachContext)
  const opponentScoutContext =
  formatOpponentScoutContext(coachContext)
  const playerFitContext =
  formatPlayerFitRuntimeContext(coachContext, userInput)

  const catalogIndex =
  formatCatalogIndex()

  const evidenceCatalogText =
  formatEvidenceCatalog(evidenceCatalog)
  const modeInstructions = getCoachModeInstructions(promptMode)

  const prompt = `
Respond ONLY with valid JSON using this exact structure:

{
  "tacticalReading": "string",
  "problemBreakdown": {
    "zone": "string",
    "moment": "string",
    "trigger": "string",
    "ownVsRival": "string"
  },
  "probableCause": "string",
  "mainAdjustment": "string",
  "alternativeAdjustments": [
    {
      "adjustment": "string",
      "whenToUse": "string",
      "tradeoff": "string"
    }
  ],
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
  "modelContrast": {
    "aligned": ["string"],
    "contradictions": ["string"],
    "insufficientEvidence": ["string"]
  },
  "playerFitWarnings": ["string"],
  "evidenceCitations": [
    {
      "sourceType": "knowledge|memory|observation|report|video",
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
- Always include 2-3 alternativeAdjustments. They must be real tactical paths, not repetitions of mainAdjustment.
- problemBreakdown must separate: zone, moment, trigger, ownVsRival.

Evidence citation rules:
- evidenceCitations must cite only sourceId values listed in Evidence catalog.
- sourceType can be knowledge, memory, observation, report or video.
- Prefer VID-* or OBS-* evidence for current case claims when available.
- Prefer current match/report evidence over generic principles.
- If no evidence supports a claim, state the uncertainty in reflection instead of fabricating a citation.
- Max 4 evidenceCitations.

Response mode:
${modeInstructions}

Game model and fit rules:
- Explicitly contrast the diagnosis against Structured Game Model when evidence allows it.
- Use modelContrast.aligned for things that confirm the user's model.
- Use modelContrast.contradictions for tactical deviations from the user's model.
- Use modelContrast.insufficientEvidence when the request lacks evidence to judge the model.
- If Player fit context flags risk, include it in playerFitWarnings and adjustmentRisks.
- Do not raise confidence only because the model says something; current evidence still governs confidence.

Coaching staff context:
${coachingStaffContext}

Structured Game Model:
${structuredGameModel}

Opponent Scout:
${opponentScoutContext}

Player fit context:
${playerFitContext}

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
  let attemptCount = 0

  // Recorremos la escalera de modelos; por cada uno, hasta 2 intentos.
  // Importante: parseamos DENTRO del try, asi un JSON invalido tambien
  // dispara reintento/fallback en vez de cortar en seco.
  for (const model of models) {
    let useJsonMode = true
    for (let attempt = 1; attempt <= 2; attempt++) {
      attemptCount++
      try {
        const completion = await requestCoachCompletion({
          client,
          model,
          prompt,
          useJsonMode,
        })

        const rawText = extractCompletionText(completion)

        logCoachCompletionTelemetry({
          model,
          configuredModel: modelName,
          fallbackUsed: model !== models[0],
          jsonMode: useJsonMode,
          attempts: attemptCount,
          durationMs: Date.now() - startedAt,
        })

        return finalizeCoachAdvice(parseCoachAdvice(rawText), {
          evidenceCatalog,
          userInput,
          coachContext,
        })
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
            const rawText = extractCompletionText(completion)
            logCoachCompletionTelemetry({
              model,
              configuredModel: modelName,
              fallbackUsed: model !== models[0] || useJsonMode,
              jsonMode: false,
              attempts: attemptCount,
              durationMs: Date.now() - startedAt,
            })
            return finalizeCoachAdvice(parseCoachAdvice(rawText), {
              evidenceCatalog,
              userInput,
              coachContext,
            })
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

/**
 * Arma la query de retrieval combinando la pregunta original con las respuestas
 * de la entrevista. Asi el ranking de evidencia/knowledge reconoce el problema
 * REAL (p. ej. "se corta en el 5, recibe de espaldas") y no solo la frase vaga
 * inicial. La query enriquecida se usa SOLO para rankear; el prompt sigue
 * recibiendo el input original como pedido del usuario.
 */
function buildRetrievalQuery(
  input: string,
  collectedEvidence: CollectedAnswer[],
): string {
  if (!collectedEvidence.length) return input

  const answers = collectedEvidence
    .map((answer) => answer.rawAnswer?.trim())
    .filter((text): text is string => Boolean(text))

  return answers.length ? [input, ...answers].join(". ") : input
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
  const turnStartedAt = Date.now()
  const retrievalQuery = buildCoachRetrievalQuery(input, collectedEvidence)
  const questionOnlyFlow =
    !skipInterview &&
    !interviewState &&
    collectedEvidence.length === 0

  if (questionOnlyFlow) {
    const questionContext = await retrieveCoachQuestionContext(retrievalQuery)

    let questionResult: Awaited<ReturnType<typeof generateContextualQuestions>>
    try {
      const client = getClient()
      questionResult = await generateContextualQuestions(
        {
          userInput: input,
          evidenceCatalog: questionContext.evidenceCatalog,
          collectedEvidence,
          priorIntent: null,
          priorClaims: [],
        },
        async ({ systemPrompt, userPrompt }) => {
          const completion = await requestQuestionCompletion({
            client,
            model: modelName,
            systemPrompt,
            userPrompt,
          })
          return extractCompletionText(completion)
        },
      )
    } catch (error) {
      questionResult = await generateContextualQuestions(
        {
          userInput: input,
          evidenceCatalog: questionContext.evidenceCatalog,
          collectedEvidence,
          priorIntent: null,
          priorClaims: [],
        },
        async () => {
          throw error
        },
      )
    }

    if (
      questionResult.recommendedResponseMode !== "question" ||
      !questionResult.selectedQuestions.length
    ) {
      const fullEvidence = await retrieveCoachEvidence(retrievalQuery, coachContext)
      const advice = await generateCoachResponse(
        input,
        withInterviewEvidence(
          coachContext,
          collectedEvidence,
          questionResult.evidenceAudit,
        ),
        fullEvidence,
        promptModeForQuestionResult(input, questionResult.recommendedResponseMode),
      )
      const requiresCap =
        questionResult.recommendedResponseMode !== "diagnosis" ||
        questionResult.evidenceAudit.evidenceStrength !== "sufficient"
      const cappedAdvice = withCappedAdvice(
        advice,
        questionResult.evidenceAudit,
        requiresCap,
      )
      logCoachPipelineTrace(buildCoachPipelineTrace({
        input,
        collectedEvidence,
        retrieved: fullEvidence.evidenceCatalog,
        audit: questionResult.evidenceAudit,
        advice: cappedAdvice,
        skipInterview,
      }))

      const response = buildCoachResponseFromAdvice({
        preferredMode:
          questionResult.recommendedResponseMode === "diagnosis"
            ? "diagnosis"
            : "hypothesis",
        advice:
          questionResult.recommendedResponseMode === "diagnosis"
            ? cappedAdvice
            : withCappedAdvice(
                advice,
                questionResult.evidenceAudit,
                true,
              ),
        intent: questionResult.intent,
        evidenceAudit: questionResult.evidenceAudit,
        userInput: input,
        evidenceCatalog: fullEvidence.evidenceCatalog,
        followUpQuestions:
          questionResult.recommendedResponseMode !== "question"
            ? questionResult.selectedQuestions
            : [],
        downgradeFollowUpQuestions: [],
      })

      return withCoachTurnTelemetry(response, turnStartedAt)
    }

    return withCoachTurnTelemetry({
      mode: "question",
      intent: questionResult.intent,
      selectedQuestions: questionResult.selectedQuestions,
      blockedClaims: questionResult.temptingClaims,
      evidenceAudit: questionResult.evidenceAudit,
      confidenceCap: questionResult.confidenceCap,
    }, turnStartedAt)
  }

  const prefetched = await retrieveCoachEvidence(retrievalQuery, coachContext)
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
    const advice = await generateCoachResponse(
      input,
      enrichedCoachContext,
      prefetched,
      evidenceAudit.evidenceStrength === "sufficient" && !skipInterview
        ? promptModeForQuestionResult(input, "diagnosis")
        : "hypothesis",
    )
    const cappedAdvice = withCappedAdvice(
      advice,
      evidenceAudit,
      skipInterview || evidenceAudit.evidenceStrength !== "sufficient",
    )
    logCoachPipelineTrace(buildCoachPipelineTrace({
      input,
      collectedEvidence,
      retrieved: prefetched.evidenceCatalog,
      audit: evidenceAudit,
      advice: cappedAdvice,
      skipInterview,
    }))

    const response = buildCoachResponseFromAdvice({
      preferredMode:
        evidenceAudit.evidenceStrength === "sufficient" && !skipInterview
          ? "diagnosis"
          : "hypothesis",
      advice: cappedAdvice,
      intent,
      evidenceAudit,
      userInput: input,
      evidenceCatalog: prefetched.evidenceCatalog,
      followUpQuestions: [],
      downgradeFollowUpQuestions: [],
    })

    return withCoachTurnTelemetry(response, turnStartedAt)
  }

  if (skipInterview) {
    const advice = await generateCoachResponse(
      input,
      enrichedCoachContext,
      prefetched,
      "hypothesis",
    )
    const cappedAdvice = withCappedAdvice(advice, evidenceAudit, true)
    logCoachPipelineTrace(buildCoachPipelineTrace({
      input,
      collectedEvidence,
      retrieved: prefetched.evidenceCatalog,
      audit: evidenceAudit,
      advice: cappedAdvice,
      skipInterview,
    }))
    return withCoachTurnTelemetry(
      buildCoachResponseFromAdvice({
        preferredMode: "hypothesis",
        advice: cappedAdvice,
        intent,
        evidenceAudit,
        userInput: input,
        evidenceCatalog: prefetched.evidenceCatalog,
        followUpQuestions: [],
        downgradeFollowUpQuestions: [],
      }),
      turnStartedAt,
    )
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
        return extractCompletionText(completion)
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

  if (questionResult.recommendedResponseMode !== "question") {
    const advice = await generateCoachResponse(
      input,
      withInterviewEvidence(
        coachContext,
        collectedEvidence,
        questionResult.evidenceAudit,
      ),
      prefetched,
      promptModeForQuestionResult(input, questionResult.recommendedResponseMode),
    )
    const requiresCap =
      questionResult.recommendedResponseMode !== "diagnosis" ||
      questionResult.evidenceAudit.evidenceStrength !== "sufficient"
    const cappedAdvice = withCappedAdvice(
      advice,
      questionResult.evidenceAudit,
      requiresCap,
    )
    logCoachPipelineTrace(buildCoachPipelineTrace({
      input,
      collectedEvidence,
      retrieved: prefetched.evidenceCatalog,
      audit: questionResult.evidenceAudit,
      advice: cappedAdvice,
      skipInterview,
    }))

    const response = buildCoachResponseFromAdvice({
      preferredMode:
        questionResult.recommendedResponseMode === "diagnosis"
          ? "diagnosis"
          : "hypothesis",
      advice: cappedAdvice,
      intent: questionResult.intent,
      evidenceAudit: questionResult.evidenceAudit,
      userInput: input,
      evidenceCatalog: prefetched.evidenceCatalog,
      followUpQuestions: questionResult.selectedQuestions,
      downgradeFollowUpQuestions: [],
    })

    return withCoachTurnTelemetry(response, turnStartedAt)
  }

  if (!questionResult.selectedQuestions.length) {
    const advice = await generateCoachResponse(
      input,
      withInterviewEvidence(
        coachContext,
        collectedEvidence,
        questionResult.evidenceAudit,
      ),
      prefetched,
      "hypothesis",
    )
    const cappedAdvice = withCappedAdvice(advice, questionResult.evidenceAudit, true)
    logCoachPipelineTrace(buildCoachPipelineTrace({
      input,
      collectedEvidence,
      retrieved: prefetched.evidenceCatalog,
      audit: questionResult.evidenceAudit,
      advice: cappedAdvice,
      skipInterview,
    }))

    return withCoachTurnTelemetry(
      buildCoachResponseFromAdvice({
        preferredMode: "hypothesis",
        advice: cappedAdvice,
        intent: questionResult.intent,
        evidenceAudit: questionResult.evidenceAudit,
        userInput: input,
        evidenceCatalog: prefetched.evidenceCatalog,
        followUpQuestions: [],
        downgradeFollowUpQuestions: [],
      }),
      turnStartedAt,
    )
  }

  return withCoachTurnTelemetry({
    mode: "question",
    intent: questionResult.intent,
    selectedQuestions: questionResult.selectedQuestions,
    blockedClaims: questionResult.temptingClaims,
    evidenceAudit: questionResult.evidenceAudit,
    confidenceCap: questionResult.confidenceCap,
  }, turnStartedAt)
}

function withCoachTurnTelemetry<T extends CoachResponse>(
  response: T,
  startedAt: number,
): T {
  const advice = response.mode === "question" ? null : response.advice
  const payload = {
    mode: response.mode,
    evidenceStrength: response.evidenceAudit.evidenceStrength,
    confidence:
      advice?.reflection.confidence ??
      ("confidenceCap" in response ? response.confidenceCap : null),
    citationCount: advice?.evidenceCitations.length ?? 0,
    followUpQuestionCount:
      response.mode === "question"
        ? response.selectedQuestions.length
        : response.mode === "hypothesis"
          ? response.followUpQuestions.length
          : 0,
    configuredModel: modelName,
    durationMs: Date.now() - startedAt,
  }
  console.info(
    "[coach-agent:turn]",
    JSON.stringify(payload),
  )
  void recordCoachObservabilityEvent({
    event: "turn",
    ...payload,
  })

  return response
}

function logCoachPipelineTrace(
  trace: ReturnType<typeof buildCoachPipelineTrace>,
) {
  console.info(
    "[coach-agent:pipeline]",
    JSON.stringify({
      domains: trace.intent.domains,
      promptMode: trace.promptMode,
      evidenceSignalCount: trace.evidenceSignalCount,
      retrievedEvidenceCount: trace.retrievedEvidenceCount,
      selfCheck: trace.selfCheck,
    }),
  )
}

function logCoachCompletionTelemetry({
  model,
  configuredModel,
  fallbackUsed,
  jsonMode,
  attempts,
  durationMs,
}: {
  model: string
  configuredModel: string
  fallbackUsed: boolean
  jsonMode: boolean
  attempts: number
  durationMs: number
}) {
  const payload = {
    model,
    configuredModel,
    fallbackUsed,
    jsonMode,
    attempts,
    durationMs,
  }
  console.info(
    "[coach-agent:completion]",
    JSON.stringify(payload),
  )
  void recordCoachObservabilityEvent({
    event: "completion",
    ...payload,
  })
}

function promptModeForQuestionResult(
  input: string,
  recommendedMode: "question" | "hypothesis" | "diagnosis",
): CoachPromptMode {
  const inferred = inferCoachPromptMode(input)
  if (inferred === "generalExplanation" || inferred === "sessionPlan") {
    return inferred
  }
  if (recommendedMode === "diagnosis") return "diagnosis"
  return "hypothesis"
}

export async function retrieveCoachEvidence(userInput: string, coachContext?: unknown) {
  // Reconocemos el dominio del problema desde el texto (input + respuestas de
  // entrevista) para priorizar el knowledge de esa fase y no traer conceptos de
  // otra fase por simple coincidencia de keyword.
  const knowledgeDomains = inferDomainsFromText(userInput)

  const [
    recentReports,
    relevantGeneratedMemory,
    relevantKnowledge,
    persistentRagEvidence,
  ] = await Promise.all([
    loadSavedPostMatchReports(),
    retrieveRelevantGeneratedMemory(userInput),
    retrieveRelevantKnowledge(userInput, knowledgeDomains),
    queryCoachRagIndex(userInput, {
      limit: 8,
      minScore: 0.2,
    }).catch(() => []),
  ])
  const contextWithReports =
    await retrieveRelevantContext(userInput, recentReports)

  const relevantReports =
    await retrieveRelevantReportsFromSaved(userInput, recentReports)

  const evidenceCatalog = [
    ...persistentRagEvidence,
    ...relevantGeneratedMemory,
    ...contextWithReports,
    ...relevantKnowledge,
    ...relevantReports,
  ].map(toRetrievedEvidence)
  const runtimeEvidence = buildRuntimeVideoEvidenceCatalog(coachContext)
  const dedupedEvidence = dedupeEvidenceById([
    ...runtimeEvidence,
    ...evidenceCatalog,
  ])

  return {
    relevantContext: contextWithReports,
    relevantGeneratedMemory,
    relevantKnowledge,
    relevantReports,
    recentReports,
    evidenceCatalog: dedupedEvidence,
  }
}

async function retrieveCoachQuestionContext(userInput: string) {
  const recentReports = await loadSavedPostMatchReports()
  const relevantReports = await retrieveRelevantReportsFromSaved(
    userInput,
    recentReports,
  )

  return {
    recentReports,
    relevantReports,
    evidenceCatalog: relevantReports.map(toRetrievedEvidence),
  }
}

/**
 * Extrae el texto de la respuesta del modelo de forma segura.
 *
 * Por qué existe: OpenRouter a veces responde HTTP 200 con un payload de error
 * (modelo :free caido, rate limit, model id invalido, sin credito) que NO trae
 * `choices`. Acceder a `completion.choices[0]` en ese caso tira un TypeError
 * critico ("Cannot read properties of undefined (reading '0')") que oculta el
 * error real. Aca chequeamos primero y propagamos el mensaje verdadero, asi el
 * retry/fallback funciona y el log muestra la causa.
 */
function extractCompletionText(completion: unknown): string {
  const result = completion as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string; code?: string | number }
  }

  if (!result?.choices?.length) {
    const apiError = result?.error
    throw new Error(
      apiError?.message
        ? `OpenRouter error: ${apiError.message}`
        : "OpenRouter no devolvio choices (modelo no disponible, rate limit, sin credito o model id invalido)",
    )
  }

  return result.choices[0]?.message?.content ?? ""
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
  return client.chat.completions.create(
    {
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
    },
    { timeout: COACH_COMPLETION_TIMEOUT_MS },
  )
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
  return client.chat.completions.create(
    {
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
    },
    { timeout: COACH_COMPLETION_TIMEOUT_MS },
  )
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
    formatStructuredRuntimeContext(context),
    formatShapeRuntimeContext(context.shapeContext),
    formatLineupLabRuntimeContext(context),
    formatVideoEvidenceRuntimeContext(context),
    formatInterviewRuntimeContext(context),
  ].filter(Boolean)

  return lines.length
    ? lines.join("\n\n")
    : "Runtime UI context provided without relevant tactical fields."
}

function formatStructuredRuntimeContext(context: Record<string, unknown>) {
  const gameModel = objectValue(context.gameModel)
  const opponentScout = objectValue(context.opponentScout)
  const lines = [
    gameModel ? "GAME MODEL: structured model provided separately." : "",
    opponentScout ? "OPPONENT SCOUT: active rival scout provided separately." : "",
  ].filter(Boolean)
  return lines.join("\n")
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

function formatVideoEvidenceRuntimeContext(context: Record<string, unknown>) {
  const videoEvidence = objectValue(context.videoEvidence)
  if (!videoEvidence) return ""

  const total = numberValue(videoEvidence.total) ?? 0
  const text = stringValue(videoEvidence.text)
  if (!total && !text) return ""

  const lines = text
    ? text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12)
    : []

  return [
    "VIDEO EVIDENCE (current UI marks)",
    `- total=${total}; tags=${numberValue(videoEvidence.tags) ?? 0}; manualTracks=${numberValue(videoEvidence.manualTracks) ?? 0}; confirmedTracks=${numberValue(videoEvidence.confirmedTracks) ?? 0}; assistedTracks=${numberValue(videoEvidence.assistedTracks) ?? 0}`,
    lines.length
      ? `- items:\n${lines.map((line) => `  - ${line}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function formatStructuredGameModel(coachContext: unknown) {
  const context = objectValue(coachContext)
  const raw = context?.gameModel
  if (!raw) {
    return "No editable Game Model provided. Use static identity only as fallback."
  }
  return summarizeGameModel(normalizeGameModel(raw))
}

function formatOpponentScoutContext(coachContext: unknown) {
  const context = objectValue(coachContext)
  const raw = context?.opponentScout
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "No opponent scout loaded."
  }
  return summarizeOpponentScout(raw as Parameters<typeof summarizeOpponentScout>[0])
}

function formatPlayerFitRuntimeContext(coachContext: unknown, userInput: string) {
  const context = objectValue(coachContext)
  if (!context) return "No squad fit context."
  const players = arrayValue(context.availableSquad)
  if (!players.length) return "No available squad provided."
  const normalized = normalizeForRules(userInput)
  const lines: string[] = []
  const centerBacks = players.filter((player) =>
    runtimePlayerPositions(player).some((position) => position === "CB"),
  )
  const pivots = players.filter((player) =>
    runtimePlayerPositions(player).some((position) => ["CDM", "CM"].includes(position)),
  )
  const attackers = players.filter((player) =>
    runtimePlayerPositions(player).some((position) => ["LW", "RW", "ST", "CM", "CDM"].includes(position)),
  )

  const slowCenterBacks = centerBacks.filter((player) =>
    runtimeProfileHas(player, [
      "lento",
      "poca velocidad",
      "sufre a la espalda",
      "espalda",
      "pesado",
      "no corrige hacia atras",
    ]),
  )
  if (
    slowCenterBacks.length &&
    /subir|bloque alto|presion alta|presionar/i.test(normalized)
  ) {
    lines.push(
      `- RIESGO FIT: bloque alto con centrales lentos (${slowCenterBacks.map(runtimePlayerLabel).join("; ")}).`,
    )
  }

  const weakPivots = pivots.filter((player) =>
    runtimeProfileHas(player, [
      "sufre de espaldas",
      "pase inseguro",
      "poca recepcion",
      "no gira",
      "limitado con pelota",
      "se complica bajo presion",
    ]),
  )
  if (weakPivots.length && /salida|pivote|5|progres/i.test(normalized)) {
    lines.push(
      `- RIESGO FIT: salida interior condicionada por pivote con pase/control bajo (${weakPivots.map(runtimePlayerLabel).join("; ")}).`,
    )
  }

  const lowPress = attackers.filter((player) =>
    runtimeProfileHas(player, [
      "no presiona",
      "baja intensidad",
      "llega tarde",
      "no sostiene presion",
      "no repliega",
    ]),
  )
  if (lowPress.length >= 2 && /presion|tras perdida|apretar/i.test(normalized)) {
    lines.push(
      `- RIESGO FIT: presion alta con baja intensidad de presion en roles clave (${lowPress.map(runtimePlayerLabel).join("; ")}).`,
    )
  }

  const organizer = pivots.find((player) =>
    runtimeProfileHas(player, ["ordena", "lectura", "primer pase", "pausa", "lidera"]),
  )
  if (organizer) {
    lines.push(`- FORTALEZA FIT: ${runtimePlayerLabel(organizer)} puede ordenar salida/presion.`)
  }

  return lines.length
    ? lines.join("\n")
    : "No deterministic fit warnings for this request."
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function runtimePlayerPositions(player: unknown) {
  const entry = objectValue(player)
  return arrayValue(entry?.positions).filter((item): item is string => typeof item === "string")
}

function runtimePlayerLabel(player: unknown) {
  const entry = objectValue(player)
  const num = numberValue(entry?.num) ?? "?"
  const name = stringValue(entry?.name) ?? "Jugador"
  return `#${num} ${name}`
}

function runtimeProfileHas(player: unknown, terms: string[]) {
  const profile = stringValue(objectValue(player)?.profile) ?? ""
  return terms.some((term) => normalizeForRules(profile).includes(normalizeForRules(term)))
}

function normalizeForRules(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

type EvidenceCatalogItem = RetrievedEvidence

function toRetrievedEvidence(item: EvidenceCatalogItem): RetrievedEvidence {
  const text = `${item.title} ${item.excerpt}`
  return {
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    excerpt: item.excerpt,
    score: item.score,
    evidenceTargets: item.evidenceTargets?.length
      ? item.evidenceTargets
      : inferEvidenceTargets(text),
  }
}

function buildRuntimeVideoEvidenceCatalog(coachContext: unknown): RetrievedEvidence[] {
  const context = objectValue(coachContext)
  const videoEvidence = objectValue(context?.videoEvidence)
  const text = stringValue(videoEvidence?.text)
  if (!text) return []

  return normalizeRuntimeVideoEvidenceText(text)
    .slice(0, 12)
    .map((observation) => ({
      id: observation.id,
      sourceType: "video" as const,
      title: observation.title,
      excerpt: observation.text,
      score:
        observation.confidence === "high"
          ? 0.94
          : observation.confidence === "medium"
            ? 0.76
            : 0.48,
      evidenceTargets: inferEvidenceTargets(
        [observation.title, observation.text, observation.zone ?? ""].join(" "),
      ),
    }))
}

function dedupeEvidenceById(items: RetrievedEvidence[]) {
  const byId = new Map<string, RetrievedEvidence>()
  for (const item of items) {
    const current = byId.get(item.id)
    if (!current || item.score > current.score) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score)
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

function buildCoachResponseFromAdvice({
  preferredMode,
  advice,
  intent,
  evidenceAudit,
  userInput,
  evidenceCatalog,
  followUpQuestions,
  downgradeFollowUpQuestions,
}: {
  preferredMode: "hypothesis" | "diagnosis"
  advice: CoachMatchAdvice
  intent: TacticalIntent
  evidenceAudit: EvidenceAudit
  userInput: string
  evidenceCatalog: EvidenceCatalogItem[]
  followUpQuestions: ContextualQuestion[]
  downgradeFollowUpQuestions: ContextualQuestion[]
}): CoachResponse {
  const trust = assessCoachAdviceTrust(advice, {
    userInput,
    evidenceCatalog,
  })

  if (preferredMode === "diagnosis" && trust.requiresHypothesisMode) {
    return {
      mode: "hypothesis",
      advice,
      confidenceCap: advice.reflection.confidence,
      intent,
      evidenceAudit,
      followUpQuestions: downgradeFollowUpQuestions,
    }
  }

  if (preferredMode === "diagnosis") {
    return {
      mode: "diagnosis",
      advice,
      intent,
      evidenceAudit,
    }
  }

  return {
    mode: "hypothesis",
    advice,
    confidenceCap: advice.reflection.confidence,
    intent,
    evidenceAudit,
    followUpQuestions,
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
        `targets=${(item.evidenceTargets ?? []).join(",") || "none"}`,
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

function finalizeCoachAdvice(
  advice: CoachMatchAdvice,
  {
    evidenceCatalog,
    userInput,
    coachContext,
  }: {
    evidenceCatalog: EvidenceCatalogItem[]
    userInput: string
    coachContext: unknown
  },
): CoachMatchAdvice {
  const withCitations = attachEvidenceCitations(advice, evidenceCatalog)
  const withDepth = ensureAdviceDepth(withCitations, userInput)
  const withExercises = enrichAdviceWithExerciseMatches(withDepth, userInput)
  const gameModel = objectValue(coachContext)?.gameModel
  const deterministicContrast = gameModel
    ? contrastTextWithGameModel(
        [
          userInput,
          withExercises.tacticalReading,
          withExercises.problemBreakdown.zone,
          withExercises.problemBreakdown.trigger,
          withExercises.probableCause,
          withExercises.mainAdjustment,
          withExercises.wednesdayTest,
          withExercises.saturdayFocus,
        ].join(" "),
        normalizeGameModel(gameModel),
      )
    : { aligned: [], contradictions: [], insufficientEvidence: [] }
  const deterministicFit = formatPlayerFitRuntimeContext(coachContext, [
    userInput,
    withExercises.mainAdjustment,
    withExercises.probableCause,
  ].join(" "))
    .split("\n")
    .filter((line) => line.startsWith("- RIESGO FIT"))
    .map((line) => line.replace(/^- RIESGO FIT:\s*/, ""))
  const fitWarnings = [
    ...withExercises.playerFitWarnings,
    ...deterministicFit,
  ].filter((item, index, list) => item.trim() && list.indexOf(item) === index)

  return guardCoachAdvice({
    ...withExercises,
    modelContrast: {
      aligned: uniqueStrings([
        ...withExercises.modelContrast.aligned,
        ...deterministicContrast.aligned,
      ]),
      contradictions: uniqueStrings([
        ...withExercises.modelContrast.contradictions,
        ...deterministicContrast.contradictions,
      ]),
      insufficientEvidence: uniqueStrings([
        ...withExercises.modelContrast.insufficientEvidence,
        ...deterministicContrast.insufficientEvidence,
      ]),
    },
    playerFitWarnings: fitWarnings,
    adjustmentRisks: uniqueStrings([
      ...withExercises.adjustmentRisks,
      ...fitWarnings,
    ]),
  }, {
    userInput,
    evidenceCatalog,
  })
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
  const sessionAction = linkedExercises.length
    ? [{
        type: "createSessionFromDiagnosis" as const,
        label: "Crear sesion desde este diagnostico",
        exerciseIds: linkedExercises,
        title: `Sesion desde diagnostico`,
        rationale: advice.mainAdjustment,
      }]
    : []

  return {
    ...advice,
    linkedExercises,
    actions: [...sessionAction, ...structuredActions, ...advice.actions].slice(0, 5),
  }
}

function ensureAdviceDepth(
  advice: CoachMatchAdvice,
  userInput: string,
): CoachMatchAdvice {
  const problemBreakdown = {
    zone: usefulText(advice.problemBreakdown.zone)
      ? advice.problemBreakdown.zone
      : inferProblemZone(userInput, advice),
    moment: usefulText(advice.problemBreakdown.moment)
      ? advice.problemBreakdown.moment
      : inferProblemMoment(userInput),
    trigger: usefulText(advice.problemBreakdown.trigger)
      ? advice.problemBreakdown.trigger
      : inferProblemTrigger(userInput, advice),
    ownVsRival: usefulText(advice.problemBreakdown.ownVsRival)
      ? advice.problemBreakdown.ownVsRival
      : "Responsabilidad a validar con evidencia del partido.",
  }
  const alternatives = uniqueAlternativeAdjustments([
    ...advice.alternativeAdjustments,
    ...fallbackAlternativeAdjustments(advice, userInput),
  ]).slice(0, 3)

  return {
    ...advice,
    problemBreakdown,
    alternativeAdjustments: alternatives,
    onFieldInstructions: advice.onFieldInstructions.slice(0, 5),
  }
}

function fallbackAlternativeAdjustments(
  advice: CoachMatchAdvice,
  userInput: string,
): CoachMatchAdvice["alternativeAdjustments"] {
  const normalized = normalizeForRules(
    [
      userInput,
      advice.tacticalReading,
      advice.probableCause,
      advice.mainAdjustment,
    ].join(" "),
  )
  const alternatives: CoachMatchAdvice["alternativeAdjustments"] = []

  if (/bloque|presion|presionar|subir|alto/.test(normalized)) {
    alternatives.push({
      adjustment: "Sostener bloque medio y presionar solo con gatillo claro.",
      whenToUse: "Cuando el plantel no sostiene esfuerzos largos o hay dudas de velocidad a la espalda.",
      tradeoff: "Cede metros iniciales y exige defender mejor la segunda jugada.",
    })
    alternatives.push({
      adjustment: "Presionar alto durante ventanas cortas y replegar si el rival supera la primera linea.",
      whenToUse: "Cuando queres incomodar salida rival sin exponer todo el partido.",
      tradeoff: "Requiere coordinacion fina; si un jugador salta tarde, el equipo queda largo.",
    })
  } else if (/salida|progres|pivote|5/.test(normalized)) {
    alternatives.push({
      adjustment: "Usar salida mixta: atraer por dentro y activar tercer hombre por fuera.",
      whenToUse: "Cuando el pivote esta tapado o no tiene perfil para recibir de espaldas.",
      tradeoff: "Puede alejar apoyos del 9 si los interiores no acompanan.",
    })
    alternatives.push({
      adjustment: "Saltar una linea con pase directo preparado y juntar segunda jugada.",
      whenToUse: "Cuando el rival presiona alto y niega la salida corta.",
      tradeoff: "Pierde control inicial de posesion y exige duelos ofensivos.",
    })
  } else if (/9|delanter|gener|atac/.test(normalized)) {
    alternatives.push({
      adjustment: "Acercar un interior al 9 para crear apoyo frontal antes de acelerar.",
      whenToUse: "Cuando el delantero queda aislado y la segunda pelota cae lejos.",
      tradeoff: "Puede dejar menos presencia en la base de la jugada.",
    })
    alternatives.push({
      adjustment: "Liberar una banda para atacar con lateral y extremo escalonados.",
      whenToUse: "Cuando el rival protege el carril central y concede lado debil.",
      tradeoff: "Expone transicion defensiva si no hay cobertura del mediocentro.",
    })
  } else {
    alternatives.push({
      adjustment: "Reducir el riesgo inicial y validar la causa con una tarea corta de repeticion.",
      whenToUse: "Cuando la evidencia todavia no separa sintoma de causa.",
      tradeoff: "No corrige todo de inmediato, pero evita sobrerreaccionar.",
    })
    alternatives.push({
      adjustment: "Probar una version mas agresiva del ajuste durante 10 minutos controlados.",
      whenToUse: "Cuando necesitás cambiar el partido sin comprometer todo el plan.",
      tradeoff: "Si falla el primer pase o salto, aumenta la exposicion.",
    })
  }

  return alternatives
}

function inferProblemZone(userInput: string, advice: CoachMatchAdvice) {
  const text = normalizeForRules(
    `${userInput} ${advice.tacticalReading} ${advice.probableCause}`,
  )
  if (/banda|lateral|extremo/.test(text)) return "Banda o carril exterior."
  if (/espalda|lineas|bloque/.test(text)) return "Espacio entre lineas o espalda del bloque."
  if (/salida|pivote|5/.test(text)) return "Base de salida y carril central."
  if (/9|delanter/.test(text)) return "Ultimo tercio y zona de apoyo al 9."
  return "Zona a confirmar con evidencia del caso."
}

function inferProblemMoment(userInput: string) {
  const text = normalizeForRules(userInput)
  if (/segundo tiempo|60|70|cans/.test(text)) return "Tramo final o caida fisica."
  if (/salida|inicio|primer pase/.test(text)) return "Inicio de la posesion."
  if (/perdida|transicion/.test(text)) return "Tras perdida o cambio de posesion."
  if (/sabado|partido/.test(text)) return "Contexto de partido a validar."
  return "Momento a confirmar."
}

function inferProblemTrigger(userInput: string, advice: CoachMatchAdvice) {
  const text = normalizeForRules(`${userInput} ${advice.mainAdjustment}`)
  if (/pase atras|control malo|gatillo/.test(text)) return "Gatillo de presion o control rival."
  if (/perdida/.test(text)) return "Perdida propia y reaccion posterior."
  if (/centro|banda/.test(text)) return "Progresion rival hacia banda."
  if (/salida/.test(text)) return "Primera recepcion bajo presion."
  return "Gatillo a validar con notas o video."
}

function uniqueAlternativeAdjustments(
  items: CoachMatchAdvice["alternativeAdjustments"],
) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizeForRules(item.adjustment)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function usefulText(value: string) {
  const normalized = normalizeForRules(value)
  return Boolean(normalized) && !/confirmar|s\/d|sin dato/.test(normalized)
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}
