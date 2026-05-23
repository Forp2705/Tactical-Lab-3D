import fs from "node:fs/promises"
import { TacticalMemorySchema } from "./CoachSchemas.js"
import { writableDataPath } from "./serverDataPaths.js"

const GENERATED_MEMORY_PATH =
  "src/ai/generated/tactical-memory.json"

export async function loadGeneratedMemory() {
  const runtimePath = writableDataPath(GENERATED_MEMORY_PATH)

  try {
    const rawContent = await fs.readFile(
      runtimePath,
      "utf-8"
    )

    const parsedContent = JSON.parse(rawContent)

    return TacticalMemorySchema.parse(parsedContent)
  } catch {
    try {
      const rawContent = await fs.readFile(
        GENERATED_MEMORY_PATH,
        "utf-8"
      )
      const parsedContent = JSON.parse(rawContent)

      return TacticalMemorySchema.parse(parsedContent)
    } catch {
      const rawContent = await fs.readFile(
        new URL("./generated/tactical-memory.json", import.meta.url),
        "utf-8"
      )
      const parsedContent = JSON.parse(rawContent)

      return TacticalMemorySchema.parse(parsedContent)
    }
  }
}
