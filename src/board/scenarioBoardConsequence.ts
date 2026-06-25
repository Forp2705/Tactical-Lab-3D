import type { BoardObject, BoardScene } from "@/board/boardModel";

const GK_ROLE = /\b(gk|arquero|portero|golero)\b/i;
const CB_ROLE = /\b(cb|dfc|central|centre[-\s]?back|center[-\s]?back)\b/i;

export function isOwnPlayerToken(o: BoardObject): boolean {
  return o.type === "playerToken";
}
export function isOwnGoalkeeper(o: BoardObject): boolean {
  return isOwnPlayerToken(o) && !!o.role && GK_ROLE.test(o.role);
}
export function isOwnCentreBack(o: BoardObject): boolean {
  return isOwnPlayerToken(o) && !!o.role && CB_ROLE.test(o.role);
}

function centroidX(objects: BoardObject[]): number | null {
  if (objects.length === 0) return null;
  return objects.reduce((sum, o) => sum + o.position.x, 0) / objects.length;
}

/**
 * dir = 1 → own team attacks toward +x ; dir = -1 → toward -x.
 * Tier 1 (primary): own GK by ROLE. Its x marks the own-goal side → attack
 *   the opposite way. (No "deepest token": deep presupposes the direction.)
 * Tier 2 (fallback): own centroid vs rival centroid. Own behind → attack
 *   toward the rival side.
 * Tier 3 (floor): no GK and no rival → dir 1 with an honest note.
 */
export function detectAttackDir(scene: BoardScene): { dir: 1 | -1; note?: string } {
  const own = scene.objects.filter(isOwnPlayerToken);
  const rival = scene.objects.filter((o) => o.type === "opponentToken");

  const gk = own.find(isOwnGoalkeeper);
  if (gk) {
    // GK on the left half (x < 50) → own goal is left → attack toward +x.
    return { dir: gk.position.x < 50 ? 1 : -1 };
  }

  const ownX = centroidX(own);
  const rivalX = centroidX(rival);
  if (ownX !== null && rivalX !== null) {
    return { dir: ownX <= rivalX ? 1 : -1 };
  }

  return {
    dir: 1,
    note: "Orientación asumida (+x hacia adelante): sin arquero ni rival en la escena.",
  };
}
