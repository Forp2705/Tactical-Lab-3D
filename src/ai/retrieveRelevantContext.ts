import { MATCH_OBSERVATIONS } from "./MatchObservations.js"
import { loadSavedPostMatchReports } from "./post-match/storage.js"
import { TACTICAL_KEYWORDS } from "./tacticalKeywords.js"

type MatchObservation = {
  match: string
  minute?: number
  phase: string
  tags: string[]
  observation: string
}

export async function retrieveRelevantContext(userInput: string) {
  const normalizedInput = userInput.toLowerCase()
  const runtimeObservations =
    await loadRuntimeMatchObservations()
  const observations = [
    ...runtimeObservations,
    ...MATCH_OBSERVATIONS,
  ]

  return observations.filter((observation) => {
    const searchableObservation = `
${observation.phase}
${observation.observation}
${observation.tags.join(" ")}
`.toLowerCase()

    return observation.tags.some((tag) => {
      const keywords = TACTICAL_KEYWORDS[tag] ?? [tag]

      return keywords.some((keyword) =>
        normalizedInput.includes(keyword.toLowerCase()) ||
        searchableObservation.includes(keyword.toLowerCase())
      )
    }) || normalizedInput
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .some((token) =>
        searchableObservation.includes(token.toLowerCase())
      )
  })
}

async function loadRuntimeMatchObservations() {
  try {
    const reports = await loadSavedPostMatchReports()
    return reports.flatMap((savedReport) => {
      const opponent = savedReport.report.matchContext.opponent
      const result = savedReport.report.matchContext.result
      const staffNotes =
        savedReport.sourceInput?.staffNotes?.trim() ||
        savedReport.staffReview.notes?.trim()
      const tagsFromReport = buildTagObservations(savedReport)
      const notesObservation = staffNotes
        ? [buildNotesObservation(opponent, result, staffNotes)]
        : []

      return [
        ...tagsFromReport,
        ...notesObservation,
      ]
    })
  } catch {
    return []
  }
}

function buildTagObservations(
  savedReport: Awaited<
    ReturnType<typeof loadSavedPostMatchReports>
  >[number],
): MatchObservation[] {
  const opponent = savedReport.report.matchContext.opponent
  const result = savedReport.report.matchContext.result

  return (savedReport.sourceInput?.tags ?? [])
    .map((tag) => {
      const text = [
        tag.label,
        tag.zone,
        tag.note,
      ]
        .filter(Boolean)
        .join(" | ")
      const tags = inferObservationTags(text)

      if (!text.trim() || !tags.length) {
        return null
      }

      const observation: MatchObservation = {
        match: `vs ${opponent}`,
        phase: "Post match tag",
        tags,
        observation: `[${result}] ${text}`,
      }

      if (typeof tag.minute === "number") {
        observation.minute = tag.minute
      }

      return observation
    })
    .filter((entry): entry is MatchObservation => entry !== null)
}

function buildNotesObservation(
  opponent: string,
  result: string,
  notes: string,
): MatchObservation {
  return {
    match: `vs ${opponent}`,
    phase: "Staff notes",
    tags: inferObservationTags(notes),
    observation: `[${result}] ${notes}`,
  }
}

function inferObservationTags(text: string) {
  const normalized = text.toLowerCase()

  return Object.entries(TACTICAL_KEYWORDS)
    .filter(([tag, keywords]) =>
      normalized.includes(tag.toLowerCase()) ||
      keywords.some((keyword) =>
        normalized.includes(keyword.toLowerCase())
      )
    )
    .map(([tag]) => tag)
}
