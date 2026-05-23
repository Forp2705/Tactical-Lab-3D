import dotenv from "dotenv"
import OpenAI from "openai"

import { CoachMatchAdviceSchema } from "./CoachSchemas.js"
import { COACH_AGENT_SYSTEM_PROMPT } from "./CoachAgentPrompt.js"
import { TEAM_CONTEXT } from "./TeamContext.js"
import { COACH_RULES } from "./CoachRules.js"
import { FOOTBALL_IDENTITY } from "./FootballIdentity.js"
import { MATCH_MEMORY } from "./MatchMemory.js"
import { MATCH_OBSERVATIONS } from "./MatchObservations.js"
import { retrieveRelevantContext } from "./retrieveRelevantContext.js"
import { retrieveRelevantKnowledge } from "./retrieveRelevantKnowledge.js"
import { TEAM_IDENTITY } from "./teamIdentity.js"
import { retrieveRelevantGeneratedMemory } from "./retrieveRelevantGeneratedMemory.js"

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


export async function generateCoachResponse(userInput: string) {
  if (!userInput.trim()) {
    throw new Error("User input cannot be empty")
  }
  const relevantContext =
  retrieveRelevantContext(userInput)

  const relevantGeneratedMemory =
  await retrieveRelevantGeneratedMemory(userInput)

  const relevantKnowledge =
  await retrieveRelevantKnowledge(userInput)

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
