import fs from "node:fs/promises"
import { TacticalMemorySchema } from "./CoachSchemas"

const GENERATED_MEMORY_PATH =
  "src/ai/generated/tactical-memory.json"

export async function loadGeneratedMemory() {
  try {
    const rawContent = await fs.readFile(
      GENERATED_MEMORY_PATH,
      "utf-8"
    )

    const parsedContent = JSON.parse(rawContent)

    return TacticalMemorySchema.parse(parsedContent)
  } catch {
    return []
  }
}