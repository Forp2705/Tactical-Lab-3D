import type { ScenarioId, ScenarioSimulation } from "@/ai/scenarioSimulator";
import { bumpEvidenceLevel, gradeConfidence } from "@/ai/scenarioSimulator";
import type {
  BoardArrow,
  BoardArrowEndpoint,
  BoardArrowSemantic,
  BoardObject,
  BoardScene,
  BoardZone,
  BoardZoneSemantic,
} from "@/board/boardModel";
import { countTokensInZone, type ZoneRect } from "@/board/productBoardTypes";
import { computeScenarioGrounding, type ScenarioGrounding } from "@/board/scenarioGrounding";

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
 *
 * Cross-check (Tier 1 ↔ Tier 2): when both the GK and a rival exist, the
 *   centroid is an independent mass signal. If it contradicts the GK, the lone
 *   GK token is the suspect (one stray token shouldn't flip the whole reading
 *   in silence) → prefer the centroid and emit a note. Non-circular: the
 *   centroid uses mass-vs-rival, never "depth" — the quantity being derived.
 *   Guard: a near-tie between the centroids carries no separation signal, so it
 *   is too weak to override Tier-1 — the GK stands (no degrading a real signal
 *   with a non-signal). The weak centroid still serves the no-GK Tier-2 path.
 */
// Normalized pitch units; below this the own/rival centroids are effectively
// co-located → no usable separation to arbitrate orientation with.
const CENTROID_EPSILON = 1;

export function detectAttackDir(scene: BoardScene): { dir: 1 | -1; note?: string } {
  const own = scene.objects.filter(isOwnPlayerToken);
  const rival = scene.objects.filter((o) => o.type === "opponentToken");

  const ownX = centroidX(own);
  const rivalX = centroidX(rival);
  const centroidDir: 1 | -1 | null =
    ownX !== null && rivalX !== null ? (ownX <= rivalX ? 1 : -1) : null;
  const centroidStrong =
    ownX !== null && rivalX !== null && Math.abs(ownX - rivalX) >= CENTROID_EPSILON;

  const gk = own.find(isOwnGoalkeeper);
  if (gk) {
    // GK on the left half (x < 50) → own goal is left → attack toward +x.
    const gkDir: 1 | -1 = gk.position.x < 50 ? 1 : -1;
    if (centroidStrong && centroidDir !== gkDir) {
      return {
        dir: centroidDir as 1 | -1,
        note: "El arquero contradice la masa del equipo respecto al rival; uso el centroide para fijar la orientación.",
      };
    }
    return { dir: gkDir };
  }

  if (centroidDir !== null) {
    return { dir: centroidDir };
  }

  return {
    dir: 1,
    note: "Orientación asumida (+x hacia adelante): sin arquero ni rival en la escena.",
  };
}

export type RivalActors = {
  passer: BoardObject | null;
  runner: BoardObject | null;
  wide: BoardObject | null;
  count: number;
};

/**
 * Rivals attack toward -dir (mirror of own). depth = dir * x → higher means
 * deeper on the rival's build-up side. NOT resolveCentreBacks (that is own,
 * relative to dir). passer = deepest; runner = most advanced; wide = widest
 * of the rest (only meaningful with a 3rd rival to spend on a channel run).
 */
export function resolveRivalActors(scene: BoardScene, dir: 1 | -1): RivalActors {
  const rivals = scene.objects.filter((o) => o.type === "opponentToken");
  const count = rivals.length;
  if (count === 0) return { passer: null, runner: null, wide: null, count };

  const depth = (o: BoardObject) => dir * o.position.x;
  const sorted = [...rivals].sort((a, b) => depth(b) - depth(a)); // deepest first
  const passer = sorted[0];
  if (count === 1) return { passer, runner: null, wide: null, count };

  const runner = sorted[sorted.length - 1]; // most advanced toward own goal
  let wide: BoardObject | null = null;
  if (count >= 3) {
    const rest = sorted.slice(1, sorted.length - 1); // exclude passer & runner
    wide = rest.reduce(
      (best, o) =>
        Math.abs(o.position.y - 50) > Math.abs(best.position.y - 50) ? o : best,
      rest[0],
    );
  }
  return { passer, runner, wide, count };
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
    grounding: ScenarioGrounding;
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
    grounding: { zones: [], hasGroundedMetrics: false },
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

    // Grounding draws from the SAME authored rects (press always; gap when the
    // CB line is resolvable). No recomputed "equivalent" rects — same refs.
    const groundingZones: Array<{ label: string; rect: ZoneRect }> = [
      { label: "Presión alta", rect: press },
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
      groundingZones.push({ label: "Espacio a la espalda", rect: gap });

      // 5) Exposure check: own tokens (excluding the CBs that vacated the line)
      //    covering the gap — routed through the single membership counter.
      const ownBehind = scene.objects.filter(
        (o) => isOwnPlayerToken(o) && !backs.includes(o),
      );
      const covering = countTokensInZone(ownBehind, gap).own;

      // 6) Composed rival fact (real names + real count, "lectura del modelo").
      const names = backs.map((b) => b.label).join(" y ");
      const tail =
        covering === 0
          ? "detrás no queda ninguna cobertura → el rival ataca esa espalda con diagonal larga"
          : `detrás quedan ${covering} cobertura(s) → riesgo atenuado en esa espalda`;
      rivalFacts.push(`(lectura del modelo) Tus centrales ${names} suben; ${tail}.`);

      // 7) Coordinated rival response. Single source of truth for the target:
      //    longPass (ball) and primary run (player) both resolve to gapTarget.
      const gapTarget = { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 };
      const actors = resolveRivalActors(scene, dir);

      if (actors.count === 0) {
        notes.push("Sin rivales en la escena: no puedo proyectar la respuesta.");
      } else if (actors.passer) {
        arrows.push({
          semantic: "longPass",
          from: { kind: "object", objectId: actors.passer.id },
          to: { kind: "point", point: gapTarget },
          patch: { label: "Diagonal a la espalda", layer: "rival" },
        });

        if (actors.runner) {
          arrows.push({
            semantic: "run",
            from: { kind: "object", objectId: actors.runner.id },
            to: { kind: "point", point: gapTarget },
            patch: { label: "Ataca tu espalda", layer: "rival" },
          });
        } else {
          notes.push("Solo 1 rival: no puedo mostrar la corrida coordinada.");
        }

        if (actors.wide) {
          // Same behind-the-line depth as the gap, but in the wide actor's lane.
          const channelY = actors.wide.position.y < 50 ? gap.y : gap.y + gap.h;
          arrows.push({
            semantic: "run",
            from: { kind: "object", objectId: actors.wide.id },
            to: {
              kind: "point",
              point: { x: gapTarget.x, y: Math.max(0, Math.min(100, channelY)) },
            },
            patch: { label: "Ataca el carril", layer: "rival" },
          });
        }
      }
    }

    // Re-grade with board-derived superiority over the SAME drawn rects. The
    // simulator already graded "low" (metrics null); grounding is the one extra
    // evidence source the board can honestly supply. Lift ONLY when a zone
    // counted real tokens — empty/outside rects keep confidence low + no lift.
    const grounding = computeScenarioGrounding(scene.objects, groundingZones);
    const riskCount = simulation.fitFindings.filter((f) => f.level === "risk").length;
    const evidenceLevel = grounding.hasGroundedMetrics
      ? bumpEvidenceLevel(simulation.evidenceLevel, 1) // grounding = exactly one source
      : simulation.evidenceLevel;
    const confidence = gradeConfidence({
      hasGroundedMetrics: grounding.hasGroundedMetrics,
      evidenceLevel,
      riskCount,
    });

    return {
      scenarioId: "raise-block",
      title: simulation.title,
      zones,
      arrows,
      rivalFacts,
      readout: { ...baseReadout(simulation), confidence, evidenceLevel, grounding },
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
