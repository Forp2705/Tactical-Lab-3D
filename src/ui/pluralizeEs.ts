// Presentation-only: keeps singular/plural noun concordance with a count
// instead of hardcoding the plural form (W21 #3, e.g. "1 guardadas").
export function pluralizeEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
