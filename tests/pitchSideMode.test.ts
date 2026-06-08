import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import type { Session, SessionBlock } from "../src/data/schemas";
import { readSessionBlockIntent, readSessionIntent } from "../src/sessions/SessionsView";
import { getExerciseById, useAppStore } from "../src/state/useAppStore";

/**
 * Pitch-side Mode (see src/sessions/PitchSideView.tsx) is a focused,
 * low-chrome execution surface opened from SessionsView ("Modo cancha"). It
 * reuses existing derivations (`readSessionIntent` / `readSessionBlockIntent`,
 * exported from SessionsView for this purpose) and writes only through
 * existing store actions (`updateSessionBlock`, `addManualObservation`).
 *
 * These tests cover the data contracts the view depends on at render time —
 * matching the store-level testing convention used across this suite (no
 * jsdom/testing-library setup is wired up here; see sketchStore.test.ts).
 */

const EXERCISE_ID = "rondo-4v2-salida";

function block(overrides: Partial<SessionBlock>): SessionBlock {
  return {
    id: "block-1",
    exerciseId: EXERCISE_ID,
    durationMin: 20,
    swappable: true,
    ...overrides,
  };
}

function withBlocks(blocks: SessionBlock[]): Session {
  const base = useAppStore.getState().session;
  return { ...base, blocks };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("Pitch-side Mode — current block data", () => {
  it("resolves the current exercise and a safe, non-crashing intent for a session with blocks", () => {
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1" }), block({ id: "block-2", durationMin: 15 })]),
    }));

    const session = useAppStore.getState().session;
    const aiPrompt = useAppStore.getState().aiPrompt;
    const thread = useAppStore.getState().weeklyDecisionThread;

    const sessionIntent = readSessionIntent(session.staffNotes, aiPrompt, thread);
    expect(sessionIntent.problem.length).toBeGreaterThan(0);
    expect(sessionIntent.objective.length).toBeGreaterThan(0);

    const block0 = session.blocks[0];
    const exercise = getExerciseById(block0.exerciseId);
    expect(exercise.id).toBe(EXERCISE_ID);

    const blockIntent = readSessionBlockIntent(block0.notes, exercise, aiPrompt, thread);
    expect(blockIntent.objective.length).toBeGreaterThan(0);
    expect(blockIntent.successSignal.length).toBeGreaterThan(0);
    // Coaching points come straight from the exercise — pitch-side mode lists
    // them as-is, capped, never invents its own.
    expect(Array.isArray(exercise.coaching)).toBe(true);
  });

  it("resolves a real exercise even for blocks created from variants (getExerciseById covers catalog + variants)", () => {
    const variant = { ...catalog[0], id: "variant-demo-1", title: "Variante de prueba" };
    useAppStore.setState((state) => ({
      exerciseVariants: [variant],
      session: withBlocks([block({ id: "block-1", exerciseId: variant.id })]),
    }));

    const resolved = getExerciseById("variant-demo-1");
    expect(resolved.id).toBe("variant-demo-1");
    expect(resolved.title).toBe("Variante de prueba");
  });
});

describe("Pitch-side Mode — sketch reference safety", () => {
  it("resolves an attached sketch when it exists", () => {
    const sketchId = useAppStore.getState().createSketch({ title: "Salida en bloque medio" });
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1", sketchId })]),
    }));

    const session = useAppStore.getState().session;
    const sketches = useAppStore.getState().sketches;
    const attached = session.blocks[0].sketchId
      ? sketches.find((entry) => entry.id === session.blocks[0].sketchId) ?? null
      : null;

    expect(attached).not.toBeNull();
    expect(attached?.title).toBe("Salida en bloque medio");
  });

  it("a dangling sketchId (sketch deleted elsewhere) resolves to null instead of throwing", () => {
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1", sketchId: "sketch-does-not-exist" })]),
    }));

    const session = useAppStore.getState().session;
    expect(() => {
      const block0 = session.blocks[0];
      const attached = block0.sketchId
        ? useAppStore.getState().sketches.find((entry) => entry.id === block0.sketchId) ?? null
        : null;
      expect(attached).toBeNull();
    }).not.toThrow();
  });

  it("a block with no sketchId at all is handled the same safe way", () => {
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1" })]),
    }));

    const block0 = useAppStore.getState().session.blocks[0];
    expect(block0.sketchId).toBeUndefined();
    const attached = block0.sketchId
      ? useAppStore.getState().sketches.find((entry) => entry.id === block0.sketchId) ?? null
      : null;
    expect(attached).toBeNull();
  });
});

describe("Pitch-side Mode — navigation bounds", () => {
  // Mirrors PitchSideView's `goTo`: clamp(nextIndex, 0, blocks.length - 1).
  function clampIndex(nextIndex: number, blocksLength: number) {
    if (blocksLength === 0) return 0;
    return Math.max(0, Math.min(blocksLength - 1, nextIndex));
  }

  it("never produces an out-of-range index for prev/next at the edges", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(2, 3)).toBe(2);
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
  });
});

describe("Pitch-side Mode — mark realizado updates state safely", () => {
  it("toggles `done` on a block via the existing generic updateSessionBlock patch without corrupting computed totals", () => {
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1" }), block({ id: "block-2", durationMin: 15 })]),
    }));

    // `withBlocks` sets `blocks` directly without recomputing totals (that only
    // happens inside store actions). Run a no-op patch through the real action
    // first so `computed` reflects these blocks correctly — that's the honest
    // "before" baseline to compare the `done` toggle against.
    useAppStore.getState().updateSessionBlock("block-1", {});
    const before = useAppStore.getState().session.computed;

    useAppStore.getState().updateSessionBlock("block-1", { done: true });
    const afterFirstToggle = useAppStore.getState().session;
    expect(afterFirstToggle.blocks.find((b) => b.id === "block-1")?.done).toBe(true);
    expect(afterFirstToggle.blocks.find((b) => b.id === "block-2")?.done).toBeUndefined();
    // `done` is purely a UI flag — totals/materials/objectives stay identical.
    expect(afterFirstToggle.computed).toEqual(before);

    useAppStore.getState().updateSessionBlock("block-1", { done: false });
    expect(useAppStore.getState().session.blocks.find((b) => b.id === "block-1")?.done).toBe(false);
  });
});

describe("Pitch-side Mode — quick note persistence", () => {
  it("saves a quick note as a manual observation with source 'home', tagged with the current exercise", () => {
    useAppStore.setState((state) => ({
      session: withBlocks([block({ id: "block-1" })]),
    }));

    const exercise = getExerciseById(useAppStore.getState().session.blocks[0].exerciseId);
    const tagged = `Modo cancha - ${exercise.title}: El grupo B llega tarde a la cobertura`;

    const observationId = useAppStore.getState().addManualObservation({
      text: tagged,
      source: "home",
    });

    expect(observationId).not.toBeNull();
    const saved = useAppStore.getState().manualObservations.find((entry) => entry.id === observationId);
    expect(saved?.source).toBe("home");
    expect(saved?.text).toContain("Modo cancha");
    expect(saved?.text).toContain(exercise.title);
  });

  it("does not persist a blank note", () => {
    const observationId = useAppStore.getState().addManualObservation({ text: "   ", source: "home" });
    expect(observationId).toBeNull();
    expect(useAppStore.getState().manualObservations).toHaveLength(0);
  });
});
