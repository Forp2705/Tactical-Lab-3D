import { loadGeneratedMemory } from "./loadGeneratedMemory"
import { TACTICAL_KEYWORDS } from "./tacticalKeywords"

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
  const normalizedInput = userInput.toLowerCase()

  const scoredMemory = generatedMemory
    .map((item) => {
      let keywordScore = 0

      const searchableText = `
${item.category}
${item.pattern}
${item.impact}
`.toLowerCase()

      for (const [tag, keywords] of Object.entries(TACTICAL_KEYWORDS)) {
        const tagMatchesMemory =
          searchableText.includes(tag.toLowerCase()) ||
          keywords.some((keyword) =>
            searchableText.includes(keyword.toLowerCase())
          )

        if (!tagMatchesMemory) continue

        const tagMatchesInput =
          normalizedInput.includes(tag.toLowerCase()) ||
          keywords.some((keyword) =>
            normalizedInput.includes(keyword.toLowerCase())
          )

        if (tagMatchesInput) {
          keywordScore += 1
        }
      }

      const frequencyScore =
        Math.min(item.frequency, 10) / 10

      const severityScore =
        item.severityScore

      const recencyScore =
        getRecencyScore(item.lastSeen)

      const finalScore =
        keywordScore * 2 +
        frequencyScore * 1 +
        severityScore * 2 +
        recencyScore * 1

      return {
        item,
        score: finalScore,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  return scoredMemory
    .slice(0, MAX_MEMORY_ITEMS)
    .map((entry) => entry.item)
}