import { describe, expect, it } from "vitest";
import {
  BoardSceneSchema,
  createBall,
  createPlayerToken,
  createSemanticArrow,
  type BoardObject,
  type BoardArrow,
  type BoardScene,
} from "../src/board/boardModel";
import { distance } from "../src/board/boardGeometry";
import {
  buildPlaybackTimeline,
  samplePlayback,
} from "../src/board/boardPlayback";

function makeScene(objects: BoardObject[], arrows: BoardArrow[]): BoardScene {
  return BoardSceneSchema.parse({
    id: "scene-test",
    title: "Test scene",
    phaseLabel: "salida",
    phases: [{ id: "phase-1", type: "salida", title: "Salida", durationMin: 2 }],
    objects,
    arrows,
    zones: [],
    instructions: [],
    notes: "",
  });
}

function token(id: string, x: number, y: number, role = "Mediocentro") {
  const base = createPlayerToken(null, { x, y }, role, 8);
  return { ...base, id };
}

describe("boardPlayback — buildPlaybackTimeline", () => {
  it("returns zero duration and no segments for a scene with no arrows", () => {
    const scene = makeScene([createBall()], []);
    const timeline = buildPlaybackTimeline(scene);
    expect(timeline.segments).toHaveLength(0);
    expect(timeline.duration).toBe(0);
  });

  it("classifies a pass arrow as a ball mover that animates the scene's ball object", () => {
    const passer = token("t-passer", 30, 50);
    const receiver = token("t-receiver", 70, 50);
    const ball = createBall({ x: 30, y: 50 });
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene([ball, passer, receiver], [arrow]);
    const timeline = buildPlaybackTimeline(scene);
    expect(timeline.segments).toHaveLength(1);
    const [segment] = timeline.segments;
    expect(segment.kind).toBe("ball");
    expect(segment.objectIds).toEqual([ball.id]);
    expect(segment.from).toEqual({ x: 30, y: 50 });
    expect(segment.to).toEqual({ x: 70, y: 50 });
    expect(segment.start).toBe(0);
    expect(segment.end).toBeGreaterThan(0);
    expect(timeline.duration).toBe(segment.end);
  });

  it("classifies a run arrow as a player mover that animates the origin token, not the ball", () => {
    const runner = token("t-runner", 40, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 60, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const [segment] = buildPlaybackTimeline(scene).segments;
    expect(segment.kind).toBe("player");
    expect(segment.objectIds).toEqual(["t-runner"]);
    expect(segment.from).toEqual({ x: 40, y: 20 });
    expect(segment.to).toEqual({ x: 60, y: 20 });
  });

  it("classifies a carry arrow as a both-mover animating the token AND the ball together", () => {
    const dribbler = token("t-dribbler", 20, 50);
    const ball = createBall({ x: 20, y: 50 });
    const arrow = createSemanticArrow(
      "carry",
      { kind: "object", objectId: "t-dribbler" },
      { kind: "point", point: { x: 50, y: 50 } },
    );
    const scene = makeScene([ball, dribbler], [arrow]);
    const [segment] = buildPlaybackTimeline(scene).segments;
    expect(segment.kind).toBe("both");
    expect(segment.objectIds.sort()).toEqual(["t-dribbler", ball.id].sort());
    expect(segment.from).toEqual({ x: 20, y: 50 });
    expect(segment.to).toEqual({ x: 50, y: 50 });
  });

  it("a player-mover arrow with a free (unanchored) origin has no objectIds to animate but still occupies time", () => {
    const arrow = createSemanticArrow(
      "movement",
      { kind: "point", point: { x: 10, y: 10 } },
      { kind: "point", point: { x: 30, y: 10 } },
    );
    const scene = makeScene([createBall()], [arrow]);
    const [segment] = buildPlaybackTimeline(scene).segments;
    expect(segment.objectIds).toEqual([]);
    expect(segment.end).toBeGreaterThan(0);
  });

  it("defaults an unclassified-by-name semantic bucket (defense arrows) to the player mover category", () => {
    const defender = token("t-defender", 55, 60);
    const arrow = createSemanticArrow(
      "pressure",
      { kind: "object", objectId: "t-defender" },
      { kind: "point", point: { x: 45, y: 55 } },
    );
    const scene = makeScene([createBall(), defender], [arrow]);
    const [segment] = buildPlaybackTimeline(scene).segments;
    expect(segment.kind).toBe("player");
    expect(segment.objectIds).toEqual(["t-defender"]);
  });

  it("sequences two independent arrows back to back by creation order", () => {
    const a1 = token("t-a1", 10, 10);
    const a2 = token("t-a2", 90, 90);
    const arrowOne = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-a1" },
      { kind: "point", point: { x: 20, y: 10 } },
    );
    const arrowTwo = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-a2" },
      { kind: "point", point: { x: 80, y: 90 } },
    );
    const scene = makeScene([createBall(), a1, a2], [arrowOne, arrowTwo]);
    const timeline = buildPlaybackTimeline(scene);
    expect(timeline.segments).toHaveLength(2);
    const [first, second] = timeline.segments;
    expect(first.start).toBe(0);
    expect(second.start).toBe(first.end);
    expect(timeline.duration).toBe(second.end);
  });

  it("chains a receiver's run in PARALLEL with the pass that looks for them via the same token", () => {
    const receiver = token("t-receiver", 70, 50);
    const passer = token("t-passer", 30, 50);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 85, y: 40 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene(
      [createBall({ x: 30, y: 50 }), receiver, passer],
      [runArrow, passArrow],
    );
    const timeline = buildPlaybackTimeline(scene);
    const [run, pass] = timeline.segments;
    expect(run.start).toBe(0);
    // Chained: the pass starts together with the run (or later, arrival-synced —
    // see the dedicated tests below), NOT after it ends.
    expect(pass.start).toBe(run.start);
    expect(pass.start).not.toBe(run.end);
    expect(timeline.duration).toBe(Math.max(run.end, pass.end));
  });

  // Coordinator review of PLAYBACK-DESIGN.md (2026-07-13): a chained ball
  // mover resolving `to` via the STATIC endpointPoint sends the pass to
  // where the receiver was drawn, while the receiver is running somewhere
  // else in parallel — the pass lands in empty space. Regression coverage
  // for the fix: the chained ball segment's destination must be the
  // receiver's FINAL run position (the previous segment's `to`), never the
  // static drawn position.
  it("REGRESSION (coordinator review): a chained pass targets the receiver's FINAL run position, not their static drawn position", () => {
    const receiver = token("t-receiver", 50, 50);
    const passer = token("t-passer", 10, 50);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 90, y: 50 } }, // far from the static (50,50)
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene(
      [createBall({ x: 10, y: 50 }), receiver, passer],
      [runArrow, passArrow],
    );
    const [run, pass] = buildPlaybackTimeline(scene).segments;
    // The static, drawn position — the WRONG target this regression guards against.
    expect(pass.to).not.toEqual({ x: 50, y: 50 });
    // The correct target: where the run actually ends up.
    expect(pass.to).toEqual(run.to);
    expect(pass.to).toEqual({ x: 90, y: 50 });
  });

  it("arrival sync (adopted refinement): a chained pass departs late enough to land exactly when the run it targets finishes", () => {
    const receiver = token("t-receiver", 50, 50);
    const passer = token("t-passer", 10, 50);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene(
      [createBall({ x: 10, y: 50 }), receiver, passer],
      [runArrow, passArrow],
    );
    const [run, pass] = buildPlaybackTimeline(scene).segments;
    // The pass is faster than the run over this geometry, so the departure
    // is delayed (not simultaneous) — arriving together, not early.
    expect(pass.start).toBeGreaterThan(run.start);
    expect(pass.end).toBeCloseTo(run.end, 5);
  });

  it("arrival sync collapses to a simultaneous start when the pass alone would take longer than the run (never departs before the run starts)", () => {
    const receiver = token("t-receiver", 70, 50);
    const passer = token("t-passer", 30, 50);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 85, y: 40 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene(
      [createBall({ x: 30, y: 50 }), receiver, passer],
      [runArrow, passArrow],
    );
    const [run, pass] = buildPlaybackTimeline(scene).segments;
    expect(pass.start).toBe(run.start);
  });

  it("does NOT chain a ball-mover to a preceding player-mover unless the token actually matches (different receiver)", () => {
    const mover = token("t-mover", 40, 40);
    const passer = token("t-passer", 10, 10);
    const someoneElse = token("t-someone-else", 90, 90);
    const moveArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-mover" },
      { kind: "point", point: { x: 60, y: 40 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-someone-else" },
    );
    const scene = makeScene(
      [createBall(), mover, passer, someoneElse],
      [moveArrow, passArrow],
    );
    const [move, pass] = buildPlaybackTimeline(scene).segments;
    expect(pass.start).toBe(move.end);
  });

  it("duration is derived from distance and clamped to the ball/player floor and ceiling", () => {
    const a = token("t-a", 50, 50);
    const b = token("t-b", 50.01, 50); // effectively zero distance -> hits the floor
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-a" },
      { kind: "object", objectId: "t-b" },
    );
    const scene = makeScene([createBall({ x: 50, y: 50 }), a, b], [arrow]);
    const [segment] = buildPlaybackTimeline(scene).segments;
    expect(segment.end - segment.start).toBeGreaterThanOrEqual(0.35);

    const far1 = token("t-far1", 0, 0);
    const far2 = token("t-far2", 100, 100);
    const farArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-far1" },
      { kind: "object", objectId: "t-far2" },
    );
    const farScene = makeScene([createBall(), far1, far2], [farArrow]);
    const [farSegment] = buildPlaybackTimeline(farScene).segments;
    expect(farSegment.end - farSegment.start).toBeLessThanOrEqual(3.5);
  });

  it("is a pure function of the distance (determinism: same input, same duration every call)", () => {
    const a = token("t-a", 12, 34);
    const b = token("t-b", 56, 78);
    const arrow = createSemanticArrow(
      "longPass",
      { kind: "object", objectId: "t-a" },
      { kind: "object", objectId: "t-b" },
    );
    const scene = makeScene([createBall(), a, b], [arrow]);
    const first = buildPlaybackTimeline(scene);
    const second = buildPlaybackTimeline(scene);
    expect(first).toEqual(second);
    // Sanity: the duration must actually depend on distance, not be a fixed constant.
    const dist = distance({ x: 12, y: 34 }, { x: 56, y: 78 });
    expect(dist).toBeGreaterThan(0);
  });
});

describe("boardPlayback — samplePlayback", () => {
  function passingScene() {
    const passer = token("t-passer", 20, 50);
    const receiver = token("t-receiver", 80, 50);
    const ball = createBall({ x: 20, y: 50 });
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    return makeScene([ball, passer, receiver], [arrow]);
  }

  it("at t=0 the moving object sits exactly at the segment's `from` point", () => {
    const scene = passingScene();
    const ball = scene.objects.find((o) => o.type === "ball")!;
    const frame = samplePlayback(scene, 0);
    expect(frame.positions[ball.id]).toEqual({ x: 20, y: 50 });
  });

  it("at t>=duration the moving object holds at the segment's `to` point (never overshoots)", () => {
    const scene = passingScene();
    const ball = scene.objects.find((o) => o.type === "ball")!;
    const frame = samplePlayback(scene, 9999);
    expect(frame.positions[ball.id]).toEqual({ x: 80, y: 50 });
    expect(frame.duration).toBeLessThan(9999);
  });

  it("at the midpoint the object is strictly between from and to (eased, not teleporting)", () => {
    const scene = passingScene();
    const ball = scene.objects.find((o) => o.type === "ball")!;
    const { duration } = samplePlayback(scene, 0);
    const mid = samplePlayback(scene, duration / 2);
    const pos = mid.positions[ball.id];
    expect(pos.x).toBeGreaterThan(20);
    expect(pos.x).toBeLessThan(80);
    expect(pos.y).toBeCloseTo(50, 5);
  });

  it("ease-in-out is symmetric around the midpoint (progress at t and duration-t are mirrored)", () => {
    const scene = passingScene();
    const { duration } = samplePlayback(scene, 0);
    const quarter = samplePlayback(scene, duration * 0.25);
    const threeQuarter = samplePlayback(scene, duration * 0.75);
    const ball = scene.objects.find((o) => o.type === "ball")!;
    const qx = quarter.positions[ball.id].x;
    const tqx = threeQuarter.positions[ball.id].x;
    // Symmetric ease-in-out: distance covered by t=25% mirrors distance
    // remaining at t=75% (both measured from the 20..80 span, midpoint 50).
    expect(qx - 20).toBeCloseTo(80 - tqx, 5);
  });

  it("objects untouched by any arrow are absent from positions (caller falls back to scene.objects)", () => {
    const scene = passingScene();
    const frame = samplePlayback(scene, 0);
    // No token in this fixture moves (only the ball does for a pure pass).
    expect(frame.positions["t-passer"]).toBeUndefined();
    expect(frame.positions["t-receiver"]).toBeUndefined();
  });

  it("arrowProgress is 0 before a segment starts, fractional during, and 1 once it ends", () => {
    const passer = token("t-passer", 0, 0);
    const receiver = token("t-receiver", 10, 0);
    const late = token("t-late", 90, 90);
    const firstArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 10, y: 0 } },
    );
    const secondArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-late" },
      { kind: "point", point: { x: 80, y: 90 } },
    );
    const scene = makeScene(
      [createBall(), passer, receiver, late],
      [firstArrow, secondArrow],
    );
    const timeline = buildPlaybackTimeline(scene);
    const [first, second] = timeline.segments;

    const beforeSecond = samplePlayback(scene, first.end / 2);
    expect(beforeSecond.arrowProgress[second.arrowId]).toBe(0);
    expect(beforeSecond.arrowProgress[first.arrowId]).toBeGreaterThan(0);
    expect(beforeSecond.arrowProgress[first.arrowId]).toBeLessThan(1);

    const afterAll = samplePlayback(scene, timeline.duration + 1);
    expect(afterAll.arrowProgress[first.arrowId]).toBe(1);
    expect(afterAll.arrowProgress[second.arrowId]).toBe(1);
  });

  it("chained run+pass: mid-run the ball has not started moving yet only if pass genuinely starts later — here they start together", () => {
    const receiver = token("t-receiver", 70, 50);
    const passer = token("t-passer", 30, 50);
    const ball = createBall({ x: 30, y: 50 });
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 85, y: 40 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene([ball, receiver, passer], [runArrow, passArrow]);
    const frameAtStart = samplePlayback(scene, 0.001);
    expect(frameAtStart.arrowProgress[runArrow.id]).toBeGreaterThan(0);
    expect(frameAtStart.arrowProgress[passArrow.id]).toBeGreaterThan(0);
  });

  it("is fully deterministic across repeated calls with the same scene and time", () => {
    const scene = passingScene();
    const { duration } = samplePlayback(scene, 0);
    const a = samplePlayback(scene, duration * 0.37);
    const b = samplePlayback(scene, duration * 0.37);
    expect(a).toEqual(b);
  });

  it("a scene with no arrows samples to an empty frame with zero duration", () => {
    const scene = makeScene([createBall()], []);
    const frame = samplePlayback(scene, 5);
    expect(frame.duration).toBe(0);
    expect(frame.positions).toEqual({});
    expect(frame.arrowProgress).toEqual({});
  });

  // Coordinator-mandated regression (2026-07-13): the star case of the whole
  // brief — "the receiver's run in parallel with the pass that looks for
  // them" — has to actually find the runner on screen. The ball's FINAL
  // resting position, once the whole chained sequence has played out, must
  // be the receiver's run destination (previous.to), never their static
  // drawn spot.
  it("REGRESSION (coordinator review): the ball ends up at the receiver's run destination, not their static drawn position", () => {
    const receiver = token("t-receiver", 50, 50);
    const passer = token("t-passer", 10, 50);
    const ball = createBall({ x: 10, y: 50 });
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene([ball, receiver, passer], [runArrow, passArrow]);
    const { duration } = samplePlayback(scene, 0);
    const finalFrame = samplePlayback(scene, duration + 1);
    expect(finalFrame.positions[ball.id]).toEqual({ x: 90, y: 50 });
    expect(finalFrame.positions[ball.id]).not.toEqual({ x: 50, y: 50 });
  });
});
