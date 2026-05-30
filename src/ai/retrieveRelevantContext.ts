import { MATCH_OBSERVATIONS } from "./MatchObservations.js"
import { loadSavedPostMatchReports } from "./post-match/storage.js"
import { rankDocuments } from "./retrievalScoring.js"
import { TACTICAL_KEYWORDS } from "./tacticalKeywords.js"

type MatchObservation = {
  match: string
  minute?: number
  phase: string
  tags: string[]
  observation: string
}

export async function retrieveRelevantContext(userInput: string) {
  const runtimeObservations =
    await loadRuntimeMatchObservations()
  const observations = [
    ...runtimeObservations,
    ...MATCH_OBSERVATIONS,
  ]

  const documents = observations.map((observation, index) => ({
    id: `OBS-${index + 1}-${slug(observation.match)}`,
    sourceType: "observation" as const,
    title: `${observation.match} | ${observation.phase}${typeof observation.minute === "number" ? ` | ${observation.minute}'` : ""}`,
    text: [
      observation.match,
      observation.phase,
      observation.observation,
      observation.tags.join(" "),
    ].join("\n"),
    tags: observation.tags,
    payload: observation,
    authorityScore: observation.match.startsWith("vs ") ? 0.75 : 0.45,
  }))

  return rankDocuments(userInput, documents, {
    limit: 6,
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

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
