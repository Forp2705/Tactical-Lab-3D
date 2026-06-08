import { z } from "zod";

/**
 * Quick Sketch — minimal local-first data model for fast 2D tactical sketches.
 *
 * Intentionally separate from `Exercise`/`Scene`/`Actor` (see src/data/schemas.ts).
 * Coordinates are normalized to a 0-100 range on both axes so a future
 * "promote to 3D" pass can map them onto the pitch coordinate conventions in
 * src/viewer/lib/coords.ts without re-authoring sketches.
 */

export const SKETCH_SCHEMA_VERSION = 1;

export const SketchPitchOrientationSchema = z.enum(["horizontal", "vertical"]);
export type SketchPitchOrientation = z.infer<typeof SketchPitchOrientationSchema>;

export const SketchTeamSchema = z.enum(["home", "away", "neutral"]);
export type SketchTeam = z.infer<typeof SketchTeamSchema>;

const NormalizedCoord = z.number().min(0).max(100);

export const SketchPointSchema = z.object({
  x: NormalizedCoord,
  y: NormalizedCoord,
});
export type SketchPoint = z.infer<typeof SketchPointSchema>;

export const SketchTokenSchema = z.object({
  id: z.string().min(1),
  x: NormalizedCoord,
  y: NormalizedCoord,
  label: z.string().min(1).max(8),
  team: SketchTeamSchema,
  role: z.string().max(40).optional(),
});
export type SketchToken = z.infer<typeof SketchTokenSchema>;

export const SketchZoneShapeSchema = z.enum(["rectangle", "circle"]);
export type SketchZoneShape = z.infer<typeof SketchZoneShapeSchema>;

export const SketchAnnotationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("arrow"),
    from: SketchPointSchema,
    to: SketchPointSchema,
    label: z.string().max(40).optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("line"),
    from: SketchPointSchema,
    to: SketchPointSchema,
    label: z.string().max(40).optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("zone"),
    shape: SketchZoneShapeSchema,
    x: NormalizedCoord,
    y: NormalizedCoord,
    w: z.number().min(0).max(100),
    h: z.number().min(0).max(100),
    label: z.string().max(40).optional(),
  }),
]);
export type SketchAnnotation = z.infer<typeof SketchAnnotationSchema>;
export type SketchAnnotationType = SketchAnnotation["type"];

export const SketchTextLabelSchema = z.object({
  id: z.string().min(1),
  x: NormalizedCoord,
  y: NormalizedCoord,
  text: z.string().min(1).max(80),
});
export type SketchTextLabel = z.infer<typeof SketchTextLabelSchema>;

export const SketchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  pitchOrientation: SketchPitchOrientationSchema,
  tokens: z.array(SketchTokenSchema),
  annotations: z.array(SketchAnnotationSchema),
  labels: z.array(SketchTextLabelSchema),
});
export type Sketch = z.infer<typeof SketchSchema>;

/** Tools available in the (deliberately minimal) Quick Sketch palette. */
export type SketchTool =
  | "select"
  | "player"
  | "arrow"
  | "line"
  | "zone"
  | "text"
  | "delete";

let sketchSeed = 0;

/**
 * Lightweight unique id generator for sketch items. Falls back to a counter
 * when `crypto.randomUUID` is unavailable (older WebViews, test environments).
 */
export function createSketchItemId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  sketchSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${sketchSeed}`;
}

/** Builds a minimal, schema-valid, empty sketch ready to edit and save. */
export function createBlankSketch(title?: string): Sketch {
  const now = new Date().toISOString();
  const trimmed = title?.trim();
  return {
    id: createSketchItemId("sketch"),
    title: trimmed && trimmed.length ? trimmed.slice(0, 80) : "Boceto sin titulo",
    createdAt: now,
    updatedAt: now,
    version: SKETCH_SCHEMA_VERSION,
    pitchOrientation: "horizontal",
    tokens: [],
    annotations: [],
    labels: [],
  };
}
