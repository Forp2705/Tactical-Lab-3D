# Board Scenario Sandbox (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the DT pick the `raise-block` scenario on the Pizarra and have RomboIQ project its deterministic geometric consequence back onto the real scene as an ephemeral overlay (accept/discard), with the rival reaction expressed as facts anchored to the drawn tokens.

**Architecture:** Two new pure modules — `scenarioBridge` (scene → `ScenarioInput`) and `scenarioBoardConsequence` (`ScenarioSimulation` → `ConsequenceOverlay` with authored, orientation-detected geometry) — orchestrated by the existing `useBoardActions`. The overlay carries commit-ready geometry; `accept` materializes it 1:1 through the existing `createSemanticArrow`/`createTacticalZone` factories (preview ≡ commit, zero recompute). Everything is deterministic and client-side; no LLM, no `api/`, no schema change.

**Tech Stack:** React 18 + TypeScript, Zustand store, Vitest, existing `boardModel` factories + `simulateScenario` (pure).

## Global Constraints

- **Slice 1 = `raise-block` only.** The input/selection scaffolding is generic, but the draw-back geometry is authored per scenario; do not generalize the consequence to the other 10. (spec §2, §3)
- **Deterministic, client-side only.** No `CoachAgent`/LLM, no `api/`, no server. (spec §3, §4.3)
- **`metrics: null` always** in the bridge output. The simulator degrades honestly. (spec §2, §5.1)
- **Overlay is ephemeral.** The persisted `BoardScene` is never mutated except on explicit `accept`, and only via the existing factories. (spec §2, §4.3)
- **No schema change to `boardModel`.** No `origin`/provenance field. (spec §3, §4.3)
- **Preview ≡ commit.** The overlay holds final geometry; `accept` maps 1:1 to factories with zero recompute. If `accept` re-derived geometry, that would reintroduce two sources of truth. (spec §5.2)
- **Orientation is detected, not assumed.** All `raise-block` geometry is computed relative to `dir` from `detectAttackDir`. (spec §5.3)
- **Honest degradation, P0.5 pattern:** the panel says *what is missing*, never shows empty. (spec §7)
- **Arrow semantics:** use `longPass` / `run`. `ballRoute` does **not** exist in the enum. (spec §6.7; verified `BoardArrowSemanticSchema`, `boardModel.ts:58-75`)
- **Verified factory param types (use verbatim as the overlay patch aliases):**
  - `createTacticalZone(semantic, x, y, w, h, patch?)`, `patch: Partial<Omit<BoardZone, "id" | "semantic" | "x" | "y" | "w" | "h">>` (`boardModel.ts:597-605`). `color` IS a top-level field of `BoardZone` (`boardModel.ts:180`), so the alias is exact — no superset rebounds at `.parse`. (resolves review note #1)
  - `createSemanticArrow(semantic, from, to, patch?)`, `patch: Partial<Omit<BoardArrow, "id" | "semantic" | "from" | "to">>` (`boardModel.ts:575-579`).
  - `BoardArrowEndpoint = { kind: "object"; objectId: string } | { kind: "point"; point: BoardPoint }` (`boardModel.ts:139-143`).

---

## Prerequisite (Task 0): Rebase onto main + P0.7 — process, not code

**This is not a code task. Do it before any task below touches `TacticalBoardCanvas.tsx` or `TacticalBoardAiPanel.tsx` (Task 5).** Tasks 1–4 do not touch those two files and can proceed on the current branch immediately.

- [ ] **Step 1: Merge `feat/board-rescue-p0` P0.7 (visual polish) to `main`** (the pending decision). P0.7 styled `TacticalBoardCanvas.tsx` and the "Qué entiende RomboIQ" panel — the exact files Task 5 extends. Leaving it unmerged forces a manual CSS/structure reconciliation later.
- [ ] **Step 2: Rebase `feat/board-scenario-sandbox` onto the new `main`.**

```bash
git checkout main && git pull
git checkout feat/board-scenario-sandbox && git rebase main
npm run type-check
```

Expected: clean rebase, type-check passes. Baseline for Task 5 = `main` + P0.7.

> If P0.7 is not yet merged when you reach Task 5, STOP and resolve the merge first — do not implement the preview layer against pre-P0.7 canvas/panel structure.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/board/scenarioBridge.ts` *(new)* | Pure: `(scene, teamPlayers, gameModel, exercises, scenarioId, problem?) → { input: ScenarioInput; unlinkedCount }`. Token→`Player` lookup by `linkedPlayerId`. |
| `src/board/scenarioBoardConsequence.ts` *(new)* | Pure: owns `detectAttackDir`, the `ConsequenceOverlay` type + patch aliases, and the `raise-block` authored geometry registry. |
| `src/board/productBoardTypes.ts` *(modify)* | Export `isInsideZoneRect` (currently private, line 279) for the exposure check. |
| `src/board/useBoardActions.ts` *(modify)* | Overlay state + `runScenario` / `commitOverlay` / `setConsequenceOverlay(null)`; discard-on-scene-mutation lifecycle. Expose in the return prop-bag. |
| `src/board/TacticalBoardView.tsx` *(modify)* | Thread the new prop-bag fields into canvas + panel. |
| `src/board/components/TacticalBoardCanvas.tsx` *(modify, post-P0.7)* | Render the ephemeral preview layer (ghost/dashed + "Proyección de RomboIQ"). |
| `src/board/components/TacticalBoardAiPanel.tsx` *(modify, post-P0.7)* | Scenario selector + readout + rivalFacts + confidence/evidence + Aceptar/Descartar. |
| `tests/scenarioBridge.test.ts` *(new)* | Bridge unit tests. |
| `tests/scenarioBoardConsequence.test.ts` *(new)* | `detectAttackDir` + `raise-block` overlay + accept-map-1:1 unit tests. |

---

## Task 1: `scenarioBridge` — scene → `ScenarioInput` (pure)

**Files:**
- Create: `src/board/scenarioBridge.ts`
- Test: `tests/scenarioBridge.test.ts`

**Interfaces:**
- Consumes: `ScenarioInput`, `ScenarioId` from `@/ai/scenarioSimulator`; `BoardScene`, `BoardObject` from `@/board/boardModel`; `Player`, `Exercise` from `@/data`; `GameModel` from `@/data/gameModel`; `TacticalProblem` from `@/board/productBoardTypes`.
- Produces: `buildScenarioInput(scene, teamPlayers, gameModel, exercises, scenarioId, problem?) => { input: ScenarioInput; unlinkedCount: number }`.

> **Faithful reconciliation of spec §4.1:** the spec prose says `objective ← problema del board` and `evidenceText/patterns ← texto del problema`. The board's `TacticalProblem` (`{ problem, objective }`) lives in the orchestrator, not in `BoardScene`, so it is passed as an optional 6th argument rather than dug out of the scene. This is the design's intent made concrete, not a scope change. `patterns` has no board source → omitted.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scenarioBridge.test.ts
import { describe, expect, it } from "vitest";
import { buildScenarioInput } from "@/board/scenarioBridge";
import { createPlayerToken, createOpponentToken, createDefaultBoardScene } from "@/board/boardModel";
import { DEFAULT_GAME_MODEL } from "@/data/gameModel";
import type { Player } from "@/data";

const players: Player[] = [
  { id: "p1", name: "Tomás Álvarez", num: 1, positions: ["GK"], foot: "R" } as Player,
  { id: "p2", name: "Bruno Díaz", num: 4, positions: ["CB"], foot: "R" } as Player,
];

function sceneWith(objects = []) {
  const scene = createDefaultBoardScene("Test");
  return { ...scene, objects };
}

describe("buildScenarioInput", () => {
  it("maps linked own tokens to their Player and reports metrics:null", () => {
    const scene = sceneWith([
      createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4),
    ]);
    const { input, unlinkedCount } = buildScenarioInput(
      scene, players, DEFAULT_GAME_MODEL, [], "raise-block",
    );
    expect(input.scenarioId).toBe("raise-block");
    expect(input.metrics).toBeNull();
    expect(input.players.map((p) => p.id)).toEqual(["p2"]);
    expect(unlinkedCount).toBe(0);
  });

  it("excludes unlinked own tokens and counts them", () => {
    const scene = sceneWith([
      createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4),
      createPlayerToken(null, { x: 30, y: 50 }, "CB", 5),       // no linkedPlayerId
      createOpponentToken({ x: 80, y: 50 }, "ST", 9),           // rival, ignored
    ]);
    const { input, unlinkedCount } = buildScenarioInput(
      scene, players, DEFAULT_GAME_MODEL, [], "raise-block",
    );
    expect(input.players.map((p) => p.id)).toEqual(["p2"]);
    expect(unlinkedCount).toBe(1);
  });

  it("sources objective/evidenceText from the board problem when present", () => {
    const scene = sceneWith([createPlayerToken(players[1], { x: 20, y: 50 }, "CB", 4)]);
    const { input } = buildScenarioInput(
      scene, players, DEFAULT_GAME_MODEL, [], "raise-block",
      { problem: "Nos cuesta presionar arriba", objective: "Subir el bloque" },
    );
    expect(input.objective).toBe("Subir el bloque");
    expect(input.evidenceText).toBe("Nos cuesta presionar arriba");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioBridge.test.ts`
Expected: FAIL — `buildScenarioInput` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/board/scenarioBridge.ts
import type { Exercise, Player } from "@/data";
import type { GameModel } from "@/data/gameModel";
import type { ScenarioId, ScenarioInput } from "@/ai/scenarioSimulator";
import type { BoardScene } from "@/board/boardModel";
import type { TacticalProblem } from "@/board/productBoardTypes";

/**
 * Pure bridge: turns the relational Pizarra scene into the simulator's
 * ScenarioInput. Own playerTokens carry an optional linkedPlayerId; only
 * linked tokens contribute a real Player (direct lookup in team.players —
 * NO collectPayloadPlayers, which produces the lossy PlanningBoardPlayer).
 * metrics is always null (CoachShapeMetrics belongs to LineupLab, not the
 * board); the simulator degrades honestly. unlinkedCount feeds the panel's
 * honest degradation.
 */
export function buildScenarioInput(
  scene: BoardScene,
  teamPlayers: Player[],
  gameModel: GameModel,
  exercises: Exercise[],
  scenarioId: ScenarioId,
  problem?: TacticalProblem,
): { input: ScenarioInput; unlinkedCount: number } {
  const byId = new Map(teamPlayers.map((p) => [p.id, p]));
  const ownTokens = scene.objects.filter((o) => o.type === "playerToken");

  const players: Player[] = [];
  let unlinkedCount = 0;
  for (const token of ownTokens) {
    const linked = token.linkedPlayerId ? byId.get(token.linkedPlayerId) : undefined;
    if (linked) players.push(linked);
    else unlinkedCount += 1;
  }

  const objective = problem?.objective?.trim() || undefined;
  const evidenceText = problem?.problem?.trim() || undefined;

  const input: ScenarioInput = {
    scenarioId,
    objective,
    metrics: null,
    gameModel,
    players,
    evidenceText,
    exercises,
  };

  return { input, unlinkedCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/scenarioBridge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/board/scenarioBridge.ts tests/scenarioBridge.test.ts
git commit -m "feat(board): scenarioBridge — scene to ScenarioInput (pure)"
```

---

## Task 2: `detectAttackDir` — orientation detected, not assumed (pure)

**Files:**
- Create: `src/board/scenarioBoardConsequence.ts` (this task adds `detectAttackDir` + the role helpers; Task 3 adds the `raise-block` geometry to the same file)
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `BoardScene`, `BoardObject` from `@/board/boardModel`.
- Produces: `detectAttackDir(scene) => { dir: 1 | -1; note?: string }`; `isOwnGoalkeeper(o)`, `isOwnCentreBack(o)` role predicates (exported for Task 3 + tests).

> Three tiers, no circularity, with a floor (spec §5.3). Do **not** use "deepest token" — "deep" presupposes the direction being computed.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scenarioBoardConsequence.test.ts
import { describe, expect, it } from "vitest";
import { detectAttackDir } from "@/board/scenarioBoardConsequence";
import { createPlayerToken, createOpponentToken, createDefaultBoardScene } from "@/board/boardModel";

function sceneWith(objects) {
  return { ...createDefaultBoardScene("T"), objects };
}

describe("detectAttackDir", () => {
  it("Tier 1: own GK on the left → attack toward +x (dir 1)", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]);
    expect(detectAttackDir(scene).dir).toBe(1);
  });

  it("Tier 1 mirrored: own GK on the right → attack toward -x (dir -1)", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 92, y: 50 }, "Arquero", 1)]);
    expect(detectAttackDir(scene).dir).toBe(-1);
  });

  it("Tier 2: no GK, own centroid behind rival centroid → dir 1", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 25, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 30, y: 60 }, "CB", 5),
      createOpponentToken({ x: 75, y: 50 }, "ST", 9),
    ]);
    expect(detectAttackDir(scene).dir).toBe(1);
  });

  it("Tier 3: no GK, no rival → dir 1 with a note", () => {
    const scene = sceneWith([createPlayerToken(null, { x: 50, y: 50 }, "CM", 8)]);
    const result = detectAttackDir(scene);
    expect(result.dir).toBe(1);
    expect(result.note).toMatch(/orientación asumida/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts`
Expected: FAIL — module/`detectAttackDir` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/board/scenarioBoardConsequence.ts
import type { BoardObject, BoardScene } from "@/board/boardModel";

const GK_ROLE = /\b(gk|arquero|portero|golero)\b/i;
const CB_ROLE = /\b(cb|dfc|central|centre[-\s]?back|center[-\s]?back)\b/i;

export function isOwnPlayerToken(o: BoardObject): boolean {
  return o.type === "playerToken";
}
export function isOwnGoalkeeper(o: BoardObject): boolean {
  return isOwnPlayerToken(o) && !!o.role && GK_ROLE.test(o.role);
}
export function isOwnCentreBack(o: BoardObject): boolean {
  return isOwnPlayerToken(o) && !!o.role && CB_ROLE.test(o.role);
}

function centroidX(objects: BoardObject[]): number | null {
  if (objects.length === 0) return null;
  return objects.reduce((sum, o) => sum + o.position.x, 0) / objects.length;
}

/**
 * dir = 1 → own team attacks toward +x ; dir = -1 → toward -x.
 * Tier 1 (primary): own GK by ROLE. Its x marks the own-goal side → attack
 *   the opposite way. (No "deepest token": deep presupposes the direction.)
 * Tier 2 (fallback): own centroid vs rival centroid. Own behind → attack
 *   toward the rival side.
 * Tier 3 (floor): no GK and no rival → dir 1 with an honest note.
 */
export function detectAttackDir(scene: BoardScene): { dir: 1 | -1; note?: string } {
  const own = scene.objects.filter(isOwnPlayerToken);
  const rival = scene.objects.filter((o) => o.type === "opponentToken");

  const gk = own.find(isOwnGoalkeeper);
  if (gk) {
    // GK on the left half (x < 50) → own goal is left → attack toward +x.
    return { dir: gk.position.x < 50 ? 1 : -1 };
  }

  const ownX = centroidX(own);
  const rivalX = centroidX(rival);
  if (ownX !== null && rivalX !== null) {
    return { dir: ownX <= rivalX ? 1 : -1 };
  }

  return { dir: 1, note: "Orientación asumida (+x hacia adelante): sin arquero ni rival en la escena." };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/board/scenarioBoardConsequence.ts tests/scenarioBoardConsequence.test.ts
git commit -m "feat(board): detectAttackDir — orientation detected not assumed"
```

---

## Task 3: `raise-block` authored geometry + `ConsequenceOverlay` (pure)

**Files:**
- Modify: `src/board/scenarioBoardConsequence.ts` (add types + `buildConsequenceOverlay`)
- Modify: `src/board/productBoardTypes.ts:279` (export `isInsideZoneRect`)
- Test: `tests/scenarioBoardConsequence.test.ts` (extend)

**Interfaces:**
- Consumes: `ScenarioSimulation` from `@/ai/scenarioSimulator`; `detectAttackDir`, `isOwnCentreBack`, `isOwnPlayerToken` from this file; `isInsideZoneRect` from `@/board/productBoardTypes`; factory param/endpoint types from `@/board/boardModel`.
- Produces:
  - `type OverlayZonePatch`, `OverlayArrowPatch`, `OverlayZone`, `OverlayArrow`, `ConsequenceOverlay` (exported).
  - `buildConsequenceOverlay(simulation: ScenarioSimulation, scene: BoardScene) => ConsequenceOverlay`.

> Central-back fallback tiebreak (resolves review note #2): when roles are missing, take the 2 own tokens furthest back relative to `dir`, **and** break ties toward the central lane (closest to the own tokens' y-centroid) so a back four does not surface fullbacks instead of centre-backs. For `raise-block` the gap is central — the fallback must draw it central.

- [ ] **Step 1: Export `isInsideZoneRect`**

In `src/board/productBoardTypes.ts:279`, change `function isInsideZoneRect(` to `export function isInsideZoneRect(`. (No behavior change; it was already used internally at line 209.)

- [ ] **Step 2: Write the failing test (append to the existing file)**

```ts
// tests/scenarioBoardConsequence.test.ts  (append)
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { simulateScenario } from "@/ai/scenarioSimulator";
import { DEFAULT_GAME_MODEL } from "@/data/gameModel";
import type { Player } from "@/data";

const cbA: Player = { id: "cbA", name: "Tomás", num: 4, positions: ["CB"], foot: "R" } as Player;
const cbB: Player = { id: "cbB", name: "Diego", num: 5, positions: ["CB"], foot: "L" } as Player;

function raiseBlockScene(dirMirror = false) {
  const gkX = dirMirror ? 92 : 8;
  const cbX = dirMirror ? 80 : 20;
  return {
    ...createDefaultBoardScene("RB"),
    objects: [
      createPlayerToken(null, { x: gkX, y: 50 }, "GK", 1),
      createPlayerToken(cbA, { x: cbX, y: 40 }, "CB", 4),
      createPlayerToken(cbB, { x: cbX, y: 60 }, "CB", 5),
      createOpponentToken({ x: dirMirror ? 20 : 80, y: 50 }, "ST", 9),
    ],
  };
}

function sim() {
  return simulateScenario({
    scenarioId: "raise-block", metrics: null, gameModel: DEFAULT_GAME_MODEL,
    players: [cbA, cbB], exercises: [],
  });
}

describe("buildConsequenceOverlay (raise-block)", () => {
  it("anchors the gap behind the centre-backs on the own-goal side for dir 1", () => {
    const overlay = buildConsequenceOverlay(sim(), raiseBlockScene(false));
    expect(overlay.scenarioId).toBe("raise-block");
    const gap = overlay.zones.find((z) => z.semantic === "danger" || z.semantic === "freeSpace");
    expect(gap).toBeDefined();
    // dir 1: gap sits behind CBs (x≈20) toward own goal (x≈8) → gap.x < 20.
    expect(gap!.x).toBeLessThan(20);
    expect(overlay.zones.some((z) => z.semantic === "press")).toBe(true);
  });

  it("mirrored scene puts the gap on the correct (right) side for dir -1", () => {
    const overlay = buildConsequenceOverlay(sim(), raiseBlockScene(true));
    const gap = overlay.zones.find((z) => z.semantic === "danger" || z.semantic === "freeSpace");
    // dir -1: gap behind CBs (x≈80) toward own goal (x≈92) → gap.x + w > 80.
    expect(gap!.x + gap!.w).toBeGreaterThan(80);
  });

  it("composes a rival fact naming the real centre-backs", () => {
    const overlay = buildConsequenceOverlay(sim(), raiseBlockScene(false));
    const joined = overlay.rivalFacts.join(" ");
    expect(joined).toContain("Tomás");
    expect(joined).toContain("Diego");
  });

  it("notes missing centre-backs instead of drawing a phantom gap", () => {
    const scene = { ...createDefaultBoardScene("RB"),
      objects: [createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)] };
    const overlay = buildConsequenceOverlay(sim(), scene);
    expect(overlay.zones.some((z) => z.semantic === "danger" || z.semantic === "freeSpace")).toBe(false);
    expect(overlay.notes.join(" ")).toMatch(/no pude ubicar los centrales/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts`
Expected: FAIL — `buildConsequenceOverlay` not exported.

- [ ] **Step 4: Write the implementation (append to `scenarioBoardConsequence.ts`)**

```ts
// src/board/scenarioBoardConsequence.ts  (append)
import type { ScenarioId, ScenarioSimulation } from "@/ai/scenarioSimulator";
import type {
  BoardArrow, BoardArrowEndpoint, BoardArrowSemantic,
  BoardZone, BoardZoneSemantic,
} from "@/board/boardModel";
import { isInsideZoneRect } from "@/board/productBoardTypes";

// Patch aliases = the factory param types verbatim (single source of truth).
export type OverlayZonePatch  = Partial<Omit<BoardZone,  "id" | "semantic" | "x" | "y" | "w" | "h">>;
export type OverlayArrowPatch = Partial<Omit<BoardArrow, "id" | "semantic" | "from" | "to">>;

export type OverlayZone  = { semantic: BoardZoneSemantic;  x: number; y: number; w: number; h: number; patch?: OverlayZonePatch };
export type OverlayArrow = { semantic: BoardArrowSemantic; from: BoardArrowEndpoint; to: BoardArrowEndpoint; patch?: OverlayArrowPatch };

export type ConsequenceOverlay = {
  scenarioId: ScenarioId;
  title: string;
  zones: OverlayZone[];
  arrows: OverlayArrow[];
  rivalFacts: string[];
  readout: {
    expectedBenefit: string;
    mainRisk: string;
    exposedPlayers: string[];
    confidence: "low" | "medium" | "high";
    evidenceLevel: "none" | "weak" | "partial" | "sufficient";
  };
  notes: string[];
};

const ZONE_W = 26;  // normalized rect width for the authored bands
const ZONE_H = 30;

/** 2 deepest own tokens relative to dir, tiebroken toward the central lane. */
function resolveCentreBacks(
  scene: BoardScene, dir: 1 | -1,
): { backs: BoardObject[]; usedFallback: boolean } {
  const own = scene.objects.filter(isOwnPlayerToken).filter((o) => !isOwnGoalkeeper(o));
  const byRole = own.filter(isOwnCentreBack);
  if (byRole.length >= 2) return { backs: byRole.slice(0, 2), usedFallback: false };

  if (own.length < 2) return { backs: [], usedFallback: true };
  const laneY = own.reduce((s, o) => s + o.position.y, 0) / own.length;
  // "deepest relative to dir": dir 1 → smallest x is deepest; dir -1 → largest x.
  const depth = (o: BoardObject) => (dir === 1 ? o.position.x : -o.position.x);
  const sorted = [...own].sort((a, b) => {
    const d = depth(a) - depth(b);
    if (d !== 0) return d;                                  // deeper first
    return Math.abs(a.position.y - laneY) - Math.abs(b.position.y - laneY); // then central
  });
  return { backs: sorted.slice(0, 2), usedFallback: true };
}

function clampRect(x: number, y: number, w: number, h: number) {
  const cx = Math.max(0, Math.min(x, 100 - w));
  const cy = Math.max(0, Math.min(y, 100 - h));
  return { x: cx, y: cy, w, h };
}

type DrawBack = (simulation: ScenarioSimulation, scene: BoardScene) => ConsequenceOverlay;

const REGISTRY: Partial<Record<ScenarioId, DrawBack>> = {
  "raise-block": (simulation, scene) => {
    const notes: string[] = [];
    const { dir, note } = detectAttackDir(scene);
    if (note) notes.push(note);

    const readout = {
      expectedBenefit: simulation.expectedBenefit,
      mainRisk: simulation.mainRisk,
      exposedPlayers: simulation.exposedPlayers,
      confidence: simulation.confidence,
      evidenceLevel: simulation.evidenceLevel,
    };

    // 3) High-press band over the rival's build-up third (relative to dir).
    const pressX = dir === 1 ? 100 - ZONE_W : 0;
    const press = clampRect(pressX, 35, ZONE_W, ZONE_H);
    const zones: OverlayZone[] = [
      { semantic: "press", ...press, patch: { label: "Presión alta", layer: "press" } },
    ];

    const { backs, usedFallback } = resolveCentreBacks(scene, dir);
    if (usedFallback && backs.length) {
      notes.push("Centrales inferidos por posición (faltan roles en las fichas).");
    }

    const rivalFacts: string[] = [];
    const arrows: OverlayArrow[] = [];

    if (backs.length < 2) {
      notes.push("No pude ubicar los centrales en la escena.");
    } else {
      // 4) Gap band behind the CB line toward the own goal (relative to dir).
      const lineX = (backs[0].position.x + backs[1].position.x) / 2;
      const gapX = dir === 1 ? lineX - ZONE_W : lineX;
      const gap = clampRect(gapX, 35, ZONE_W, ZONE_H);
      zones.push({ semantic: "danger", ...gap, patch: { label: "Espacio a la espalda", layer: "notes" } });

      // 5) Exposure check: own tokens covering the gap.
      const gapZoneRect = { ...gap, id: "tmp", semantic: "danger", label: "", shape: "rectangle",
        layer: "notes", color: "#000", style: {}, visibility: "staff" } as unknown as BoardZone;
      const covering = scene.objects.filter(
        (o) => isOwnPlayerToken(o) && !backs.includes(o) && isInsideZoneRect(o.position, gapZoneRect),
      ).length;

      // 6) Composed rival fact (real names + real count, "lectura del modelo").
      const names = backs.map((b) => b.label).join(" y ");
      const tail = covering === 0
        ? "detrás no queda ninguna cobertura → el rival ataca esa espalda con diagonal larga"
        : `detrás quedan ${covering} cobertura(s) → riesgo atenuado en esa espalda`;
      rivalFacts.push(`(lectura del modelo) Tus centrales ${names} suben; ${tail}.`);

      // 7) Threat arrow: longPass into the gap, anchored to a rival token if any.
      const rival = scene.objects.find((o) => o.type === "opponentToken");
      const from: BoardArrowEndpoint = rival
        ? { kind: "object", objectId: rival.id }
        : { kind: "point", point: { x: dir === 1 ? 100 - ZONE_W : ZONE_W, y: 50 } };
      const to: BoardArrowEndpoint = { kind: "point", point: { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 } };
      arrows.push({ semantic: "longPass", from, to, patch: { label: "Diagonal a la espalda" } });
    }

    return {
      scenarioId: "raise-block", title: simulation.title,
      zones, arrows, rivalFacts, readout, notes,
    };
  },
};

export function buildConsequenceOverlay(
  simulation: ScenarioSimulation, scene: BoardScene,
): ConsequenceOverlay {
  const draw = REGISTRY[simulation.scenarioId];
  if (!draw) {
    return {
      scenarioId: simulation.scenarioId, title: simulation.title,
      zones: [], arrows: [], rivalFacts: [],
      readout: {
        expectedBenefit: simulation.expectedBenefit, mainRisk: simulation.mainRisk,
        exposedPlayers: simulation.exposedPlayers, confidence: simulation.confidence,
        evidenceLevel: simulation.evidenceLevel,
      },
      notes: [`El draw-back de "${simulation.scenarioId}" todavía no está autorado (Slice 1 = raise-block).`],
    };
  }
  return draw(simulation, scene);
}
```

> Note: imports at the top of the file must be merged with Task 2's existing imports (`BoardScene` is already imported). Keep a single import block per module.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts`
Expected: PASS (8 tests: 4 from Task 2 + 4 new). Then `npm run type-check` → passes.

- [ ] **Step 6: Commit**

```bash
git add src/board/scenarioBoardConsequence.ts src/board/productBoardTypes.ts tests/scenarioBoardConsequence.test.ts
git commit -m "feat(board): raise-block authored geometry + ConsequenceOverlay"
```

---

## Task 4: Orchestration in `useBoardActions` — run / commit / discard lifecycle

**Files:**
- Modify: `src/board/useBoardActions.ts`
- Test: `tests/scenarioOverlayCommit.test.ts` *(new — tests the pure commit mapping, extracted as a helper)*

**Interfaces:**
- Consumes: `buildScenarioInput`, `buildConsequenceOverlay`, `ConsequenceOverlay`; `simulateScenario`; `createTacticalZone`, `createSemanticArrow`.
- Produces (in the return prop-bag): `consequenceOverlay: ConsequenceOverlay | null`, `runScenario(scenarioId: ScenarioId): void`, `commitOverlay(): void`, `discardOverlay(): void`. Plus exported pure helper `overlayToBoardItems(overlay) => { zones: BoardZone[]; arrows: BoardArrow[] }`.

> **Lifecycle, named explicitly (resolves review note #3):** the overlay is discarded on **any** scene mutation *and* on **active-scene change**. The overlay is anchored to `objectId`s of the current scene; switching scenes (the board is multi-scene) would leave it anchored to tokens that do not exist in the new scene. Discard on scene-id change is therefore not merely covered by "mutation" — it is called out and tested.

- [ ] **Step 1: Write the failing test for the pure commit mapping**

```ts
// tests/scenarioOverlayCommit.test.ts
import { describe, expect, it } from "vitest";
import { overlayToBoardItems } from "@/board/useBoardActions";
import type { ConsequenceOverlay } from "@/board/scenarioBoardConsequence";

const overlay: ConsequenceOverlay = {
  scenarioId: "raise-block", title: "Subir el bloque",
  zones: [{ semantic: "danger", x: 10, y: 35, w: 26, h: 30, patch: { label: "Espacio a la espalda" } }],
  arrows: [{ semantic: "longPass", from: { kind: "point", point: { x: 80, y: 50 } },
            to: { kind: "point", point: { x: 23, y: 50 } }, patch: { label: "Diagonal" } }],
  rivalFacts: [], notes: [],
  readout: { expectedBenefit: "", mainRisk: "", exposedPlayers: [], confidence: "low", evidenceLevel: "none" },
};

describe("overlayToBoardItems", () => {
  it("maps 1:1 to real BoardZone/BoardArrow via factories (no recompute)", () => {
    const { zones, arrows } = overlayToBoardItems(overlay);
    expect(zones).toHaveLength(1);
    expect(zones[0].semantic).toBe("danger");
    expect(zones[0].x).toBe(10);
    expect(zones[0].label).toBe("Espacio a la espalda");
    expect(arrows).toHaveLength(1);
    expect(arrows[0].semantic).toBe("longPass");
    expect(arrows[0].to).toEqual({ kind: "point", point: { x: 23, y: 50 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioOverlayCommit.test.ts`
Expected: FAIL — `overlayToBoardItems` not exported.

- [ ] **Step 3: Add the pure helper + state + handlers in `useBoardActions.ts`**

Add imports near the top:

```ts
import type { ScenarioId } from "@/ai/scenarioSimulator";
import { simulateScenario } from "@/ai/scenarioSimulator";
import { buildScenarioInput } from "@/board/scenarioBridge";
import { buildConsequenceOverlay, type ConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { createSemanticArrow, createTacticalZone } from "@/board/boardModel";
```

Add the exported pure helper at module scope (outside the hook):

```ts
// Preview ≡ commit: map the overlay 1:1 to real board items via the existing
// factories. Zero recompute — if this re-derived geometry it would reintroduce
// two sources of truth.
export function overlayToBoardItems(overlay: ConsequenceOverlay) {
  const zones = overlay.zones.map((z) => createTacticalZone(z.semantic, z.x, z.y, z.w, z.h, z.patch));
  const arrows = overlay.arrows.map((a) => createSemanticArrow(a.semantic, a.from, a.to, a.patch));
  return { zones, arrows };
}
```

Inside the hook, add state next to the other `useState` calls (~line 92):

```ts
const [consequenceOverlay, setConsequenceOverlay] = useState<ConsequenceOverlay | null>(null);
```

Add a discard-on-scene-change effect (the overlay is anchored to this scene's objectIds):

```ts
// Discard a pending overlay when the active scene changes — it is anchored to
// objectIds of the scene it was computed for (spec §5.4).
useEffect(() => {
  setConsequenceOverlay(null);
}, [scene.id]);
```

Add the handlers (near the other action handlers, before `return {`). Note `team.players`, `gameModel`, `exercises`, and `problem` must be in scope; read `team`/`gameModel`/`exercises` from the store at the top of the hook if not already available:

```ts
const runScenario = (scenarioId: ScenarioId) => {
  const { input } = buildScenarioInput(scene, teamPlayers, gameModel, exercises, scenarioId, problem);
  const simulation = simulateScenario(input);
  setConsequenceOverlay(buildConsequenceOverlay(simulation, scene));
};

const commitOverlay = () => {
  if (!consequenceOverlay) return;
  const { zones, arrows } = overlayToBoardItems(consequenceOverlay);
  commitScene({
    zones: [...scene.zones, ...zones],
    arrows: [...scene.arrows, ...arrows],
  });
  setConsequenceOverlay(null);
};

const discardOverlay = () => setConsequenceOverlay(null);
```

Wrap the existing scene-mutating handlers so any of them clears a pending overlay. The cheapest correct hook: clear inside `commitScene` itself, EXCEPT for the commit path. Implement by clearing in `commitScene` when the patch is not an overlay commit:

```ts
// In commitScene: a scene mutation invalidates any pending projection.
const commitScene = (patch: Partial<BoardScene>, record = true) => {
  if (record) pushHistory();
  setConsequenceOverlay((prev) => (prev && !committingOverlayRef.current ? null : prev));
  updateTacticalBoardScene(board.id, scene.id, patch);
};
```

Add a guard ref (near the other `useRef`) and set it across the commit:

```ts
const committingOverlayRef = useRef(false);
// ...in commitOverlay, wrap the commitScene call:
committingOverlayRef.current = true;
commitScene({ zones: [...scene.zones, ...zones], arrows: [...scene.arrows, ...arrows] });
committingOverlayRef.current = false;
```

Expose in the return object (in the `// action handlers` section):

```ts
consequenceOverlay,
runScenario,
commitOverlay,
discardOverlay,
```

- [ ] **Step 4: Run tests + type-check**

Run: `npm test -- --run tests/scenarioOverlayCommit.test.ts` → PASS.
Run: `npm run type-check` → passes.

- [ ] **Step 5: Commit**

```bash
git add src/board/useBoardActions.ts tests/scenarioOverlayCommit.test.ts
git commit -m "feat(board): scenario overlay orchestration (run/commit/discard lifecycle)"
```

---

## Task 5: UI — scenario selector, readout panel, preview layer (post-P0.7)

> **Prerequisite gate:** P0.7 must be merged to `main` and this branch rebased (Task 0) before starting — this task edits the exact two files P0.7 restyled. If not done, STOP and resolve the merge first.

**Files:**
- Modify: `src/board/components/TacticalBoardAiPanel.tsx`
- Modify: `src/board/components/TacticalBoardCanvas.tsx`
- Modify: `src/board/TacticalBoardView.tsx` (thread the prop-bag fields)

**Interfaces:**
- Consumes from `useBoardActions`: `consequenceOverlay`, `runScenario`, `commitOverlay`, `discardOverlay`.
- Produces: no exports; visual integration only. Verified manually via `/run`.

- [ ] **Step 1: Thread the prop-bag fields in `TacticalBoardView.tsx`**

Pass to `<TacticalBoardCanvas>`: `consequenceOverlay={a.consequenceOverlay}`. Pass to `<TacticalBoardAiPanel>`: `consequenceOverlay={a.consequenceOverlay}`, `onRunScenario={a.runScenario}`, `onCommitOverlay={a.commitOverlay}`, `onDiscardOverlay={a.discardOverlay}`.

- [ ] **Step 2: Extend `TacticalBoardAiPanel` props + add the scenario section**

Add to `TacticalBoardAiPanelProps`:

```ts
consequenceOverlay: import("../scenarioBoardConsequence").ConsequenceOverlay | null;
onRunScenario: (scenarioId: import("@/ai/scenarioSimulator").ScenarioId) => void;
onCommitOverlay: () => void;
onDiscardOverlay: () => void;
```

Add a new `<section>` (after the "Que entiende RomboIQ" reading list). Slice 1 exposes only `raise-block`:

```tsx
<section className="rombo-scenario">
  <h2>Probar un ajuste</h2>
  <button type="button" onClick={() => onRunScenario("raise-block")}>
    Subir el bloque
  </button>

  {consequenceOverlay && (
    <div className="rombo-scenario-readout">
      <p className="rombo-scenario-benefit">{consequenceOverlay.readout.expectedBenefit}</p>
      <p className="rombo-scenario-risk">{consequenceOverlay.readout.mainRisk}</p>
      <p className="rombo-scenario-evidence">
        Confianza: {consequenceOverlay.readout.confidence} · Evidencia: {consequenceOverlay.readout.evidenceLevel}
      </p>
      {consequenceOverlay.rivalFacts.length > 0 && (
        <ul className="rombo-scenario-rival">
          {consequenceOverlay.rivalFacts.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      {consequenceOverlay.notes.length > 0 && (
        <ul className="rombo-scenario-notes">
          {consequenceOverlay.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      <div className="rombo-scenario-actions">
        <button type="button" onClick={onCommitOverlay}>Aceptar</button>
        <button type="button" onClick={onDiscardOverlay}>Descartar</button>
      </div>
    </div>
  )}
</section>
```

Wire the new params in the destructured props signature.

- [ ] **Step 3: Render the preview layer in `TacticalBoardCanvas`**

Add `consequenceOverlay: ConsequenceOverlay | null` to `TacticalBoardCanvasProps`. After the existing `visibleZones.map(...)` block (~line 203-237) and before/around `visibleArrows.map(...)`, render the overlay zones and arrows with a distinct ghost/dashed style and a label so they read as a projection, not committed geometry:

```tsx
{consequenceOverlay?.zones.map((z, i) => (
  <rect
    key={`ov-zone-${i}`}
    x={`${z.x}%`} y={`${z.y}%`} width={`${z.w}%`} height={`${z.h}%`}
    className="board-overlay-zone"
    fill="none" stroke="#c7df5f" strokeDasharray="4 3" strokeWidth={2} opacity={0.85}
  />
))}
{consequenceOverlay && (
  <text x="2%" y="4%" className="board-overlay-label" fill="#c7df5f" fontSize="3">
    Proyección de RomboIQ
  </text>
)}
```

For overlay arrows, resolve each endpoint to a point: `kind: "point"` → its `point`; `kind: "object"` → look up `scene.objects.find(o => o.id === objectId)?.position`. Render as a dashed line reusing the existing arrow-render helper if one exists, else a plain `<line>` with the same dashed style. Skip an arrow if an object endpoint cannot be resolved.

- [ ] **Step 4: Type-check + build**

Run: `npm run type-check` → passes.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Manual verification with `/run`**

Launch the app, open the Pizarra, place an own GK + two CB tokens (linked to roster) + a rival ST, click **Subir el bloque**. Verify: a dashed press band over the rival third, a dashed gap band behind the CBs toward the own goal, the readout with real centre-back names in the rival fact, and Aceptar/Descartar. Click Aceptar → the dashed bands become solid committed zones. Re-run, then move a token → the projection disappears (discard-on-mutation). Switch scene with a pending overlay → it disappears.

- [ ] **Step 6: Commit**

```bash
git add src/board/components/TacticalBoardAiPanel.tsx src/board/components/TacticalBoardCanvas.tsx src/board/TacticalBoardView.tsx
git commit -m "feat(board): scenario sandbox UI — selector, readout, ephemeral preview layer"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §4.1 `scenarioBridge` (pure, direct Player lookup, metrics:null, unlinkedCount) | Task 1 |
| §5.3 `detectAttackDir` (3 tiers, no circularity, floor) | Task 2 |
| §4.1 `scenarioBoardConsequence` (orientation-owned, centre-backs, zones/arrows anchored, rival facts, honest notes) | Task 3 |
| §6 `raise-block` authoring (press band, gap band, exposure check, composed rival fact, longPass/run arrow) | Task 3 |
| §5.2 `ConsequenceOverlay` contract + patch aliases | Task 3 |
| §4.2/§5.1 overlay state in `useBoardActions`, run/accept/discard | Task 4 |
| §5.2 accept = map 1:1 (preview ≡ commit, zero recompute) | Task 4 (`overlayToBoardItems`) |
| §5.4 discard on scene mutation **and** active-scene change | Task 4 |
| §4.2/§7 panel readout + rivalFacts + confidence/evidence + buttons; canvas preview layer; honest degradation | Task 5 |
| §4.3 reuse `isInsideZoneRect` (now exported) | Task 3 |
| Review note #1 (Omit<BoardZone> vs factory) | Global Constraints (verified exact) |
| Review note #2 (central tiebreak in fallback) | Task 3 `resolveCentreBacks` |
| Review note #3 (discard on scene change, named) | Task 4 lifecycle |
| Process: P0.7 merge before touching canvas/panel | Task 0 |

**2. Placeholder scan:** no TBD/"add error handling"/"similar to Task N". Every code step shows complete code; UI steps that cannot be fully literal (depend on post-P0.7 JSX) give exact prop names, exact insertion points (line refs), and concrete JSX, with the object-endpoint resolution spelled out.

**3. Type consistency:** `buildScenarioInput` (Task 1), `detectAttackDir`/`isOwnCentreBack`/`isOwnGoalkeeper` (Task 2), `buildConsequenceOverlay` + `ConsequenceOverlay`/`OverlayZone`/`OverlayArrow` (Task 3), `overlayToBoardItems`/`runScenario`/`commitOverlay`/`discardOverlay`/`consequenceOverlay` (Task 4) — names are used identically where consumed in Tasks 4–5. Factory call signatures match `boardModel.ts` verbatim. `metrics: null`, `ScenarioId`, `BoardArrowEndpoint` discriminated union all consistent with the verified source.

**Open implementation detail (not a blocker):** Task 4 assumes `teamPlayers`, `gameModel`, `exercises`, and `problem` are reachable inside `useBoardActions`. `problem` is already in the hook; `team.players`/`gameModel` come from `useAppStore` and the catalog `exercises` from `@/data` — the implementer wires these reads at the top of the hook if not already present. Flagged here so it is not a silent addition.
