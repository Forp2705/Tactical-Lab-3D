import type { TacticalDomain } from "@/ai/CoachSchemas";
import type { TeamPattern } from "@/ai/patternDetection";
import type { PitchOverlay } from "@/ui/tacticalPrimitives";

// Coordinate convention matches PitchViz's 0-100/0-64 viewBox and the rest of
// the app: x:0 = propio arco, x:100 = arco rival. Only domains with a
// spatially reliable meaning get an overlay; the rest fall back to neutral
// (no fabricated location) in derivePatternPitchOverlays below.
const DOMAIN_OVERLAYS: Partial<Record<TacticalDomain, PitchOverlay[]>> = {
  buildUp: [
    { type: "zone", x: 8, y: 14, w: 26, h: 36, tone: "info", label: "salida propia" },
  ],
  block: [
    { type: "zone", x: 10, y: 16, w: 30, h: 32, tone: "info", label: "bloque propio" },
  ],
  pressing: [
    { type: "blockHeight", x: 70, tone: "warn", label: "altura de presion" },
    { type: "zone", x: 60, y: 10, w: 32, h: 44, tone: "warn", label: "presion alta" },
  ],
  defensiveTransition: [
    { type: "zone", x: 38, y: 18, w: 24, h: 28, tone: "danger", label: "transicion defensiva" },
  ],
  offensiveTransition: [
    { type: "zone", x: 50, y: 16, w: 24, h: 32, tone: "warn", label: "transicion ofensiva" },
  ],
  attack: [
    { type: "zone", x: 66, y: 12, w: 28, h: 40, tone: "warn", label: "ataque" },
  ],
  setPieces: [
    { type: "zone", x: 78, y: 18, w: 18, h: 28, tone: "danger", label: "area" },
  ],
};

export type PatternPitchOverlays = {
  overlays: PitchOverlay[];
  confirmed: boolean;
};

export function derivePatternPitchOverlays(
  pattern?: TeamPattern,
): PatternPitchOverlays {
  if (!pattern) return { overlays: [], confirmed: false };
  const overlays = DOMAIN_OVERLAYS[pattern.domain];
  if (!overlays || !overlays.length) return { overlays: [], confirmed: false };
  return { overlays, confirmed: true };
}
