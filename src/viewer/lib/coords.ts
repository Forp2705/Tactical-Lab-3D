import type { Vec2 } from "@/data/schemas";

export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;

export type PitchMode = "full" | "half" | "third" | "small";
export type WorldPoint = { x: number; z: number };

const MODE_LENGTH: Record<PitchMode, number> = {
  full: PITCH_LENGTH_M,
  half: 52.5,
  third: 39,
  small: 28,
};

const PITCH_ASPECT = PITCH_LENGTH_M / PITCH_WIDTH_M;

const MODE_WIDTH: Record<PitchMode, number> = {
  full: PITCH_WIDTH_M,
  half: 52.5 / PITCH_ASPECT,
  third: 39 / PITCH_ASPECT,
  small: 28 / PITCH_ASPECT,
};

export function pitchDimensions(mode: PitchMode = "full") {
  return {
    length: MODE_LENGTH[mode],
    width: MODE_WIDTH[mode],
  };
}

export function pitchToWorld(pos: Vec2, mode: PitchMode = "full"): WorldPoint {
  const { length, width } = pitchDimensions(mode);

  return {
    x: (pos.x / 100 - 0.5) * length,
    z: (0.5 - pos.y / 100) * width,
  };
}

export function worldToPitch(
  point: WorldPoint,
  mode: PitchMode = "full",
): Vec2 {
  const { length, width } = pitchDimensions(mode);

  return {
    x: (point.x / length + 0.5) * 100,
    y: (0.5 - point.z / width) * 100,
  };
}

export function clampPitch(pos: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(100, pos.x)),
    y: Math.max(0, Math.min(100, pos.y)),
  };
}
