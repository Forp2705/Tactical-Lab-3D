import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  APP_SNAPSHOT_VERSION,
  db,
  loadBackupSnapshot,
  loadSnapshot,
} from "../src/state/db";
import { useAppStore } from "../src/state/useAppStore";

/**
 * H1 (auditoria mc-20): loadSnapshot() dispara un backup best-effort del
 * crudo original cuando detecta needsRecovery (shape invalido) o
 * needsMigration (version vieja) antes de migrar/rescatar. Ese camino
 * (backupSnapshot + loadBackupSnapshot, contra Dexie real) no tenia
 * cobertura — solo se testeaba parseSnapshot() en aislamiento (ver
 * tests/snapshot.test.ts, tests/migration.test.ts). El import de
 * "fake-indexeddb/auto" debe ir antes que cualquier import que toque
 * src/state/db (que instancia Dexie a nivel de modulo).
 */
describe("loadSnapshot — backup on corruption/migration (contrato real de db.ts)", () => {
  beforeEach(async () => {
    await db.snapshots.clear();
  });

  function snapshotFromDefaults() {
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
      workspaceMode: s.workspaceMode,
      teamIdentity: s.teamIdentity,
      gameModel: s.gameModel,
      opponentScout: s.opponentScout,
      session: s.session,
      microcycle: s.microcycle,
      lineupLab: s.lineupLab,
      tags: s.tags,
      tracks: s.tracks,
      manualObservations: s.manualObservations,
      weeklyDecisionThread: s.weeklyDecisionThread,
      libraryFavoriteIds: s.libraryFavoriteIds,
      libraryRecentOpens: s.libraryRecentOpens,
      sketches: s.sketches,
      tacticalBoards: s.tacticalBoards,
      activeBoardId: s.activeBoardId,
      activeBoardSceneId: s.activeBoardSceneId,
      aiPrompt: s.aiPrompt,
    } as Record<string, unknown>;
  }

  it("needsMigration: snapshot legacy (version vieja, shape sano) se migra y el backup preserva el crudo sin migrar", async () => {
    const legacy = snapshotFromDefaults();
    legacy.version = 2; // shape actual pero version vieja -> needsMigration true, needsRecovery false

    await db.snapshots.put({ key: "latest", value: legacy, savedAt: Date.now() });

    const loaded = await loadSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(APP_SNAPSHOT_VERSION);
    expect(loaded?.team.players.length).toBe(
      (legacy.team as { players: unknown[] }).players.length,
    );

    const backup = await loadBackupSnapshot();
    expect(backup).not.toBeNull();
    expect((backup as Record<string, unknown>).version).toBe(2);
    expect(backup).toEqual(legacy);
  });

  it("needsRecovery: snapshot con un campo corrupto rescata lo sano y el backup preserva el crudo corrupto exacto", async () => {
    const corrupted = snapshotFromDefaults();
    corrupted.team = { totally: "broken" }; // rompe el shape completo -> needsRecovery true

    await db.snapshots.put({ key: "latest", value: corrupted, savedAt: Date.now() });

    const loaded = await loadSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.team).toBeUndefined();
    expect(loaded?.session?.id).toBeTruthy();
    expect(loaded?.version).toBe(APP_SNAPSHOT_VERSION);

    const backup = await loadBackupSnapshot();
    expect(backup).toEqual(corrupted);
    expect((backup as Record<string, unknown>).team).toEqual({
      totally: "broken",
    });
  });

  it("sin campos reconocibles: loadSnapshot devuelve null pero el backup igual preserva el crudo", async () => {
    const garbage = { foo: "bar", baz: 1 };

    await db.snapshots.put({ key: "latest", value: garbage, savedAt: Date.now() });

    const loaded = await loadSnapshot();
    expect(loaded).toBeNull();

    const backup = await loadBackupSnapshot();
    expect(backup).toEqual(garbage);
  });

  it("sin snapshot guardado no hay backup ni error", async () => {
    const loaded = await loadSnapshot("clave-inexistente");
    expect(loaded).toBeNull();
    const backup = await loadBackupSnapshot("clave-inexistente");
    expect(backup).toBeNull();
  });
});
