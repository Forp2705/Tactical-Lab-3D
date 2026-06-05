import fs from "node:fs/promises"
import path from "node:path"
import { TacticalKnowledgeSchema } from "./CoachSchemas.js"

const KNOWLEDGE_DIR = "src/ai/knowledge"
const BUNDLED_KNOWLEDGE_FILES = [
  new URL("./knowledge/build-up.json", import.meta.url),
  new URL("./knowledge/compactness.json", import.meta.url),
  new URL("./knowledge/defensive-transition.json", import.meta.url),
  new URL("./knowledge/pressing.json", import.meta.url),
  new URL("./knowledge/organized-attack.json", import.meta.url),
  new URL("./knowledge/offensive-transition.json", import.meta.url),
  new URL("./knowledge/set-pieces.json", import.meta.url),
  new URL("./knowledge/duels.json", import.meta.url),
  new URL("./knowledge/principles-of-play.json", import.meta.url),
  new URL("./knowledge/relational-play.json", import.meta.url),
  new URL("./knowledge/direct-play.json", import.meta.url),
  new URL("./knowledge/defensive-systems.json", import.meta.url),
  new URL("./knowledge/game-management.json", import.meta.url),
]

let knowledgeBaseCache:
  | Awaited<ReturnType<typeof TacticalKnowledgeSchema.parse>>
  | null = null
let knowledgeBasePromise:
  | Promise<Awaited<ReturnType<typeof TacticalKnowledgeSchema.parse>>>
  | null = null

export async function loadKnowledgeBase() {
  if (knowledgeBaseCache) return knowledgeBaseCache
  if (knowledgeBasePromise) return knowledgeBasePromise

  knowledgeBasePromise = (async () => {
    try {
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

      knowledgeBaseCache = allKnowledge
      return allKnowledge
    } catch {
      const allKnowledge = []

      for (const fileUrl of BUNDLED_KNOWLEDGE_FILES) {
        const rawContent = await fs.readFile(fileUrl, "utf-8")
        const parsedContent = JSON.parse(rawContent)
        const validatedKnowledge =
          TacticalKnowledgeSchema.parse(parsedContent)

        allKnowledge.push(...validatedKnowledge)
      }

      knowledgeBaseCache = allKnowledge
      return allKnowledge
    } finally {
      knowledgeBasePromise = null
    }
  })()

  return knowledgeBasePromise
}
