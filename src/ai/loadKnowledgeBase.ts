import fs from "node:fs/promises"
import path from "node:path"
import { TacticalKnowledgeSchema } from "./CoachSchemas"

const KNOWLEDGE_DIR = "src/ai/knowledge"

export async function loadKnowledgeBase() {
  const files = await fs.readdir(KNOWLEDGE_DIR)

  const jsonFiles = files.filter((file) =>
    file.endsWith(".json")
  )

  const allKnowledge = []

  for (const file of jsonFiles) {
    const filePath = path.join(KNOWLEDGE_DIR, file)
    const rawContent = await fs.readFile(filePath, "utf-8")
    const parsedContent = JSON.parse(rawContent)

    const validatedKnowledge =
      TacticalKnowledgeSchema.parse(parsedContent)

    allKnowledge.push(...validatedKnowledge)
  }

  return allKnowledge
}