# Board Scenario Sandbox — Slice 3: Board-Derived Zone Superiority — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive a real number from board token positions (own-vs-rival superiority inside the scenario's authored zones) and feed it into the readout's `confidence`/`evidenceLevel` so a grounded reading is no longer stamped "low" by construction.

**Architecture:** Extract the simulator's confidence ladder into shared pure graders (Enfoque A). The board computes a board-local `ScenarioGrounding` (separate from `CoachShapeMetrics`) using a single token-in-zone counter that wraps the existing `isInsideZoneRect`. The raise-block draw-back re-grades the readout with `hasGroundedMetrics` derived from real token counts — never from "a zone was authored".

**Tech Stack:** TypeScript, Vitest, Zustand/React (UI panel). Determinstic, no LLM.

## Global Constraints

- **Base (verbatim from spec §9):** `main` **with slice 2 merged**, not stacked. Authored on `feat/board-scenario-metrics` (off `feat/board-rival-response`); at integration: merge `feat/board-rival-response` → `main` first, then rebase this branch onto `main`, then PR.
- **Single counter:** exactly one function answers "own vs rival in this rect" (`countTokensInZone`), wrapping `isInsideZoneRect`. No second counting loop may remain — the P0.5 reading must consume it.
- **Grounding atom:** `hasGroundedMetrics === zones.some(z => z.own + z.rival > 0)`. Computing a zone is NOT grounding.
- **No `CoachShapeMetrics` abuse:** the simulator only ever receives the primitive `hasGroundedMetrics: boolean`.
- **LineupLab non-regression:** `simulateScenario` output is byte-identical for existing (LineupLab) callers after the grader extraction.
- Validate before every commit: `npm run type-check` and the touched test files green. Run from `C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d` (the clone with `node_modules`/vitest), or any worktree with deps installed.

---

## File Structure

- `src/ai/scenarioSimulator.ts` *(modify)* — export pure graders; refactor `computeEvidenceLevel`/`computeConfidence` to call them. No behavior change.
- `src/board/productBoardTypes.ts` *(modify)* — add `ZoneRect` type; widen `isInsideZoneRect` param to `ZoneRect`; add `countTokensInZone`; route the P0.5 reading (≈204-218) through it.
- `src/board/scenarioGrounding.ts` *(create)* — `ZoneSuperiority`, `ScenarioGrounding`, `computeScenarioGrounding`, `groundingSummary`.
- `src/board/scenarioBoardConsequence.ts` *(modify)* — compute grounding over the authored press+gap rects; re-grade `readout`; attach `grounding`; route `covering` through `countTokensInZone`; drop the `as unknown as BoardZone` hack.
- `src/board/components/TacticalBoardAiPanel.tsx` *(modify)* — render the per-zone superiority rows + partial-grounding note.
- Tests: `tests/scenarioSimulator.test.ts`, `tests/scenarioGrounding.test.ts` *(new)*, `tests/scenarioBoardConsequence.test.ts`, `tests/productBoardReading.test.ts` *(new or existing reading test)*.

---

## Task 1: Shared pure graders (Enfoque A) — LineupLab non-regression

**Files:**
- Modify: `src/ai/scenarioSimulator.ts:269-290`
- Test: `tests/scenarioSimulator.test.ts`

**Interfaces:**
- Produces:
  - `export type EvidenceLevel = "none" | "weak" | "partial" | "sufficient";`
  - `export type Confidence = "low" | "medium" | "high";`
  - `export function gradeEvidenceLevel(sourceCount: number): EvidenceLevel;`
  - `export function gradeConfidence(args: { hasGroundedMetrics: boolean; evidenceLevel: EvidenceLevel; riskCount: number }): Confidence;`
  - `export function bumpEvidenceLevel(level: EvidenceLevel, steps: number): EvidenceLevel;`

- [ ] **Step 1: Write the failing test** (truth table = current behavior, locked)

```ts
// tests/scenarioSimulator.test.ts (append)
import { describe, it, expect } from "vitest";
import {
  gradeEvidenceLevel,
  gradeConfidence,
  bumpEvidenceLevel,
} from "@/ai/scenarioSimulator";

describe("scenario graders (Enfoque A)", () => {
  it("gradeEvidenceLevel maps source count exactly as before", () => {
    expect(gradeEvidenceLevel(0)).toBe("none");
    expect(gradeEvidenceLevel(1)).toBe("weak");
    expect(gradeEvidenceLevel(2)).toBe("partial");
    expect(gradeEvidenceLevel(3)).toBe("sufficient");
    expect(gradeEvidenceLevel(5)).toBe("sufficient");
  });

  it("gradeConfidence reproduces the !metrics/none/risk>=2 -> low rule", () => {
    // !hasGroundedMetrics -> low regardless
    expect(gradeConfidence({ hasGroundedMetrics: false, evidenceLevel: "sufficient", riskCount: 0 })).toBe("low");
    // none -> low
    expect(gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "none", riskCount: 0 })).toBe("low");
    // risk>=2 -> low
    expect(gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "sufficient", riskCount: 2 })).toBe("low");
    // sufficient & risk 0 -> high
    expect(gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "sufficient", riskCount: 0 })).toBe("high");
    // otherwise -> medium
    expect(gradeConfidence({ hasGroundedMetrics: true, evidenceLevel: "partial", riskCount: 1 })).toBe("medium");
  });

  it("bumpEvidenceLevel moves by N tiers, clamped", () => {
    expect(bumpEvidenceLevel("none", 1)).toBe("weak");
    expect(bumpEvidenceLevel("weak", 0)).toBe("weak");
    expect(bumpEvidenceLevel("partial", 1)).toBe("sufficient");
    expect(bumpEvidenceLevel("sufficient", 1)).toBe("sufficient");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioSimulator.test.ts`
Expected: FAIL — `gradeEvidenceLevel`/`gradeConfidence`/`bumpEvidenceLevel` not exported.

- [ ] **Step 3: Add the graders and refactor the private fns to call them**

```ts
// src/ai/scenarioSimulator.ts — add near the top-level (after types)
export type EvidenceLevel = ScenarioSimulation["evidenceLevel"];
export type Confidence = ScenarioSimulation["confidence"];

const EVIDENCE_ORDER: EvidenceLevel[] = ["none", "weak", "partial", "sufficient"];

export function gradeEvidenceLevel(sourceCount: number): EvidenceLevel {
  if (sourceCount >= 3) return "sufficient";
  if (sourceCount === 2) return "partial";
  if (sourceCount === 1) return "weak";
  return "none";
}

export function gradeConfidence(args: {
  hasGroundedMetrics: boolean;
  evidenceLevel: EvidenceLevel;
  riskCount: number;
}): Confidence {
  const { hasGroundedMetrics, evidenceLevel, riskCount } = args;
  if (!hasGroundedMetrics || evidenceLevel === "none" || riskCount >= 2) return "low";
  if (evidenceLevel === "sufficient" && riskCount === 0) return "high";
  return "medium";
}

export function bumpEvidenceLevel(level: EvidenceLevel, steps: number): EvidenceLevel {
  const i = EVIDENCE_ORDER.indexOf(level);
  const next = Math.max(0, Math.min(EVIDENCE_ORDER.length - 1, i + steps));
  return EVIDENCE_ORDER[next];
}
```

Then replace the bodies of the two private fns to delegate:

```ts
function computeEvidenceLevel(input: ScenarioInput): EvidenceLevel {
  const sources = [
    input.metrics ? "metrics" : "",
    input.evidenceText?.trim() ? "evidence" : "",
    input.patterns?.length ? "patterns" : "",
  ].filter(Boolean).length;
  return gradeEvidenceLevel(sources);
}

function computeConfidence(
  metrics: CoachShapeMetrics | null | undefined,
  evidenceLevel: EvidenceLevel,
  findings: PlayerFitFinding[],
): Confidence {
  const riskCount = findings.filter((finding) => finding.level === "risk").length;
  return gradeConfidence({ hasGroundedMetrics: !!metrics, evidenceLevel, riskCount });
}
```

- [ ] **Step 4: Run tests to verify pass + no regression**

Run: `npm test -- --run tests/scenarioSimulator.test.ts && npm run type-check`
Expected: PASS. Existing `scenarioSimulator.test.ts` cases unchanged (LineupLab parity).

- [ ] **Step 5: Commit**

```bash
git add src/ai/scenarioSimulator.ts tests/scenarioSimulator.test.ts
git commit -m "refactor(sim): extract shared confidence graders (Enfoque A), no behavior change"
```

---

## Task 2: `countTokensInZone` — the single counter over `isInsideZoneRect`

**Files:**
- Modify: `src/board/productBoardTypes.ts:279-289` (widen `isInsideZoneRect`), add `countTokensInZone`; refactor reading `:204-218`
- Test: `tests/productBoardReading.test.ts` (create if absent)

**Interfaces:**
- Consumes: `isInsideZoneRect` (widened), `BoardObject` from `@/board/boardModel`.
- Produces:
  - `export type ZoneRect = Pick<BoardZone, "x" | "y" | "w" | "h">;`
  - `export function countTokensInZone(objects: BoardObject[], rect: ZoneRect): { own: number; rival: number };`

- [ ] **Step 1: Write the failing test**

```ts
// tests/productBoardReading.test.ts
import { describe, it, expect } from "vitest";
import { countTokensInZone, isInsideZoneRect } from "@/board/productBoardTypes";
import type { BoardObject } from "@/board/boardModel";

const tok = (id: string, type: BoardObject["type"], x: number, y: number) =>
  ({ id, type, position: { x, y }, label: id } as unknown as BoardObject);

const rect = { x: 0, y: 0, w: 50, h: 50 };

describe("countTokensInZone (single counter)", () => {
  it("counts own vs rival via isInsideZoneRect membership", () => {
    const objects = [
      tok("a", "playerToken", 10, 10), // in
      tok("b", "playerToken", 90, 90), // out
      tok("c", "opponentToken", 20, 20), // in
      tok("d", "ballToken" as BoardObject["type"], 5, 5), // ignored (not a player/opponent)
    ];
    expect(countTokensInZone(objects, rect)).toEqual({ own: 1, rival: 1 });
  });

  it("agrees with a manual isInsideZoneRect filter", () => {
    const objects = [tok("a", "playerToken", 1, 1), tok("b", "playerToken", 60, 1)];
    const manualOwn = objects.filter(
      (o) => o.type === "playerToken" && isInsideZoneRect(o.position, rect as never),
    ).length;
    expect(countTokensInZone(objects, rect).own).toBe(manualOwn);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/productBoardReading.test.ts`
Expected: FAIL — `countTokensInZone` not exported.

- [ ] **Step 3: Widen `isInsideZoneRect`, add `countTokensInZone`, route the reading through it**

```ts
// src/board/productBoardTypes.ts

// (a) new type + widened predicate param
export type ZoneRect = Pick<BoardZone, "x" | "y" | "w" | "h">;

export function isInsideZoneRect(
  position: { x: number; y: number },
  zone: ZoneRect,
): boolean {
  return (
    position.x >= zone.x &&
    position.x <= zone.x + zone.w &&
    position.y >= zone.y &&
    position.y <= zone.y + zone.h
  );
}

// (b) the single counter — the ONLY "own vs rival in a rect" function
export function countTokensInZone(
  objects: BoardObject[],
  rect: ZoneRect,
): { own: number; rival: number } {
  let own = 0;
  let rival = 0;
  for (const object of objects) {
    if (object.type !== "playerToken" && object.type !== "opponentToken") continue;
    if (!isInsideZoneRect(object.position, rect)) continue;
    if (object.type === "playerToken") own += 1;
    else rival += 1;
  }
  return { own, rival };
}
```

Refactor the P0.5 reading (`:204-218`) to consume it — no second loop:

```ts
  // 3) Hechos posicionales por zona: conteo de fichas reales, NO veredicto.
  for (const zone of zones.slice(0, 2)) {
    const { own, rival } = countTokensInZone(objects, zone);
    if (own + rival > 0) {
      findings.push(`En ${zone.label}: ${own} propios vs ${rival} rivales.`);
    }
  }
```

- [ ] **Step 4: Run tests to verify pass + reading unchanged**

Run: `npm test -- --run tests/productBoardReading.test.ts && npm run type-check`
Expected: PASS. If an existing reading test asserts the "En X: N propios vs M rivales" strings, it stays green (same output, one counter now).

- [ ] **Step 5: Commit**

```bash
git add src/board/productBoardTypes.ts tests/productBoardReading.test.ts
git commit -m "refactor(board): single countTokensInZone over isInsideZoneRect; P0.5 reading consumes it"
```

---

## Task 3: `scenarioGrounding.ts` — board-local grounding (Lock 1 + Lock 2 at unit level)

**Files:**
- Create: `src/board/scenarioGrounding.ts`
- Test: `tests/scenarioGrounding.test.ts`

**Interfaces:**
- Consumes: `countTokensInZone`, `ZoneRect` from `@/board/productBoardTypes`; `BoardObject` from `@/board/boardModel`.
- Produces:
  - `export type ZoneSuperiority = { label: string; own: number; rival: number; delta: number; populated: boolean };`
  - `export type ScenarioGrounding = { zones: ZoneSuperiority[]; hasGroundedMetrics: boolean };`
  - `export function computeScenarioGrounding(objects: BoardObject[], zones: Array<{ label: string; rect: ZoneRect }>): ScenarioGrounding;`
  - `export function groundingSummary(g: ScenarioGrounding): string | null;` // partial-grounding note or null

- [ ] **Step 1: Write the failing test (Lock 1 + Lock 2)**

```ts
// tests/scenarioGrounding.test.ts
import { describe, it, expect } from "vitest";
import { computeScenarioGrounding, groundingSummary } from "@/board/scenarioGrounding";
import type { BoardObject } from "@/board/boardModel";

const tok = (id: string, type: BoardObject["type"], x: number, y: number) =>
  ({ id, type, position: { x, y }, label: id } as unknown as BoardObject);

const press = { label: "Presión alta", rect: { x: 0, y: 0, w: 40, h: 100 } };
const gap = { label: "Espacio a la espalda", rect: { x: 60, y: 0, w: 40, h: 100 } };

describe("computeScenarioGrounding", () => {
  it("LOCK 1: empty board is NOT grounded (computing a zone != grounded)", () => {
    const g = computeScenarioGrounding([], [press, gap]);
    expect(g.hasGroundedMetrics).toBe(false);
    expect(g.zones.every((z) => !z.populated)).toBe(true);
  });

  it("LOCK 1b: tokens entirely outside both rects are NOT grounded", () => {
    const g = computeScenarioGrounding([tok("a", "playerToken", 50, 50)], [press, gap]);
    expect(g.hasGroundedMetrics).toBe(false);
  });

  it("LOCK 2: populated zones give signed dual-face superiority", () => {
    const objects = [
      tok("p1", "playerToken", 10, 10),
      tok("p2", "playerToken", 20, 20),
      tok("p3", "playerToken", 30, 30),
      tok("r1", "opponentToken", 15, 15),
      tok("r2", "opponentToken", 25, 25), // press: own 3 vs rival 2 -> +1
      tok("g1", "playerToken", 70, 50), // gap: own 1 vs rival 2 -> -1
      tok("gr1", "opponentToken", 65, 40),
      tok("gr2", "opponentToken", 75, 60),
    ];
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(g.hasGroundedMetrics).toBe(true);
    expect(g.zones[0]).toMatchObject({ label: "Presión alta", own: 3, rival: 2, delta: 1, populated: true });
    expect(g.zones[1]).toMatchObject({ label: "Espacio a la espalda", own: 1, rival: 2, delta: -1, populated: true });
  });
});

describe("groundingSummary", () => {
  it("returns a partial note when some zones are empty", () => {
    const objects = [tok("p1", "playerToken", 10, 10)]; // only press populated
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(groundingSummary(g)).toMatch(/parcial/i);
  });
  it("returns null when all present zones are populated", () => {
    const objects = [tok("p1", "playerToken", 10, 10), tok("g1", "playerToken", 70, 50)];
    const g = computeScenarioGrounding(objects, [press, gap]);
    expect(groundingSummary(g)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioGrounding.test.ts`
Expected: FAIL — module `@/board/scenarioGrounding` not found.

- [ ] **Step 3: Implement the grounding module**

```ts
// src/board/scenarioGrounding.ts
import type { BoardObject } from "@/board/boardModel";
import { countTokensInZone, type ZoneRect } from "@/board/productBoardTypes";

export type ZoneSuperiority = {
  label: string;
  own: number;
  rival: number;
  delta: number; // own - rival (signed)
  populated: boolean; // own + rival > 0 — the grounding atom
};

export type ScenarioGrounding = {
  zones: ZoneSuperiority[];
  hasGroundedMetrics: boolean;
};

export function computeScenarioGrounding(
  objects: BoardObject[],
  zones: Array<{ label: string; rect: ZoneRect }>,
): ScenarioGrounding {
  const rows: ZoneSuperiority[] = zones.map(({ label, rect }) => {
    const { own, rival } = countTokensInZone(objects, rect);
    return { label, own, rival, delta: own - rival, populated: own + rival > 0 };
  });
  return { zones: rows, hasGroundedMetrics: rows.some((z) => z.populated) };
}

// Partial-grounding note derived from per-zone populated flags (no standalone
// requiredZoneCount field). Null when every authored zone is populated.
export function groundingSummary(g: ScenarioGrounding): string | null {
  const total = g.zones.length;
  const populated = g.zones.filter((z) => z.populated).length;
  if (total === 0 || populated === total) return null;
  return `Lectura parcial — ${populated} de ${total} zonas pobladas.`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run tests/scenarioGrounding.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board/scenarioGrounding.ts tests/scenarioGrounding.test.ts
git commit -m "feat(board): ScenarioGrounding — zone superiority + honest grounding atom (Lock 1/2)"
```

---

## Task 4: Wire grounding into the raise-block draw-back + re-grade the readout

**Files:**
- Modify: `src/board/scenarioBoardConsequence.ts` (the `raise-block` entry in `REGISTRY`, the `ConsequenceOverlay` type, `baseReadout`)
- Test: `tests/scenarioBoardConsequence.test.ts`

**Interfaces:**
- Consumes: `computeScenarioGrounding`, `groundingSummary` (Task 3); `gradeConfidence`, `bumpEvidenceLevel` (Task 1); `countTokensInZone` (Task 2).
- Produces: `ConsequenceOverlay["readout"]` gains `grounding: ScenarioGrounding`; `confidence`/`evidenceLevel` are board-aware (re-graded).

- [ ] **Step 1: Write the failing test (end-to-end Lock 1 + Lock 2)**

```ts
// tests/scenarioBoardConsequence.test.ts (append)
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
// reuse this file's existing scene + simulation builders/fixtures

describe("raise-block grounding → confidence", () => {
  it("LOCK 1 (end-to-end): empty/ungrounded scene keeps confidence low", () => {
    const scene = makeScene([]); // no tokens (use this file's helper)
    const sim = makeSimulation("raise-block", { evidenceLevel: "sufficient", riskCount: 0 });
    const overlay = buildConsequenceOverlay(sim, scene);
    expect(overlay.readout.grounding.hasGroundedMetrics).toBe(false);
    expect(overlay.readout.confidence).toBe("low");
  });

  it("LOCK 2 (end-to-end): grounded scene exposes grounding and lifts off the floor", () => {
    const scene = makeRaiseBlockScene(); // GK + CBs + rivals, tokens in both rects
    const sim = makeSimulation("raise-block", { evidenceLevel: "partial", riskCount: 0 });
    const overlay = buildConsequenceOverlay(sim, scene);
    expect(overlay.readout.grounding.hasGroundedMetrics).toBe(true);
    expect(overlay.readout.grounding.zones.length).toBeGreaterThanOrEqual(1);
    expect(overlay.readout.confidence).not.toBe("low");
  });
});
```

(If the existing test file lacks `makeScene`/`makeSimulation` helpers, build the scene inline from `BoardScene` literals as the other tests in this file already do — reuse their exact fixture pattern.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts`
Expected: FAIL — `overlay.readout.grounding` is undefined.

- [ ] **Step 3: Implement — grounding + re-grade + route `covering` through the single counter**

In `scenarioBoardConsequence.ts`:

```ts
// add imports
import { gradeConfidence, bumpEvidenceLevel } from "@/ai/scenarioSimulator";
import { countTokensInZone } from "@/board/productBoardTypes";
import {
  computeScenarioGrounding,
  type ScenarioGrounding,
} from "@/board/scenarioGrounding";
```

Extend the readout type:

```ts
export type ConsequenceOverlay = {
  // ...unchanged fields...
  readout: {
    expectedBenefit: string;
    mainRisk: string;
    exposedPlayers: string[];
    confidence: "low" | "medium" | "high";
    evidenceLevel: "none" | "weak" | "partial" | "sufficient";
    grounding: ScenarioGrounding;
  };
  notes: string[];
};
```

`baseReadout` gains an empty grounding (the no-draw-back fallback stays honest):

```ts
function baseReadout(simulation: ScenarioSimulation): ConsequenceOverlay["readout"] {
  return {
    expectedBenefit: simulation.expectedBenefit,
    mainRisk: simulation.mainRisk,
    exposedPlayers: simulation.exposedPlayers,
    confidence: simulation.confidence,
    evidenceLevel: simulation.evidenceLevel,
    grounding: { zones: [], hasGroundedMetrics: false },
  };
}
```

Inside the `raise-block` draw-back, after the press rect and (when present) the gap rect are authored, build grounding and re-grade. Replace the inline `covering` loop (and its `as unknown as BoardZone` cast) with the single counter:

```ts
    // 5) Exposure check via the single counter (own behind, excluding the CBs).
    const ownBehind = scene.objects.filter(
      (o) => isOwnPlayerToken(o) && !backs.includes(o),
    );
    const covering = countTokensInZone(ownBehind, gap).own;
```

At the end of the draw-back, before `return`, assemble grounding over the authored rects and re-grade:

```ts
    // Board-derived grounding over the zones we actually authored.
    const groundingZones: Array<{ label: string; rect: typeof press }> = [
      { label: "Presión alta", rect: press },
    ];
    if (backs.length >= 2) {
      groundingZones.push({ label: "Espacio a la espalda", rect: gap });
    }
    const grounding = computeScenarioGrounding(scene.objects, groundingZones);

    const riskCount = simulation.fitFindings.filter((f) => f.level === "risk").length;
    const evidenceLevel = grounding.hasGroundedMetrics
      ? bumpEvidenceLevel(simulation.evidenceLevel, 1) // grounding restores the "metrics" source
      : simulation.evidenceLevel;
    const confidence = gradeConfidence({
      hasGroundedMetrics: grounding.hasGroundedMetrics,
      evidenceLevel,
      riskCount,
    });

    const readout = { ...baseReadout(simulation), confidence, evidenceLevel, grounding };
```

Return `readout` instead of `baseReadout(simulation)` for the raise-block branch.

> Note: `gap` is only in scope inside the `backs.length >= 2` block today. Lift the `press`/`gap` rect declarations so both are visible where grounding is assembled (declare `gap` as `let gap: ReturnType<typeof clampRect> | null = null` and assign it where authored; include it in `groundingZones` only when non-null).

- [ ] **Step 4: Run tests to verify pass + full board suite + type-check**

Run: `npm test -- --run tests/scenarioBoardConsequence.test.ts tests/scenarioGrounding.test.ts tests/scenarioSimulator.test.ts && npm run type-check`
Expected: PASS. Slice 2's existing consequence tests (coordination invariant, 1-rival/0-rival degradation) stay green.

- [ ] **Step 5: Commit**

```bash
git add src/board/scenarioBoardConsequence.ts tests/scenarioBoardConsequence.test.ts
git commit -m "feat(board): raise-block readout grounded by zone superiority (re-grade confidence)"
```

---

## Task 5: Surface the zone superiority in the readout panel

**Files:**
- Modify: `src/board/components/TacticalBoardAiPanel.tsx:75-97`
- Test: covered by Task 3's `groundingSummary` unit test; UI render is a thin map (manual/visual verify).

**Interfaces:**
- Consumes: `consequenceOverlay.readout.grounding` (Task 4), `groundingSummary` (Task 3).

- [ ] **Step 1: Implement the rows + partial note**

Add, after the confidence/evidencia line (around line 85) inside the `consequenceOverlay` block:

```tsx
import { groundingSummary } from "@/board/scenarioGrounding";
// ...
{consequenceOverlay.readout.grounding.zones.some((z) => z.populated) ? (
  <ul className="rombo-scenario-grounding">
    {consequenceOverlay.readout.grounding.zones
      .filter((z) => z.populated)
      .map((z) => (
        <li key={z.label}>
          {z.label}: {z.own} propios vs {z.rival} rival ({z.delta >= 0 ? "+" : ""}
          {z.delta})
        </li>
      ))}
  </ul>
) : null}
{groundingSummary(consequenceOverlay.readout.grounding) ? (
  <p className="rombo-scenario-partial">
    {groundingSummary(consequenceOverlay.readout.grounding)}
  </p>
) : null}
```

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Visual verify (manual)**

Run the app, open the board sandbox, run "Subir el bloque" on a scene with tokens in both bands. Confirm the two rows render ("Presión alta: N propios vs M rival (±k)") and the confidence badge is no longer "low" when grounded; on an empty scene confirm it stays "low" with no rows.

- [ ] **Step 4: Commit**

```bash
git add src/board/components/TacticalBoardAiPanel.tsx
git commit -m "feat(board): readout shows per-zone superiority + partial-grounding note"
```

---

## Self-Review

**Spec coverage:**
- §2 scope (one metric, two authored zones, feeds confidence, surfaced) → Tasks 3, 4, 5. ✓
- §3 Enfoque A shared graders, LineupLab parity → Task 1 + Lock (truth table). ✓
- §4 "computing a zone ≠ grounded" → Task 3 Lock 1 + Task 4 end-to-end Lock 1. ✓
- §5.1 `ScenarioGrounding` separate type, `requiredZoneCount` removed (derived) → Task 3. ✓
- §5.2 single counter over `isInsideZoneRect`, P0.5 consumes it → Task 2 (Lock 4). ✓
- §5.3/5.4 flow + readout shape → Task 4. ✓
- §6 UI dual-face rows + partial note → Task 5. ✓
- §7 Locks 1-4 → Lock 1 (T3/T4), Lock 2 (T3/T4), Lock 3 (T1), Lock 4 (T2). ✓
- §9 integration sequencing → Global Constraints. ✓

**Placeholder scan:** No TBD/TODO; every code step has real code; no "handle edge cases" hand-waving. ✓

**Type consistency:** `EvidenceLevel`/`Confidence` defined in Task 1 and reused; `ZoneRect`/`countTokensInZone` defined in Task 2 and consumed in Tasks 3-4; `ScenarioGrounding`/`computeScenarioGrounding`/`groundingSummary` defined in Task 3 and consumed in Tasks 4-5; `bumpEvidenceLevel`/`gradeConfidence` defined in Task 1 and consumed in Task 4. ✓

**One open implementer note (not a gap):** Task 4 Step 3 lifts the `gap` rect declaration out of the `backs.length >= 2` block — flagged inline so the implementer scopes it correctly.
