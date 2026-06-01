import type { Vec2 } from "@/data";
import { pitchDimensions, pitchToWorld } from "@/viewer/lib/coords";

export type ShapeMetricChip = {
  id: string;
  role: string;
  pos: Vec2;
};

export type RivalMetricChip = {
  id: string;
  role: string;
  pos: Vec2;
};

export type HeatmapCell = {
  id: string;
  x: number;
  z: number;
  value: number;
};

export type TacticalLineMetrics = {
  defense?: number;
  midfield?: number;
  attack?: number;
  defenseToMidfield?: number;
  midfieldToAttack?: number;
  defenseToAttack?: number;
};

export type TacticalMetrics = {
  width: number;
  depth: number;
  compactness: number;
  duels: number;
  heatScore: number;
  blockHeight: number;
  center: { x: number; z: number };
  lineDistances: TacticalLineMetrics;
};

export function computeMetrics(
  own: ShapeMetricChip[],
  rivals: RivalMetricChip[] = [],
): TacticalMetrics {
  if (own.length === 0) {
    return emptyMetrics();
  }

  const ownWorld = own.map((chip) => pitchToWorld(chip.pos, "full"));
  const minX = Math.min(...ownWorld.map((point) => point.x));
  const maxX = Math.max(...ownWorld.map((point) => point.x));
  const minZ = Math.min(...ownWorld.map((point) => point.z));
  const maxZ = Math.max(...ownWorld.map((point) => point.z));
  const center = {
    x: ownWorld.reduce((sum, point) => sum + point.x, 0) / ownWorld.length,
    z: ownWorld.reduce((sum, point) => sum + point.z, 0) / ownWorld.length,
  };
  const compactness =
    ownWorld.reduce(
      (sum, point) => sum + Math.hypot(point.x - center.x, point.z - center.z),
      0,
    ) / ownWorld.length;
  const heatmap = computeHeatmapCells(own, rivals);
  const heatScore =
    heatmap.reduce((sum, cell) => sum + cell.value, 0) /
    Math.max(1, heatmap.length);

  return {
    width: maxZ - minZ,
    depth: maxX - minX,
    compactness,
    duels: countLikelyDuels(own, rivals),
    heatScore: heatScore * 100,
    blockHeight: center.x + pitchDimensions("full").length / 2,
    center,
    lineDistances: computeLineDistances(own),
  };
}

export function computeHeatmapCells(
  own: Array<{ pos: Vec2 }>,
  rivals: Array<{ pos: Vec2 }> = [],
): HeatmapCell[] {
  const { length, width } = pitchDimensions("full");
  const all = [...own, ...rivals].map((chip) => pitchToWorld(chip.pos, "full"));
  const cells: HeatmapCell[] = [];

  for (let x = -length / 2 + 12; x <= length / 2 - 12; x += 18) {
    for (let z = -width / 2 + 10; z <= width / 2 - 10; z += 14) {
      const nearest = Math.min(
        ...(all.length
          ? all.map((point) => Math.hypot(point.x - x, point.z - z))
          : [18]),
      );
      const value = Math.max(0, Math.min(1, (nearest - 4) / 14));
      cells.push({ id: `heat-${x}-${z}`, x, z, value });
    }
  }

  return cells;
}

export function countLikelyDuels(
  own: ShapeMetricChip[],
  rivals: RivalMetricChip[] = [],
) {
  const pairs = new Set<string>();

  for (const rival of rivals) {
    const rivalWorld = pitchToWorld(rival.pos, "full");
    const nearest = own
      .map((chip) => {
        const ownWorld = pitchToWorld(chip.pos, "full");
        return {
          playerId: chip.id,
          distance: Math.hypot(
            ownWorld.x - rivalWorld.x,
            ownWorld.z - rivalWorld.z,
          ),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance < 3.8) {
      pairs.add(`${nearest.playerId}-${rival.id}`);
    }
  }

  return pairs.size;
}

export function computeLineDistances(own: ShapeMetricChip[]): TacticalLineMetrics {
  const defense = averageLineX(own.filter((chip) => isDefenderRole(chip.role)));
  const midfield = averageLineX(own.filter((chip) => isMidfieldRole(chip.role)));
  const attack = averageLineX(own.filter((chip) => isAttackRole(chip.role)));

  return {
    defense,
    midfield,
    attack,
    defenseToMidfield: distanceBetweenLines(defense, midfield),
    midfieldToAttack: distanceBetweenLines(midfield, attack),
    defenseToAttack: distanceBetweenLines(defense, attack),
  };
}

function averageLineX(chips: ShapeMetricChip[]) {
  if (!chips.length) return undefined;
  const world = chips.map((chip) => pitchToWorld(chip.pos, "full"));
  return world.reduce((sum, point) => sum + point.x, 0) / world.length;
}

function distanceBetweenLines(a?: number, b?: number) {
  if (a === undefined || b === undefined) return undefined;
  return Math.abs(a - b);
}

function emptyMetrics(): TacticalMetrics {
  return {
    width: 0,
    depth: 0,
    compactness: 0,
    duels: 0,
    heatScore: 0,
    blockHeight: 0,
    center: { x: 0, z: 0 },
    lineDistances: {},
  };
}

function isDefenderRole(role: string) {
  const normalized = role.toUpperCase();
  return normalized === "GK" || normalized.includes("B") || normalized.includes("WB");
}

function isMidfieldRole(role: string) {
  const normalized = role.toUpperCase();
  return normalized.includes("M") || normalized.includes("PIVOT");
}

function isAttackRole(role: string) {
  const normalized = role.toUpperCase();
  return normalized.includes("ST") || normalized.includes("W") || normalized.includes("9");
}
