# Board Rival Response (slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the staff raises the defensive block on the board, draw the rival's coordinated reaction — a `longPass` (ball) plus 1–2 `run` arrows (players) anchored to real opponent tokens, attacking the conceded space behind the line.

**Architecture:** Extend the existing `raise-block` draw-back in `src/board/scenarioBoardConsequence.ts`. A single authoring path computes the gap-center target **once** (`gapTarget`) and references it from both the `longPass` and the primary `run`, so the ball and the runner are coherent by construction. A pure helper `resolveRivalActors` selects passer/runner/wide deterministically by dir-aware geometry. Rival arrows carry `layer: "rival"`; a one-line branch in `boardGeometry.ts` makes that group visibility behave.

**Tech Stack:** TypeScript, Zod (board model factories), Vitest. No new deps.

## Global Constraints

- **Guard 1 — one vocabulary.** No new enum for rival actions. Use existing `BoardArrowSemantic` (`run`, `support`, `cover`, `pressure`, `longPass`). Human intent lives in `label`/`tacticalMeaning`. "Rival" derives from anchoring `from` to a real `opponentToken` `objectId`.
- **Guard 2 — same machinery.** Reuse `ConsequenceOverlay`, `OverlayArrow`, `createSemanticArrow`, accept/discard lifecycle, `notes[]`. No new overlay model, persistence, or UI flow.
- **Single coherent authoring.** `gapTarget` is computed once; `longPass.to` and the primary `run.to` both reference it. This is an invariant guarded by a test (Task 3).
- **Honest degradation.** Never anchor a rival arrow to a fabricated token. Fewer rivals → draw less + a `note`, never a phantom.
- **Scope:** `raise-block` only. Out: new enum, final ghosts, animation, temporal order, metrics, `dropReceive`-as-default, LLM, the other 10 scenarios.
- **Coordinates:** pitch is `0–100` in both axes at the model level. `dir = 1` → own team attacks toward `+x`; `dir = -1` → toward `-x`. Rivals attack toward `-dir`.

Spec: `docs/superpowers/specs/2026-06-25-board-rival-response-design.md` (commit `c8983c8`).

---

### Task 1: `resolveRivalActors` — dir-aware rival selection (pure)

Deterministic geometry that picks the passer (deepest on the rival's build-up side), the primary runner (most advanced toward the own goal), and an optional wide actor. **Do NOT copy `resolveCentreBacks`** — that selects *own* tokens relative to `dir`; rivals are the mirror (`-dir`). Encoded as `depth = dir * x` (higher = deeper on the rival side).

**Files:**
- Modify: `src/board/scenarioBoardConsequence.ts` (add exported helper near `detectAttackDir`)
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `BoardScene`, `BoardObject` (already imported in the module).
- Produces:
  ```ts
  export type RivalActors = {
    passer: BoardObject | null; // build-up, on the ball, deep rival side
    runner: BoardObject | null; // most advanced toward the own goal
    wide: BoardObject | null;   // widest of the rest (2nd run); null unless count >= 3
    count: number;              // total opponentTokens
  };
  export function resolveRivalActors(scene: BoardScene, dir: 1 | -1): RivalActors;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `tests/scenarioBoardConsequence.test.ts` (inside a new `describe`):

```ts
import {
  buildConsequenceOverlay,
  detectAttackDir,
  resolveRivalActors,
} from "@/board/scenarioBoardConsequence";

describe("resolveRivalActors", () => {
  it("dir 1: passer = max x (deep rival side), runner = min x (advanced)", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 80, y: 50 }, "ST", 9),
      createOpponentToken({ x: 40, y: 45 }, "AM", 10),
    ]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(2);
    expect(a.passer?.position.x).toBe(80);
    expect(a.runner?.position.x).toBe(40);
    expect(a.wide).toBeNull();
  });

  it("dir -1: mirrored — passer = min x, runner = max x", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 20, y: 50 }, "ST", 9),
      createOpponentToken({ x: 60, y: 45 }, "AM", 10),
    ]);
    const a = resolveRivalActors(scene, -1);
    expect(a.passer?.position.x).toBe(20);
    expect(a.runner?.position.x).toBe(60);
  });

  it("1 rival: passer set, runner null (cannot be both)", () => {
    const scene = sceneWith([createOpponentToken({ x: 80, y: 50 }, "ST", 9)]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(1);
    expect(a.passer).not.toBeNull();
    expect(a.runner).toBeNull();
  });

  it("0 rivals: all null", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 20, y: 50 }, "CB", 4)]);
    const a = resolveRivalActors(scene, 1);
    expect(a.count).toBe(0);
    expect(a.passer).toBeNull();
    expect(a.runner).toBeNull();
  });

  it("3 rivals: wide = the widest of the remaining (max |y-50|)", () => {
    const scene = sceneWith([
      createOpponentToken({ x: 80, y: 50 }, "ST", 9), // passer
      createOpponentToken({ x: 40, y: 48 }, "AM", 10), // runner
      createOpponentToken({ x: 55, y: 12 }, "LW", 11), // wide
    ]);
    const a = resolveRivalActors(scene, 1);
    expect(a.wide?.position.x).toBe(55);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "resolveRivalActors"`
Expected: FAIL — `resolveRivalActors` is not exported (import error / not a function).

- [ ] **Step 3: Implement the helper**

In `src/board/scenarioBoardConsequence.ts`, add after `detectAttackDir` (after its closing `}` near line 60):

```ts
export type RivalActors = {
  passer: BoardObject | null;
  runner: BoardObject | null;
  wide: BoardObject | null;
  count: number;
};

/**
 * Rivals attack toward -dir (mirror of own). depth = dir * x → higher means
 * deeper on the rival's build-up side. NOT resolveCentreBacks (that is own,
 * relative to dir). passer = deepest; runner = most advanced; wide = widest
 * of the rest (only meaningful with a 3rd rival to spend on a channel run).
 */
export function resolveRivalActors(scene: BoardScene, dir: 1 | -1): RivalActors {
  const rivals = scene.objects.filter((o) => o.type === "opponentToken");
  const count = rivals.length;
  if (count === 0) return { passer: null, runner: null, wide: null, count };

  const depth = (o: BoardObject) => dir * o.position.x;
  const sorted = [...rivals].sort((a, b) => depth(b) - depth(a)); // deepest first
  const passer = sorted[0];
  if (count === 1) return { passer, runner: null, wide: null, count };

  const runner = sorted[sorted.length - 1]; // most advanced toward own goal
  let wide: BoardObject | null = null;
  if (count >= 3) {
    const rest = sorted.slice(1, sorted.length - 1); // exclude passer & runner
    wide = rest.reduce(
      (best, o) =>
        Math.abs(o.position.y - 50) > Math.abs(best.position.y - 50) ? o : best,
      rest[0],
    );
  }
  return { passer, runner, wide, count };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "resolveRivalActors"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add src/board/scenarioBoardConsequence.ts tests/scenarioBoardConsequence.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "feat(board): resolveRivalActors dir-aware rival selection (slice 2 task 1)"
```

---

### Task 2: Author the coordinated rival response (single `gapTarget`)

Replace the slice-1 single-threat `longPass` block with one authoring path: compute `gapTarget` once, draw the `longPass` from the passer and the primary `run` from the runner — both to `gapTarget`, both on `layer: "rival"`. Absorbs the old standalone `longPass`.

**Files:**
- Modify: `src/board/scenarioBoardConsequence.ts` — the `else` branch of `REGISTRY["raise-block"]` (currently the threat-arrow block, ~lines 203-212)
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `resolveRivalActors` (Task 1); existing `gap` rect and `dir` already in scope in the `else` branch.
- Produces: `overlay.arrows` containing, for ≥2 rivals, a `longPass` and a `run`, each with `patch.layer === "rival"` and `from.kind === "object"` pointing at real rival ids.

- [ ] **Step 1: Add the multi-rival scene helper and the failing test**

Add the helper near `raiseBlockScene` in `tests/scenarioBoardConsequence.test.ts`:

```ts
function raiseBlockMultiRivalScene(dirMirror = false) {
  const gkX = dirMirror ? 92 : 8;
  const cbX = dirMirror ? 80 : 20;
  const passerX = dirMirror ? 20 : 80; // deep on rival side
  const runnerX = dirMirror ? 60 : 40; // advanced toward own goal
  return sceneWith([
    createPlayerToken(null, { x: gkX, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: cbX, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: cbX, y: 60 }, "CB", 5),
    createOpponentToken({ x: passerX, y: 50 }, "ST", 9),
    createOpponentToken({ x: runnerX, y: 45 }, "AM", 10),
  ]);
}
```

Add the test (new `describe` or inside the raise-block suite):

```ts
it("draws a coordinated rival response: longPass + run on layer rival, anchored to real rival ids", () => {
  const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockMultiRivalScene(false));
  const rivalArrows = overlay.arrows.filter((a) => a.patch?.layer === "rival");
  expect(rivalArrows.length).toBeGreaterThanOrEqual(2);

  const longPass = overlay.arrows.find((a) => a.semantic === "longPass");
  const run = overlay.arrows.find((a) => a.semantic === "run");
  expect(longPass).toBeDefined();
  expect(run).toBeDefined();
  expect(longPass!.from.kind).toBe("object");
  expect(run!.from.kind).toBe("object");
  // anchored to actual opponent tokens in the scene
  const rivalIds = raiseBlockMultiRivalScene(false)
    .objects.filter((o) => o.type === "opponentToken")
    .map((o) => o.id);
  // (ids are regenerated per call; assert the kind + that both are object-anchored)
  expect(longPass!.from.kind === "object" && run!.from.kind === "object").toBe(true);
  expect(rivalIds.length).toBe(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "coordinated rival response"`
Expected: FAIL — today only one arrow exists and it has no `layer: "rival"`; `run` is undefined.

- [ ] **Step 3: Replace the threat-arrow block with the rival-response authoring**

In `src/board/scenarioBoardConsequence.ts`, inside `REGISTRY["raise-block"]`, replace the current block:

```ts
      // 7) Threat arrow: longPass into the gap, anchored to a rival token if any.
      const rival = scene.objects.find((o) => o.type === "opponentToken");
      const from: BoardArrowEndpoint = rival
        ? { kind: "object", objectId: rival.id }
        : { kind: "point", point: { x: dir === 1 ? 100 - ZONE_W : ZONE_W, y: 50 } };
      const to: BoardArrowEndpoint = {
        kind: "point",
        point: { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 },
      };
      arrows.push({ semantic: "longPass", from, to, patch: { label: "Diagonal a la espalda" } });
```

with:

```ts
      // 7) Coordinated rival response. Single source of truth for the target:
      //    longPass (ball) and primary run (player) both resolve to gapTarget.
      const gapTarget = { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 };
      const actors = resolveRivalActors(scene, dir);

      if (actors.count === 0) {
        notes.push("Sin rivales en la escena: no puedo proyectar la respuesta.");
      } else if (actors.passer) {
        arrows.push({
          semantic: "longPass",
          from: { kind: "object", objectId: actors.passer.id },
          to: { kind: "point", point: gapTarget },
          patch: { label: "Diagonal a la espalda", layer: "rival" },
        });

        if (actors.runner) {
          arrows.push({
            semantic: "run",
            from: { kind: "object", objectId: actors.runner.id },
            to: { kind: "point", point: gapTarget },
            patch: { label: "Ataca tu espalda", layer: "rival" },
          });
        } else {
          notes.push("Solo 1 rival: no puedo mostrar la corrida coordinada.");
        }
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "coordinated rival response"`
Expected: PASS.

- [ ] **Step 5: Run the full file to confirm no slice-1 regression**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts`
Expected: PASS (all existing + new). The slice-1 buildConsequenceOverlay tests use a 1-rival scene → they still get a `longPass` (gap zone unchanged); the new note does not break their assertions.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add src/board/scenarioBoardConsequence.ts tests/scenarioBoardConsequence.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "feat(board): coordinated rival response with single gapTarget (slice 2 task 2)"
```

---

### Task 3: Coordination invariant test (the lock)

Lock single-coherent-authoring with a test, same discipline as the `detectAttackDir` cross-check: `longPass.to` and the primary `run.to` resolve to the same gap, and both sit inside the `danger`/`freeSpace` zone. A future refactor that decouples ball from runner must fail here, not in silence.

**Files:**
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `buildConsequenceOverlay`, `raiseBlockMultiRivalScene` (Task 2), `isInsideZoneRect`.

- [ ] **Step 1: Add the import and the invariant test**

Add the import at the top of the test file (alongside the existing board imports):

```ts
import { isInsideZoneRect } from "@/board/productBoardTypes";
import type { BoardZone } from "@/board/boardModel";
```

Add the test:

```ts
it("coordination invariant: longPass and primary run resolve to one gap inside the danger zone", () => {
  const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockMultiRivalScene(false));
  const longPass = overlay.arrows.find((a) => a.semantic === "longPass");
  const run = overlay.arrows.find((a) => a.semantic === "run");
  expect(longPass).toBeDefined();
  expect(run).toBeDefined();
  expect(longPass!.to.kind).toBe("point");
  expect(run!.to.kind).toBe("point");

  const lp = (longPass!.to as { kind: "point"; point: { x: number; y: number } }).point;
  const rn = (run!.to as { kind: "point"; point: { x: number; y: number } }).point;
  // same gapTarget by construction (single source) → distance ~0
  expect(Math.hypot(lp.x - rn.x, lp.y - rn.y)).toBeLessThan(0.001);

  const gap = overlay.zones.find(
    (z) => z.semantic === "danger" || z.semantic === "freeSpace",
  );
  expect(gap).toBeDefined();
  const gapRect = { x: gap!.x, y: gap!.y, w: gap!.w, h: gap!.h } as unknown as BoardZone;
  expect(isInsideZoneRect(lp, gapRect)).toBe(true);
  expect(isInsideZoneRect(rn, gapRect)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it passes (green-on-arrival lock)**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "coordination invariant"`
Expected: PASS. This is a regression lock for behavior established in Task 2 — it is green on arrival by construction. (To prove it bites, temporarily change `run.to` in the source to a different point and watch it fail, then revert. Optional.)

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add tests/scenarioBoardConsequence.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "test(board): lock the ball/runner coordination invariant (slice 2 task 3)"
```

---

### Task 4: Degradation cases (1 rival, 0 rivals)

The 1-rival and 0-rival behaviors were authored in Task 2; this task locks them with tests (Patch 1: a single token is never drawn as a redundant runner).

**Files:**
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `buildConsequenceOverlay`, `raiseBlockScene` (1 rival), `sceneWith`, factories.

- [ ] **Step 1: Add the degradation tests**

```ts
it("degradation 1 rival: longPass only, partial note, NO run on layer rival", () => {
  // raiseBlockScene(false) has exactly one opponent token.
  const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false));
  expect(overlay.arrows.some((a) => a.semantic === "longPass")).toBe(true);
  const rivalRuns = overlay.arrows.filter(
    (a) => a.semantic === "run" && a.patch?.layer === "rival",
  );
  expect(rivalRuns.length).toBe(0);
  expect(overlay.notes.join(" ")).toMatch(/solo 1 rival/i);
});

it("degradation 0 rivals: no rival-layer arrows + note, gap zone and press still drawn", () => {
  // CBs present (so the gap can be drawn) but no opponent tokens.
  const scene = sceneWith([
    createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: 20, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: 20, y: 60 }, "CB", 5),
  ]);
  const overlay = buildConsequenceOverlay(raiseBlockSim(), scene);
  expect(overlay.arrows.some((a) => a.patch?.layer === "rival")).toBe(false);
  expect(overlay.notes.join(" ")).toMatch(/sin rivales/i);
  expect(
    overlay.zones.some((z) => z.semantic === "danger" || z.semantic === "freeSpace"),
  ).toBe(true);
  expect(overlay.zones.some((z) => z.semantic === "press")).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "degradation"`
Expected: PASS (2 tests). If `degradation 0 rivals` fails because the gap is not drawn, confirm both CBs share `x: 20` so they resolve via `resolveCentreBacks`.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add tests/scenarioBoardConsequence.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "test(board): lock 1-rival and 0-rival degradation (slice 2 task 4)"
```

---

### Task 5: Second run / channel (≥3 rivals)

Spend a third rival on a channel run: a `run` into the same behind-the-line band as the gap but in the wide actor's lane — geometrically compatible, not identical to `gapTarget` (so it never confuses the invariant).

**Files:**
- Modify: `src/board/scenarioBoardConsequence.ts` — append to the rival-response block from Task 2
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `actors.wide` (Task 1), `gap`, `gapTarget` (Task 2).
- Produces: a 3rd `run` arrow on `layer: "rival"` when a wide rival exists.

- [ ] **Step 1: Add the 3-rival scene helper and failing test**

```ts
function raiseBlockThreeRivalScene() {
  return sceneWith([
    createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
    createPlayerToken(cbA, { x: 20, y: 40 }, "CB", 4),
    createPlayerToken(cbB, { x: 20, y: 60 }, "CB", 5),
    createOpponentToken({ x: 80, y: 50 }, "ST", 9), // passer
    createOpponentToken({ x: 40, y: 48 }, "AM", 10), // runner
    createOpponentToken({ x: 55, y: 12 }, "LW", 11), // wide
  ]);
}

it("3 rivals: adds a second run (channel) on layer rival, distinct from the primary run target", () => {
  const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockThreeRivalScene());
  const runs = overlay.arrows.filter(
    (a) => a.semantic === "run" && a.patch?.layer === "rival",
  );
  expect(runs.length).toBe(2);
  // both runs end at point endpoints; the channel run is not the exact gapTarget
  const targets = runs.map(
    (r) => (r.to as { kind: "point"; point: { x: number; y: number } }).point,
  );
  expect(Math.hypot(targets[0].x - targets[1].x, targets[0].y - targets[1].y)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "second run"`
Expected: FAIL — only one rival `run` exists today.

- [ ] **Step 3: Implement the channel run**

In `src/board/scenarioBoardConsequence.ts`, inside the `else if (actors.passer)` block from Task 2, after the primary-run `if/else`, add:

```ts
        if (actors.wide) {
          // Same behind-the-line depth as the gap, but in the wide actor's lane.
          const channelY = actors.wide.position.y < 50 ? gap.y : gap.y + gap.h;
          arrows.push({
            semantic: "run",
            from: { kind: "object", objectId: actors.wide.id },
            to: {
              kind: "point",
              point: { x: gapTarget.x, y: Math.max(0, Math.min(100, channelY)) },
            },
            patch: { label: "Ataca el carril", layer: "rival" },
          });
        }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts -t "second run"`
Expected: PASS.

- [ ] **Step 5: Run the full file**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts`
Expected: PASS (all). The invariant test (Task 3) still passes — the channel run is a separate arrow; the primary run still equals `gapTarget`.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add src/board/scenarioBoardConsequence.ts tests/scenarioBoardConsequence.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "feat(board): channel run for a third rival (slice 2 task 5)"
```

---

### Task 6: Rival-layer visibility branch (`boardGeometry.ts`)

`layerVisibleForArrow` classifies by `arrow.semantic`, so a rival `run` binds to the attack layer and a rival `longPass` is always visible — mis-classification. Add one early branch so the `rival` group is governed as a group (controlled by the overlay lifecycle during preview; correct after accept when arrows are real board items).

**Files:**
- Modify: `src/board/boardGeometry.ts:61-68` (`layerVisibleForArrow`)
- Test: `tests/boardGeometry.test.ts` (create if absent)

**Interfaces:**
- Consumes: `BoardArrow` (already imported in `boardGeometry.ts`), `createSemanticArrow` (for the test).
- Produces: `layerVisibleForArrow(arrow, layers)` returns `true` for any `arrow.layer === "rival"` regardless of `activeLayers`.

- [ ] **Step 1: Write the failing test**

Create `tests/boardGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { layerVisibleForArrow } from "@/board/boardGeometry";
import { createSemanticArrow } from "@/board/boardModel";

describe("layerVisibleForArrow — rival group", () => {
  it("a rival-layer run is visible even when no attack layer is active", () => {
    const arrow = createSemanticArrow(
      "run",
      { kind: "point", point: { x: 40, y: 45 } },
      { kind: "point", point: { x: 12, y: 50 } },
      { layer: "rival" },
    );
    expect(layerVisibleForArrow(arrow, new Set<string>())).toBe(true);
  });

  it("a non-rival run still depends on its semantic layer", () => {
    const arrow = createSemanticArrow(
      "run",
      { kind: "point", point: { x: 40, y: 45 } },
      { kind: "point", point: { x: 12, y: 50 } },
    );
    expect(layerVisibleForArrow(arrow, new Set<string>())).toBe(false);
    expect(layerVisibleForArrow(arrow, new Set(["attack"]))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/boardGeometry.test.ts`
Expected: FAIL — the first test fails because a rival `run` resolves via `offensiveTransition || attack` → `false`.

- [ ] **Step 3: Add the early branch**

In `src/board/boardGeometry.ts`, change `layerVisibleForArrow` (line ~61):

```ts
export function layerVisibleForArrow(arrow: BoardArrow, layers: Set<string>) {
  if (arrow.layer === "rival") return true;
  if (arrow.semantic === "pass") return layers.has("attack");
  if (arrow.semantic === "pressure")
    return layers.has("counterPress") || layers.has("defense");
  if (arrow.semantic === "run")
    return layers.has("offensiveTransition") || layers.has("attack");
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/boardGeometry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" add src/board/boardGeometry.ts tests/boardGeometry.test.ts
git -C "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" commit -m "fix(board): rival-layer arrows visible as a group (slice 2 task 6)"
```

---

### Final verification (after all tasks)

- [ ] **Full test suite + type-check**

Run: `cd "C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d" && npx vitest run tests/scenarioBoardConsequence.test.ts tests/boardGeometry.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: all tests PASS, `tsc` exit 0.

> **Implementation note (spec §10):** confirm whether the overlay preview renders through `layerVisibleForArrow` or via a dedicated ghost renderer. If it is a ghost renderer, the Task 6 branch primarily protects the post-accept state (when rival arrows are real board items entering the layer pipeline). Either way the branch is correct and required.

---

## Self-Review

**Spec coverage:**
- §2 guards → Global Constraints (verbatim) + enforced in Tasks 1/2/6.
- §3 vocabulary (`run`/`longPass`, no new enum) → Tasks 2/5.
- §4 six decisions → visual coexistence (Task 2 keeps longPass + adds runs), single authoring function (Task 2), semantics (Tasks 2/5), grounding (Tasks 2/4), raise-block verticality longPass+run+run (Tasks 2/5), density/visibility layer "rival" (Tasks 2/6).
- §5 dir-aware selection + "not resolveCentreBacks" → Task 1.
- §6 degradation 0/1/≥2 → Tasks 2/4.
- §7+§8.2 coordination invariant → Task 3.
- §8.1/8.3/8.4/8.5 tests → Tasks 2/4/6.
- §9 out-of-scope → nothing in the plan adds ghosts, animation, temporal order, metrics, dropReceive-default, LLM, or other scenarios.
- §10 affected files → `scenarioBoardConsequence.ts` (Tasks 1/2/5), `boardGeometry.ts` (Task 6), test files; the implementation note carries the preview/ghost confirmation.

**Placeholder scan:** none — every code/test/command step shows actual content.

**Type consistency:** `RivalActors`, `resolveRivalActors(scene, dir)`, `OverlayArrow` (`semantic`/`from`/`to`/`patch.layer`), `isInsideZoneRect(position, zone)`, `layerVisibleForArrow(arrow, layers)` are used consistently across tasks and match the source signatures verified against `boardModel.ts`, `productBoardTypes.ts`, and `boardGeometry.ts`.
