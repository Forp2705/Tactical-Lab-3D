// Presentation-only: collapses a min-max player range into a single honest
// string instead of always showing "N-N" when both bounds are equal (W21 #2).
export function formatPlayerRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}
