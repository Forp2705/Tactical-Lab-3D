import { describe, expect, it } from "vitest";
import {
  APP_SNAPSHOT_VERSION,
  type AppSnapshot,
  parseSnapshot,
} from "../src/state/db";
import { useAppStore } from "../src/state/useAppStore";

/**
 * Migración tolerante (Nivel 1): parseSnapshot ya no descarta todo el snapshot
 * cuando un campo está roto. Rescata lo que se pueda y deja que el store
 * complete los campos faltantes con sus defaults. Estos tests fijan ese
 * contrato para que un cambio futuro no vuelva a la pérdida total silenciosa.
 */

function snapshotFromDefaults(): AppSnapshot {
  const s = useAppStore.getState();
  return {
    version: APP_SNAPSHOT_VERSION,
    selectedExerciseId: s.selectedExerciseId,
    view: s.view,
    camera: s.camera,
    viewerQuality: s.viewerQuality,
    time: s.time,
    speed: s.speed,
    playing: s.playing,
    search: s.search,
    phase: s.phase,
    level: s.level,
    principle: s.principle,
    exerciseVariants: s.exerciseVariants,
    showZones: s.showZones,
    showRuns: s.showRuns,
    showPasses: s.showPasses,
    showPress: s.showPress,
    personalSpace: s.personalSpace,
    layers: s.layers,
    team: s.team,
    session: s.session,
    microcycle: s.microcycle,
    lineupLab: s.lineupLab,
    tags: s.tags,
    tracks: s.tracks,
    aiPrompt: s.aiPrompt,
  } as AppSnapshot;
}

describe("parseSnapshot — recuperación tolerante", () => {
  it("rescata campos válidos cuando un campo está corrupto", () => {
    const base = snapshotFromDefaults() as unknown as Record<string, unknown>;
    // Rompemos un único campo: 'time' deja de ser un número válido.
    base.time = "no-es-un-numero";

    const parsed = parseSnapshot(base);
    expect(parsed).not.toBeNull();
    // El campo roto se descarta (queda undefined → el store pone su default).
    expect(parsed?.time).toBeUndefined();
    // Los campos sanos se conservan.
    expect(parsed?.selectedExerciseId).toBe(base.selectedExerciseId);
    expect(parsed?.team?.players.length).toBeGreaterThan(0);
    expect(parsed?.session?.id).toBeTruthy();
  });

  it("descarta solo el sub-objeto roto y conserva el resto", () => {
    const base = snapshotFromDefaults() as unknown as Record<string, unknown>;
    // 'team' completamente inválido, pero 'session' y 'microcycle' sanos.
    base.team = { totally: "broken" };

    const parsed = parseSnapshot(base);
    expect(parsed).not.toBeNull();
    expect(parsed?.team).toBeUndefined();
    expect(parsed?.session?.id).toBeTruthy();
    expect(parsed?.microcycle?.id).toBeTruthy();
  });

  it("normaliza la versión incluso en el camino de recuperación", () => {
    const base = snapshotFromDefaults() as unknown as Record<string, unknown>;
    base.version = 9999; // versión imposible
    base.camera = "no-existe"; // fuerza recuperación parcial

    const parsed = parseSnapshot(base);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(APP_SNAPSHOT_VERSION);
    expect(parsed?.camera).toBeUndefined();
  });

  it("devuelve null cuando no hay ningún campo reconocible", () => {
    expect(parseSnapshot({ foo: "bar", baz: 1 })).toBeNull();
    expect(parseSnapshot([])).toBeNull();
    expect(parseSnapshot("texto")).toBeNull();
  });
});
