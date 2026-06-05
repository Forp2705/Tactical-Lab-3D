import { loadKnowledgeBase } from "./loadKnowledgeBase.js"
import { rankDocumentsHybrid } from "./embeddingRetrieval.js"
import type { TacticalDomain } from "./CoachSchemas.js"

const MAX_KNOWLEDGE_ITEMS = 10

// Categorias de knowledge preferidas por dominio tactico. Cuando se conoce el
// dominio del problema (p. ej. buildUp), los conceptos de esas categorias
// reciben un bonus para que floten por encima del match generico por keyword,
// que tiende a traer conceptos de otras fases (presion/defensa) para preguntas
// de salida o ataque.
const DOMAIN_TO_CATEGORIES: Record<TacticalDomain, string[]> = {
  buildUp: ["build-up", "building-up", "relational-play", "direct-play", "principles-of-play"],
  attack: ["organized-attack", "relational-play", "principles-of-play", "crosses"],
  pressing: ["pressing", "high-block", "principles-of-play"],
  block: ["compactness", "block", "low-block", "defensive-systems", "principles-of-play"],
  defense: ["compactness", "block", "defensive-systems", "wide-defense", "principles-of-play"],
  defensiveTransition: ["defensive-transition", "rest-defense", "principles-of-play"],
  offensiveTransition: ["offensive-transition", "counter", "direct-play", "principles-of-play"],
  setPieces: ["set-pieces", "abp"],
  duels: ["duels", "defensive-systems"],
  systemLineup: ["defensive-systems", "principles-of-play", "game-management"],
  physicalEmotional: ["game-management", "principles-of-play"],
}

const DOMAIN_BONUS = 0.15

export async function retrieveRelevantKnowledge(
  userInput: string,
  domains: TacticalDomain[] = [],
) {
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

  // Pool amplio para luego priorizar por dominio sin descartar buenos matches.
  const ranked = await rankDocumentsHybrid(userInput, documents, {
    limit: MAX_KNOWLEDGE_ITEMS * 3,
  })

  if (!domains.length) {
    return ranked.slice(0, MAX_KNOWLEDGE_ITEMS)
  }

  const preferred = new Set(
    domains.flatMap((domain) => DOMAIN_TO_CATEGORIES[domain] ?? []),
  )

  return [...ranked]
    .map((document) => ({
      ...document,
      score: preferred.has(document.payload.category)
        ? document.score + DOMAIN_BONUS
        : document.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KNOWLEDGE_ITEMS)
}
