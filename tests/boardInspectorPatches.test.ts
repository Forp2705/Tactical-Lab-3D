import { describe, expect, it } from "vitest";
import { arrowStyle, zoneStyle } from "../src/board/boardActionStyle";
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
