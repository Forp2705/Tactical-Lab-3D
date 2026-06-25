import type { ScenarioId, ScenarioSimulation } from "@/ai/scenarioSimulator";
import type {
  BoardArrow,
  BoardArrowEndpoint,
  BoardArrowSemantic,
  BoardObject,
  BoardScene,
  BoardZone,
  BoardZoneSemantic,
} from "@/board/boardModel";
import { isInsideZoneRect } from "@/board/productBoardTypes";

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

// Patch aliases = the factory param types verbatim (single source of truth).
export type OverlayZonePatch = Partial<
  Omit<BoardZone, "id" | "semantic" | "x" | "y" | "w" | "h">
>;
export type OverlayArrowPatch = Partial<
  Omit<BoardArrow, "id" | "semantic" | "from" | "to">
>;

export type OverlayZone = {
  semantic: BoardZoneSemantic;
  x: number;
  y: number;
  w: number;
  h: number;
  patch?: OverlayZonePatch;
};
export type OverlayArrow = {
  semantic: BoardArrowSemantic;
  from: BoardArrowEndpoint;
  to: BoardArrowEndpoint;
  patch?: OverlayArrowPatch;
};

export type ConsequenceOverlay = {
  scenarioId: ScenarioId;
  title: string;
  zones: OverlayZone[];
  arrows: OverlayArrow[];
  rivalFacts: string[];
  readout: {
    expectedBenefit: string;
    mainRisk: string;
    exposedPlayers: string[];
    confidence: "low" | "medium" | "high";
    evidenceLevel: "none" | "weak" | "partial" | "sufficient";
  };
  notes: string[];
};

const ZONE_W = 26; // normalized rect width for the authored bands
const ZONE_H = 30;

/** 2 deepest own tokens relative to dir, tiebroken toward the central lane. */
function resolveCentreBacks(
  scene: BoardScene,
  dir: 1 | -1,
): { backs: BoardObject[]; usedFallback: boolean } {
  const own = scene.objects.filter(isOwnPlayerToken).filter((o) => !isOwnGoalkeeper(o));
  const byRole = own.filter(isOwnCentreBack);
  if (byRole.length >= 2) return { backs: byRole.slice(0, 2), usedFallback: false };

  if (own.length < 2) return { backs: [], usedFallback: true };
  const laneY = own.reduce((s, o) => s + o.position.y, 0) / own.length;
  // "deepest relative to dir": dir 1 → smallest x is deepest; dir -1 → largest x.
  const depth = (o: BoardObject) => (dir === 1 ? o.position.x : -o.position.x);
  const sorted = [...own].sort((a, b) => {
    const d = depth(a) - depth(b);
    if (d !== 0) return d; // deeper first
    return Math.abs(a.position.y - laneY) - Math.abs(b.position.y - laneY); // then central
  });
  return { backs: sorted.slice(0, 2), usedFallback: true };
}

function clampRect(x: number, y: number, w: number, h: number) {
  const cx = Math.max(0, Math.min(x, 100 - w));
  const cy = Math.max(0, Math.min(y, 100 - h));
  return { x: cx, y: cy, w, h };
}

function baseReadout(simulation: ScenarioSimulation): ConsequenceOverlay["readout"] {
  return {
    expectedBenefit: simulation.expectedBenefit,
    mainRisk: simulation.mainRisk,
    exposedPlayers: simulation.exposedPlayers,
    confidence: simulation.confidence,
    evidenceLevel: simulation.evidenceLevel,
  };
}

type DrawBack = (simulation: ScenarioSimulation, scene: BoardScene) => ConsequenceOverlay;

const REGISTRY: Partial<Record<ScenarioId, DrawBack>> = {
  "raise-block": (simulation, scene) => {
    const notes: string[] = [];
    const { dir, note } = detectAttackDir(scene);
    if (note) notes.push(note);

    // 3) High-press band over the rival's build-up third (relative to dir).
    const pressX = dir === 1 ? 100 - ZONE_W : 0;
    const press = clampRect(pressX, 35, ZONE_W, ZONE_H);
    const zones: OverlayZone[] = [
      { semantic: "press", ...press, patch: { label: "Presión alta", layer: "press" } },
    ];

    const { backs, usedFallback } = resolveCentreBacks(scene, dir);
    if (usedFallback && backs.length) {
      notes.push("Centrales inferidos por posición (faltan roles en las fichas).");
    }

    const rivalFacts: string[] = [];
    const arrows: OverlayArrow[] = [];

    if (backs.length < 2) {
      notes.push("No pude ubicar los centrales en la escena.");
    } else {
      // 4) Gap band behind the CB line toward the own goal (relative to dir).
      const lineX = (backs[0].position.x + backs[1].position.x) / 2;
      const gapX = dir === 1 ? lineX - ZONE_W : lineX;
      const gap = clampRect(gapX, 35, ZONE_W, ZONE_H);
      zones.push({
        semantic: "danger",
        ...gap,
        patch: { label: "Espacio a la espalda", layer: "notes" },
      });

      // 5) Exposure check: own tokens covering the gap.
      const gapZoneRect = {
        ...gap,
        id: "tmp",
        semantic: "danger",
        label: "",
        shape: "rectangle",
        layer: "notes",
        color: "#000",
        style: {},
        visibility: "staff",
      } as unknown as BoardZone;
      const covering = scene.objects.filter(
        (o) =>
          isOwnPlayerToken(o) &&
          !backs.includes(o) &&
          isInsideZoneRect(o.position, gapZoneRect),
      ).length;

      // 6) Composed rival fact (real names + real count, "lectura del modelo").
      const names = backs.map((b) => b.label).join(" y ");
      const tail =
        covering === 0
          ? "detrás no queda ninguna cobertura → el rival ataca esa espalda con diagonal larga"
          : `detrás quedan ${covering} cobertura(s) → riesgo atenuado en esa espalda`;
      rivalFacts.push(`(lectura del modelo) Tus centrales ${names} suben; ${tail}.`);

      // 7) Threat arrow: longPass into the gap, anchored to a rival token if any.
      const rival = scene.objects.find((o) => o.type === "opponentToken");
      const from: BoardArrowEndpoint = rival
        ? { kind: "object", objectId: rival.id }
        : { kind: "point", point: { x: dir === 1 ? 100 - ZONE_W : ZONE_W, y: 50 } };
      const to: BoardArrowEndpoint = {
        kind: "point",
        point: { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 },
      };
      arrows.push({ semantic: "longPass", from, to, patch: { label: "Diagonal a la espalda" } });
    }

    return {
      scenarioId: "raise-block",
      title: simulation.title,
      zones,
      arrows,
      rivalFacts,
      readout: baseReadout(simulation),
      notes,
    };
  },
};

export function buildConsequenceOverlay(
  simulation: ScenarioSimulation,
  scene: BoardScene,
): ConsequenceOverlay {
  const draw = REGISTRY[simulation.scenarioId];
  if (!draw) {
    return {
      scenarioId: simulation.scenarioId,
      title: simulation.title,
      zones: [],
      arrows: [],
      rivalFacts: [],
      readout: baseReadout(simulation),
      notes: [
        `El draw-back de "${simulation.scenarioId}" todavía no está autorado (Slice 1 = raise-block).`,
      ],
    };
  }
  return draw(simulation, scene);
}
