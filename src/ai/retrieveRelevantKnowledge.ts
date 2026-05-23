import { loadKnowledgeBase } from "./loadKnowledgeBase.js"
import { TACTICAL_KEYWORDS } from "./tacticalKeywords.js"

const MAX_KNOWLEDGE_ITEMS = 5

export async function retrieveRelevantKnowledge(userInput: string) {
  const knowledgeBase = await loadKnowledgeBase()
  const normalizedInput = userInput.toLowerCase()

  const scoredKnowledge = knowledgeBase
    .map((item) => {
      let score = 0

      for (const tag of item.tags) {
        const keywords = TACTICAL_KEYWORDS[tag] ?? [tag]

        for (const keyword of keywords) {
          if (normalizedInput.includes(keyword.toLowerCase())) {
            score += 1
          }
        }
      }

      return {
        item,
        score,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  return scoredKnowledge
    .slice(0, MAX_KNOWLEDGE_ITEMS)
    .map((entry) => entry.item)
}
