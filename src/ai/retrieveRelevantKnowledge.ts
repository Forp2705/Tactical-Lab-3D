import { loadKnowledgeBase } from "./loadKnowledgeBase.js"
import { rankDocuments } from "./retrievalScoring.js"

const MAX_KNOWLEDGE_ITEMS = 5

export async function retrieveRelevantKnowledge(userInput: string) {
  const knowledgeBase = await loadKnowledgeBase()
  const documents = knowledgeBase.map((item, index) => ({
    id: `KN-${item.category}-${index + 1}`,
    sourceType: "knowledge" as const,
    title: `${item.category}: ${item.principle.slice(0, 80)}`,
    text: [
      item.category,
      item.principle,
      item.context,
      item.risk,
      item.tags.join(" "),
    ].join("\n"),
    tags: item.tags,
    payload: item,
    authorityScore: 0.8,
  }))

  return rankDocuments(userInput, documents, {
    limit: MAX_KNOWLEDGE_ITEMS,
  })
}
