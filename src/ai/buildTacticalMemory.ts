import dotenv from "dotenv"
import OpenAI from "openai"
import fs from "node:fs/promises"

import { MATCH_OBSERVATIONS_STORE } from "./MatchObservationsStore"
import { TacticalMemorySchema } from "./CoachSchemas"
import { MEMORY_UPDATER_PROMPT } from "./memoryUpdaterPrompt"

dotenv.config({
  path: ".env.local",
})

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

export async function buildTacticalMemory() {
  if (MATCH_OBSERVATIONS_STORE.length === 0) {
    throw new Error("No match observations available")
  }

  const observations = JSON.stringify(
    MATCH_OBSERVATIONS_STORE,
    null,
    2
  )

  const prompt = `
Analyze the following match observations and detect recurring tactical patterns.

Important:
- Do not summarize every observation.
- Detect patterns.
- Ignore isolated events unless severity is high.
- Focus on collective tactical behavior.
- Think like an assistant coach.
- Respond ONLY with valid JSON.
- Do not use markdown.

Use this exact structure:

[
  {
    "category": "string",
    "pattern": "string",
    "impact": "string",
    "frequency": 1,
    "severityScore": 0.0,
    "lastSeen": "YYYY-MM-DD"
  }
]

Rules for metadata:
- frequency = how many observations support the pattern
- severityScore = number between 0 and 1
- high severity observations increase severityScore
- lastSeen = latest explicit observation date. If no date exists, use 2026-05-22.
- Every object MUST contain ALL fields
- Never omit frequency, severityScore or lastSeen
- If the pattern occurs immediately after losing possession, prefer category defensive-transition over block.

Language rules:
- Respond in Spanish.
- category should use canonical English keys only:
  defensive-transition, build-up, compactness, pressing, midfield, wide-areas, strikers, block

Date rules:
- If observations do not include an explicit date, use today's date: 2026-05-22
- Do not invent dates.

Match observations:
${observations}
`

  const completion =
    await client.chat.completions.create({
      model:
        process.env.OPENROUTER_MODEL ??
        "openrouter/free",

      messages: [
        {
          role: "system",
          content: MEMORY_UPDATER_PROMPT,
        },

        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.25,
    })

  const rawText =
    completion.choices?.[0]?.message?.content

  if (!rawText) {
    console.log(
      "Invalid provider response:",
      completion
    )

    throw new Error(
      "Provider returned no content"
    )
  }

  const cleanText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()

  let parsedJson

  try {
    parsedJson = JSON.parse(cleanText)
  } catch (error) {
    console.log(
      "Failed to parse tactical memory JSON"
    )

    console.log("Raw provider response:")

    console.log(rawText)

    throw new Error(
      "Invalid JSON returned by provider"
    )
  }

  const validatedMemory =
    TacticalMemorySchema.parse(parsedJson)

  await fs.mkdir(
    "src/ai/generated",
    {
      recursive: true,
    }
  )

  await fs.writeFile(
    "src/ai/generated/tactical-memory.json",
    JSON.stringify(
      validatedMemory,
      null,
      2
    ),
    "utf-8"
  )

  return validatedMemory
}