import { MATCH_OBSERVATIONS } from "./MatchObservations.js"
import { TACTICAL_KEYWORDS } from "./tacticalKeywords.js"

export function retrieveRelevantContext(userInput: string) {
  const normalizedInput = userInput.toLowerCase()

  return MATCH_OBSERVATIONS.filter((observation) => {
    return observation.tags.some((tag) => {
      const keywords = TACTICAL_KEYWORDS[tag] ?? [tag]

      return keywords.some((keyword) =>
        normalizedInput.includes(keyword.toLowerCase())
      )
    })
  })
}
