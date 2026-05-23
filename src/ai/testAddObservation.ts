import { addMatchObservation } from "./addMatchObservation"
import { MATCH_OBSERVATIONS_STORE } from "./MatchObservationsStore"

addMatchObservation({
  matchId: "vs-reserva-001",
  minute: 34,
  phase: "defensive-transition",
  observation:
    "Los delanteros retroceden antes de activar presión y el bloque se hunde.",
  severity: "high",
  tags: ["strikers", "pressing", "block", "compactness"],
})

console.log(MATCH_OBSERVATIONS_STORE)