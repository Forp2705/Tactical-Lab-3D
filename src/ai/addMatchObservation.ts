import { MatchObservationSchema } from "./CoachSchemas"
import { MATCH_OBSERVATIONS_STORE } from "./MatchObservationsStore"

// Dev-only helper used by test/build scripts to accumulate observations
// before consolidating tactical memory.
export function addMatchObservation(input: unknown) {
  const observation = MatchObservationSchema.parse(input)

  MATCH_OBSERVATIONS_STORE.push(observation)

  return observation
}
