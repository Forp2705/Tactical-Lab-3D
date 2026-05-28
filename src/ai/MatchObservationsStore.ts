import type { MatchObservation } from "./CoachSchemas"

// Dev-only in-memory buffer used by observation/memory build scripts.
// It is not part of the runtime post-match UI flow.
export const MATCH_OBSERVATIONS_STORE: MatchObservation[] = []
