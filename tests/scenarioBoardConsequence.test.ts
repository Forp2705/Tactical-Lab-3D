import { describe, expect, it } from "vitest";
import {
  buildConsequenceOverlay,
  detectAttackDir,
  resolveRivalActors,
} from "@/board/scenarioBoardConsequence";
import {
  createDefaultBoardScene,
  createOpponentToken,
  createPlayerToken,
  type BoardObject,
  type BoardZone,
} from "@/board/boardModel";
import { isInsideZoneRect } from "@/board/productBoardTypes";
import { simulateScenario } from "@/ai/scenarioSimulator";
import { DEFAULT_GAME_MODEL } from "@/data/gameModel";
import type { Player } from "@/data";

function sceneWith(objects: BoardObject[]) {
  return { ...createDefaultBoardScene("T"), objects };
}

function makePlayer(id: string, name: string, num: number): Player {
  return {
    id,
    name,
    num,
    positions: ["CB"],
    foot: "R",
    status: "available",
    profile: "",
    attributes: {
      speed: 50,
      stamina: 50,
      pass: 50,
      control: 50,
      press: 50,
      duel: 50,
      tactical: 50,
    },
  };
}

const cbA = makePlayer("cbA", "Tomás", 4);
const cbB = makePlayer("cbB", "Diego", 5);

function raiseBlockScene(dirMirror = false) {
  const gkX = dirMirror ? 92 : 8;
  const cbX = dirMirror ? 80 : 20;
  return sceneWith([
    createPlayerToken(null, { x: gkX, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: cbX, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: cbX, y: 60 }, "CB", 5),
    createOpponentToken({ x: dirMirror ? 20 : 80, y: 50 }, "ST", 9),
  ]);
}

function raiseBlockMultiRivalScene(dirMirror = false) {
  const gkX = dirMirror ? 92 : 8;
  const cbX = dirMirror ? 80 : 20;
  const passerX = dirMirror ? 20 : 80; // deep on rival side
  const runnerX = dirMirror ? 60 : 40; // advanced toward own goal
  return sceneWith([
    createPlayerToken(null, { x: gkX, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: cbX, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: cbX, y: 60 }, "CB", 5),
    createOpponentToken({ x: passerX, y: 50 }, "ST", 9),
    createOpponentToken({ x: runnerX, y: 45 }, "AM", 10),
  ]);
}

function raiseBlockSim() {
  return simulateScenario({
    scenarioId: "raise-block",
    metrics: null,
    gameModel: DEFAULT_GAME_MODEL,
    players: [cbA, cbB],
    exercises: [],
  });
}

describe("detectAttackDir", () => {
  it("Tier 1: own GK on the left → attack toward +x (dir 1)", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]);
    expect(detectAttackDir(scene).dir).toBe(1);
  });

  it("Tier 1 mirrored: own GK on the right → attack toward -x (dir -1)", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 92, y: 50 }, "Arquero", 1)]);
    expect(detectAttackDir(scene).dir).toBe(-1);
  });

  it("Tier 2: no GK, own centroid behind rival centroid → dir 1", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 25, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 30, y: 60 }, "CB", 5),
      createOpponentToken({ x: 75, y: 50 }, "ST", 9),
    ]);
    expect(detectAttackDir(scene).dir).toBe(1);
  });

  it("Tier 3: no GK, no rival → dir 1 with a note", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 50, y: 50 }, "CM", 8)]);
    const result = detectAttackDir(scene);
    expect(result.dir).toBe(1);
    expect(result.note).toMatch(/orientación asumida/i);
  });

  it("Cross-check: a stray GK on the wrong side is overruled by the centroid (dir 1 + note)", () => {
    // Messy real board: GK misplaced at x=62 while the own mass sits at x=22
    // and the rival is ahead at x=80. Tier-1 alone flips to dir -1 silently;
    // the centroid (mass-based, robust to one stray token) must win AND warn.
    const scene = sceneWith([
      createPlayerToken(null, { x: 62, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 22, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 22, y: 60 }, "CB", 5),
      createOpponentToken({ x: 80, y: 50 }, "ST", 9),
    ]);
    const result = detectAttackDir(scene);
    expect(result.dir).toBe(1);
    // The contradiction must no longer be silent: the note names the centroid
    // path uniquely (Tier-3's note says "sin arquero", so /centroide/ can't leak).
    expect(result.note).toMatch(/centroide/i);
  });

  it("Cross-check: tied centroids are too weak to override the GK (GK stands, no note)", () => {
    // GK x=62 → gkDir -1. Own mass (GK 62, CB 38) centroid = 50; rival = 50.
    // A tie is no separation signal: the árbitro must not flip Tier-1 here.
    const scene = sceneWith([
      createPlayerToken(null, { x: 62, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 38, y: 50 }, "CB", 4),
      createOpponentToken({ x: 50, y: 50 }, "ST", 9),
    ]);
    const result = detectAttackDir(scene);
    expect(result.dir).toBe(-1);
    expect(result.note).toBeUndefined();
  });

  it("Cross-check guard: a coherent board (GK + rival agree) keeps Tier-1 without a note", () => {
    // raiseBlockScene(false): GK x=8 → dir 1; own centroid x≈16 behind rival x=80
    // → centroid also dir 1. Agreement must NOT make every GK inference ambiguous.
    const result = detectAttackDir(raiseBlockScene(false));
    expect(result.dir).toBe(1);
    expect(result.note).toBeUndefined();
  });
});

describe("buildConsequenceOverlay (raise-block)", () => {
  it("anchors the gap behind the centre-backs on the own-goal side for dir 1", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false));
    expect(overlay.scenarioId).toBe("raise-block");
    const gap = overlay.zones.find(
      (z) => z.semantic === "danger" || z.semantic === "freeSpace",
    );
    expect(gap).toBeDefined();
    // dir 1: gap sits behind CBs (x≈20) toward own goal (x≈8) → gap.x < 20.
    expect(gap!.x).toBeLessThan(20);
    expect(overlay.zones.some((z) => z.semantic === "press")).toBe(true);
  });

  it("mirrored scene puts the gap on the correct (right) side for dir -1", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(true));
    const gap = overlay.zones.find(
      (z) => z.semantic === "danger" || z.semantic === "freeSpace",
    );
    // dir -1: gap behind CBs (x≈80) toward own goal (x≈92) → gap.x + w > 80.
    expect(gap!.x + gap!.w).toBeGreaterThan(80);
  });

  it("composes a rival fact naming the real centre-backs", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false));
    const joined = overlay.rivalFacts.join(" ");
    expect(joined).toContain("Tomás");
    expect(joined).toContain("Diego");
  });

  it("draws a coordinated rival response: longPass + run on layer rival, anchored to real rival ids", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockMultiRivalScene(false));
    const rivalArrows = overlay.arrows.filter((a) => a.patch?.layer === "rival");
    expect(rivalArrows.length).toBeGreaterThanOrEqual(2);

    const longPass = overlay.arrows.find((a) => a.semantic === "longPass");
    const run = overlay.arrows.find((a) => a.semantic === "run");
    expect(longPass).toBeDefined();
    expect(run).toBeDefined();
    expect(longPass!.from.kind).toBe("object");
    expect(run!.from.kind).toBe("object");
  });

  it("coordination invariant: longPass and primary run resolve to one gap inside the danger zone", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockMultiRivalScene(false));
    const longPass = overlay.arrows.find((a) => a.semantic === "longPass");
    const run = overlay.arrows.find((a) => a.semantic === "run");
    expect(longPass).toBeDefined();
    expect(run).toBeDefined();
    expect(longPass!.to.kind).toBe("point");
    expect(run!.to.kind).toBe("point");

    const lp = (longPass!.to as { kind: "point"; point: { x: number; y: number } }).point;
    const rn = (run!.to as { kind: "point"; point: { x: number; y: number } }).point;
    // same gapTarget by construction (single source) → distance ~0
    expect(Math.hypot(lp.x - rn.x, lp.y - rn.y)).toBeLessThan(0.001);

    const gap = overlay.zones.find(
      (z) => z.semantic === "danger" || z.semantic === "freeSpace",
    );
    expect(gap).toBeDefined();
    const gapRect = { x: gap!.x, y: gap!.y, w: gap!.w, h: gap!.h } as unknown as BoardZone;
    expect(isInsideZoneRect(lp, gapRect)).toBe(true);
    expect(isInsideZoneRect(rn, gapRect)).toBe(true);
  });

  it("notes missing centre-backs instead of drawing a phantom gap", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]);
    const overlay = buildConsequenceOverlay(raiseBlockSim(), scene);
    expect(
      overlay.zones.some((z) => z.semantic === "danger" || z.semantic === "freeSpace"),
    ).toBe(false);
    expect(overlay.notes.join(" ")).toMatch(/no pude ubicar los centrales/i);
  });
});

describe("resolveRivalActors", () => {
  it("dir 1: passer = max x (deep rival side), runner = min x (advanced)", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 80, y: 50 }, "ST", 9),
      createOpponentToken({ x: 40, y: 45 }, "AM", 10),
    ]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(2);
    expect(a.passer?.position.x).toBe(80);
    expect(a.runner?.position.x).toBe(40);
    expect(a.wide).toBeNull();
  });

  it("dir -1: mirrored — passer = min x, runner = max x", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 20, y: 50 }, "ST", 9),
      createOpponentToken({ x: 60, y: 45 }, "AM", 10),
    ]);
    const a = resolveRivalActors(scene, -1);
    expect(a.passer?.position.x).toBe(20);
    expect(a.runner?.position.x).toBe(60);
  });

  it("1 rival: passer set, runner null (cannot be both)", () => {
    const scene = sceneWith([createOpponentToken({ x: 80, y: 50 }, "ST", 9)]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(1);
    expect(a.passer).not.toBeNull();
    expect(a.runner).toBeNull();
  });

  it("0 rivals: all null", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 20, y: 50 }, "CB", 4)]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(0);
    expect(a.passer).toBeNull();
    expect(a.runner).toBeNull();
  });

  it("3 rivals: wide = the widest of the remaining (max |y-50|)", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 80, y: 50 }, "ST", 9), // passer
      createOpponentToken({ x: 40, y: 48 }, "AM", 10), // runner
      createOpponentToken({ x: 55, y: 12 }, "LW", 11), // wide
    ]);
    const a = resolveRivalActors(scene, 1);
    expect(a.wide?.position.x).toBe(55);
  });
});
