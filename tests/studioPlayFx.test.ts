import { describe, expect, it } from "vitest";
import {
  BoardSceneSchema,
  createBall,
  createPlayerToken,
  createSemanticArrow,
  type BoardArrow,
  type BoardObject,
  type BoardScene,
} from "../src/board/boardModel";
import { arrowStyle } from "../src/board/boardActionStyle";
import {
  activeSegmentsAt,
  buildFxTimeline,
  cameraZoomEnvelope,
  focusObjectIds,
  focusPoint,
  fxPathD,
  fxPositionAt,
  sampleTrail,
  segmentRawProgress,
} from "../src/board/studio/studioPlayFx";

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

describe("studioPlayFx — buildFxTimeline", () => {
  it("marks a semantic as curved exactly when arrowStyle says so (single source of truth)", () => {
    const runner = token("t-runner", 20, 20);
    const passer = token("t-passer", 20, 40);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 60, y: 20 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 60, y: 40 } },
    );
    const scene = makeScene([createBall(), runner, passer], [runArrow, passArrow]);
    const timeline = buildFxTimeline(scene);
    const run = timeline.segments.find((s) => s.arrowId === runArrow.id)!;
    const pass = timeline.segments.find((s) => s.arrowId === passArrow.id)!;
    expect(run.curved).toBe(arrowStyle("run").curved);
    expect(pass.curved).toBe(arrowStyle("pass").curved);
    expect(run.curved).toBe(true);
    expect(pass.curved).toBe(false);
  });

  it("gives a curved segment a control point off the straight line (real bulge, not a degenerate midpoint)", () => {
    const runner = token("t-runner", 20, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 80, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const [segment] = buildFxTimeline(scene).segments;
    const straightMidY = (segment.from.y + segment.to.y) / 2;
    expect(Math.abs(segment.control.y - straightMidY)).toBeGreaterThan(0.5);
  });

  it("a straight (non-curved) segment's control point sits exactly on the midpoint", () => {
    const passer = token("t-passer", 20, 20);
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 80, y: 60 } },
    );
    const scene = makeScene([createBall(), passer], [arrow]);
    const [segment] = buildFxTimeline(scene).segments;
    expect(segment.control).toEqual({ x: 50, y: 40 });
  });

  it("the curve side is deterministic — same arrow id always bends the same way across rebuilds", () => {
    const runner = token("t-runner", 20, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 80, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const first = buildFxTimeline(scene).segments[0].control;
    const second = buildFxTimeline(scene).segments[0].control;
    expect(first).toEqual(second);
  });

  it("preserves the underlying playback timeline's from/to/kind/objectIds untouched", () => {
    const receiver = token("t-receiver", 70, 50);
    const passer = token("t-passer", 30, 50);
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 90, y: 40 } },
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
    const timeline = buildFxTimeline(scene);
    const pass = timeline.segments.find((s) => s.arrowId === passArrow.id)!;
    // The coordinator-mandated chained-pass fix still holds through the FX layer.
    expect(pass.to).toEqual({ x: 90, y: 40 });
  });
});

describe("studioPlayFx — fxPositionAt / segmentRawProgress", () => {
  function straightSegment() {
    const passer = token("t-passer", 10, 50);
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const scene = makeScene([createBall({ x: 10, y: 50 }), passer], [arrow]);
    return buildFxTimeline(scene).segments[0];
  }

  it("sits exactly at `from` at t=start and `to` at t>=end", () => {
    const segment = straightSegment();
    expect(fxPositionAt(segment, segment.start)).toEqual(segment.from);
    expect(fxPositionAt(segment, segment.end + 5)).toEqual(segment.to);
  });

  it("clamps raw progress to [0,1] outside the segment window", () => {
    const segment = straightSegment();
    expect(segmentRawProgress(segment, segment.start - 10)).toBe(0);
    expect(segmentRawProgress(segment, segment.end + 10)).toBe(1);
  });

  it("a curved segment's midpoint position is off the straight from-to line", () => {
    const runner = token("t-runner", 20, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 80, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    const mid = fxPositionAt(segment, (segment.start + segment.end) / 2);
    expect(Math.abs(mid.y - 20)).toBeGreaterThan(0.1);
  });

  it("is deterministic — repeated sampling at the same t gives the same point", () => {
    const runner = token("t-runner", 20, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 80, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    const t = segment.start + (segment.end - segment.start) * 0.3;
    expect(fxPositionAt(segment, t)).toEqual(fxPositionAt(segment, t));
  });
});

describe("studioPlayFx — fxPathD", () => {
  it("emits a Q (quadratic bezier) path for a curved segment", () => {
    const runner = token("t-runner", 20, 20);
    const arrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-runner" },
      { kind: "point", point: { x: 80, y: 20 } },
    );
    const scene = makeScene([createBall(), runner], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    const d = fxPathD(segment, (y) => y * 0.64);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("Q");
  });

  it("emits a straight L path for a non-curved segment", () => {
    const passer = token("t-passer", 10, 50);
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const scene = makeScene([createBall({ x: 10, y: 50 }), passer], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    const d = fxPathD(segment, (y) => y * 0.64);
    expect(d).not.toContain("Q");
    expect(d).toContain("L");
  });
});

describe("studioPlayFx — focus (spotlight/camera)", () => {
  function chainedScene() {
    const receiver = token("t-receiver", 70, 50);
    const passer = token("t-passer", 30, 50);
    const ball = createBall({ x: 30, y: 50 });
    const runArrow = createSemanticArrow(
      "run",
      { kind: "object", objectId: "t-receiver" },
      { kind: "point", point: { x: 90, y: 40 } },
    );
    const passArrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "object", objectId: "t-receiver" },
    );
    const scene = makeScene([ball, receiver, passer], [runArrow, passArrow]);
    return { scene, ball, receiver, passer, runArrow, passArrow };
  }

  it("focus ids are empty before anything starts", () => {
    const { scene } = chainedScene();
    const timeline = buildFxTimeline(scene);
    expect(focusObjectIds(timeline.segments, -1)).toEqual([]);
  });

  it("focus ids include every active segment's movers (parallel chained run+pass)", () => {
    const { scene, receiver, ball } = chainedScene();
    const timeline = buildFxTimeline(scene);
    const activeIds = focusObjectIds(timeline.segments, 0.001);
    expect(activeIds).toEqual(expect.arrayContaining([receiver.id, ball.id]));
  });

  it("freezes focus on the LAST segment's movers once the whole timeline has ended", () => {
    const { scene } = chainedScene();
    const timeline = buildFxTimeline(scene);
    const last = timeline.segments.at(-1)!;
    const idsAtEnd = focusObjectIds(timeline.segments, timeline.duration + 1);
    expect(idsAtEnd).toEqual(last.objectIds);
  });

  it("focusPoint falls back to the given point when nothing is active and the timeline hasn't ended", () => {
    const timeline = buildFxTimeline(makeScene([createBall()], []));
    expect(focusPoint(timeline.segments, 0, { x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });

  it("activeSegmentsAt is inclusive of segment boundaries", () => {
    const { scene } = chainedScene();
    const timeline = buildFxTimeline(scene);
    const [first] = timeline.segments;
    expect(activeSegmentsAt(timeline.segments, first.start)).toContainEqual(first);
    expect(activeSegmentsAt(timeline.segments, first.end)).toContainEqual(first);
  });
});

describe("studioPlayFx — cameraZoomEnvelope", () => {
  it("ramps from 0 up to 1 over the first 18% and back down over the last 18%, holding 1 in between", () => {
    const duration = 10;
    expect(cameraZoomEnvelope(0, duration)).toBe(0);
    expect(cameraZoomEnvelope(duration, duration)).toBe(0);
    expect(cameraZoomEnvelope(duration / 2, duration)).toBe(1);
    const rampingIn = cameraZoomEnvelope(duration * 0.09, duration);
    expect(rampingIn).toBeGreaterThan(0);
    expect(rampingIn).toBeLessThan(1);
  });

  it("returns 0 for a non-positive duration (never divides by zero)", () => {
    expect(cameraZoomEnvelope(1, 0)).toBe(0);
  });
});

describe("studioPlayFx — sampleTrail", () => {
  it("is empty before the segment has started accumulating any history", () => {
    const passer = token("t-passer", 10, 50);
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const scene = makeScene([createBall({ x: 10, y: 50 }), passer], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    expect(sampleTrail(segment, segment.start, 4, 0.05)).toEqual([]);
  });

  it("returns fading-opacity points strictly behind the current time, deterministically", () => {
    const passer = token("t-passer", 10, 50);
    const arrow = createSemanticArrow(
      "pass",
      { kind: "object", objectId: "t-passer" },
      { kind: "point", point: { x: 90, y: 50 } },
    );
    const scene = makeScene([createBall({ x: 10, y: 50 }), passer], [arrow]);
    const segment = buildFxTimeline(scene).segments[0];
    const t = segment.start + (segment.end - segment.start) * 0.6;
    const trail = sampleTrail(segment, t, 4, 0.05);
    expect(trail.length).toBeGreaterThan(0);
    for (let i = 1; i < trail.length; i += 1) {
      expect(trail[i].opacity).toBeLessThan(trail[i - 1].opacity);
    }
    expect(sampleTrail(segment, t, 4, 0.05)).toEqual(trail);
  });
});
