/**
 * Pure, framework-agnostic geometry helpers for Quick Sketch.
 *
 * Sketch coordinates are normalized to 0-100 on both axes. The SVG surface in
 * `QuickSketchView.tsx` renders with `viewBox="0 0 100 64"` and
 * `preserveAspectRatio="none"`, so the same 0-100 space maps linearly onto
 * both the on-screen pixel rect and the SVG viewBox without letterboxing.
 */

import type { SketchPoint } from "./sketchSchemas";

/** Aspect ratio of the sketch surface viewBox (width x height), ~ a pitch. */
export const SKETCH_VIEWBOX_WIDTH = 100;
export const SKETCH_VIEWBOX_HEIGHT = 64;

/** Clamps a coordinate into the valid normalized 0-100 range. */
export function clamp01to100(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Rounds a normalized coordinate to a stable precision for storage. */
export function roundCoord(value: number): number {
  return Math.round(clamp01to100(value) * 100) / 100;
}

/**
 * Converts a pointer position (in client/viewport pixels) to a normalized
 * 0-100 point relative to a bounding rectangle (typically the sketch
 * surface's `getBoundingClientRect()`).
 */
export function pixelToPercent(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): SketchPoint {
  const width = rect.width || 1;
  const height = rect.height || 1;
  const x = ((clientX - rect.left) / width) * 100;
  const y = ((clientY - rect.top) / height) * 100;
  return { x: roundCoord(x), y: roundCoord(y) };
}

/** Converts a normalized 0-100 x to an SVG viewBox x coordinate. */
export function toSvgX(xPercent: number): number {
  return (clamp01to100(xPercent) / 100) * SKETCH_VIEWBOX_WIDTH;
}

/** Converts a normalized 0-100 y to an SVG viewBox y coordinate. */
export function toSvgY(yPercent: number): number {
  return (clamp01to100(yPercent) / 100) * SKETCH_VIEWBOX_HEIGHT;
}

/** Euclidean distance between two normalized points (in percent-space units). */
export function distanceBetween(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Normalizes two free-form corner points (e.g. drag start/end) into a
 * top-left-anchored rectangle descriptor, clamped to the 0-100 space.
 * Used to derive zone geometry from a click-drag gesture.
 */
export function normalizeRect(
  a: SketchPoint,
  b: SketchPoint,
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return {
    x: roundCoord(x),
    y: roundCoord(y),
    w: roundCoord(w),
    h: roundCoord(h),
  };
}

/**
 * Minimum drag distance (in percent-space units) before a click-drag gesture
 * is treated as drawing an annotation rather than a simple click/placement.
 * Keeps accidental micro-drags from creating zero-size annotations.
 */
export const MIN_DRAW_DISTANCE = 1.5;

/** True when a drag gesture moved far enough to count as "drawing" something. */
export function isMeaningfulDrag(a: SketchPoint, b: SketchPoint): boolean {
  return distanceBetween(a, b) >= MIN_DRAW_DISTANCE;
}

/** Distance from point `p` to the segment `a`-`b`, for line/arrow hit-testing. */
export function distanceToSegment(p: SketchPoint, a: SketchPoint, b: SketchPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distanceBetween(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projection: SketchPoint = { x: a.x + t * dx, y: a.y + t * dy };
  return distanceBetween(p, projection);
}

/** True when a normalized point falls within a token's circular hit area. */
export function isPointOverToken(point: SketchPoint, token: SketchPoint, radius = 3): boolean {
  return distanceBetween(point, token) <= radius;
}

/** True when a normalized point falls within a rectangular zone descriptor. */
export function isPointInRect(
  point: SketchPoint,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/** True when a normalized point falls within a circular zone (x,y = center). */
export function isPointInCircle(
  point: SketchPoint,
  circle: { x: number; y: number; w: number; h: number },
): boolean {
  const radius = Math.max(circle.w, circle.h) / 2;
  const center: SketchPoint = { x: circle.x + circle.w / 2, y: circle.y + circle.h / 2 };
  return distanceBetween(point, center) <= radius;
}
