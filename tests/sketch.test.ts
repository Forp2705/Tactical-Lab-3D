import { describe, expect, it } from "vitest";
import {
  SketchAnnotationSchema,
  SketchSchema,
  createBlankSketch,
  createSketchItemId,
} from "../src/sketch/sketchSchemas";
import {
  SKETCH_VIEWBOX_HEIGHT,
  SKETCH_VIEWBOX_WIDTH,
  clamp01to100,
  distanceBetween,
  distanceToSegment,
  isMeaningfulDrag,
  isPointInCircle,
  isPointInRect,
  isPointOverToken,
  normalizeRect,
  pixelToPercent,
  roundCoord,
  toSvgX,
  toSvgY,
} from "../src/sketch/sketchGeometry";
import {
  deserializeSketch,
  reviveSketch,
  roundTripSketch,
  serializeSketch,
} from "../src/sketch/sketchSerialization";
import type { Sketch } from "../src/sketch/sketchSchemas";

/**
 * Quick Sketch — pure-module coverage for the schema, geometry helpers and
 * serialization layer (see src/sketch/). These are the building blocks the
 * editor (`QuickSketchView`) and persistence (`db.ts`/`useAppStore.ts`) lean
 * on, so keeping them locked down here protects the rest of the feature.
 */

describe("Sketch schema", () => {
  it("createBlankSketch produces a schema-valid empty sketch", () => {
    const sketch = createBlankSketch("Salida corta vs presión alta");
    expect(() => SketchSchema.parse(sketch)).not.toThrow();
    expect(sketch.title).toBe("Salida corta vs presión alta");
    expect(sketch.tokens).toEqual([]);
    expect(sketch.annotations).toEqual([]);
    expect(sketch.labels).toEqual([]);
    expect(sketch.pitchOrientation).toBe("horizontal");
  });

  it("falls back to a default title when given blank input", () => {
    expect(createBlankSketch("   ").title).toBe("Boceto sin titulo");
    expect(createBlankSketch().title).toBe("Boceto sin titulo");
  });

  it("createSketchItemId returns unique, prefixed ids", () => {
    const a = createSketchItemId("token");
    const b = createSketchItemId("token");
    expect(a).not.toBe(b);
    expect(a.startsWith("token-")).toBe(true);
    expect(b.startsWith("token-")).toBe(true);
  });

  it("rejects coordinates outside the normalized 0-100 range", () => {
    const sketch = createBlankSketch();
    const invalid = {
      ...sketch,
      tokens: [{ id: "t1", x: 142, y: 10, label: "9", team: "home" }],
    };
    expect(SketchSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates each annotation variant of the discriminated union", () => {
    const arrow = {
      id: "a1",
      type: "arrow",
      from: { x: 10, y: 10 },
      to: { x: 50, y: 30 },
    };
    const line = {
      id: "l1",
      type: "line",
      from: { x: 5, y: 5 },
      to: { x: 90, y: 40 },
    };
    const zone = {
      id: "z1",
      type: "zone",
      shape: "rectangle",
      x: 20,
      y: 20,
      w: 30,
      h: 15,
    };
    expect(SketchAnnotationSchema.safeParse(arrow).success).toBe(true);
    expect(SketchAnnotationSchema.safeParse(line).success).toBe(true);
    expect(SketchAnnotationSchema.safeParse(zone).success).toBe(true);
  });

  it("rejects an annotation with an unknown discriminant", () => {
    const bogus = {
      id: "x1",
      type: "freehand",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    };
    expect(SketchAnnotationSchema.safeParse(bogus).success).toBe(false);
  });
});

describe("Sketch geometry helpers", () => {
  it("clamp01to100 clamps to the normalized range and guards NaN", () => {
    expect(clamp01to100(-10)).toBe(0);
    expect(clamp01to100(150)).toBe(100);
    expect(clamp01to100(42)).toBe(42);
    expect(clamp01to100(Number.NaN)).toBe(0);
  });

  it("roundCoord clamps then rounds to two decimals", () => {
    expect(roundCoord(33.3333)).toBe(33.33);
    expect(roundCoord(-5)).toBe(0);
    expect(roundCoord(123)).toBe(100);
  });

  it("pixelToPercent maps a client point onto the 0-100 surface", () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 };
    expect(pixelToPercent(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(pixelToPercent(300, 150, rect)).toEqual({ x: 100, y: 100 });
    expect(pixelToPercent(200, 100, rect)).toEqual({ x: 50, y: 50 });
  });

  it("toSvgX/toSvgY scale normalized coords onto the sketch viewBox", () => {
    expect(toSvgX(0)).toBe(0);
    expect(toSvgX(100)).toBe(SKETCH_VIEWBOX_WIDTH);
    expect(toSvgX(50)).toBe(SKETCH_VIEWBOX_WIDTH / 2);
    expect(toSvgY(0)).toBe(0);
    expect(toSvgY(100)).toBe(SKETCH_VIEWBOX_HEIGHT);
    expect(toSvgY(50)).toBe(SKETCH_VIEWBOX_HEIGHT / 2);
  });

  it("distanceBetween computes euclidean distance in percent-space", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceBetween({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it("normalizeRect anchors a free-form drag to a top-left rectangle", () => {
    expect(normalizeRect({ x: 40, y: 30 }, { x: 10, y: 60 })).toEqual({
      x: 10,
      y: 30,
      w: 30,
      h: 30,
    });
    expect(normalizeRect({ x: 10, y: 10 }, { x: 90, y: 50 })).toEqual({
      x: 10,
      y: 10,
      w: 80,
      h: 40,
    });
  });

  it("isMeaningfulDrag distinguishes clicks from intentional drags", () => {
    expect(isMeaningfulDrag({ x: 10, y: 10 }, { x: 10.5, y: 10 })).toBe(false);
    expect(isMeaningfulDrag({ x: 10, y: 10 }, { x: 15, y: 10 })).toBe(true);
  });

  it("distanceToSegment measures distance from a point to a line/arrow", () => {
    // Point directly above the midpoint of a horizontal segment.
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    // Point beyond the segment's end clamps to the nearest endpoint.
    expect(distanceToSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
    // Degenerate (zero-length) segment behaves like point-to-point distance.
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });

  it("isPointOverToken / isPointInRect / isPointInCircle hit-test correctly", () => {
    expect(isPointOverToken({ x: 12, y: 12 }, { x: 10, y: 10 })).toBe(true);
    expect(isPointOverToken({ x: 50, y: 50 }, { x: 10, y: 10 })).toBe(false);

    const rect = { x: 10, y: 10, w: 20, h: 10 };
    expect(isPointInRect({ x: 15, y: 15 }, rect)).toBe(true);
    expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(false);

    const circle = { x: 10, y: 10, w: 20, h: 20 };
    expect(isPointInCircle({ x: 20, y: 20 }, circle)).toBe(true);
    expect(isPointInCircle({ x: 35, y: 35 }, circle)).toBe(false);
  });
});

describe("Sketch serialization", () => {
  function buildSampleSketch(): Sketch {
    const blank = createBlankSketch("Presión tras pérdida");
    return {
      ...blank,
      tokens: [
        { id: "tok-1", x: 25, y: 30, label: "9", team: "home", role: "Delantero" },
        { id: "tok-2", x: 70, y: 40, label: "4", team: "away" },
      ],
      annotations: [
        { id: "ann-1", type: "arrow", from: { x: 25, y: 30 }, to: { x: 60, y: 20 }, label: "Diagonal" },
        { id: "ann-2", type: "zone", shape: "rectangle", x: 50, y: 10, w: 25, h: 20, label: "Zona 3" },
      ],
      labels: [{ id: "lab-1", x: 12, y: 8, text: "Salida en corto" }],
    };
  }

  it("serializes and deserializes a sketch without losing data", () => {
    const sketch = buildSampleSketch();
    const json = serializeSketch(sketch);
    expect(typeof json).toBe("string");

    const result = deserializeSketch(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sketch).toEqual(sketch);
    }
  });

  it("roundTripSketch is equivalent to serialize -> deserialize", () => {
    const sketch = buildSampleSketch();
    const result = roundTripSketch(sketch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sketch).toEqual(sketch);
    }
  });

  it("serializeSketch throws on an invalid sketch instead of silently saving it", () => {
    const sketch = buildSampleSketch();
    const broken = { ...sketch, tokens: [{ ...sketch.tokens[0], x: 999 }] } as unknown as Sketch;
    expect(() => serializeSketch(broken)).toThrow(/invalido/i);
  });

  it("deserializeSketch reports a friendly error for malformed JSON", () => {
    const result = deserializeSketch("{not json");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/JSON/);
    }
  });

  it("deserializeSketch reports a friendly error for schema-invalid data", () => {
    const result = deserializeSketch(JSON.stringify({ id: "only-id" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/formato/i);
    }
  });

  it("reviveSketch validates and clones plain candidates, returning null for garbage", () => {
    const sketch = buildSampleSketch();
    const revived = reviveSketch(JSON.parse(JSON.stringify(sketch)));
    expect(revived).toEqual(sketch);
    expect(reviveSketch({ not: "a sketch" })).toBeNull();
    expect(reviveSketch(null)).toBeNull();
  });
});
