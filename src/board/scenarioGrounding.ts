import type { BoardObject } from "@/board/boardModel";
import { countTokensInZone, type ZoneRect } from "@/board/productBoardTypes";

export type ZoneSuperiority = {
  label: string;
  own: number;
  rival: number;
  delta: number; // own - rival (signed; + = own superiority)
  populated: boolean; // own + rival > 0 — the grounding atom
};

export type ScenarioGrounding = {
  zones: ZoneSuperiority[];
  hasGroundedMetrics: boolean;
};

export function computeScenarioGrounding(
  objects: BoardObject[],
  zones: Array<{ label: string; rect: ZoneRect }>,
): ScenarioGrounding {
  const rows: ZoneSuperiority[] = zones.map(({ label, rect }) => {
    const { own, rival } = countTokensInZone(objects, rect);
    return { label, own, rival, delta: own - rival, populated: own + rival > 0 };
  });
  // Grounding atom is EXACTLY "a zone counted real tokens" — never
  // zones.length > 0, never requiredZoneCount, never "rects were authored".
  return { zones: rows, hasGroundedMetrics: rows.some((z) => z.own + z.rival > 0) };
}

// Partial-grounding note derived from per-zone populated flags (no standalone
// requiredZoneCount field). Null when every authored zone is populated. An
// empty zone is never converted into evidence — same atom as above.
export function groundingSummary(g: ScenarioGrounding): string | null {
  const total = g.zones.length;
  const populated = g.zones.filter((z) => z.populated).length;
  if (total === 0 || populated === total) return null;
  return `Lectura parcial — ${populated} de ${total} zonas pobladas.`;
}
