import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import { SessionBlockSchema, SessionSchema } from "../src/data/schemas";
import { getExerciseById, useAppStore } from "../src/state/useAppStore";

/**
 * Regression coverage for the Real Coach Onboarding + Pitch-side Mode pass
 * (see RealCoachOnboarding.tsx / PitchSideView.tsx). This pass deliberately
 * touched shared, sensitive surfaces — `SessionBlockSchema` (new `done`
 * field), the session drawer's catalog/variant/favorites/recents resolution,
 * and Quick Sketch attachment — without rewriting any of them. These tests
 * confirm those existing flows still behave exactly as before.
 */

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("Regression — SessionBlockSchema stays additive/backward-compatible", () => {
  it("parses legacy blocks (no `done`, no `sketchId`) exactly as before — old snapshots keep loading", () => {
    const legacyBlock = {
      id: "block-legacy",
      exerciseId: "rondo-4v2-salida",
      durationMin: 20,
      swappable: true,
    };

    const parsed = SessionBlockSchema.safeParse(legacyBlock);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.done).toBeUndefined();
      expect(parsed.data.sketchId).toBeUndefined();
    }
  });

  it("parses blocks carrying the new `done` flag alongside `sketchId`, and a full session round-trips through the schema", () => {
    const blockWithDone = {
      id: "block-new",
      exerciseId: "rondo-4v2-salida",
      durationMin: 25,
      swappable: true,
      sketchId: "sketch-1",
      done: true,
    };

    const parsedBlock = SessionBlockSchema.safeParse(blockWithDone);
    expect(parsedBlock.success).toBe(true);
    if (parsedBlock.success) {
      expect(parsedBlock.data.done).toBe(true);
      expect(parsedBlock.data.sketchId).toBe("sketch-1");
    }

    const session = useAppStore.getState().session;
    const sessionWithDoneBlock = {
      ...session,
      blocks: [...session.blocks, blockWithDone],
    };
    const parsedSession = SessionSchema.safeParse(sessionWithDoneBlock);
    expect(parsedSession.success).toBe(true);
  });
});

describe("Regression — library catalog/variants/favorites/recents resolution intact", () => {
  it("getExerciseById still resolves catalog exercises and falls back safely for unknown ids (used by both SessionBlockCard and PitchSideView)", () => {
    const fromCatalog = getExerciseById("rondo-4v2-salida");
    expect(fromCatalog.id).toBe("rondo-4v2-salida");

    // Unknown id never throws — falls back to catalog[0], same contract
    // PitchSideView relies on for safe rendering.
    expect(() => getExerciseById("definitely-not-a-real-id")).not.toThrow();
    const fallback = getExerciseById("definitely-not-a-real-id");
    expect(fallback.id).toBe(catalog[0].id);
  });

  it("library favorites and recents toggle/record without disturbing each other or session state", () => {
    useAppStore.getState().toggleLibraryFavorite("rondo-4v2-salida");
    expect(useAppStore.getState().libraryFavoriteIds).toContain("rondo-4v2-salida");

    useAppStore.getState().toggleLibraryFavorite("rondo-4v2-salida");
    expect(useAppStore.getState().libraryFavoriteIds).not.toContain("rondo-4v2-salida");

    useAppStore.getState().recordLibraryOpen("rondo-4v2-salida");
    const recents = useAppStore.getState().libraryRecentOpens;
    expect(recents[0]?.exerciseId).toBe("rondo-4v2-salida");
  });

  it("exerciseVariants resolve through getExerciseById exactly like catalog entries (drawer + pitch-side share this path)", () => {
    const variant = { ...catalog[0], id: "variant-regression-1", title: "Variante regresion" };
    useAppStore.setState({ exerciseVariants: [variant] });

    const resolved = getExerciseById("variant-regression-1");
    expect(resolved.id).toBe("variant-regression-1");
    expect(resolved.title).toBe("Variante regresion");
  });
});

describe("Regression — Quick Sketch attachment flow on session blocks unaffected", () => {
  it("attach/detach still work through the existing actions and clear safely when a sketch is deleted", () => {
    useAppStore.getState().addToSession("rondo-4v2-salida");
    const blockId = useAppStore.getState().session.blocks[0]?.id;
    expect(blockId).toBeDefined();
    if (!blockId) return;

    const sketchId = useAppStore.getState().createSketch({ title: "Cobertura lateral" });
    useAppStore.getState().attachSketchToSessionBlock(blockId, sketchId);
    expect(useAppStore.getState().session.blocks.find((b) => b.id === blockId)?.sketchId).toBe(sketchId);

    useAppStore.getState().detachSketchFromSessionBlock(blockId);
    expect(useAppStore.getState().session.blocks.find((b) => b.id === blockId)?.sketchId).toBeUndefined();

    // Re-attach, then delete the sketch itself — the block reference must clear,
    // exactly as PitchSideView's "missing sketch fallback" depends on.
    useAppStore.getState().attachSketchToSessionBlock(blockId, sketchId);
    useAppStore.getState().deleteSketch(sketchId);
    expect(useAppStore.getState().session.blocks.find((b) => b.id === blockId)?.sketchId).toBeUndefined();
  });
});
