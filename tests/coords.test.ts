import { describe, expect, it } from "vitest";
import {
  pitchDimensions,
  pitchToWorld,
  worldToPitch,
  type PitchMode,
} from "../src/viewer/lib/coords";

const modes: PitchMode[] = ["full", "half", "third", "small"];

describe("pitch coordinate transforms", () => {
  it.each(modes)("round-trips positions in %s mode", (mode) => {
    const samples = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 18.4, y: 74.2 },
    ];

    for (const sample of samples) {
      const roundTrip = worldToPitch(pitchToWorld(sample, mode), mode);
      expect(roundTrip.x).toBeCloseTo(sample.x, 5);
      expect(roundTrip.y).toBeCloseTo(sample.y, 5);
    }
  });

  it("keeps football orientation horizontal in world space", () => {
    const ownGoal = pitchToWorld({ x: 0, y: 50 });
    const rivalGoal = pitchToWorld({ x: 100, y: 50 });

    expect(ownGoal.x).toBeLessThan(rivalGoal.x);
    expect(ownGoal.z).toBeCloseTo(rivalGoal.z, 5);
  });

  it.each(modes)("keeps the rendered field landscape in %s focus mode", (mode) => {
    const { length, width } = pitchDimensions(mode);

    expect(length).toBeGreaterThan(width);
    expect(length / width).toBeCloseTo(105 / 68, 5);
  });
});
