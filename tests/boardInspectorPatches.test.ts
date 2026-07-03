import { describe, expect, it } from "vitest";
import { arrowStyle, zoneStyle } from "../src/board/boardActionStyle";
import { zoneGeometryPatch } from "../src/board/boardGeometry";
import {
  arrowSemanticPatch,
  arrowTargetZonePatch,
  createSemanticArrow,
  createTacticalZone,
  labelForArrow,
  labelForZone,
  zoneSemanticPatch,
} from "../src/board/boardModel";

// P0.4: logica pura del inspector. Las tres trampas que levanto el review.

describe("arrowSemanticPatch (re-derive default-aware)", () => {
  it("re-derives tacticalMeaning when it was the old type default", () => {
    const arrow = createSemanticArrow(
      "pass",
      { kind: "point", point: { x: 0, y: 0 } },
      { kind: "point", point: { x: 10, y: 10 } },
    );
    expect(arrow.tacticalMeaning).toBe(labelForArrow("pass"));
    const patch = arrowSemanticPatch(arrow, "pressure");
    expect(patch.semantic).toBe("pressure");
    expect(patch.tacticalMeaning).toBe(labelForArrow("pressure"));
  });

  it("keeps a user-customized tacticalMeaning", () => {
    const arrow = {
      ...createSemanticArrow(
        "pass",
        { kind: "point", point: { x: 0, y: 0 } },
        { kind: "point", point: { x: 10, y: 10 } },
      ),
      tacticalMeaning: "Mi lectura propia",
    };
    const patch = arrowSemanticPatch(arrow, "pressure");
    expect(patch.semantic).toBe("pressure");
    expect(patch.tacticalMeaning).toBeUndefined();
  });
});

describe("arrowTargetZonePatch (destino mutuamente excluyente)", () => {
  it("sets targetZoneId and moves `to` to the zone centroid (breaking object anchor)", () => {
    const zone = createTacticalZone("danger", 10, 10, 20, 16);
    const patch = arrowTargetZonePatch(zone);
    expect(patch.targetZoneId).toBe(zone.id);
    // `to` pasa a punto (no objeto) -> nunca queda "apunta a jugador X + zona Y".
    expect(patch.to).toEqual({ kind: "point", point: { x: 20, y: 18 } });
  });

  it("clears targetZoneId when no zone is given", () => {
    const patch = arrowTargetZonePatch(null);
    expect(patch.targetZoneId).toBeUndefined();
    expect(patch.to).toBeUndefined();
  });
});

describe("zoneSemanticPatch (re-derive default-aware)", () => {
  it("re-derives color+label when both were the old type defaults", () => {
    const zone = createTacticalZone("occupation", 5, 5, 20, 20);
    expect(zone.color).toBe(zoneStyle("occupation").color);
    const patch = zoneSemanticPatch(zone, "danger");
    expect(patch.semantic).toBe("danger");
    expect(patch.color).toBe(zoneStyle("danger").color);
    expect(patch.label).toBe(labelForZone("danger"));
  });

  it("keeps a user-customized color", () => {
    const zone = {
      ...createTacticalZone("occupation", 5, 5, 20, 20),
      color: "#123456",
    };
    const patch = zoneSemanticPatch(zone, "danger");
    expect(patch.semantic).toBe("danger");
    expect(patch.color).toBeUndefined();
    // el label seguia en default -> ese si se re-deriva
    expect(patch.label).toBe(labelForZone("danger"));
  });
});

// Sanity: arrowStyle existe para la semantica destino (el color sigue solo).
it("arrow color follows the new semantic via arrowStyle (not stored)", () => {
  expect(arrowStyle("pressure").color).not.toBe(arrowStyle("pass").color);
});

// W6: reposicion de zona via inspector — un campo a la vez, clampeado contra
// el invariante x+w<=100 / y+h<=100 del schema (nunca toca los otros campos).
describe("zoneGeometryPatch (edicion x/y/w/h del inspector)", () => {
  const zone = createTacticalZone("occupation", 40, 30, 20, 20);

  it("clamps x so it never pushes x+w over 100 (adjusts x, not w)", () => {
    const patch = zoneGeometryPatch(zone, "x", 95);
    expect(patch).toEqual({ x: 80 });
  });

  it("clamps w so it never pushes x+w over 100 (adjusts w, not x)", () => {
    const patch = zoneGeometryPatch(zone, "w", 90);
    expect(patch).toEqual({ w: 60 });
  });

  it("clamps y so it never pushes y+h over 100 (adjusts y, not h)", () => {
    const patch = zoneGeometryPatch(zone, "y", 95);
    expect(patch).toEqual({ y: 80 });
  });

  it("clamps h so it never pushes y+h over 100 (adjusts h, not y)", () => {
    const patch = zoneGeometryPatch(zone, "h", 90);
    expect(patch).toEqual({ h: 70 });
  });

  it("clamps a negative value up to the valid minimum instead of rejecting it", () => {
    expect(zoneGeometryPatch(zone, "x", -10)).toEqual({ x: 0 });
    expect(zoneGeometryPatch(zone, "w", -5)).toEqual({ w: 1 });
  });

  it("rejects NaN/Infinity input without producing a patch (no NaN persisted)", () => {
    expect(zoneGeometryPatch(zone, "x", Number.NaN)).toBeNull();
    expect(zoneGeometryPatch(zone, "w", Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("passes an in-range value through unchanged", () => {
    expect(zoneGeometryPatch(zone, "x", 10)).toEqual({ x: 10 });
  });
});
