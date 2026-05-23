import fs from "node:fs/promises"
import path from "node:path"
import { TacticalKnowledgeSchema } from "./CoachSchemas"
import buildUpKnowledge from "./knowledge/build-up.json"
import compactnessKnowledge from "./knowledge/compactness.json"
import defensiveTransitionKnowledge from "./knowledge/defensive-transition.json"
import pressingKnowledge from "./knowledge/pressing.json"

const KNOWLEDGE_DIR = "src/ai/knowledge"
const BUNDLED_KNOWLEDGE = [
  ...buildUpKnowledge,
  ...compactnessKnowledge,
  ...defensiveTransitionKnowledge,
  ...pressingKnowledge,
]

export async function loadKnowledgeBase() {
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

    return allKnowledge
  } catch {
    return TacticalKnowledgeSchema.parse(BUNDLED_KNOWLEDGE)
  }
}
