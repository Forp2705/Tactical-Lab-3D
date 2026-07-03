import { describe, expect, it } from "vitest";
import {
  catalog,
  generatedLibraryExerciseIds,
} from "../src/data/exercises/catalog";
import { validateExercise } from "../src/data/exercises/validateExercise";
import {
  criticalExerciseIds,
  getSelectableCatalog,
} from "../src/data/exercises/validatedCatalog";
import type { Exercise } from "../src/data/schemas";

// W3.2: los 3 re-autorados (Brief B de mc-10). Fija B1/B2/B3/B5 como contrato
// deterministico; B4 (firma semantica) es revision humana en el gate.

const REAUTHORED_IDS = [
  "abp-defensa-zona-rechace",
  "transicion-perdida-cinco-segundos",
  "repliegue-temporizar-banda",
] as const;

function byId(id: string): Exercise {
  const exercise = catalog.find((item) => item.id === id);
  if (!exercise) throw new Error(`re-autorado no encontrado: ${id}`);
  return exercise;
}

describe("re-autorados W3.2 (Brief B)", () => {
  it.each(REAUTHORED_IDS)(
    "B1: '%s' valida con critical=false, score>=80 y sin tags de error",
    (id) => {
      const validation = validateExercise(byId(id));
      expect(validation.critical).toBe(false);
      expect(validation.score).toBeGreaterThanOrEqual(80);
      expect(validation.errors).toHaveLength(0);
    },
  );

  it.each(REAUTHORED_IDS)(
    "B2: '%s' salio del set generado y entra al pool seleccionable",
    (id) => {
      expect(generatedLibraryExerciseIds.has(id)).toBe(false);
      const pool = new Set(getSelectableCatalog().map((e) => e.id));
      expect(pool.has(id)).toBe(true);
    },
  );

  it("B3: el pool cubre las 6 fases, incluida abpDef (antes en cero)", () => {
    const phases = new Set(getSelectableCatalog().map((e) => e.phase));
    expect(phases.has("abpDef")).toBe(true);
    expect(phases.size).toBe(6);
  });

  it("B5: el pool crecio a 25 con los salvages W5 y sigue sin criticos", () => {
    expect(getSelectableCatalog().length).toBe(25); // 19 (post-W4) + 6 salvages W5
    // Ola 4: el unico critico historico ("presion-arquero-pase-atras", generado
    // roto) fue retirado del catalogo; los salvages W5 no reintroducen criticos.
    expect([...criticalExerciseIds]).toEqual([]);
  });

  it.each(REAUTHORED_IDS)(
    "estandar curado: '%s' tiene escena propia (no el sello del template)",
    (id) => {
      const exercise = byId(id);
      // El template estampaba SIEMPRE 7 actores (5 own + 2 rival) sin GK y
      // pelota inicial en poder propio. Los curados tienen mas de 7 actores o
      // una estructura distinta, y coaching/success reales.
      expect(exercise.scene.actors.length).toBeGreaterThanOrEqual(8);
      expect(exercise.coaching.filter((c) => c.trim()).length).toBeGreaterThanOrEqual(2);
      expect(exercise.success.trim().length).toBeGreaterThan(0);
      expect(exercise.scene.overlays.length).toBeGreaterThanOrEqual(4);
    },
  );
});

// W5: los 6 SALVAGE (mismo metodo/estandar que W3.2). El 7mo generado
// (ataque-cambio-orientacion-extremo, REWRITE-CARO) sigue en cuarentena.
const SALVAGED_IDS = [
  "presion-salto-lateral",
  "transicion-primer-pase-seguro",
  "abp-falta-bloqueo-frontal",
  "defensa-centro-lateral-juego-abierto",
  "abp-defensa-bloqueo-segundo-palo",
  "defensa-linea-pase-bloqueada",
] as const;

describe("salvages W5", () => {
  it.each(SALVAGED_IDS)(
    "S1: '%s' valida con critical=false, score>=80 y sin tags de error",
    (id) => {
      const validation = validateExercise(byId(id));
      expect(validation.critical).toBe(false);
      expect(validation.score).toBeGreaterThanOrEqual(80);
      expect(validation.errors).toHaveLength(0);
    },
  );

  it.each(SALVAGED_IDS)(
    "S2: '%s' salio de la cuarentena y entra al pool seleccionable",
    (id) => {
      expect(generatedLibraryExerciseIds.has(id)).toBe(false);
      const pool = new Set(getSelectableCatalog().map((e) => e.id));
      expect(pool.has(id)).toBe(true);
    },
  );

  it.each(SALVAGED_IDS)(
    "S3: '%s' tiene escena propia (actores, overlays, zona y trigger reales)",
    (id) => {
      const exercise = byId(id);
      expect(exercise.scene.actors.length).toBeGreaterThanOrEqual(8);
      expect(exercise.coaching.filter((c) => c.trim()).length).toBeGreaterThanOrEqual(2);
      expect(exercise.success.trim().length).toBeGreaterThan(0);
      expect(exercise.scene.overlays.length).toBeGreaterThanOrEqual(3);
      expect(exercise.scene.zones.length).toBeGreaterThanOrEqual(1);
      expect(exercise.scene.triggers.length).toBeGreaterThanOrEqual(1);
      // Ambos equipos en escena (oposicion real, no el sello sin GK).
      const teams = new Set(exercise.scene.actors.map((a) => a.team));
      expect(teams.has("own") && teams.has("rival")).toBe(true);
    },
  );

  it("S4: la cuarentena remanente es solo el REWRITE-CARO", () => {
    expect([...generatedLibraryExerciseIds]).toEqual([
      "ataque-cambio-orientacion-extremo",
    ]);
  });
});
