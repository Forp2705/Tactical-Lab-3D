# Board Scenario Sandbox — Slice 3: Board-Derived Zone Superiority (Grounding → Confidence)

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Base:** `main` **with slice 2 merged** (`feat/board-rival-response` → `main` first). Not stacked.
**Predecessors:** Slice 1 (scenario sandbox + `detectAttackDir` + raise-block consequence), Slice 2 (coordinated rival response). Both built; slice 1 in `main`, slice 2 on `feat/board-rival-response` (merge-first per base decision).

---

## 1. Problem

The scenario sandbox draws a rich, grounded consequence (zones, arrows, rival response) — but the **readout confidence is clamped to `"low"` by construction**. `buildScenarioInput` always passes `metrics: null` (correct: `CoachShapeMetrics` belongs to LineupLab, not the board), and the simulator's `computeConfidence` short-circuits on `!metrics → "low"`. So every good board reading is stamped "low confidence". That is the credibility ceiling on everything slices 1–2 built.

Meanwhile the board **already derives a real number from token positions** — `productBoardTypes.ts:204-218` (P0.5 reading) counts `own` vs `rival` inside each zone via `isInsideZoneRect`, and the raise-block draw-back computes a `covering` count in the gap. These numbers exist but never feed confidence.

**Goal:** turn the positions-derived count into a first-class **grounding signal** that lifts `evidenceLevel`/`confidence` off the artificial floor when (and only when) the read is actually grounded in real tokens — and surface the numbers in the readout (dual-face: benefit zone + risk zone).

---

## 2. Scope (locked)

- **One metric type:** *zone numeric superiority* — own tokens vs rival tokens inside a rectangle (`{ own, rival, delta }`).
- **Applied to the two rects the raise-block draw-back already authors:** the press band (benefit: "¿hay números para presionar?") and the gap behind the line (risk: "¿se sobrevive la espalda concedida?"). Dual-face content; near-zero extra geometry because both rects already exist.
- **Feeds `evidenceLevel`/`confidence`** via the shared grader (Enfoque A, §4) — presence of a grounded metric is one evidence source and removes the `!metrics` low-floor for the board path.
- **Surfaces the numbers** in the board sandbox readout panel.

**Out of scope (YAGNI):** other metric families (space conceded, overloads), other scenarios' draw-backs, the board→CoachAgent bridge, provenance. Those are later slices.

---

## 3. Architecture decision: Enfoque A — shared pure graders

The simulator (`src/ai/scenarioSimulator.ts`) is **shared** with LineupLab (`ScenarioSimulatorPanel`). We do not abuse its `CoachShapeMetrics` contract with board token counts, and we do not duplicate the confidence ladder.

Extract the two private functions into **exported pure graders parameterized by primitives**:

```ts
// scenarioSimulator.ts
export function gradeEvidenceLevel(sourceCount: number): EvidenceLevel; // 3→sufficient, 2→partial, 1→weak, 0→none
export function gradeConfidence(args: {
  hasGroundedMetrics: boolean;
  evidenceLevel: EvidenceLevel;
  riskCount: number;
}): Confidence; // !hasGroundedMetrics || none || risk>=2 → low ; sufficient && risk==0 → high ; else medium
```

- `computeEvidenceLevel`/`computeConfidence` are refactored to call these graders. **LineupLab behavior is byte-identical** (it passes `hasGroundedMetrics = !!metrics` from `CoachShapeMetrics`, exactly today's `!metrics` semantics). Locked by a non-regression test (§7, Lock 3).
- The **board path** calls the same graders from the overlay layer (§5) with `hasGroundedMetrics` derived from `ScenarioGrounding` and its evidence source added to the count. Single source of truth for the ladder; clean boundary; LineupLab untouched.

Rejected: **B** (extend `ScenarioInput` with a board concept) — ordering problem, the grounding is only known *after* the draw-back authors the zones, would force a re-simulate, and pollutes the shared contract. **C** (approximate zones in the bridge) — duplicates zone geometry; the two copies drift.

---

## 4. The critical distinction: "computing a zone ≠ grounded"

`hasGroundedMetrics` is **NOT** "the metric function ran". It is "the metric counted real tokens". An empty board, or tokens that all fall outside the authored rects, must yield `hasGroundedMetrics: false` so confidence honestly stays `"low"`. Computing an empty zone is not evidence.

Concretely: grounding is `true` iff **at least one authored zone contains at least one token** (own or rival). This is checked against the actual `countTokensInZone` result, never against "we authored a rect".

> **This is the lock the reviewer will personally check** (§7, Lock 1): empty board → `hasGroundedMetrics: false` → `gradeConfidence(...) === "low"`.

---

## 5. Data model & flow

### 5.1 Types (board-local, separate from `CoachShapeMetrics`)

New module `src/board/scenarioGrounding.ts`:

```ts
export type ZoneSuperiority = {
  label: string;     // the authored zone's label ("Presión alta", "Espacio a la espalda")
  own: number;
  rival: number;
  delta: number;     // own - rival (signed; + = own superiority)
  populated: boolean; // own + rival > 0  ← the grounding atom
};

export type ScenarioGrounding = {
  zones: ZoneSuperiority[];
  hasGroundedMetrics: boolean; // zones.some(z => z.populated)
};
```

**`requiredZoneCount` is removed** (the reviewer's YAGNI flag, resolved): partial-grounding is **derived from the `zones[].populated` flags**, not a standalone scalar nobody reads. A "lectura parcial" note (some zones populated, others empty) is computed from the array when surfaced. The information lives in one place.

### 5.2 The single counter (single source of truth)

```ts
// scenarioGrounding.ts — thin wrapper, NO new counting loop
export function countTokensInZone(
  objects: BoardObject[],
  zoneRect: ZoneRectLike,
): { own: number; rival: number };
```

It is a thin wrapper over **`isInsideZoneRect`** (already exported from `productBoardTypes.ts`). It does **not** reimplement "is this token in this zone?". Binding constraint:

- **`productBoardTypes.ts:204-218` (P0.5 reading) is refactored to consume `countTokensInZone`.** Today it has its own `isInsideZoneRect` filter + `own`/`rival` tally; after slice 3 there is exactly **one** function that answers "own vs rival in this rect", consumed by both the readout text (P0.5: "En X: N propios vs M rivales") and the confidence grounding. They can never disagree on screen.

(Locked by §7, Lock 4: `countTokensInZone` equals a manual `isInsideZoneRect` filter, and P0.5 uses it.)

### 5.3 Flow (`useBoardActions`, lines ~595-604 today)

```
buildScenarioInput(...)            // metrics: null (unchanged)
  → simulateScenario(input)        // now via graders; board still gets "low" here (pre-grounding)
  → buildConsequenceOverlay(simulation, scene)
        // has `scene` → authors press + gap rects (already)
        // NEW: compute ScenarioGrounding over those two rects via countTokensInZone
        // NEW: re-grade readout.confidence / readout.evidenceLevel with:
        //   hasGroundedMetrics = grounding.hasGroundedMetrics
        //   evidenceLevel      = gradeEvidenceLevel(textSources + (grounded ? 1 : 0))
        //   riskCount          = from simulation.fitFindings (risk-level)
        // attach grounding to the overlay readout
```

The simulator runs first (LineupLab-correct; board gets the floor). The **overlay re-grades** using grounding — this is the board-aware confidence that reaches the UI. For the LineupLab path `buildConsequenceOverlay` is never called, so no double-grade.

### 5.4 Overlay readout shape

`ConsequenceOverlay.readout` gains the grounding (or a sibling `grounding` field on the overlay):

```ts
readout: {
  expectedBenefit, mainRisk, exposedPlayers,
  confidence,       // now board-aware (re-graded)
  evidenceLevel,    // now board-aware (re-graded)
  grounding: ScenarioGrounding, // the two ZoneSuperiority rows + hasGroundedMetrics
}
```

---

## 6. UI surface

The board sandbox readout panel (`src/board/components/TacticalBoardAiPanel.tsx`, the consumer of `consequenceOverlay.readout`) renders the two zone rows as plain facts, e.g.:

- **Presión alta:** 3 propios vs 2 rival (+1)
- **Espacio a la espalda:** 1 propio vs 2 rival (−1)

Confidence/evidence badges already render; they now move off "low" when grounded. If grounding is partial (one zone empty), show a quiet "lectura parcial — 1 de 2 zonas pobladas" note derived from `zones[].populated`. No verdicts — facts and honest degradation, consistent with P0.5's "facts, not verdicts" stance.

---

## 7. Testing (locks)

1. **Lock 1 — empty-board grounding floor (reviewer-checked).** A scene with no tokens (and a scene whose tokens all fall outside both rects) → `ScenarioGrounding.hasGroundedMetrics === false` → `gradeConfidence` returns `"low"`. Computing a zone must not, by itself, lift confidence.
2. **Lock 2 — populated dual-face read.** A scene with tokens in both rects → per-zone `own`/`rival`/`delta` correct (signs included), both `populated`, `hasGroundedMetrics === true`, confidence rises off the floor when evidence/risk allow, and both zone rows appear in the readout.
3. **Lock 3 — LineupLab non-regression.** `simulateScenario` for the LineupLab path produces identical `confidence`/`evidenceLevel` before and after the grader extraction (table of cases over `{metrics?, evidenceText?, patterns?, riskCount}`). The shared refactor changes nothing for existing callers.
4. **Lock 4 — single counter.** `countTokensInZone(objects, rect)` equals a manual `objects.filter(isInsideZoneRect).partition(type)` count for representative rects; and `productBoardTypes.ts` P0.5 reading is wired through `countTokensInZone` (no second counting loop remains).

All four are TDD (red → green). Full suite + `tsc` clean before any commit.

---

## 8. Files touched

- `src/ai/scenarioSimulator.ts` — extract & export `gradeEvidenceLevel`, `gradeConfidence`; refactor the two private fns to call them (no behavior change).
- `src/board/scenarioGrounding.ts` *(new)* — `ZoneSuperiority`, `ScenarioGrounding`, `countTokensInZone` (wrapper over `isInsideZoneRect`), `computeScenarioGrounding(objects, zones)`.
- `src/board/scenarioBoardConsequence.ts` — in the raise-block draw-back, compute grounding over the authored press+gap rects; re-grade readout via the shared graders; attach grounding to the overlay.
- `src/board/productBoardTypes.ts` — P0.5 reading (≈204-218) consumes `countTokensInZone` (single counter).
- `src/board/components/TacticalBoardAiPanel.tsx` — render the two zone-superiority rows + partial-grounding note.
- `tests/` — locks 1-4 (`scenarioGrounding.test.ts`, additions to `scenarioBoardConsequence.test.ts`, `scenarioSimulator.test.ts`).

---

## 9. Integration sequencing (honors the base decision)

The slice-3 work is authored on `feat/board-scenario-metrics` (branched off `feat/board-rival-response` so authoring sees real slice 1+2 code). At integration:

1. **Merge `feat/board-rival-response` → `main`** first (slice 2 lands; resolves the `scenarioBoardConsequence.ts` overlap up front — this is *why* merge-first, not stacked).
2. **Rebase `feat/board-scenario-metrics` onto `main`.** Now it sits on `main` with slice 2 present — not a stack of two unmerged features.
3. PR slice 3 → `main`.

---

## 10. Open / resolved review points

- **`countTokensInZone` reuses `isInsideZoneRect`** — RESOLVED, binding (§5.2, Lock 4). No third counter; P0.5 consumes it.
- **`requiredZoneCount`** — RESOLVED: removed; partial-grounding derived from `zones[].populated` (§5.1).
- **"computing a zone ≠ grounded"** — RESOLVED: `hasGroundedMetrics = zones.some(populated)`, locked by Lock 1 (§4, §7).
- **No `CoachShapeMetrics` abuse** — RESOLVED: board-local `ScenarioGrounding`; the simulator only ever sees the primitive `hasGroundedMetrics: boolean` via the grader (§3).
