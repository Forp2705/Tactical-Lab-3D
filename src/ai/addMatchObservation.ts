import { MatchObservationSchema } from "./CoachSchemas"
import { MATCH_OBSERVATIONS_STORE } from "./MatchObservationsStore"

export function addMatchObservation(input: unknown) {
  const observation = MatchObservationSchema.parse(input)

  MATCH_OBSERVATIONS_STORE.push(observation)

  return observation
}