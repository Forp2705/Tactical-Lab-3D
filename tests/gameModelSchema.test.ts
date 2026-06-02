import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_MODEL,
  contrastTextWithGameModel,
  GameModelSchema,
} from "../src/data/gameModel";

describe("gameModel", () => {
  it("valida el modelo default", () => {
    expect(GameModelSchema.parse(DEFAULT_GAME_MODEL).identity).toContain("Equipo");
  });

  it("detecta desvios contra no negociables", () => {
    const contrast = contrastTextWithGameModel(
      "El bloque queda partido entre lineas y el 9 queda aislado sin apoyos.",
      DEFAULT_GAME_MODEL,
    );

    expect(contrast.contradictions.length).toBeGreaterThan(0);
  });
});
