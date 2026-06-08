import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../src/state/useAppStore";
import { SketchSchema, type Sketch } from "../src/sketch/sketchSchemas";
import type { SessionBlock } from "../src/data/schemas";

/**
 * Quick Sketch — store action coverage (see src/state/useAppStore.ts) and
 * session-reference safety: a `SessionBlock.sketchId` must never point at a
 * sketch that no longer exists, in either direction (attach guards against
 * unknown ids; delete cleans up any block still pointing at the removed one).
 */

function block(overrides: Partial<SessionBlock>): SessionBlock {
  return {
    id: "block-1",
    exerciseId: "exercise-1",
    durationMin: 20,
    swappable: true,
    ...overrides,
  };
}

afterEach(() => {
  // Safety net: restore real timers even if an assertion above throws mid-test.
  vi.useRealTimers();
});

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState((state) => ({
    sketches: [],
    session: {
      ...state.session,
      blocks: [block({ id: "block-1" }), block({ id: "block-2", exerciseId: "exercise-2" })],
    },
  }));
});

describe("Sketch store actions", () => {
  it("createSketch appends a schema-valid sketch and returns its id", () => {
    const id = useAppStore.getState().createSketch({ title: "Bloque medio compacto" });
    const sketches = useAppStore.getState().sketches;
    expect(sketches).toHaveLength(1);
    expect(sketches[0]?.id).toBe(id);
    expect(sketches[0]?.title).toBe("Bloque medio compacto");
    expect(() => SketchSchema.parse(sketches[0])).not.toThrow();
  });

  it("updateSketch patches fields, bumps updatedAt, and re-validates before writing", () => {
    // `createSketch`/`updateSketch` both stamp `updatedAt` with
    // `new Date().toISOString()`. Two calls issued back-to-back can land in
    // the same millisecond, making a plain `not.toBe` comparison flaky. Pin
    // the clock and advance it deterministically between writes so the
    // assertion stays meaningful (an actual time change must be reflected)
    // without relying on real wall-clock granularity or sleeps.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T10:00:00.000Z"));

    const id = useAppStore.getState().createSketch({ title: "Original" });
    const before = useAppStore.getState().sketches[0] as Sketch;
    expect(before.updatedAt).toBe("2026-06-08T10:00:00.000Z");

    vi.setSystemTime(new Date("2026-06-08T10:00:01.000Z"));
    useAppStore.getState().updateSketch(id, {
      tokens: [{ id: "tok-1", x: 30, y: 40, label: "9", team: "home" }],
    });
    const afterValid = useAppStore.getState().sketches.find((s) => s.id === id);
    expect(afterValid?.tokens).toHaveLength(1);
    expect(afterValid?.updatedAt).toBe("2026-06-08T10:00:01.000Z");
    expect(afterValid?.updatedAt).not.toBe(before.updatedAt);

    // An invalid patch (coordinate outside 0-100) must be rejected silently —
    // the previously-valid sketch stays untouched rather than being corrupted.
    vi.setSystemTime(new Date("2026-06-08T10:00:02.000Z"));
    useAppStore.getState().updateSketch(id, {
      tokens: [{ id: "tok-2", x: 999, y: 40, label: "9", team: "home" }],
    });
    const afterInvalid = useAppStore.getState().sketches.find((s) => s.id === id);
    expect(afterInvalid?.tokens).toEqual(afterValid?.tokens);
    expect(afterInvalid?.updatedAt).toBe(afterValid?.updatedAt);

    vi.useRealTimers();
  });

  it("renameSketch trims, clamps length, and ignores blank titles", () => {
    const id = useAppStore.getState().createSketch({ title: "Inicial" });

    useAppStore.getState().renameSketch(id, "  Salida en bloque medio  ");
    expect(useAppStore.getState().sketches.find((s) => s.id === id)?.title).toBe(
      "Salida en bloque medio",
    );

    useAppStore.getState().renameSketch(id, "   ");
    expect(useAppStore.getState().sketches.find((s) => s.id === id)?.title).toBe(
      "Salida en bloque medio",
    );
  });

  it("attachSketchToSessionBlock only attaches sketches that actually exist", () => {
    const id = useAppStore.getState().createSketch({ title: "Presión alta" });

    useAppStore.getState().attachSketchToSessionBlock("block-1", "sketch-does-not-exist");
    expect(useAppStore.getState().session.blocks.find((b) => b.id === "block-1")?.sketchId).toBeUndefined();

    useAppStore.getState().attachSketchToSessionBlock("block-1", id);
    expect(useAppStore.getState().session.blocks.find((b) => b.id === "block-1")?.sketchId).toBe(id);
    // Other blocks are untouched.
    expect(useAppStore.getState().session.blocks.find((b) => b.id === "block-2")?.sketchId).toBeUndefined();
  });

  it("detachSketchFromSessionBlock clears the reference without touching the sketch", () => {
    const id = useAppStore.getState().createSketch({ title: "Cobertura zonal" });
    useAppStore.getState().attachSketchToSessionBlock("block-1", id);

    useAppStore.getState().detachSketchFromSessionBlock("block-1");
    expect(useAppStore.getState().session.blocks.find((b) => b.id === "block-1")?.sketchId).toBeUndefined();
    // The sketch itself remains in the library, just unattached.
    expect(useAppStore.getState().sketches.some((s) => s.id === id)).toBe(true);
  });

  it("deleteSketch removes the sketch and detaches it from every session block referencing it", () => {
    const id = useAppStore.getState().createSketch({ title: "Transición ofensiva" });
    useAppStore.getState().attachSketchToSessionBlock("block-1", id);
    useAppStore.getState().attachSketchToSessionBlock("block-2", id);

    useAppStore.getState().deleteSketch(id);

    expect(useAppStore.getState().sketches.some((s) => s.id === id)).toBe(false);
    const blocks = useAppStore.getState().session.blocks;
    expect(blocks.find((b) => b.id === "block-1")?.sketchId).toBeUndefined();
    expect(blocks.find((b) => b.id === "block-2")?.sketchId).toBeUndefined();
  });
});
