import { distance, endpointPoint } from "./boardGeometry";
import type {
  BoardArrow,
  BoardArrowSemantic,
  BoardObject,
  BoardPoint,
  BoardScene,
} from "./boardModel";

/**
 * Pure playback engine for a board scene (W25A). See PLAYBACK-DESIGN.md for
 * the full model. Zero state, zero render, zero React — a deterministic
 * function of (scene, tSeconds). The drawn scene is the only source of
 * truth: this module never mutates or persists anything, it only samples.
 */

export type PlaybackMoveKind = "ball" | "player" | "both";

// Semantics that move the ball only (pass-like actions + the shot).
const BALL_MOVER_SEMANTICS = new Set<BoardArrowSemantic>([
  "pass",
  "longPass",
  "cross",
  "switch",
  "shot",
]);

// The one "both" mover: dribbling carries the token AND the ball together.
const BOTH_MOVER_SEMANTICS = new Set<BoardArrowSemantic>(["carry"]);

// Anything not explicitly a ball/both mover defaults to moving the origin
// token (player mover) — a deliberate catch-all so a future addition to the
// (aditivo) BoardArrowSemantic enum never needs a motor change.
export function classifyArrowMoveKind(
  semantic: BoardArrowSemantic,
): PlaybackMoveKind {
  if (BALL_MOVER_SEMANTICS.has(semantic)) return "ball";
  if (BOTH_MOVER_SEMANTICS.has(semantic)) return "both";
  return "player";
}

// Speed table (pitch-normalized units/second, same 0-100 space as
// boardGeometry's `distance` — never the 0-64 render-scaled space). See
// PLAYBACK-DESIGN.md §3 for the rationale of each value.
const SPEED_UNITS_PER_SECOND: Record<BoardArrowSemantic, number> = {
  shot: 95,
  pass: 65,
  cross: 62,
  longPass: 60,
  switch: 58,
  run: 24,
  pressure: 22,
  movement: 20,
  mark: 20,
  recovery: 20,
  cover: 18,
  support: 18,
  rotation: 16,
  carry: 15,
};

const BALL_DURATION_FLOOR = 0.35;
const BALL_DURATION_CEIL = 2.2;
const PLAYER_DURATION_FLOOR = 0.5;
const PLAYER_DURATION_CEIL = 3.5;

function computeDuration(
  kind: PlaybackMoveKind,
  semantic: BoardArrowSemantic,
  from: BoardPoint,
  to: BoardPoint,
): number {
  const speed = SPEED_UNITS_PER_SECOND[semantic];
  const raw = distance(from, to) / speed;
  const [floor, ceil] =
    kind === "ball"
      ? [BALL_DURATION_FLOOR, BALL_DURATION_CEIL]
      : [PLAYER_DURATION_FLOOR, PLAYER_DURATION_CEIL];
  return Math.min(Math.max(raw, floor), ceil);
}

// ease-in-out quadratic — natural accel/decel for every tramo (ball speed
// difference alone is what makes the ball feel "more alive", see design doc).
function easeInOutQuad(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - (-2 * clamped + 2) ** 2 / 2;
}

function lerpPoint(from: BoardPoint, to: BoardPoint, eased: number): BoardPoint {
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

export type PlaybackSegment = {
  arrowId: string;
  kind: PlaybackMoveKind;
  // Object ids this segment animates: 1 for ball/player, 2 for "both"
  // ([token, ball]). Empty when the arrow has no anchored token to move
  // (a free-point origin) — the segment still occupies time on the timeline.
  objectIds: string[];
  start: number;
  end: number;
  from: BoardPoint;
  to: BoardPoint;
};

export type PlaybackTimeline = {
  segments: PlaybackSegment[];
  duration: number;
};

function findBall(objects: BoardObject[]): BoardObject | undefined {
  return objects.find((object) => object.type === "ball");
}

// Chaining rule (PLAYBACK-DESIGN.md §2): a player/both mover immediately
// followed by a ball mover that targets the SAME token (as its anchored `to`
// endpoint) runs in parallel with it — "el desmarque corre en paralelo con
// el pase que lo busca". Any other adjacency stays strictly sequential.
function isChainedParallel(previous: BoardArrow, current: BoardArrow): boolean {
  const previousKind = classifyArrowMoveKind(previous.semantic);
  const currentKind = classifyArrowMoveKind(current.semantic);
  if (previousKind === "ball" || currentKind !== "ball") return false;
  if (previous.from.kind !== "object" || current.to.kind !== "object") {
    return false;
  }
  return previous.from.objectId === current.to.objectId;
}

export function buildPlaybackTimeline(scene: BoardScene): PlaybackTimeline {
  const ball = findBall(scene.objects);
  const segments: PlaybackSegment[] = [];

  let cursor = 0;
  let previousArrow: BoardArrow | null = null;
  let previousSegment: PlaybackSegment | null = null;

  for (const arrow of scene.arrows) {
    const kind = classifyArrowMoveKind(arrow.semantic);
    const from = endpointPoint(arrow.from, scene.objects);

    const chained =
      previousArrow !== null && isChainedParallel(previousArrow, arrow);

    // FIX (coordinator review, PLAYBACK-DESIGN.md §1 exception): a chained
    // ball mover's destination is the receiver's FINAL run position (the
    // previous, already-computed segment's `to`), never the static
    // endpointPoint — the receiver is running somewhere else in parallel,
    // so a static target sends the pass to empty space. Still a pure
    // function of (scene, t): `to` comes from a segment already resolved
    // in this same deterministic pass, never from an animated frame.
    const to =
      chained && previousSegment
        ? previousSegment.to
        : endpointPoint(arrow.to, scene.objects);
    const duration = computeDuration(kind, arrow.semantic, from, to);

    // Arrival sync (adopted refinement): a chained pass departs late enough
    // to LAND together with the run it targets, never before the run
    // itself starts — the real timing of a pass into space.
    const start =
      chained && previousSegment
        ? Math.max(previousSegment.end - duration, previousSegment.start)
        : cursor;
    const end = start + duration;

    const objectIds: string[] = [];
    if (kind === "ball" || kind === "both") {
      if (ball) objectIds.push(ball.id);
    }
    if (kind === "player" || kind === "both") {
      if (arrow.from.kind === "object") objectIds.push(arrow.from.objectId);
    }

    const segment: PlaybackSegment = {
      arrowId: arrow.id,
      kind,
      objectIds,
      start,
      end,
      from,
      to,
    };
    segments.push(segment);

    cursor = Math.max(cursor, end);
    previousArrow = arrow;
    previousSegment = segment;
  }

  return { segments, duration: cursor };
}

export type PlaybackFrame = {
  duration: number;
  // Only objects touched by at least one segment — callers fall back to the
  // object's own scene.position for anything absent here.
  positions: Record<string, BoardPoint>;
  // 0..1 progress per arrow at time t (0 before start, 1 once ended).
  arrowProgress: Record<string, number>;
};

export function samplePlayback(scene: BoardScene, tSeconds: number): PlaybackFrame {
  const { segments, duration } = buildPlaybackTimeline(scene);

  const positions: Record<string, BoardPoint> = {};
  const arrowProgress: Record<string, number> = {};

  // Segments are in creation/chaining order, not necessarily sorted by
  // start time (a chained segment can start before an earlier-in-array one
  // finishes, but never before it). Later entries in this loop for the SAME
  // objectId simply overwrite earlier ones, which is correct: at any given
  // t, an object's position is governed by whichever of its segments the
  // clock currently falls in (or the last one that already ended).
  for (const segment of segments) {
    const localT =
      segment.end === segment.start
        ? 1
        : (tSeconds - segment.start) / (segment.end - segment.start);
    const rawProgress = Math.min(1, Math.max(0, localT));
    arrowProgress[segment.arrowId] = rawProgress;

    if (segment.objectIds.length === 0) continue;
    if (tSeconds < segment.start) continue; // not started: leave to an earlier segment / scene default

    const eased = easeInOutQuad(rawProgress);
    const point = lerpPoint(segment.from, segment.to, eased);
    for (const objectId of segment.objectIds) {
      positions[objectId] = point;
    }
  }

  return { duration, positions, arrowProgress };
}
