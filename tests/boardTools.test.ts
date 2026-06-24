import { describe, expect, it, vi } from "vitest";
import {
  BoardObjectSchema,
  createDefaultBoard,
  type BoardScene,
} from "../src/board";
import type { PlanningBoardPlayer } from "../src/board/productBoardTypes";
import {
  handleCanvasPress,
  labelForTool,
  makeEquipmentLikeObject,
  semanticForTool,
  tokenFromPlanningPlayer,
} from "../src/board/boardTools";

describe("boardTools — tool semantics", () => {
  it("drawing tools are 1:1 with the arrow semantic (no lossy collapse)", () => {
    expect(semanticForTool("pass")).toBe("pass");
    expect(semanticForTool("longPass")).toBe("longPass");
    expect(semanticForTool("cross")).toBe("cross");
    expect(semanticForTool("switch")).toBe("switch");
    expect(semanticForTool("carry")).toBe("carry");
    expect(semanticForTool("support")).toBe("support");
    expect(semanticForTool("pressure")).toBe("pressure");
    expect(semanticForTool("mark")).toBe("mark");
    expect(semanticForTool("run")).toBe("run");
    expect(semanticForTool("movement")).toBe("movement");
    expect(semanticForTool("shot")).toBe("shot");
  });

  it("returns null for non-arrow tools", () => {
    expect(semanticForTool("select")).toBeNull();
    expect(semanticForTool("zone")).toBeNull();
    expect(semanticForTool("cone")).toBeNull();
    expect(semanticForTool("block")).toBeNull();
  });

  it("labelForTool resolves human labels", () => {
    expect(labelForTool("pass")).toBe("Pase");
    expect(labelForTool("block")).toBe("Bloque");
  });
});

describe("boardTools — object factories", () => {
  it("makeEquipmentLikeObject builds a schema-valid object", () => {
    const note = makeEquipmentLikeObject(
      "note",
      "Buscar pase",
      { x: 20, y: 30 },
      "#facc15",
    );
    expect(note.type).toBe("note");
    expect(note.label).toBe("Buscar pase");
    expect(note.position).toEqual({ x: 20, y: 30 });
    expect(note.visibility).toBe("player");
    expect(() => BoardObjectSchema.parse(note)).not.toThrow();
  });

  it("tokenFromPlanningPlayer links roster when the number is numeric", () => {
    const player: PlanningBoardPlayer = {
      id: "p-6",
      name: "Pivot Central",
      position: "Mediocentro",
      number: 6,
      traits: "salida",
      team: "A",
      role: "Pivote",
      task: "ordenar",
    };
    const token = tokenFromPlanningPlayer(player, { x: 40, y: 50 }, "Pivote", 99);
    expect(token.label).toBe("Pivot Central");
    expect(token.number).toBe(6);
    expect(token.linkedPlayerId).toBe("p-6");
    expect(token.rosterLink?.number).toBe(6);
  });

  it("tokenFromPlanningPlayer omits roster link and uses fallback for a non-numeric number", () => {
    const player: PlanningBoardPlayer = {
      id: "p-x",
      name: "Sin numero",
      position: "Lateral",
      number: "",
      traits: "",
      team: "A",
    };
    const token = tokenFromPlanningPlayer(player, { x: 10, y: 10 }, "Lateral", 12);
    expect(token.number).toBe(12);
    expect(token.rosterLink).toBeUndefined();
  });
});

describe("boardTools — handleCanvasPress", () => {
  function freshScene(): BoardScene {
    return createDefaultBoard("Test").scenes[0];
  }

  it("arms drawStart on the first arrow click without committing", () => {
    const setDrawStart = vi.fn();
    const commitScene = vi.fn();
    const updateSceneObjects = vi.fn();
    handleCanvasPress({
      point: { x: 10, y: 10 },
      tool: "pass",
      scene: freshScene(),
      color: "#fff",
      lineWidth: 2,
      drawStart: null,
      setDrawStart,
      commitScene,
      updateSceneObjects,
    });
    expect(setDrawStart).toHaveBeenCalledWith({ x: 10, y: 10 });
    expect(commitScene).not.toHaveBeenCalled();
  });

  it("commits an arrow on the second click and clears drawStart", () => {
    const setDrawStart = vi.fn();
    const commitScene = vi.fn();
    const scene = freshScene();
    handleCanvasPress({
      point: { x: 30, y: 30 },
      tool: "pass",
      scene,
      color: "#fff",
      lineWidth: 2,
      drawStart: { x: 10, y: 10 },
      setDrawStart,
      commitScene,
      updateSceneObjects: vi.fn(),
    });
    expect(commitScene).toHaveBeenCalledTimes(1);
    const patch = commitScene.mock.calls[0][0];
    expect(patch.arrows).toHaveLength(scene.arrows.length + 1);
    expect(setDrawStart).toHaveBeenCalledWith(null);
  });

  it("zone tool appends a zone", () => {
    const commitScene = vi.fn();
    const scene = freshScene();
    handleCanvasPress({
      point: { x: 40, y: 40 },
      tool: "zone",
      scene,
      color: "#fff",
      lineWidth: 2,
      drawStart: null,
      setDrawStart: vi.fn(),
      commitScene,
      updateSceneObjects: vi.fn(),
    });
    expect(commitScene.mock.calls[0][0].zones).toHaveLength(
      scene.zones.length + 1,
    );
  });

  it("equipment tools append a scene object", () => {
    const updateSceneObjects = vi.fn();
    const scene = freshScene();
    handleCanvasPress({
      point: { x: 50, y: 50 },
      tool: "cone",
      scene,
      color: "#fff",
      lineWidth: 2,
      drawStart: null,
      setDrawStart: vi.fn(),
      commitScene: vi.fn(),
      updateSceneObjects,
    });
    expect(updateSceneObjects.mock.calls[0][0]).toHaveLength(
      scene.objects.length + 1,
    );
  });
});
