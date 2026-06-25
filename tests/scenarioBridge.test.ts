import { describe, expect, it } from "vitest";
import { buildScenarioInput } from "@/board/scenarioBridge";
import {
  createDefaultBoardScene,
  createOpponentToken,
  createPlayerToken,
} from "@/board/boardModel";
import { DEFAULT_GAME_MODEL } from "@/data/gameModel";
import type { Player } from "@/data";

function makePlayer(id: string, name: string, num: number, positions: Player["positions"]): Player {
  return {
    id,
    name,
    num,
    positions,
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

const players: Player[] = [
  makePlayer("p1", "Tomás Álvarez", 1, ["GK"]),
  makePlayer("p2", "Bruno Díaz", 4, ["CB"]),
];

function sceneWith(objects: ReturnType<typeof createPlayerToken>[] = []) {
  const scene = createDefaultBoardScene("Test");
  return { ...scene, objects };
}

describe("buildScenarioInput", () => {
  it("maps linked own tokens to their Player and reports metrics:null", () => {
    const scene = sceneWith([createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4)]);
    const { input, unlinkedCount } = buildScenarioInput(
      scene,
      players,
      DEFAULT_GAME_MODEL,
      [],
      "raise-block",
    );
    expect(input.scenarioId).toBe("raise-block");
    expect(input.metrics).toBeNull();
    expect(input.players.map((p) => p.id)).toEqual(["p2"]);
    expect(unlinkedCount).toBe(0);
  });

  it("excludes unlinked own tokens and counts them", () => {
    const scene = sceneWith([
      createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4),
      createPlayerToken(null, { x: 30, y: 50 }, "CB", 5), // no linkedPlayerId
      createOpponentToken({ x: 80, y: 50 }, "ST", 9), // rival, ignored
    ]);
    const { input, unlinkedCount } = buildScenarioInput(
      scene,
      players,
      DEFAULT_GAME_MODEL,
      [],
      "raise-block",
    );
    expect(input.players.map((p) => p.id)).toEqual(["p2"]);
    expect(unlinkedCount).toBe(1);
  });

  it("sources objective/evidenceText from the board problem when present", () => {
    const scene = sceneWith([createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4)]);
    const { input } = buildScenarioInput(
      scene,
      players,
      DEFAULT_GAME_MODEL,
      [],
      "raise-block",
      { problem: "Nos cuesta presionar arriba", objective: "Subir el bloque" },
    );
    expect(input.objective).toBe("Subir el bloque");
    expect(input.evidenceText).toBe("Nos cuesta presionar arriba");
  });
});
