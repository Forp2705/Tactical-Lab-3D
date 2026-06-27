import { describe, expect, it } from "vitest";
import type { SessionBlock } from "../src/data";
import { createPlayerToken, createSemanticArrow } from "../src/board";
import type { BoardArrow } from "../src/board";
import {
  blockTitle,
  clamp,
  distance,
  endpointPoint,
  layerVisibleForArrow,
  scaleY,
  shortName,
  slug,
  zoneVisible,
} from "../src/board/boardGeometry";

describe("boardGeometry — pure math", () => {
  it("clamp bounds a value to [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("distance is euclidean", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it("scaleY maps 0..100 onto the pitch height (64)", () => {
    expect(scaleY(0)).toBe(0);
    expect(scaleY(50)).toBe(32);
    expect(scaleY(100)).toBe(64);
  });
});

describe("boardGeometry — text helpers", () => {
  it("shortName takes the first word capped at 8 chars", () => {
    expect(shortName("Juan Roman Riquelme")).toBe("Juan");
    expect(shortName("Maximiliano")).toBe("Maximili");
  });

  it("slug normalizes and falls back to 'pizarra'", () => {
    expect(slug("Salida vs Presion")).toBe("salida-vs-presion");
    expect(slug("###")).toBe("pizarra");
    expect(slug("")).toBe("pizarra");
  });

  it("blockTitle prefers the notes headline without the 'Problema:' prefix", () => {
    expect(
      blockTitle({ notes: "Problema: salida limpia\notra linea" } as SessionBlock),
    ).toBe("salida limpia");
    expect(blockTitle({ exerciseId: "rondo-4v2" } as SessionBlock)).toBe(
      "rondo-4v2",
    );
    expect(blockTitle(undefined)).toBe("Bloque de sesion");
  });
});

describe("boardGeometry — endpoint resolution", () => {
  it("returns the literal point for a point endpoint", () => {
    expect(endpointPoint({ kind: "point", point: { x: 12, y: 34 } }, [])).toEqual(
      { x: 12, y: 34 },
    );
  });

  it("resolves an object endpoint to the object position", () => {
    const token = createPlayerToken(null, { x: 30, y: 40 }, "Pivot", 5);
    expect(
      endpointPoint({ kind: "object", objectId: token.id }, [token]),
    ).toEqual({ x: 30, y: 40 });
  });

  it("falls back to center when the object is missing", () => {
    expect(endpointPoint({ kind: "object", objectId: "ghost" }, [])).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe("boardGeometry — layer visibility", () => {
  const arrow = (semantic: Parameters<typeof createSemanticArrow>[0]): BoardArrow =>
    createSemanticArrow(
      semantic,
      { kind: "point", point: { x: 0, y: 0 } },
      { kind: "point", point: { x: 10, y: 10 } },
    );

  it("ties pass/pressure/run arrows to their layers", () => {
    expect(layerVisibleForArrow(arrow("pass"), new Set(["attack"]))).toBe(true);
    expect(layerVisibleForArrow(arrow("pass"), new Set())).toBe(false);
    expect(
      layerVisibleForArrow(arrow("pressure"), new Set(["defense"])),
    ).toBe(true);
    expect(layerVisibleForArrow(arrow("run"), new Set(["attack"]))).toBe(true);
  });

  it("movement arrows are always visible", () => {
    expect(layerVisibleForArrow(arrow("movement"), new Set())).toBe(true);
  });

  it("a rival-layer arrow is visible as a group, regardless of its semantic", () => {
    // A run normally ties to attack/offensiveTransition; on layer "rival" the
    // whole group is controlled by the overlay lifecycle, not the attack layer.
    const rivalRun = createSemanticArrow(
      "run",
      { kind: "point", point: { x: 40, y: 45 } },
      { kind: "point", point: { x: 12, y: 50 } },
      { layer: "rival" },
    );
    expect(layerVisibleForArrow(rivalRun, new Set<string>())).toBe(true);
  });

  it("zoneVisible gates danger/press/block and lets occupation through", () => {
    expect(zoneVisible("danger", new Set(["defensiveTransition"]))).toBe(true);
    expect(zoneVisible("danger", new Set())).toBe(false);
    expect(zoneVisible("press", new Set(["counterPress"]))).toBe(true);
    expect(zoneVisible("block", new Set(["defense"]))).toBe(true);
    expect(zoneVisible("occupation", new Set())).toBe(true);
  });
});
