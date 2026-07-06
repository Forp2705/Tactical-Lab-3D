import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { APP_SNAPSHOT_VERSION, db, loadSnapshot, saveSnapshot } from "../src/state/db";
import { useAppStore } from "../src/state/useAppStore";

/**
 * H3 (mc-19): el unico camino de persistencia real (Dexie/IndexedDB) no
 * tenia cobertura — solo se testeaba parseSnapshot en aislamiento (ver
 * tests/snapshot.test.ts). Este test ejercita saveSnapshot -> loadSnapshot
 * contra IndexedDB real via fake-indexeddb, no contra un mock de Dexie.
 * El import de "fake-indexeddb/auto" debe ir antes que cualquier import que
 * toque src/state/db (que instancia Dexie a nivel de modulo).
 */
describe("saveSnapshot / loadSnapshot — round-trip real via Dexie", () => {
  beforeEach(async () => {
    await db.snapshots.clear();
  });

  it("persiste y recupera un snapshot construido desde los defaults del store", async () => {
    const s = useAppStore.getState();
    const snapshot = {
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
      staffProfile: { name: "Marcela Bosio", role: "Asistente tactica" },
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
    };

    await saveSnapshot(snapshot);
    const loaded = await loadSnapshot();

    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(APP_SNAPSHOT_VERSION);
    expect(loaded?.team.players.length).toBe(snapshot.team.players.length);
    expect(loaded?.session.id).toBe(snapshot.session.id);
    expect(loaded?.microcycle.id).toBe(snapshot.microcycle.id);
    expect(loaded?.aiPrompt).toBe(snapshot.aiPrompt);
    // W9: el perfil de staff viaja por el mismo camino Dexie que el resto.
    expect(loaded?.staffProfile).toEqual({
      name: "Marcela Bosio",
      role: "Asistente tactica",
    });
  });

  it("devuelve null si no hay snapshot guardado", async () => {
    const loaded = await loadSnapshot("clave-inexistente");
    expect(loaded).toBeNull();
  });
});
