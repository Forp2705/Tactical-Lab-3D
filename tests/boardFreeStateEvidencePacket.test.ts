import { describe, it, expect } from "vitest";
import {
  BoardFreeStateEvidencePacketSchema,
  buildBoardFreeStateEvidencePacket,
  parseIncomingBoardFreeState,
} from "@/board/boardFreeStateEvidencePacket";
import {
  createDefaultBoard,
  createOpponentShape,
  createPlayerToken,
  createSemanticArrow,
  createTacticalZone,
} from "@/board";
import { makeEquipmentLikeObject } from "@/board/boardTools";

describe("buildBoardFreeStateEvidencePacket", () => {
  it("counts declared facts only — own/rival formation, token counts, object counts by declared semantic, active scene, visible layers", () => {
    const board = createDefaultBoard("Test");
    const scene = {
      ...board.scenes[0],
      objects: [
        createPlayerToken(null, { x: 10, y: 10 }, "Lateral", 2),
        createPlayerToken(null, { x: 20, y: 20 }, "Central", 4),
        ...createOpponentShape("4-4-2"),
        makeEquipmentLikeObject("note", "Recordar salida corta", { x: 5, y: 5 }, "#fff"),
      ],
      arrows: [
        createSemanticArrow("pass", { kind: "point", point: { x: 0, y: 0 } }, { kind: "point", point: { x: 1, y: 1 } }),
        createSemanticArrow("pass", { kind: "point", point: { x: 0, y: 0 } }, { kind: "point", point: { x: 1, y: 1 } }),
        createSemanticArrow("pressure", { kind: "point", point: { x: 0, y: 0 } }, { kind: "point", point: { x: 1, y: 1 } }),
      ],
      zones: [
        createTacticalZone("occupation", 10, 10, 20, 20, { label: "Zona A" }),
      ],
    };
    const boardWithScene = { ...board, scenes: [scene] };
    const activeLayers = new Set(["attack", "defense"]);

    const packet = buildBoardFreeStateEvidencePacket(
      boardWithScene,
      scene,
      "4-3-3",
      activeLayers,
    );

    expect(() => BoardFreeStateEvidencePacketSchema.parse(packet)).not.toThrow();
    expect(packet.source).toBe("boardFreeState");
    expect(packet.scope).toBe("currentScene");
    expect(packet.boardId).toBe(boardWithScene.id);
    expect(packet.sceneId).toBe(scene.id);

    const claims = packet.freeStateEvidence.factualClaims;
    const byId = Object.fromEntries(claims.map((c) => [c.id, c]));

    expect(byId["formation-own"]).toMatchObject({ kind: "formation", side: "own", formation: "4-3-3" });
    expect(byId["formation-rival"]).toMatchObject({ kind: "formation", side: "rival", formation: "4-4-2" });
    expect(byId["token-count-own"]).toMatchObject({ kind: "tokenCount", side: "own", count: 2 });
    expect(byId["token-count-rival"]).toMatchObject({ kind: "tokenCount", side: "rival", count: 11 });
    expect(byId["object-count-arrow-pass"]).toMatchObject({ kind: "objectCount", objectType: "arrow", semantic: "pass", count: 2 });
    expect(byId["object-count-arrow-pressure"]).toMatchObject({ kind: "objectCount", objectType: "arrow", semantic: "pressure", count: 1 });
    expect(byId["object-count-zone-occupation"]).toMatchObject({ kind: "objectCount", objectType: "zone", semantic: "occupation", count: 1 });
    expect(byId["object-count-note"]).toMatchObject({ kind: "objectCount", objectType: "note", count: 1 });
    expect(byId["object-count-note"].semantic).toBeUndefined();
    expect(byId["scene-active"]).toMatchObject({ kind: "scene", title: scene.title, index: 0, totalScenes: 1 });
    expect(byId["layers-visible"]).toMatchObject({ kind: "layers", visible: ["attack", "defense"] });

    // no invented tactical claims: only the kinds above ever appear
    const kinds = new Set(claims.map((c) => c.kind));
    expect(kinds).toEqual(new Set(["formation", "tokenCount", "objectCount", "scene", "layers"]));
  });

  it("never includes positions/coordinates anywhere in the packet", () => {
    const board = createDefaultBoard("Test");
    const scene = {
      ...board.scenes[0],
      objects: [createPlayerToken(null, { x: 42, y: 99 }, "9", 9)],
    };
    const packet = buildBoardFreeStateEvidencePacket(
      { ...board, scenes: [scene] },
      scene,
      "4-3-3",
      new Set(),
    );
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toMatch(/"x":\s*42/);
    expect(serialized).not.toMatch(/"y":\s*99/);
  });

  it("omits the note claim entirely when there are no notes (no zero-count claim)", () => {
    const board = createDefaultBoard("Test");
    const scene = { ...board.scenes[0], objects: [] };
    const packet = buildBoardFreeStateEvidencePacket(
      { ...board, scenes: [scene] },
      scene,
      "4-3-3",
      new Set(),
    );
    expect(
      packet.freeStateEvidence.factualClaims.some((c) => c.id === "object-count-note"),
    ).toBe(false);
  });

  it("produces deterministic ids across two builds of the same content (not random)", () => {
    const board = createDefaultBoard("Test");
    const scene = {
      ...board.scenes[0],
      arrows: [createSemanticArrow("pass", { kind: "point", point: { x: 0, y: 0 } }, { kind: "point", point: { x: 1, y: 1 } })],
    };
    const boardWithScene = { ...board, scenes: [scene] };
    const first = buildBoardFreeStateEvidencePacket(boardWithScene, scene, "4-3-3", new Set(["attack"]));
    const second = buildBoardFreeStateEvidencePacket(boardWithScene, scene, "4-3-3", new Set(["attack"]));
    expect(first.freeStateEvidence.factualClaims.map((c) => c.id)).toEqual(
      second.freeStateEvidence.factualClaims.map((c) => c.id),
    );
  });
});

describe("BoardFreeStateEvidencePacketSchema / parseIncomingBoardFreeState", () => {
  function validPacket() {
    const board = createDefaultBoard("Test");
    const scene = board.scenes[0];
    return buildBoardFreeStateEvidencePacket(board, scene, "4-3-3", new Set());
  }

  it("absent (undefined/null) parses as absent, not malformed", () => {
    expect(parseIncomingBoardFreeState(undefined)).toEqual({ status: "absent" });
    expect(parseIncomingBoardFreeState(null)).toEqual({ status: "absent" });
  });

  it("a well-formed packet parses ok", () => {
    const result = parseIncomingBoardFreeState(validPacket());
    expect(result.status).toBe("ok");
  });

  it("rejects a packet with the wrong source literal (malformed, not silently absent)", () => {
    const packet = { ...validPacket(), source: "boardScenario" };
    expect(parseIncomingBoardFreeState(packet)).toEqual({ status: "malformed" });
  });

  it("rejects duplicate claim ids (malformed)", () => {
    const packet = validPacket();
    const dup = {
      ...packet,
      freeStateEvidence: {
        ...packet.freeStateEvidence,
        factualClaims: [
          ...packet.freeStateEvidence.factualClaims,
          packet.freeStateEvidence.factualClaims[0],
        ],
      },
    };
    expect(parseIncomingBoardFreeState(dup).status).toBe("malformed");
  });

  it("rejects a claim with grounded:false (schema only allows the literal true)", () => {
    const packet = validPacket();
    const bad = {
      ...packet,
      freeStateEvidence: {
        ...packet.freeStateEvidence,
        factualClaims: [
          { id: "formation-own", kind: "formation", side: "own", formation: "4-3-3", grounded: false },
        ],
      },
    };
    expect(parseIncomingBoardFreeState(bad).status).toBe("malformed");
  });

  it("rejects an objectCount claim with count 0 (min 1 — zero counts are omitted, not sent as 0)", () => {
    const packet = validPacket();
    const bad = {
      ...packet,
      freeStateEvidence: {
        ...packet.freeStateEvidence,
        factualClaims: [
          { id: "object-count-note", kind: "objectCount", objectType: "note", count: 0, grounded: true },
        ],
      },
    };
    expect(parseIncomingBoardFreeState(bad).status).toBe("malformed");
  });

  it("rejects an unrelated shape entirely (malformed)", () => {
    expect(parseIncomingBoardFreeState({ foo: "bar" })).toEqual({ status: "malformed" });
    expect(parseIncomingBoardFreeState("not an object")).toEqual({ status: "malformed" });
  });
});
