import { describe, expect, it } from "vitest";
import {
  buildConsequenceOverlay,
  detectAttackDir,
} from "@/board/scenarioBoardConsequence";
import {
  createDefaultBoardScene,
  createOpponentToken,
  createPlayerToken,
  type BoardObject,
} from "@/board/boardModel";
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

  it("notes missing centre-backs instead of drawing a phantom gap", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]);
    const overlay = buildConsequenceOverlay(raiseBlockSim(), scene);
    expect(
      overlay.zones.some((z) => z.semantic === "danger" || z.semantic === "freeSpace"),
    ).toBe(false);
    expect(overlay.notes.join(" ")).toMatch(/no pude ubicar los centrales/i);
  });
});
