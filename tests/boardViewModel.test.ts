import { describe, expect, it } from "vitest";
import {
  createDefaultBoard,
  createPlayerToken,
  createSemanticArrow,
  createTacticalZone,
} from "../src/board";
import {
  boardProjectLabel,
  buildBoardReadiness,
  getActiveLayers,
  resolveActiveBoard,
  resolveActiveScene,
  resolveBoardSelection,
} from "../src/board/boardViewModel";
import type { SessionBlock } from "../src/data";

describe("resolveActiveBoard", () => {
  const a = createDefaultBoard("A");
  const b = createDefaultBoard("B");

  it("finds the board by active id", () => {
    expect(resolveActiveBoard([a, b], b.id)).toBe(b);
  });

  it("falls back to the only board when there is no active id", () => {
    expect(resolveActiveBoard([a], null)).toBe(a);
  });

  it("returns null when ambiguous or missing", () => {
    expect(resolveActiveBoard([a, b], null)).toBeNull();
    expect(resolveActiveBoard([], "x")).toBeNull();
  });
});

describe("resolveActiveScene", () => {
  const board = createDefaultBoard("A");

  it("finds the scene by id, else the first scene, else null", () => {
    expect(resolveActiveScene(board, board.scenes[0].id)).toBe(board.scenes[0]);
    expect(resolveActiveScene(board, "ghost")).toBe(board.scenes[0]);
    expect(resolveActiveScene(null, "x")).toBeNull();
  });
});

describe("resolveBoardSelection", () => {
  const token = createPlayerToken(null, { x: 30, y: 40 }, "Pivot", 5);
  const arrow = createSemanticArrow(
    "pass",
    { kind: "point", point: { x: 0, y: 0 } },
    { kind: "point", point: { x: 10, y: 10 } },
  );
  const zone = createTacticalZone("occupation", 10, 10, 20, 20, {
    label: "Zona",
  });
  const scene = {
    ...createDefaultBoard("A").scenes[0],
    objects: [token],
    arrows: [arrow],
    zones: [zone],
  };

  it("resolves the selected object/arrow/zone", () => {
    expect(
      resolveBoardSelection({ kind: "object", id: token.id }, scene)
        .selectedObject,
    ).toBe(token);
    expect(
      resolveBoardSelection({ kind: "arrow", id: arrow.id }, scene)
        .selectedArrow,
    ).toBe(arrow);
    expect(
      resolveBoardSelection({ kind: "zone", id: zone.id }, scene).selectedZone,
    ).toBe(zone);
  });

  it("returns all-null when nothing is selected", () => {
    const resolved = resolveBoardSelection(null, scene);
    expect(resolved.selectedObject).toBeNull();
    expect(resolved.selectedArrow).toBeNull();
    expect(resolved.selectedZone).toBeNull();
  });
});

describe("getActiveLayers", () => {
  it("returns only the visible layer ids", () => {
    const layers = [
      { id: "attack", name: "Ataque", visible: true },
      { id: "defense", name: "Defensa", visible: false },
      { id: "midBlock", name: "Bloque", visible: true },
    ];
    expect(getActiveLayers(layers)).toEqual(new Set(["attack", "midBlock"]));
  });
});

describe("buildBoardReadiness", () => {
  it("reflects focus/session/brief/notes state", () => {
    const board = createDefaultBoard("A");
    const scene = { ...board.scenes[0], notes: "", instructions: [] };
    const readiness = buildBoardReadiness(board, [], scene);
    expect(readiness).toContain("Sin sesion");
    expect(readiness).toContain("Faltan instrucciones visibles");
    expect(readiness).toContain("Sin notas staff");

    const linkedBlocks = [{ id: "b1", boardId: board.id }] as SessionBlock[];
    expect(buildBoardReadiness(board, linkedBlocks, scene)).toContain(
      "Sesion vinculada",
    );
  });
});

describe("boardProjectLabel", () => {
  it("switches on a weekly focus problem", () => {
    expect(boardProjectLabel("salida bajo presion")).toBe(
      "Foco semanal activo",
    );
    expect(boardProjectLabel(undefined)).toBe("Partido vs. Rojos FC");
    expect(boardProjectLabel("")).toBe("Partido vs. Rojos FC");
  });
});
