import OpenAI from "openai"
import dotenv from "dotenv"
import { MATCH_OBSERVATIONS } from "./MatchObservations"
import { MATCH_MEMORY } from "./MatchMemory"
import { MEMORY_UPDATER_PROMPT } from "./memoryUpdaterPrompt"
import { TacticalMemorySchema } from "./CoachSchemas"


dotenv.config({
  path: ".env.local",
})

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

export async function updateMatchMemory() {
  const observations = JSON.stringify(
    MATCH_OBSERVATIONS,
    null,
    2
  )

  const prompt = `
You are a tactical football analyst.

Your job:
Analyze the recent observations and generate an updated tactical memory.

Rules:
- Detect recurring patterns.
- Ignore isolated events.
- Focus on collective tactical behaviors.
- Keep the memory concise.
- Avoid generic statements.
- Think like a real assistant coach.

Current memory:
${MATCH_MEMORY}

Recent observations:
${observations}

Respond ONLY with valid JSON using this structure:

[
  {
    "category": "string",
    "pattern": "string",
    "impact": "string"
  }
]
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

    temperature: 0.3,
  })

const rawText =
  completion.choices[0]?.message?.content ?? ""

const cleanText = rawText
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim()

const parsedJson = JSON.parse(cleanText)

const validatedMemory =
  TacticalMemorySchema.parse(parsedJson)

return validatedMemory

}