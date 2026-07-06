import { describe, expect, it, vi } from "vitest";
import {
  BoardObjectSchema,
  createDefaultBoard,
  type BoardScene,
} from "../src/board";
import type { PlanningBoardPlayer } from "../src/board/productBoardTypes";
import { type BoardObject, createPlayerToken } from "../src/board";
import {
  commitZoneDrag,
  handleCanvasPress,
  labelForTool,
  makeEquipmentLikeObject,
  mergeFormationTokens,
  resolveZoneDragRect,
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

describe("boardTools — mergeFormationTokens (FIX mc-21 2a: formation-change merge)", () => {
  function editedOwnToken(overrides: Partial<BoardObject> = {}): BoardObject {
    return {
      ...createPlayerToken(null, { x: 20, y: 30 }, "Lateral derecho", 2),
      linkedPlayerId: "roster-2",
      role: "Carrilero (manual)",
      note: "Cubrir la espalda del central",
      number: 77,
      ...overrides,
    };
  }

  it("preserves role/note/number from a matched linkedPlayerId and adopts the new position", () => {
    const previous = [editedOwnToken()];
    const rebuilt = tokenFromPlanningPlayer(
      {
        id: "roster-2",
        name: "J. Perez",
        position: "Lateral",
        number: 2,
        traits: "",
        team: "A",
      },
      { x: 72, y: 78 },
      "Extremo izquierdo",
      2,
    );
    const [merged] = mergeFormationTokens(previous, [rebuilt]);
    expect(merged.role).toBe("Carrilero (manual)");
    expect(merged.note).toBe("Cubrir la espalda del central");
    expect(merged.number).toBe(77);
    expect(merged.position).toEqual({ x: 72, y: 78 });
    expect(merged.linkedPlayerId).toBe("roster-2");
  });

  it("does NOT preserve edits on a token without linkedPlayerId (deliberate limit, roster shorter than formation)", () => {
    const previous = [
      editedOwnToken({ linkedPlayerId: undefined, id: "unlinked-1" }),
    ];
    const rebuilt = createPlayerToken(
      null,
      { x: 45, y: 84 },
      "Carrilero",
      9,
    );
    const [merged] = mergeFormationTokens(previous, [rebuilt]);
    // No stable key to match unlinked tokens across a rebuild: the rebuilt
    // token comes through untouched, edits on the old unlinked token are lost.
    expect(merged).toEqual(rebuilt);
    expect(merged.role).not.toBe("Carrilero (manual)");
    expect(merged.note).toBeUndefined();
  });

  it("leaves an unmatched new token (no previous token with that linkedPlayerId) unchanged", () => {
    const previous = [editedOwnToken({ linkedPlayerId: "roster-2" })];
    const rebuilt = tokenFromPlanningPlayer(
      {
        id: "roster-9",
        name: "Nuevo Jugador",
        position: "Central",
        number: 9,
        traits: "",
        team: "A",
      },
      { x: 22, y: 38 },
      "Central",
      9,
    );
    const [merged] = mergeFormationTokens(previous, [rebuilt]);
    expect(merged).toEqual(rebuilt);
  });

  it("does not mutate its inputs (undo safety: history can hold these objects by reference)", () => {
    const previous = [editedOwnToken()];
    const previousSnapshot = JSON.parse(JSON.stringify(previous));
    const rebuilt = tokenFromPlanningPlayer(
      {
        id: "roster-2",
        name: "J. Perez",
        position: "Lateral",
        number: 2,
        traits: "",
        team: "A",
      },
      { x: 72, y: 78 },
      "Extremo izquierdo",
      2,
    );
    const rebuiltSnapshot = JSON.parse(JSON.stringify(rebuilt));
    mergeFormationTokens(previous, [rebuilt]);
    expect(previous).toEqual(previousSnapshot);
    expect(rebuilt).toEqual(rebuiltSnapshot);
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
    expect(setDrawStart).toHaveBeenCalledWith({
      kind: "point",
      point: { x: 10, y: 10 },
    });
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
      drawStart: { kind: "point", point: { x: 10, y: 10 } },
      setDrawStart,
      commitScene,
      updateSceneObjects: vi.fn(),
    });
    expect(commitScene).toHaveBeenCalledTimes(1);
    const patch = commitScene.mock.calls[0][0];
    expect(patch.arrows).toHaveLength(scene.arrows.length + 1);
    expect(setDrawStart).toHaveBeenCalledWith(null);
  });

  it("anchors the start endpoint to a token when the first click hits one", () => {
    const setDrawStart = vi.fn();
    handleCanvasPress({
      point: { x: 40, y: 50 },
      tool: "pass",
      targetId: "player-5",
      scene: freshScene(),
      color: "#fff",
      lineWidth: 2,
      drawStart: null,
      setDrawStart,
      commitScene: vi.fn(),
      updateSceneObjects: vi.fn(),
    });
    expect(setDrawStart).toHaveBeenCalledWith({
      kind: "object",
      objectId: "player-5",
    });
  });

  it("commits a token->token anchored arrow on the second targeted click", () => {
    const commitScene = vi.fn();
    const scene = freshScene();
    handleCanvasPress({
      point: { x: 60, y: 50 },
      tool: "pass",
      targetId: "player-2",
      scene,
      color: "#fff",
      lineWidth: 2,
      drawStart: { kind: "object", objectId: "player-5" },
      setDrawStart: vi.fn(),
      commitScene,
      updateSceneObjects: vi.fn(),
    });
    const arrow = commitScene.mock.calls[0][0].arrows.at(-1);
    expect(arrow.from).toEqual({ kind: "object", objectId: "player-5" });
    expect(arrow.to).toEqual({ kind: "object", objectId: "player-2" });
    expect(arrow.semantic).toBe("pass");
  });

  it("zone tool no longer creates on press — drag-to-create commits on pointerup instead (W8)", () => {
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
    expect(commitScene).not.toHaveBeenCalled();
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

describe("boardTools — resolveZoneDragRect (W8 drag-to-create)", () => {
  it("a click with no movement keeps the existing 20x16 centered rect", () => {
    const rect = resolveZoneDragRect({ x: 40, y: 40 }, { x: 40, y: 40 });
    expect(rect).toEqual({ x: 30, y: 30, w: 20, h: 16 });
  });

  it("movement below the click threshold still falls back to the centered rect", () => {
    const rect = resolveZoneDragRect({ x: 40, y: 40 }, { x: 42, y: 41 });
    expect(rect).toEqual({ x: 30, y: 30, w: 20, h: 16 });
  });

  it("a real drag past the threshold uses the actual rectangle, corners in any order", () => {
    const forward = resolveZoneDragRect({ x: 20, y: 20 }, { x: 40, y: 30 });
    expect(forward).toEqual({ x: 20, y: 20, w: 20, h: 10 });

    // dragged from bottom-right back to top-left — same rect, normalized.
    const reversed = resolveZoneDragRect({ x: 40, y: 30 }, { x: 20, y: 20 });
    expect(reversed).toEqual({ x: 20, y: 20, w: 20, h: 10 });
  });

  it("floors a real-but-tiny drag so it never creates an invisible zone", () => {
    const rect = resolveZoneDragRect({ x: 50, y: 50 }, { x: 53.2, y: 50.5 });
    expect(rect.w).toBe(4);
    expect(rect.h).toBe(4);
  });

  it("clamps a drag near the pitch edge to stay inside the normalized bounds", () => {
    const rect = resolveZoneDragRect({ x: 95, y: 95 }, { x: 100, y: 100 });
    expect(rect.x + rect.w).toBeLessThanOrEqual(100);
    expect(rect.y + rect.h).toBeLessThanOrEqual(100);
  });
});

describe("boardTools — commitZoneDrag (W8: one undo entry per zone, on pointerup)", () => {
  function freshScene(): BoardScene {
    return createDefaultBoard("Test").scenes[0];
  }

  it("commits exactly one zone with the resolved drag rectangle", () => {
    const commitScene = vi.fn();
    const scene = freshScene();
    commitZoneDrag({
      tool: "zone",
      start: { x: 20, y: 20 },
      end: { x: 40, y: 30 },
      scene,
      color: "#1677ff",
      commitScene,
    });
    expect(commitScene).toHaveBeenCalledTimes(1);
    const zones = commitScene.mock.calls[0][0].zones;
    expect(zones).toHaveLength(scene.zones.length + 1);
    const created = zones.at(-1);
    expect(created).toMatchObject({
      semantic: "occupation",
      x: 20,
      y: 20,
      w: 20,
      h: 10,
    });
  });

  it("uses the block semantic for the block tool", () => {
    const commitScene = vi.fn();
    const scene = freshScene();
    commitZoneDrag({
      tool: "block",
      start: { x: 10, y: 10 },
      end: { x: 10, y: 10 },
      scene,
      color: "#1677ff",
      commitScene,
    });
    const created = commitScene.mock.calls[0][0].zones.at(-1);
    expect(created.semantic).toBe("block");
  });
});
