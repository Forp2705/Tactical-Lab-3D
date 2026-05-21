import { describe, expect, it } from "vitest";
import type { Exercise } from "../src/data";
import {
  actorDirectionFromPoints,
  classifyActorMotion,
  getMatchFrame,
} from "../src/viewer/lib/matchEngine";

describe("match engine ball rules", () => {
  it("keeps the ball with the receiver after a clean pass", () => {
    const frame = getMatchFrame(
      makeExercise({ withDefenderInLane: false }),
      3.2,
    );

    expect(frame.ball.carrier).toBe("b");
    expect(frame.ball.state).toBe("carried");
  });

  it("does not let a pass travel through a rival standing in the lane", () => {
    const frame = getMatchFrame(
      makeExercise({ withDefenderInLane: true }),
      2.2,
    );

    expect(frame.ball.carrier).toBe("d");
    expect(frame.ball.state).toBe("intercepted");
    expect(frame.ball.interceptedBy).toBe("d");
  });
});

describe("match engine motion classifier", () => {
  it("classifies pass, receive, press and sprint from active overlays", () => {
    const exercise = makeMotionExercise();
    const frameAtPass = getMatchFrame(exercise, 1.2);
    const frameAtReceive = getMatchFrame(exercise, 1.9);
    const frameAtPress = getMatchFrame(exercise, 2.4);
    const frameAtRun = getMatchFrame(exercise, 3.4);

    expect(actorMotion(frameAtPass, "a")).toBe("Pass");
    expect(actorMotion(frameAtReceive, "b")).toBe("Receive");
    expect(actorMotion(frameAtPress, "d")).toBe("Press");
    expect(actorMotion(frameAtRun, "c")).toBe("Sprint");
  });

  it("falls back to speed hints when no tactical overlay is active", () => {
    const exercise = makeMotionExercise();
    const frame = getMatchFrame(exercise, 0.5);
    const pose = frame.actors.find((actor) => actor.actor.id === "c");

    if (!pose) throw new Error("Expected actor c in frame");
    expect(classifyActorMotion(exercise, pose, 0.5, frame.ball)).toBe("Sprint");
  });
});

describe("match engine direction sign", () => {
  it("keeps positive X as attacking right and positive Y as lower pitch side", () => {
    expect(
      actorDirectionFromPoints({ x: 10, y: 50 }, { x: 20, y: 50 }),
    ).toBeCloseTo(0, 5);
    expect(
      actorDirectionFromPoints({ x: 20, y: 50 }, { x: 10, y: 50 }),
    ).toBeCloseTo(Math.PI, 5);
    expect(
      actorDirectionFromPoints({ x: 50, y: 50 }, { x: 50, y: 60 }),
    ).toBeCloseTo(Math.PI / 2, 5);
    expect(
      actorDirectionFromPoints({ x: 50, y: 50 }, { x: 50, y: 40 }),
    ).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe("match engine triggers", () => {
  it("exposes active triggers around their activation time", () => {
    const frameBefore = getMatchFrame(makeTriggerExercise(), 1.4);
    const frameActive = getMatchFrame(makeTriggerExercise(), 2.1);
    const frameAfter = getMatchFrame(makeTriggerExercise(), 3.5);

    expect(frameBefore.triggers).toHaveLength(0);
    expect(frameActive.triggers.map((trigger) => trigger.id)).toContain("t1");
    expect(frameAfter.triggers).toHaveLength(0);
  });
});

function makeExercise({
  withDefenderInLane,
}: { withDefenderInLane: boolean }): Exercise {
  return {
    id: "engine-test",
    title: "Engine test",
    phase: "attackOrg",
    principle: "test",
    level: "test",
    intensity: "med",
    rpe: 5,
    density: 0.5,
    players: { min: 2, max: 3 },
    duration: 4,
    space: "test",
    material: [],
    objective: { primary: "test" },
    organization: "test",
    rules: [],
    coaching: [],
    errors: [],
    success: "test",
    progressions: [],
    regressions: [],
    scene: {
      duration: 4,
      pitchMode: "full",
      actors: [
        {
          id: "a",
          team: "own",
          num: 6,
          role: "MC",
          start: { x: 20, y: 50 },
          path: [],
          facingMode: "auto",
          state: [],
        },
        {
          id: "b",
          team: "own",
          num: 8,
          role: "INT",
          start: { x: 80, y: 50 },
          path: [],
          facingMode: "auto",
          state: [],
        },
        {
          id: "d",
          team: "rival",
          num: 5,
          role: "DEF",
          start: withDefenderInLane ? { x: 50, y: 50 } : { x: 50, y: 62 },
          path: [],
          facingMode: "auto",
          state: [],
        },
      ],
      ball: { start: { x: 20, y: 50, z: 0 }, path: [] },
      overlays: [
        {
          id: "p1",
          type: "pass",
          from: "a",
          to: "b",
          start: 1,
          end: 3,
          layer: "withBall",
        },
      ],
      zones: [],
      triggers: [],
      phases: [
        {
          id: "setup",
          name: "Setup",
          start: 0,
          end: 1,
          activeLayers: ["notes"],
        },
        {
          id: "execution",
          name: "Execution",
          start: 1,
          end: 3,
          activeLayers: ["withBall"],
        },
        {
          id: "outcome",
          name: "Outcome",
          start: 3,
          end: 4,
          activeLayers: ["withBall"],
        },
      ],
    },
  };
}

function makeMotionExercise(): Exercise {
  return {
    ...makeExercise({ withDefenderInLane: false }),
    scene: {
      ...makeExercise({ withDefenderInLane: false }).scene,
      actors: [
        {
          id: "a",
          team: "own",
          num: 6,
          role: "MC",
          start: { x: 20, y: 48 },
          path: [],
          facingMode: "auto",
          state: [],
        },
        {
          id: "b",
          team: "own",
          num: 8,
          role: "INT",
          start: { x: 42, y: 48 },
          path: [],
          facingMode: "auto",
          state: [],
        },
        {
          id: "c",
          team: "own",
          num: 11,
          role: "EXT",
          start: { x: 25, y: 22 },
          path: [{ t: 2.8, pos: { x: 50, y: 22 }, ease: "smooth" }],
          facingMode: "auto",
          state: [],
        },
        {
          id: "d",
          team: "rival",
          num: 5,
          role: "DEF",
          start: { x: 64, y: 52 },
          path: [],
          facingMode: "auto",
          state: [],
        },
      ],
      overlays: [
        {
          id: "p1",
          type: "pass",
          from: "a",
          to: "b",
          start: 1,
          end: 2,
          layer: "withBall",
        },
        {
          id: "pr1",
          type: "press",
          from: "d",
          to: "b",
          start: 2.2,
          end: 2.8,
          layer: "press",
        },
        {
          id: "r1",
          type: "run",
          from: "c",
          to: { x: 72, y: 22 },
          start: 3,
          end: 4,
          layer: "withoutBall",
        },
      ],
    },
  };
}

function actorMotion(frame: ReturnType<typeof getMatchFrame>, actorId: string) {
  return frame.actors.find((pose) => pose.actor.id === actorId)?.motion;
}

function makeTriggerExercise(): Exercise {
  return {
    ...makeExercise({ withDefenderInLane: false }),
    scene: {
      ...makeExercise({ withDefenderInLane: false }).scene,
      triggers: [
        {
          id: "t1",
          description: "Pase atras del 5",
          whenT: 2,
          cause: { actorId: "a", action: "backPass" },
          visualMarker: { pos: { x: 40, y: 50 }, icon: "!" },
          activatesOverlays: ["p1"],
        },
      ],
    },
  };
}
