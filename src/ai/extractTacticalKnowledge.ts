import dotenv from "dotenv"
import OpenAI from "openai"

import { TacticalKnowledgeSchema } from "./CoachSchemas"

dotenv.config({
  path: ".env.local",
})

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

export async function extractTacticalKnowledge(sourceText: string) {
  if (!sourceText.trim()) {
    throw new Error("Source text cannot be empty")
  }

  const prompt = `
You are a football tactical knowledge extractor.

Your job:
Extract practical tactical principles from the source text.

Rules:
- Do NOT summarize the text.
- Extract reusable tactical knowledge.
- Focus on principles that could help an assistant coach.
- Ignore anecdotes unless they contain a tactical lesson.
- Keep each item concrete.
- Do not invent information not present in the text.
- Tags must be short and useful for retrieval.
- Respond ONLY with valid JSON.
- Respond in Spanish.
- Use lowercase category names.
- Prefer categories from this list when possible:
  pressing, defensive-transition, compactness, build-up, strikers, midfield, wide-areas, block
- Tags must also be lowercase.
- Do not omit tags under any circumstance.

Use this exact structure:

[
  {
    "category": "string",
    "principle": "string",
    "context": "string",
    "risk": "string",
    "tags": ["string"]
  }
]

Use this exact structure.
Every object MUST include all fields.
The "tags" field is mandatory and must always be an array of lowercase strings.

[
  {
    "category": "string",
    "principle": "string",
    "context": "string",
    "risk": "string",
    "tags": ["string"]
  }
]

Source text:
${sourceText}
`

  const completion = await client.chat.completions.create({
    model:
      process.env.OPENROUTER_MODEL ??
      "openrouter/free",
    messages: [
      {
        role: "system",
        content:
          "You extract structured tactical football knowledge for a coaching assistant.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
  })

  const rawText =
    completion.choices[0]?.message?.content ?? ""

    if (!rawText) {
      console.log("Invalid provider response:", completion)
      throw new Error("Provider did not return any content")
    }

  const cleanText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()

  const parsedJson = JSON.parse(cleanText)

  return TacticalKnowledgeSchema.parse(parsedJson)
}