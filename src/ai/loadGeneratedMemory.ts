import fs from "node:fs/promises"
import { TacticalMemorySchema } from "./CoachSchemas.js"
import { writableDataPath } from "./serverDataPaths.js"

const GENERATED_MEMORY_PATH =
  "src/ai/generated/tactical-memory.json"

let generatedMemoryCache:
  | Awaited<ReturnType<typeof TacticalMemorySchema.parse>>
  | null = null
let generatedMemoryPromise:
  | Promise<Awaited<ReturnType<typeof TacticalMemorySchema.parse>>>
  | null = null

export async function loadGeneratedMemory() {
  if (generatedMemoryCache) return generatedMemoryCache
  if (generatedMemoryPromise) return generatedMemoryPromise

  generatedMemoryPromise = (async () => {
    const runtimePath = writableDataPath(GENERATED_MEMORY_PATH)
    const memorySets = await Promise.all([
      readMemoryFile(runtimePath),
      readMemoryFile(GENERATED_MEMORY_PATH),
      readMemoryFile(new URL("./generated/tactical-memory.json", import.meta.url)),
    ])

    const memory = TacticalMemorySchema.parse(dedupeMemory(memorySets.flat()))
    generatedMemoryCache = memory
    return memory
  })().finally(() => {
    generatedMemoryPromise = null
  })

  return generatedMemoryPromise
}

async function readMemoryFile(filePath: string | URL) {
  try {
    const rawContent = await fs.readFile(filePath, "utf-8")
    return TacticalMemorySchema.parse(JSON.parse(rawContent))
  } catch {
    return []
  }
}

function dedupeMemory<T extends { pattern: string; lastSeen: string }>(items: T[]) {
  const byPattern = new Map<string, T>()
  for (const item of items) {
    const key = item.pattern.trim().toLowerCase().replace(/\s+/g, " ")
    const current = byPattern.get(key)
    if (!current || item.lastSeen.localeCompare(current.lastSeen) > 0) {
      byPattern.set(key, item)
    }
  }
  return [...byPattern.values()]
}
