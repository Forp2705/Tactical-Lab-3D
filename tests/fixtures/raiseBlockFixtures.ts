// Shared raise-block fixtures (lifted from tests/scenarioBoardConsequence.test.ts).
// Consumed by slice-3 (scenarioBoardConsequence), slice-4 task 2 (boardEvidencePacket)
// and task 9. Pure builders — no behavior, just scene/sim factories.
import {
  createDefaultBoardScene,
  createOpponentToken,
  createPlayerToken,
  type BoardObject,
} from "@/board/boardModel";
import { simulateScenario } from "@/ai/scenarioSimulator";
import { DEFAULT_GAME_MODEL } from "@/data/gameModel";
import type { Player } from "@/data";

export function sceneWith(objects: BoardObject[]) {
  return { ...createDefaultBoardScene("T"), objects };
}

export function makePlayer(id: string, name: string, num: number): Player {
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

export const cbA = makePlayer("cbA", "Tomás", 4);
export const cbB = makePlayer("cbB", "Diego", 5);

export function raiseBlockScene(dirMirror = false) {
  const gkX = dirMirror ? 92 : 8;
  const cbX = dirMirror ? 80 : 20;
  return sceneWith([
    createPlayerToken(null, { x: gkX, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: cbX, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: cbX, y: 60 }, "CB", 5),
    createOpponentToken({ x: dirMirror ? 20 : 80, y: 50 }, "ST", 9),
  ]);
}

export function raiseBlockSim() {
  return simulateScenario({
    scenarioId: "raise-block",
    metrics: null,
    gameModel: DEFAULT_GAME_MODEL,
    players: [cbA, cbB],
    exercises: [],
  });
}
