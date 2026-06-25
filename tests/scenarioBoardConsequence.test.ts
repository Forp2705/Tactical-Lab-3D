import { describe, expect, it } from "vitest";
import { detectAttackDir } from "@/board/scenarioBoardConsequence";
import {
  createDefaultBoardScene,
  createOpponentToken,
  createPlayerToken,
  type BoardObject,
} from "@/board/boardModel";

function sceneWith(objects: BoardObject[]) {
  return { ...createDefaultBoardScene("T"), objects };
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
