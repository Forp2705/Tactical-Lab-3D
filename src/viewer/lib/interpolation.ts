import type { Keyframe, Vec2, Vec3 } from "@/data/schemas";

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(t: number) {
  const k = clamp(t);
  return k * k * (3 - 2 * k);
}

export function easeValue(t: number, ease: Keyframe["ease"] = "smooth") {
  if (ease === "linear") return clamp(t);
  if (ease === "ease-in") return clamp(t) * clamp(t);
  if (ease === "ease-out") return 1 - (1 - clamp(t)) * (1 - clamp(t));
  return footballLocomotion(t);
}

function footballLocomotion(t: number) {
  const k = clamp(t);
  const accelerate = k < 0.2 ? (k / 0.2) ** 1.7 * 0.2 : k;
  const settle = smoothstep(k);

  return clamp(accelerate * 0.35 + settle * 0.65);
}

export function interpolateVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

export function interpolateVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z ?? 0, b.z ?? 0, t),
  };
}

export function interpolatePath(start: Vec2, path: Keyframe[], time: number) {
  const points = [{ t: 0, pos: start, ease: "smooth" as const }, ...path].sort(
    (a, b) => a.t - b.t,
  );

  let prev = points[0];
  let next = points[points.length - 1];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (time >= a.t && time <= b.t) {
      prev = a;
      next = b;
      const span = Math.max(0.001, b.t - a.t);
      const t = easeValue((time - a.t) / span, b.ease);
      return {
        pos: interpolateVec2(a.pos, b.pos, t),
        prev: a.pos,
        next: b.pos,
      };
    }
  }

  const last = points.filter((point) => time >= point.t).at(-1) ?? points[0];
  return {
    pos: last.pos,
    prev: prev.pos,
    next: next.pos,
  };
}
