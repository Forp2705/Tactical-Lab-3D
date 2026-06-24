import { describe, expect, it } from "vitest";
import { arrowStyle, zoneStyle } from "../src/board/boardActionStyle";
import {
  BoardArrowSemanticSchema,
  createDefaultBoard,
  createSemanticArrow,
  createTacticalZone,
} from "../src/board/boardModel";
import { tacticalBoardSceneSvgString } from "../src/board/exportBoard";

// P0.3b: una sola fuente de estilo por semantica, compartida por el render
// vivo (canvas) y el export. El export puede simplificar geometria, no color
// ni semantica.
describe("board action style (shared canvas/export source)", () => {
  it("arrowStyle covers every arrow semantic with a valid color", () => {
    for (const semantic of BoardArrowSemanticSchema.options) {
      const style = arrowStyle(semantic);
      expect(style.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(typeof style.dashed).toBe("boolean");
      expect(typeof style.curved).toBe("boolean");
    }
  });

  it("zones bake their color from the shared zoneStyle table", () => {
    const zone = createTacticalZone("danger", 10, 10, 20, 20);
    expect(zone.color).toBe(zoneStyle("danger").color);
  });

  it("export derives arrow color from arrowStyle (no 2-color hardcode)", () => {
    const board = createDefaultBoard("Test");
    const scene = {
      ...board.scenes[0],
      arrows: [
        createSemanticArrow(
          "pressure",
          { kind: "point", point: { x: 10, y: 10 } },
          { kind: "point", point: { x: 30, y: 30 } },
        ),
        createSemanticArrow(
          "cross",
          { kind: "point", point: { x: 40, y: 10 } },
          { kind: "point", point: { x: 60, y: 30 } },
        ),
      ],
    };
    const svg = tacticalBoardSceneSvgString(scene, false);
    // cross ya no colapsa al verde generico: usa su propio color de la tabla.
    expect(svg).toContain(arrowStyle("pressure").color);
    expect(svg).toContain(arrowStyle("cross").color);
  });
});
