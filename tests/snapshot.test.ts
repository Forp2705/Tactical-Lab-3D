import { describe, expect, it } from "vitest";
import {
  APP_SNAPSHOT_VERSION,
  type AppSnapshot,
  parseSnapshot,
} from "../src/state/db";
import { useAppStore } from "../src/state/useAppStore";

/**
 * Persistencia: parseSnapshot/migrateSnapshot son las funciones puras que
 * protegen el snapshot guardado en IndexedDB. Si schemas.ts o la forma del
 * store cambian, estos tests avisan antes de que el usuario pierda estado.
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
    tags: s.tags,
    tracks: s.tracks,
    aiPrompt: s.aiPrompt,
  } as AppSnapshot;
}

describe("parseSnapshot", () => {
  it("acepta un snapshot construido desde los defaults del store", () => {
    const parsed = parseSnapshot(snapshotFromDefaults());
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(APP_SNAPSHOT_VERSION);
  });

  it("devuelve null ante entrada inválida", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(undefined)).toBeNull();
    expect(parseSnapshot({ foo: "bar" })).toBeNull();
    expect(parseSnapshot(42)).toBeNull();
  });

  it("normaliza la versión y completa defaults faltantes (migración mínima)", () => {
    const base = snapshotFromDefaults();
    // Simulamos un snapshot viejo sin version ni campos opcionales nuevos.
    const legacy = { ...base } as Record<string, unknown>;
    legacy.version = undefined;
    legacy.exerciseVariants = undefined;
    legacy.personalSpace = undefined;
    legacy.viewerQuality = undefined;

    const parsed = parseSnapshot(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(APP_SNAPSHOT_VERSION);
    expect(Array.isArray(parsed?.exerciseVariants)).toBe(true);
    expect(parsed?.personalSpace).toBe(false);
    expect(parsed?.viewerQuality).toBe("medium");
  });

  it("preserva campos de dominio (team, session, microcycle)", () => {
    const base = snapshotFromDefaults();
    const parsed = parseSnapshot(base);
    expect(parsed?.team.players.length).toBe(base.team.players.length);
    expect(parsed?.session.id).toBe(base.session.id);
    expect(parsed?.microcycle.id).toBe(base.microcycle.id);
  });
});
