import dotenv from "dotenv"
import OpenAI from "openai"

import { TacticalMemorySchema } from "./CoachSchemas"

dotenv.config({
  path: ".env.local",
})

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

export async function consolidateTacticalMemory(
  currentMemory: unknown
) {
  const validatedMemory =
    TacticalMemorySchema.parse(currentMemory)

  const prompt = `
You are consolidating tactical memory for a football coaching AI system.

Your job:
- Merge duplicated ideas
- Merge similar tactical patterns
- Remove redundancy
- Preserve the most important recurring concepts
- Keep memory compact and useful
- Preserve tactical meaning
- Do NOT invent new tactical conclusions

Important:
- Multiple similar patterns should become one stronger abstraction
- Keep memory concise
- Focus on recurring collective behavior
- Respond ONLY with valid JSON
- Do not use markdown

Consolidation rules:
- If two patterns describe the same tactical behavior using different words, they MUST be merged.
- The output must have fewer items than the input when duplicates or near-duplicates exist.
- Do not preserve two items if they share the same cause and same tactical consequence.
- Prefer one stronger combined pattern over multiple similar patterns.
- Merge only duplicated or near-duplicated items.
- Do NOT remove unrelated patterns from different categories.
- If an item describes a different phase or different tactical problem, keep it.
- Avoid repeating the same phrase inside a single impact.
- When merging similar items, sum their frequency.
- severityScore should reflect the highest or strongest severity among merged items.
- lastSeen should be the most recent lastSeen among merged items.
- Keep unrelated patterns separate.

Example:

Input:
[
  {
    "category": "defensive-transition",
    "pattern": "Los delanteros retroceden rápido antes de presionar",
    "impact": "El bloque se hunde"
  },
  {
    "category": "defensive-transition",
    "pattern": "Los delanteros bajan antes de activar presión",
    "impact": "El equipo defiende cerca del área"
  }
]

Correct output:
[
  {
    "category": "defensive-transition",
    "pattern": "Los delanteros retroceden antes de activar presión.",
    "impact": "El bloque se hunde, pierde compactación y el equipo termina defendiendo cerca del área."
  }
]

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

Current memory:
${JSON.stringify(validatedMemory, null, 2)}
`

  const completion =
    await client.chat.completions.create({
      model:
        process.env.OPENROUTER_MODEL ??
        "openrouter/free",

      messages: [
        {
          role: "system",
          content:
            "You consolidate tactical football memory for a coaching intelligence system.",
        },

        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.2,
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
      "Failed to parse consolidated memory JSON"
    )

    console.log(rawText)

    throw new Error(
      "Invalid JSON returned by provider"
    )
  }

  return TacticalMemorySchema.parse(
    parsedJson
  )
}