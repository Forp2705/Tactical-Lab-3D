import { describe, expect, it } from "vitest";
import { catalog, demoPlayers } from "../src/data";
import {
  ExerciseSchema,
  PlayerSchema,
  SceneSchema,
} from "../src/data/schemas";

/**
 * schemas.ts es el contrato central del dominio. Si un cambio lo rompe, arrastra
 * viewer, planner, export, persistencia y tests. Estos tests anclan que:
 *  - el catálogo curado siempre conforma ExerciseSchema,
 *  - el plantel demo conforma PlayerSchema,
 *  - las invariantes clave del schema siguen vigentes.
 */

describe("ExerciseSchema vs catálogo curado", () => {
  it("hay ejercicios en el catálogo", () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("cada ejercicio del catálogo es válido", () => {
    for (const exercise of catalog) {
      const result = ExerciseSchema.safeParse(exercise);
      expect(
        result.success,
        `Ejercicio inválido: ${exercise.id} -> ${
          result.success ? "" : JSON.stringify(result.error.issues)
        }`,
      ).toBe(true);
    }
  });

  it("cada escena tiene exactamente 3 fases", () => {
    for (const exercise of catalog) {
      expect(exercise.scene.phases.length, exercise.id).toBe(3);
    }
  });
});

describe("PlayerSchema vs plantel demo", () => {
  it("cada jugador demo es válido", () => {
    for (const player of demoPlayers) {
      const result = PlayerSchema.safeParse(player);
      expect(
        result.success,
        `Jugador inválido: ${player.id}`,
      ).toBe(true);
    }
  });

  it("rechaza dorsal fuera de rango", () => {
    const base = demoPlayers[0];
    expect(PlayerSchema.safeParse({ ...base, num: 0 }).success).toBe(false);
    expect(PlayerSchema.safeParse({ ...base, num: 100 }).success).toBe(false);
  });

  it("rechaza atributos fuera de 0..100", () => {
    const base = demoPlayers[0];
    expect(
      PlayerSchema.safeParse({
        ...base,
        attributes: { ...base.attributes, speed: 120 },
      }).success,
    ).toBe(false);
  });
});

describe("invariantes de SceneSchema", () => {
  it("rechaza una escena con duración no positiva", () => {
    const scene = {
      duration: 0,
      pitchMode: "full",
      actors: [],
      ball: { start: { x: 50, y: 50, z: 0 }, path: [] },
      phases: [
        { id: "setup", name: "a", start: 0, end: 1, activeLayers: [] },
        { id: "execution", name: "b", start: 1, end: 2, activeLayers: [] },
        { id: "outcome", name: "c", start: 2, end: 3, activeLayers: [] },
      ],
    };
    expect(SceneSchema.safeParse(scene).success).toBe(false);
  });

  it("rechaza coordenadas fuera de 0..100", () => {
    const result = ExerciseSchema.safeParse({
      ...catalog[0],
      scene: {
        ...catalog[0].scene,
        ball: { start: { x: 150, y: 50, z: 0 }, path: [] },
      },
    });
    expect(result.success).toBe(false);
  });
});
