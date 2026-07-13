import { describe, expect, it, vi } from "vitest";
import {
  BoardObjectSchema,
  createDefaultBoard,
  type BoardScene,
} from "../src/board";
import type { PlanningBoardPlayer } from "../src/board/productBoardTypes";
import { type BoardObject, createPlayerToken } from "../src/board";
import {
  buildArrowFromGestureCommit,
  commitZoneDrag,
  handleCanvasPress,
  IDLE_ARROW_GESTURE,
  labelForTool,
  makeEquipmentLikeObject,
  mergeFormationTokens,
  resolveArrowHintText,
  resolveZoneDragRect,
  semanticForTool,
  stepArrowGestureOnPointerDown,
  stepArrowGestureOnPointerUp,
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

describe("boardTools — handleCanvasPress (equipment-only since W24A; zones/arrows resolve elsewhere)", () => {
  function freshScene(): BoardScene {
    return createDefaultBoard("Test").scenes[0];
  }

  it("zone tool no longer creates on press — drag-to-create commits on pointerup instead (W8)", () => {
    const scene = freshScene();
    const updateSceneObjects = vi.fn();
    handleCanvasPress({
      point: { x: 40, y: 40 },
      tool: "zone",
      scene,
      color: "#fff",
      updateSceneObjects,
    });
    expect(updateSceneObjects).not.toHaveBeenCalled();
  });

  it("arrow tools do not touch scene objects — resolved by the arrow gesture state machine instead (W24A)", () => {
    const scene = freshScene();
    const updateSceneObjects = vi.fn();
    handleCanvasPress({
      point: { x: 40, y: 40 },
      tool: "pass",
      scene,
      color: "#fff",
      updateSceneObjects,
    });
    expect(updateSceneObjects).not.toHaveBeenCalled();
  });

  it("equipment tools append a scene object", () => {
    const updateSceneObjects = vi.fn();
    const scene = freshScene();
    handleCanvasPress({
      point: { x: 50, y: 50 },
      tool: "cone",
      scene,
      color: "#fff",
      updateSceneObjects,
    });
    expect(updateSceneObjects.mock.calls[0][0]).toHaveLength(
      scene.objects.length + 1,
    );
  });
});

describe("boardTools — arrow gesture state machine (W24A: drag-to-create + click-click fallback, no ghost arrow)", () => {
  const originToken = (id: string) =>
    ({ kind: "object", objectId: id }) as const;
  const freePoint = (x: number, y: number) =>
    ({ kind: "point", point: { x, y } }) as const;

  describe("stepArrowGestureOnPointerDown", () => {
    it("a fresh press (idle) always goes to pending — never commits, never arms directly", () => {
      const result = stepArrowGestureOnPointerDown(
        IDLE_ARROW_GESTURE,
        originToken("player-5"),
        { x: 40, y: 50 },
      );
      expect(result.next).toEqual({
        phase: "pending",
        origin: originToken("player-5"),
        anchor: { x: 40, y: 50 },
      });
      expect(result.commit).toBeUndefined();
      expect(result.cancelledSameToken).toBeUndefined();
    });

    it("a press while armed on a DIFFERENT token commits the arrow and returns to idle", () => {
      const armed = { phase: "armed" as const, origin: originToken("player-5") };
      const result = stepArrowGestureOnPointerDown(
        armed,
        originToken("player-2"),
        { x: 60, y: 50 },
      );
      expect(result.commit).toEqual({
        origin: originToken("player-5"),
        endpoint: originToken("player-2"),
      });
      expect(result.next).toEqual(IDLE_ARROW_GESTURE);
    });

    it("a press while armed on the SAME token cancels with feedback, never a silent no-op", () => {
      const armed = { phase: "armed" as const, origin: originToken("player-5") };
      const result = stepArrowGestureOnPointerDown(
        armed,
        originToken("player-5"),
        { x: 40, y: 50 },
      );
      expect(result.cancelledSameToken).toBe(true);
      expect(result.commit).toBeUndefined();
      expect(result.next).toEqual(IDLE_ARROW_GESTURE);
    });
  });

  describe("stepArrowGestureOnPointerUp", () => {
    it("releasing below the drag threshold arms the origin (click-click fallback, first click)", () => {
      const pending = {
        phase: "pending" as const,
        origin: freePoint(10, 10),
        anchor: { x: 10, y: 10 },
      };
      const result = stepArrowGestureOnPointerUp(
        pending,
        { x: 10.5, y: 9.8 },
        freePoint(10.5, 9.8),
      );
      expect(result.next).toEqual({ phase: "armed", origin: freePoint(10, 10) });
      expect(result.commit).toBeUndefined();
    });

    it("releasing past the drag threshold on a different endpoint commits immediately (drag-to-create)", () => {
      const pending = {
        phase: "pending" as const,
        origin: originToken("player-5"),
        anchor: { x: 40, y: 50 },
      };
      const result = stepArrowGestureOnPointerUp(
        pending,
        { x: 60, y: 50 },
        originToken("player-2"),
      );
      expect(result.commit).toEqual({
        origin: originToken("player-5"),
        endpoint: originToken("player-2"),
      });
      expect(result.next).toEqual(IDLE_ARROW_GESTURE);
    });

    it("a drag that starts and ends on the same token cancels with feedback (not a silent no-op)", () => {
      const pending = {
        phase: "pending" as const,
        origin: originToken("player-5"),
        anchor: { x: 40, y: 50 },
      };
      // Movement past the drag threshold (>= 3 units), but the release still
      // resolves to the SAME token (e.g. the drag looped back over it).
      const result = stepArrowGestureOnPointerUp(
        pending,
        { x: 45, y: 50 },
        originToken("player-5"),
      );
      expect(result.cancelledSameToken).toBe(true);
      expect(result.next).toEqual(IDLE_ARROW_GESTURE);
    });

    it("REGRESSION (audit H3 ghost arrow): an incomplete drag never leaves the origin armed for the next unrelated click", () => {
      // Old bug: pointerdown armed drawStart immediately; a drag's pointerup
      // did nothing, so the origin stayed silently armed and the NEXT press
      // anywhere committed an unwanted arrow. Here: pointerdown -> pending,
      // pointerup resolves it THERE (drag => commit/cancel now), so idle is
      // the only state carried into the next gesture.
      const down = stepArrowGestureOnPointerDown(
        IDLE_ARROW_GESTURE,
        originToken("player-5"),
        { x: 40, y: 50 },
      );
      const up = stepArrowGestureOnPointerUp(
        down.next,
        { x: 70, y: 50 },
        originToken("player-9"),
      );
      expect(up.commit).toEqual({
        origin: originToken("player-5"),
        endpoint: originToken("player-9"),
      });
      expect(up.next).toEqual(IDLE_ARROW_GESTURE);

      // The very next press, anywhere, must start a brand-new gesture — it
      // must NOT silently commit against the drag's origin.
      const nextDown = stepArrowGestureOnPointerDown(
        up.next,
        freePoint(5, 5),
        { x: 5, y: 5 },
      );
      expect(nextDown.commit).toBeUndefined();
      expect(nextDown.next.phase).toBe("pending");
    });

    it("a pointerup while NOT pending (e.g. a stray mouseup once already armed) is a no-op — no ghost re-arm", () => {
      const armed = { phase: "armed" as const, origin: originToken("player-5") };
      const result = stepArrowGestureOnPointerUp(
        armed,
        { x: 99, y: 99 },
        freePoint(99, 99),
      );
      expect(result).toEqual({ next: armed });
    });

    it("a pointerup while idle is a no-op", () => {
      const result = stepArrowGestureOnPointerUp(
        IDLE_ARROW_GESTURE,
        { x: 1, y: 1 },
        freePoint(1, 1),
      );
      expect(result).toEqual({ next: IDLE_ARROW_GESTURE });
    });
  });

  describe("buildArrowFromGestureCommit", () => {
    it("builds a schema-valid arrow with the tool's semantic from a commit result", () => {
      const arrow = buildArrowFromGestureCommit(
        { origin: originToken("player-5"), endpoint: originToken("player-2") },
        "pass",
        { color: "#fff", tone: "2" },
      );
      expect(arrow?.semantic).toBe("pass");
      expect(arrow?.from).toEqual(originToken("player-5"));
      expect(arrow?.to).toEqual(originToken("player-2"));
    });

    it("returns null for a non-arrow tool (defensive — should never be called this way)", () => {
      const arrow = buildArrowFromGestureCommit(
        { origin: freePoint(1, 1), endpoint: freePoint(2, 2) },
        "zone",
        { color: "#fff", tone: "2" },
      );
      expect(arrow).toBeNull();
    });
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

describe("boardTools — resolveArrowHintText (FIXUP W25B: la razon del block le gana al hint pasivo)", () => {
  it("una razon de block vigente gana siempre, tool de flecha activa o no", () => {
    expect(
      resolveArrowHintText({
        grammarBlockReason: "El 9 ya tiene un desmarque...",
        isArrowToolActive: true,
        armed: false,
      }),
    ).toBe("El 9 ya tiene un desmarque...");
    expect(
      resolveArrowHintText({
        grammarBlockReason: "El 9 ya tiene un desmarque...",
        isArrowToolActive: false,
        armed: false,
      }),
    ).toBe("El 9 ya tiene un desmarque...");
  });

  it("una razon de block vigente gana incluso con el origen ya armado (segundo click pendiente)", () => {
    expect(
      resolveArrowHintText({
        grammarBlockReason: "El 9 ya tiene un desmarque...",
        isArrowToolActive: true,
        armed: true,
      }),
    ).toBe("El 9 ya tiene un desmarque...");
  });

  it("sin razon de block y tool inactiva: silencio (null, no un hint fantasma)", () => {
    expect(
      resolveArrowHintText({
        grammarBlockReason: null,
        isArrowToolActive: false,
        armed: false,
      }),
    ).toBeNull();
  });

  it("sin razon de block: el hint pasivo vuelve, texto segun armed/no-armed", () => {
    expect(
      resolveArrowHintText({
        grammarBlockReason: null,
        isArrowToolActive: true,
        armed: false,
      }),
    ).toMatch(/Arrastra de origen a destino/);
    expect(
      resolveArrowHintText({
        grammarBlockReason: null,
        isArrowToolActive: true,
        armed: true,
      }),
    ).toMatch(/Origen fijado/);
  });
});
