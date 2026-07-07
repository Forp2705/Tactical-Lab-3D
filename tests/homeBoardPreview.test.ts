import { describe, expect, it } from "vitest";
import { createDefaultBoard } from "../src/board";
import type { TacticalBoard } from "../src/board";
import type { Player } from "../src/data";
import {
  clampChipLabel,
  deriveHomeBoardPreview,
  toVerticalPitch,
} from "../src/home/homeBoardPreview";
import { useAppStore } from "../src/state/useAppStore";
import type { LineupLabShape } from "../src/state/useAppStore";

function makePlayer(id: string, num: number): Player {
  return {
    id,
    name: `Jugador ${num}`,
    num,
    positions: ["CM"],
    foot: "R",
    status: "available",
    profile: "Perfil de prueba",
    attributes: {
      speed: 60,
      stamina: 60,
      pass: 60,
      control: 60,
      press: 60,
      duel: 60,
      tactical: 60,
    },
  };
}

function makeShape(
  id: string,
  name: string,
  createdAt: number,
  positions: LineupLabShape["positions"],
): LineupLabShape {
  return { id, name, phase: "attack", positions, createdAt };
}

const emptyInput = {
  tacticalBoards: [] as TacticalBoard[],
  activeBoardId: null,
  activeBoardSceneId: null,
  shapes: [] as LineupLabShape[],
  players: [] as Player[],
};

describe("toVerticalPitch (mapeo de ejes horizontal -> vertical)", () => {
  it("manda el arco propio (x=0-8) abajo del pitch vertical", () => {
    // GK propio del board default: x=8 (largo), y=50 (ancho centrado).
    expect(toVerticalPitch({ x: 8, y: 50 })).toEqual({ x: 50, y: 92 });
  });

  it("manda el arco rival (x~100) arriba del pitch vertical", () => {
    expect(toVerticalPitch({ x: 94, y: 50 })).toEqual({ x: 50, y: 6 });
  });

  it("mantiene el eje ancho como horizontal", () => {
    expect(toVerticalPitch({ x: 50, y: 20 })).toEqual({ x: 20, y: 50 });
  });
});

describe("clampChipLabel", () => {
  it("deja pasar hasta 16 chars", () => {
    expect(clampChipLabel("1234567890123456")).toBe("1234567890123456");
  });

  it("clampa a 16 con ellipsis si se pasa", () => {
    const clamped = clampChipLabel("12345678901234567");
    expect(clamped).toHaveLength(16);
    expect(clamped.endsWith("…")).toBe(true);
  });
});

describe("deriveHomeBoardPreview — prioridad de fuente", () => {
  it("sin board ni shapes devuelve vacio", () => {
    expect(deriveHomeBoardPreview(emptyInput)).toEqual({ kind: "empty" });
  });

  it("board activo gana sobre shapes", () => {
    const board = createDefaultBoard("Plan A");
    const shape = makeShape("s1", "Shape", 10, { p1: { x: 50, y: 50 } });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
      shapes: [shape],
    });
    expect(preview.kind).toBe("board");
  });

  it("activeBoardId que no resuelve cae a la rama shape (no crashea)", () => {
    const board = createDefaultBoard("Plan A");
    const shape = makeShape("s1", "Bloque medio", 10, {
      p1: { x: 50, y: 50 },
    });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: "board-que-no-existe",
      shapes: [shape],
    });
    expect(preview.kind).toBe("shape");
  });
});

describe("deriveHomeBoardPreview — rama board", () => {
  it("renderiza fichas A/B reales de la escena y la pelota, sin inventos", () => {
    const players = [makePlayer("p1", 25)];
    const board = createDefaultBoard("Salida vs presion", { players });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
      players,
    });
    if (preview.kind !== "board") throw new Error("expected board branch");
    const teamA = preview.tokens.filter((token) => token.team === "A");
    const teamB = preview.tokens.filter((token) => token.team === "B");
    expect(teamA).toHaveLength(11);
    expect(teamB).toHaveLength(11);
    expect(preview.ball).not.toBeNull();
    // El player linkeado conserva su dorsal real.
    expect(teamA.some((token) => token.number === 25)).toBe(true);
    // Coords ya en espacio vertical 0-100.
    for (const token of preview.tokens) {
      expect(token.x).toBeGreaterThanOrEqual(0);
      expect(token.x).toBeLessThanOrEqual(100);
      expect(token.y).toBeGreaterThanOrEqual(0);
      expect(token.y).toBeLessThanOrEqual(100);
    }
  });

  it("ignora objetos que no son fichas (note/equipmentMarker)", () => {
    const board = createDefaultBoard("Plan");
    board.scenes[0].objects.push({
      id: "note-1",
      type: "note",
      label: "Nota",
      position: { x: 50, y: 50 },
      rotationDeg: 0,
      style: {},
      visibility: "staff",
      locked: false,
      isDangerPlayer: false,
    });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
    });
    if (preview.kind !== "board") throw new Error("expected board branch");
    expect(preview.tokens).toHaveLength(22);
  });

  it("usa la escena activa si existe y cae a la primera si el sceneId es stale", () => {
    const board = createDefaultBoard("Plan");
    const stale = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
      activeBoardSceneId: "scene-inexistente",
    });
    if (stale.kind !== "board") throw new Error("expected board branch");
    expect(stale.tokens.length).toBeGreaterThan(0);

    const active = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
      activeBoardSceneId: board.scenes[0].id,
    });
    expect(active).toEqual(stale);
  });

  it("clampa el chip al titulo del board", () => {
    const board = createDefaultBoard(
      "Un titulo largo de pizarra que no entra en el chip",
    );
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      tacticalBoards: [board],
      activeBoardId: board.id,
    });
    if (preview.kind !== "board") throw new Error("expected board branch");
    expect(preview.chip).toHaveLength(16);
    expect(preview.chip.endsWith("…")).toBe(true);
  });
});

describe("deriveHomeBoardPreview — rama shape", () => {
  it("elige la shape mas reciente por createdAt", () => {
    const older = makeShape("s1", "Vieja", 100, { p1: { x: 10, y: 50 } });
    const newer = makeShape("s2", "Nueva", 200, { p1: { x: 90, y: 50 } });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      shapes: [newer, older],
    });
    if (preview.kind !== "shape") throw new Error("expected shape branch");
    expect(preview.chip).toBe("Nueva");
  });

  it("resuelve dorsales contra el plantel y deja sin numero los que no resuelven", () => {
    const players = [makePlayer("p1", 5)];
    const shape = makeShape("s1", "Bloque", 100, {
      p1: { x: 7, y: 50 },
      fantasma: { x: 80, y: 30 },
    });
    const preview = deriveHomeBoardPreview({
      ...emptyInput,
      shapes: [shape],
      players,
    });
    if (preview.kind !== "shape") throw new Error("expected shape branch");
    expect(preview.tokens).toHaveLength(2);
    const known = preview.tokens.find((token) => token.id === "p1");
    const unknown = preview.tokens.find((token) => token.id === "fantasma");
    expect(known?.number).toBe(5);
    expect(known?.team).toBe("A");
    // GK propio (x=7 horizontal) queda abajo en el pitch vertical.
    expect(known?.y).toBe(93);
    expect(unknown?.number).toBeUndefined();
  });
});

describe("deriveHomeBoardPreview — rama demo (W12: seed del workspace demo)", () => {
  it("el workspace demo siembra una shape y el preview muestra el XI con dorsales", () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.getState().loadDemoWorkspace();
    const state = useAppStore.getState();

    const preview = deriveHomeBoardPreview({
      tacticalBoards: state.tacticalBoards,
      activeBoardId: state.activeBoardId,
      activeBoardSceneId: state.activeBoardSceneId,
      shapes: state.lineupLab.shapes,
      players: state.team.players,
    });

    if (preview.kind !== "shape") throw new Error("expected shape branch");
    expect(preview.chip).toBe("4-3-3 base");
    expect(preview.tokens).toHaveLength(11);
    // Todos los tokens resuelven contra el plantel demo: dorsal real, sin invento.
    for (const token of preview.tokens) {
      expect(token.team).toBe("A");
      expect(token.number).toBeGreaterThanOrEqual(1);
      expect(token.number).toBeLessThanOrEqual(11);
    }
    // GK propio abajo del pitch vertical (x=7 horizontal -> y=93).
    const gk = preview.tokens.find((token) => token.number === 1);
    expect(gk?.y).toBe(93);
  });

  it("el workspace real NO siembra shapes: el vacio honesto queda intacto", () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.getState().loadDemoWorkspace();
    useAppStore.getState().loadRealWorkspace();
    const state = useAppStore.getState();

    expect(state.lineupLab.shapes).toHaveLength(0);
    const preview = deriveHomeBoardPreview({
      tacticalBoards: state.tacticalBoards,
      activeBoardId: state.activeBoardId,
      activeBoardSceneId: state.activeBoardSceneId,
      shapes: state.lineupLab.shapes,
      players: state.team.players,
    });
    expect(preview).toEqual({ kind: "empty" });
  });
});
