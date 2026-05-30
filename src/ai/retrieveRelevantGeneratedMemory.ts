import { loadGeneratedMemory } from "./loadGeneratedMemory.js"
import { rankDocuments } from "./retrievalScoring.js"

const MAX_MEMORY_ITEMS = 3

function getRecencyScore(lastSeen: string) {
  const timestamp = new Date(lastSeen).getTime()

  if (Number.isNaN(timestamp)) {
    return 0
  }

  const daysAgo =
    (Date.now() - timestamp) / (1000 * 60 * 60 * 24)

  if (daysAgo <= 7) return 1
  if (daysAgo <= 30) return 0.7
  if (daysAgo <= 90) return 0.4

  return 0.1
}

export async function retrieveRelevantGeneratedMemory(
  userInput: string
) {
  const generatedMemory = await loadGeneratedMemory()
  const documents = generatedMemory.map((item, index) => ({
    id: `MEM-${index + 1}-${item.lastSeen}`,
    sourceType: "memory" as const,
    title: `${item.category}: ${item.pattern.slice(0, 90)}`,
    text: [item.category, item.pattern, item.impact].join("\n"),
    tags: [item.category],
    payload: item,
    recencyScore: getRecencyScore(item.lastSeen),
    authorityScore:
      Math.min(item.frequency, 10) / 10 * 0.35 +
      item.severityScore * 0.65,
  }))

  return rankDocuments(userInput, documents, {
    limit: MAX_MEMORY_ITEMS,
  })
}
