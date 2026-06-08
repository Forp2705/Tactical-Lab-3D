/**
 * Serialization helpers for Quick Sketch persistence and round-tripping.
 *
 * Sketches are stored as plain JSON inside the Dexie snapshot (see
 * src/state/db.ts). These helpers centralize JSON <-> `Sketch` conversion and
 * always validate through `SketchSchema` so malformed/legacy data degrades
 * safely instead of crashing the app.
 */

import { SketchSchema, type Sketch } from "./sketchSchemas";

export type SketchParseResult =
  | { success: true; sketch: Sketch }
  | { success: false; error: string };

/** Serializes a sketch to a JSON string (validating first). */
export function serializeSketch(sketch: Sketch): string {
  const parsed = SketchSchema.safeParse(sketch);
  if (!parsed.success) {
    throw new Error(`No se puede guardar un boceto invalido: ${parsed.error.message}`);
  }
  return JSON.stringify(parsed.data);
}

/**
 * Deserializes a JSON string into a `Sketch`, validating the result.
 * Never throws — returns a discriminated result so callers can show a
 * friendly fallback instead of crashing on corrupted local data.
 */
export function deserializeSketch(raw: string): SketchParseResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { success: false, error: "El boceto guardado no es JSON valido." };
  }
  const parsed = SketchSchema.safeParse(candidate);
  if (!parsed.success) {
    return { success: false, error: "El boceto guardado no respeta el formato esperado." };
  }
  return { success: true, sketch: parsed.data };
}

/**
 * Validates and clones a sketch-like object (e.g. from snapshot storage)
 * without going through a JSON string round trip. Returns `null` for
 * malformed data so callers can drop it safely (e.g. during migration).
 */
export function reviveSketch(candidate: unknown): Sketch | null {
  const parsed = SketchSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Round-trip helper used mainly by tests: serialize then deserialize. */
export function roundTripSketch(sketch: Sketch): SketchParseResult {
  return deserializeSketch(serializeSketch(sketch));
}
