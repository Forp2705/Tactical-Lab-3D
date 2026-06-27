# Board → CoachAgent Bridge (Slice 4, v1: raise-block) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the staff consult the conversational coach about a board scenario, grounded by the board's deterministic signal and bounded by a structured firewall so the coach cannot assert board facts the board did not ground.

**Architecture:** The board builds a one-shot `BoardEvidencePacket` from the already-audited `ConsequenceOverlay.readout` (no raw scene). It travels with a single `/api/coach-agent` request. The coach references board facts in a structured `supportingFacts` field; a server-side `coachOutputGuard` validates those references structure-vs-structure against the packet (existence, `grounded`, copied values) — drops invalid ones always, downgrades the turn only when an invalid reference sits in `supportingFacts`. Board facts shown to staff are rendered from the validated structure, never from prose. A prose scan is a documented best-effort net, not the firewall.

**Tech Stack:** TypeScript, Zod, Vitest, React 18. Server boundary via `/api/coach-agent` (Node handler). Reuses slice-3 `ConsequenceOverlay.readout` and the coach's existing `EvidenceAudit`/`confidenceCap`/`question-mode`.

## Global Constraints

- **One-shot, never ambient:** the packet travels in exactly one turn; it is NOT saved to the store, NOT `shapeContext`, NOT reused in later queries.
- **Firewall runs for every board-initiated request,** including `factualClaims: []` (empty ⇒ zero factual board claims permitted in output).
- **Downgrade trigger is structural:** lower confidence / force `question-mode` ONLY when an invalid reference appears in `supportingFacts`. Stray/non-support invalid refs → drop + audit only, no downgrade. The turn never errors except on complete structural failure.
- **Render board facts from validated structure, never prose.** `copiedValues` never controls display.
- **Boundary:** React never imports `CoachAgent`/server-only coach modules; the packet travels via `/api/coach-agent`. The injection is an explicit, isolated path (not tangled into ambient context assembly).
- **No invented knobs:** map board `evidenceLevel` → `evidenceAudit.evidenceStrength`; board `confidence` → audit input; reuse existing `confidenceCap`/`question-mode` for downgrade.
- **Execution:** subagent-driven, sequential, PO review per task; dispatch subagents in **opus** (sonnet weekly cap hit). Full suite + `tsc` + `build` green before each commit. After any full `npm test` run, revert `src/ai/generated/coach-observability.jsonl` (the coach suite mutates it): `git checkout -- src/ai/generated/coach-observability.jsonl`.

---

### Task 1: Packet types & contract

**Files:**
- Create: `src/board/boardEvidencePacket.ts`
- Test: `tests/boardEvidencePacket.test.ts`

**Interfaces:**
- Consumes: `ScenarioId` from `@/ai/scenarioSimulator`; `Confidence`, `EvidenceLevel` from `@/ai/scenarioSimulator` (exported by slice 3).
- Produces:
  - `BoardFactualClaim` (discriminated union, every member has `id` + `kind`)
  - `BoardEvidencePacket`
  - `isBoardFactualClaimId(packet, id): boolean` (existence helper used by the guard)

- [ ] **Step 1: Write the failing test**

```ts
// tests/boardEvidencePacket.test.ts
import { describe, it, expect } from "vitest";
import { isBoardFactualClaimId, type BoardEvidencePacket } from "@/board/boardEvidencePacket";

const packet: BoardEvidencePacket = {
  source: "boardScenario",
  scope: "drawnSituation",
  scenarioId: "raise-block",
  title: "Subir el bloque",
  readout: { confidence: "medium", evidenceLevel: "partial", expectedBenefit: "x", mainRisk: "y" },
  boardEvidence: {
    authority: "high",
    evidenceStrength: "partial",
    hasGroundedMetrics: true,
    factualClaims: [
      { id: "press", kind: "zone-count", zoneLabel: "Presión alta", own: 3, rival: 2, delta: 1, grounded: true },
      { id: "gap", kind: "coverage", zoneId: "gap", zoneLabel: "Espacio a la espalda", covering: 0, grounded: true, excludes: "backs" },
    ],
  },
};

describe("BoardEvidencePacket contract", () => {
  it("isBoardFactualClaimId finds existing ids and rejects unknown", () => {
    expect(isBoardFactualClaimId(packet, "press")).toBe(true);
    expect(isBoardFactualClaimId(packet, "gap")).toBe(true);
    expect(isBoardFactualClaimId(packet, "nope")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/boardEvidencePacket.test.ts`
Expected: FAIL — module `@/board/boardEvidencePacket` not found.

- [ ] **Step 3: Write the types + helper**

```ts
// src/board/boardEvidencePacket.ts
import type { ScenarioId, Confidence, EvidenceLevel } from "@/ai/scenarioSimulator";

export type BoardFactualClaim =
  | { id: string; kind: "zone-count"; zoneLabel: string; own: number; rival: number; delta: number; grounded: boolean }
  | { id: string; kind: "coverage"; zoneId: string; zoneLabel: string; covering: number; grounded: boolean; excludes: "backs" };

export type BoardEvidencePacket = {
  source: "boardScenario";
  scope: "drawnSituation";
  scenarioId: ScenarioId;
  title: string;
  readout: { confidence: Confidence; evidenceLevel: EvidenceLevel; expectedBenefit: string; mainRisk: string };
  boardEvidence: {
    authority: "high";
    evidenceStrength: EvidenceLevel;
    hasGroundedMetrics: boolean;
    factualClaims: BoardFactualClaim[];
    summary?: string;
  };
};

export function isBoardFactualClaimId(packet: BoardEvidencePacket, id: string): boolean {
  return packet.boardEvidence.factualClaims.some((claim) => claim.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes + type-check**

Run: `npm test -- --run tests/boardEvidencePacket.test.ts && npm run type-check`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/board/boardEvidencePacket.ts tests/boardEvidencePacket.test.ts
git commit -m "feat(bridge): BoardEvidencePacket types + claim-id contract (slice 4 task 1)"
```

---

### Task 2: Packet builder from raise-block

**Files:**
- Modify: `src/board/boardEvidencePacket.ts`
- Test: `tests/boardEvidencePacket.test.ts`

**Interfaces:**
- Consumes: `ConsequenceOverlay` from `@/board/scenarioBoardConsequence` (its `.readout` has `confidence`, `evidenceLevel`, `expectedBenefit`, `mainRisk`, `grounding: { zones: ZoneSuperiority[]; hasGroundedMetrics }`, `tacticalRows: TacticalReadoutRow[]`).
- Produces: `buildBoardEvidencePacket(overlay: ConsequenceOverlay): BoardEvidencePacket`

**Mapping rules (from slice 3/7):**
- `tacticalRows` of `kind: "superiority"` → `{ id: <row.label slug>, kind: "zone-count", zoneLabel, own, rival, delta, grounded }` where `grounded` = the matching `grounding.zones[label].populated`.
- `tacticalRows` of `kind: "coverage"` → `{ id: <slug>, kind: "coverage", zoneId: <slug>, zoneLabel, covering, grounded, excludes: "backs" }` where `grounded` = the matching `grounding.zones[label].populated` (all-token, so a CB-in-gap with `covering:0` is still `grounded:true`).
- `boardEvidence.evidenceStrength = overlay.readout.evidenceLevel`; `hasGroundedMetrics = overlay.readout.grounding.hasGroundedMetrics`.
- No raw scene anywhere in the packet.

- [ ] **Step 1: Write the failing tests (grounded + ungrounded)**

```ts
// tests/boardEvidencePacket.test.ts (append)
import { buildBoardEvidencePacket } from "@/board/boardEvidencePacket";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
// FIRST: lift the existing slice-3 helpers `raiseBlockSim()`, `raiseBlockScene(false)`,
// `sceneWith([])` out of tests/scenarioBoardConsequence.test.ts into a NEW shared
// `tests/fixtures/raiseBlockFixtures.ts` (export them; update the slice-3 test to import
// from there so its 28 tests stay green). Tasks 2 and 9 import from this fixture.
import { raiseBlockSim, raiseBlockScene, sceneWith } from "./fixtures/raiseBlockFixtures";

describe("buildBoardEvidencePacket", () => {
  it("grounded raise-block: claims carry structured numbers + grounded:true, no raw scene", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false));
    const packet = buildBoardEvidencePacket(overlay);
    expect(packet.source).toBe("boardScenario");
    expect(packet.scenarioId).toBe("raise-block");
    expect(packet.boardEvidence.hasGroundedMetrics).toBe(true);
    const press = packet.boardEvidence.factualClaims.find((c) => c.kind === "zone-count");
    expect(press).toMatchObject({ kind: "zone-count", grounded: true });
    expect(typeof (press as { own: number }).own).toBe("number");
    const gap = packet.boardEvidence.factualClaims.find((c) => c.kind === "coverage");
    expect(gap).toMatchObject({ kind: "coverage", excludes: "backs" });
    expect(JSON.stringify(packet)).not.toMatch(/objects|position|"x":/); // no raw scene leaked
  });

  it("ungrounded raise-block (empty board): hasGroundedMetrics false, claims grounded:false", () => {
    const overlay = buildConsequenceOverlay(raiseBlockSim(), sceneWith([]));
    const packet = buildBoardEvidencePacket(overlay);
    expect(packet.boardEvidence.hasGroundedMetrics).toBe(false);
    expect(packet.boardEvidence.factualClaims.every((c) => c.grounded === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/boardEvidencePacket.test.ts`
Expected: FAIL — `buildBoardEvidencePacket` not exported.

- [ ] **Step 3: Implement the builder**

```ts
// src/board/boardEvidencePacket.ts (append)
import type { ConsequenceOverlay } from "@/board/scenarioBoardConsequence";

const slug = (label: string) =>
  label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function buildBoardEvidencePacket(overlay: ConsequenceOverlay): BoardEvidencePacket {
  const { readout } = overlay;
  const groundedOf = (label: string) =>
    readout.grounding.zones.find((z) => z.label === label)?.populated ?? false;

  const factualClaims: BoardFactualClaim[] = readout.tacticalRows.map((row) => {
    if (row.kind === "superiority") {
      return { id: slug(row.label), kind: "zone-count", zoneLabel: row.label, own: row.own, rival: row.rival, delta: row.delta, grounded: groundedOf(row.label) };
    }
    return { id: slug(row.label), kind: "coverage", zoneId: slug(row.label), zoneLabel: row.label, covering: row.covering, grounded: groundedOf(row.label), excludes: "backs" };
  });

  return {
    source: "boardScenario",
    scope: "drawnSituation",
    scenarioId: overlay.scenarioId,
    title: overlay.title,
    readout: {
      confidence: readout.confidence,
      evidenceLevel: readout.evidenceLevel,
      expectedBenefit: readout.expectedBenefit,
      mainRisk: readout.mainRisk,
    },
    boardEvidence: {
      authority: "high",
      evidenceStrength: readout.evidenceLevel,
      hasGroundedMetrics: readout.grounding.hasGroundedMetrics,
      factualClaims,
    },
  };
}
```

- [ ] **Step 4: Run tests + type-check**

Run: `npm test -- --run tests/boardEvidencePacket.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board/boardEvidencePacket.ts tests/boardEvidencePacket.test.ts
git commit -m "feat(bridge): one-shot packet builder from raise-block readout (slice 4 task 2)"
```

---

### Task 3: Coach schema extension (`supportingFacts`)

**Files:**
- Modify: `src/ai/CoachSchemas.ts`
- Test: `tests/coachBoardClaimReference.test.ts`

**Interfaces:**
- Produces:
  - `CoachBoardClaimReferenceSchema` / `CoachBoardClaimReference`
  - `supportingFacts: CoachBoardClaimReference[]` added (optional, `.default([])`) to `CoachMatchAdviceSchema` so it rides on every advice-bearing response (`hypothesis`/`diagnosis`).
- Additive: existing responses without `supportingFacts` still parse (`.default([])`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/coachBoardClaimReference.test.ts
import { describe, it, expect } from "vitest";
import { CoachBoardClaimReferenceSchema, CoachMatchAdviceSchema } from "@/ai/CoachSchemas";

describe("CoachBoardClaimReference + supportingFacts (additive)", () => {
  it("parses a valid reference with copiedValues", () => {
    const r = CoachBoardClaimReferenceSchema.parse({
      boardClaimId: "press", use: "supportingFact", copiedValues: { own: 3, rival: 2, delta: 1 },
    });
    expect(r.use).toBe("supportingFact");
  });

  it("advice without supportingFacts still parses, defaulting to []", () => {
    const advice = CoachMatchAdviceSchema.parse({
      tacticalReading: "t", probableCause: "c", mainAdjustment: "m",
      onFieldInstructions: [], wednesdayTest: "w", saturdayFocus: "s",
      adjustmentRisks: [], successSignals: [],
      reflection: { mainUncertainty: "u", missingInformation: "i", alternativeInterpretation: "a", confidence: 0.4 },
    });
    expect(advice.supportingFacts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/coachBoardClaimReference.test.ts`
Expected: FAIL — `CoachBoardClaimReferenceSchema` not exported / `supportingFacts` missing.

- [ ] **Step 3: Add the schema (additive)**

```ts
// src/ai/CoachSchemas.ts — add near CoachAlternativeAdjustmentSchema
export const CoachBoardClaimReferenceSchema = z.object({
  boardClaimId: z.string().min(1),
  use: z.enum(["supportingFact", "limitation", "questionTrigger"]),
  copiedValues: z
    .object({
      own: z.number().optional(),
      rival: z.number().optional(),
      delta: z.number().optional(),
      covering: z.number().optional(),
    })
    .optional(),
});
export type CoachBoardClaimReference = z.infer<typeof CoachBoardClaimReferenceSchema>;
```

Then add to `CoachMatchAdviceSchema` (after `playerFitWarnings`):
```ts
  supportingFacts: z.array(CoachBoardClaimReferenceSchema).default([]),
```

- [ ] **Step 4: Run tests + the existing coach schema suite (non-regression) + type-check**

Run: `npm test -- --run tests/coachBoardClaimReference.test.ts tests/postMatchSchema.test.ts && npm run type-check`
Expected: PASS; existing advice fixtures still parse (default `[]`).

- [ ] **Step 5: Commit**

```bash
git add src/ai/CoachSchemas.ts tests/coachBoardClaimReference.test.ts
git commit -m "feat(bridge): additive supportingFacts on coach advice schema (slice 4 task 3)"
```

---

### Task 4: Coach output guard (the firewall)

**Files:**
- Create: `src/ai/coachOutputGuard.ts`
- Test: `tests/coachOutputGuard.test.ts`

**Interfaces:**
- Consumes: `BoardEvidencePacket`, `isBoardFactualClaimId` from `@/board/boardEvidencePacket`; `CoachResponse`, `CoachBoardClaimReference` from `@/ai/CoachSchemas`.
- Produces:
  - `applyBoardFactFirewall(response: CoachResponse, packet: BoardEvidencePacket): { response: CoachResponse; dropped: DroppedReference[]; downgraded: boolean }`
  - `type DroppedReference = { boardClaimId: string; reason: "unknown" | "ungrounded-as-support" | "value-mismatch" | "empty-factset"; wasSupport: boolean }`

**Single rule (spec §6):** for each `supportingFacts` reference on the advice —
- valid (id exists, and if `use:"supportingFact"` then source `grounded:true`, and `copiedValues` — when present — equal the source claim exactly) → keep.
- invalid → drop it from `supportingFacts`. If it was `use:"supportingFact"` (a structured support position) → also `downgraded = true`. Otherwise (`limitation`/`questionTrigger`, or stray) → drop + record, no downgrade.
- `factualClaims: []` + any `use:"supportingFact"` board fact → drop + downgrade (covered by "id unknown ⇒ unknown").
- Downgrade = lower `confidenceCap` to ≤ `0.3` and, if the response is `hypothesis`/`diagnosis`, force `mode:"question"` is out of scope for v1 — instead set `reflection.confidence = Math.min(reflection.confidence, 0.3)` and `confidenceCap = Math.min(existing, 0.3)` where the field exists. (Reuses existing fields; no new knob.)

- [ ] **Step 1: Write the failing tests**

```ts
// tests/coachOutputGuard.test.ts
// Define `packet()`, `baseAdvice`, and `hyp()` below in a NEW shared
// `tests/fixtures/coachBridgeFixtures.ts` and EXPORT them (Task 9 imports `hyp`
// from there). Shown inline here for readability.
import { describe, it, expect } from "vitest";
import { applyBoardFactFirewall } from "@/ai/coachOutputGuard";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { CoachResponse } from "@/ai/CoachSchemas";

function packet(over: Partial<BoardEvidencePacket["boardEvidence"]> = {}): BoardEvidencePacket {
  return {
    source: "boardScenario", scope: "drawnSituation", scenarioId: "raise-block", title: "Subir el bloque",
    readout: { confidence: "medium", evidenceLevel: "partial", expectedBenefit: "b", mainRisk: "r" },
    boardEvidence: {
      authority: "high", evidenceStrength: "partial", hasGroundedMetrics: true,
      factualClaims: [
        { id: "press", kind: "zone-count", zoneLabel: "Presión alta", own: 3, rival: 2, delta: 1, grounded: true },
        { id: "gap", kind: "coverage", zoneId: "gap", zoneLabel: "Espacio a la espalda", covering: 0, grounded: true, excludes: "backs" },
      ],
      ...over,
    },
  };
}
const baseAdvice = {
  tacticalReading: "t", problemBreakdown: { zone: "z", moment: "m", trigger: "g", ownVsRival: "o" },
  probableCause: "c", mainAdjustment: "m", onFieldInstructions: [], alternativeAdjustments: [],
  wednesdayTest: "w", saturdayFocus: "s", adjustmentRisks: [], successSignals: [],
  reflection: { mainUncertainty: "u", missingInformation: "i", alternativeInterpretation: "a", confidence: 0.6 },
  linkedExercises: [], actions: [], evidenceCitations: [],
  modelContrast: { aligned: [], contradictions: [], insufficientEvidence: [] }, playerFitWarnings: [],
};
const hyp = (supportingFacts: unknown[]): CoachResponse => ({
  mode: "hypothesis", advice: { ...baseAdvice, supportingFacts } as never, confidenceCap: 0.7,
  intent: { domains: ["block"], specificity: "specific", requestType: "diagnosis", impliedClaims: [] },
  evidenceAudit: { covered: [], missing: [], criticalMissingCount: 0, evidenceStrength: "partial" },
  followUpQuestions: [],
});

describe("applyBoardFactFirewall", () => {
  it("valid supportingFact reference with matching copiedValues is kept, no downgrade", () => {
    const r = hyp([{ boardClaimId: "press", use: "supportingFact", copiedValues: { own: 3, rival: 2, delta: 1 } }]);
    const out = applyBoardFactFirewall(r, packet());
    expect(out.downgraded).toBe(false);
    expect((out.response as typeof r).advice.supportingFacts).toHaveLength(1);
  });

  it("unknown boardClaimId in supportingFacts → drop + downgrade", () => {
    const r = hyp([{ boardClaimId: "ghost", use: "supportingFact" }]);
    const out = applyBoardFactFirewall(r, packet());
    expect(out.downgraded).toBe(true);
    expect((out.response as typeof r).advice.supportingFacts).toHaveLength(0);
    expect(out.dropped[0]).toMatchObject({ boardClaimId: "ghost", reason: "unknown", wasSupport: true });
  });

  it("value mismatch in copiedValues → drop + downgrade", () => {
    const r = hyp([{ boardClaimId: "press", use: "supportingFact", copiedValues: { own: 5, rival: 1 } }]);
    const out = applyBoardFactFirewall(r, packet());
    expect(out.downgraded).toBe(true);
    expect(out.dropped[0]).toMatchObject({ reason: "value-mismatch", wasSupport: true });
  });

  it("grounded:false used as supportingFact → drop + downgrade", () => {
    const p = packet({ hasGroundedMetrics: false, factualClaims: [
      { id: "press", kind: "zone-count", zoneLabel: "Presión alta", own: 0, rival: 0, delta: 0, grounded: false },
    ]});
    const r = hyp([{ boardClaimId: "press", use: "supportingFact" }]);
    const out = applyBoardFactFirewall(r, p);
    expect(out.downgraded).toBe(true);
    expect(out.dropped[0]).toMatchObject({ reason: "ungrounded-as-support", wasSupport: true });
  });

  it("empty factClaims + board fact in supportingFacts → drop + downgrade", () => {
    const p = packet({ hasGroundedMetrics: false, factualClaims: [] });
    const r = hyp([{ boardClaimId: "press", use: "supportingFact" }]);
    const out = applyBoardFactFirewall(r, p);
    expect(out.downgraded).toBe(true);
    expect(out.dropped[0]).toMatchObject({ reason: "unknown", wasSupport: true });
  });

  it("stray invalid ref NOT in support position (limitation) → drop, NO downgrade", () => {
    const r = hyp([{ boardClaimId: "ghost", use: "limitation" }]);
    const out = applyBoardFactFirewall(r, packet());
    expect(out.downgraded).toBe(false);
    expect(out.dropped[0]).toMatchObject({ boardClaimId: "ghost", wasSupport: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/coachOutputGuard.test.ts`
Expected: FAIL — `applyBoardFactFirewall` not found.

- [ ] **Step 3: Implement the guard**

```ts
// src/ai/coachOutputGuard.ts
import type { BoardEvidencePacket, BoardFactualClaim } from "@/board/boardEvidencePacket";
import { isBoardFactualClaimId } from "@/board/boardEvidencePacket";
import type { CoachBoardClaimReference, CoachResponse } from "@/ai/CoachSchemas";

export type DroppedReference = {
  boardClaimId: string;
  reason: "unknown" | "ungrounded-as-support" | "value-mismatch";
  wasSupport: boolean;
};
// Note: the `factualClaims: []` case is a natural "unknown" (the id cannot exist
// in an empty claim set) — no separate reason needed.

const DOWNGRADE_CAP = 0.3;

function claimById(packet: BoardEvidencePacket, id: string): BoardFactualClaim | undefined {
  return packet.boardEvidence.factualClaims.find((c) => c.id === id);
}

function copiedValuesMatch(ref: CoachBoardClaimReference, claim: BoardFactualClaim): boolean {
  if (!ref.copiedValues) return true;
  const cv = ref.copiedValues;
  const eq = (a?: number, b?: number) => a === undefined || a === b;
  if (claim.kind === "zone-count") {
    return eq(cv.own, claim.own) && eq(cv.rival, claim.rival) && eq(cv.delta, claim.delta);
  }
  return eq(cv.covering, claim.covering);
}

function validateRef(ref: CoachBoardClaimReference, packet: BoardEvidencePacket):
  | { ok: true }
  | { ok: false; reason: DroppedReference["reason"] } {
  if (!isBoardFactualClaimId(packet, ref.boardClaimId)) return { ok: false, reason: "unknown" };
  const claim = claimById(packet, ref.boardClaimId)!;
  if (ref.use === "supportingFact" && !claim.grounded) return { ok: false, reason: "ungrounded-as-support" };
  if (!copiedValuesMatch(ref, claim)) return { ok: false, reason: "value-mismatch" };
  return { ok: true };
}

export function applyBoardFactFirewall(
  response: CoachResponse,
  packet: BoardEvidencePacket,
): { response: CoachResponse; dropped: DroppedReference[]; downgraded: boolean } {
  if (response.mode === "question") return { response, dropped: [], downgraded: false };

  const refs = response.advice.supportingFacts ?? [];
  const kept: CoachBoardClaimReference[] = [];
  const dropped: DroppedReference[] = [];
  let downgraded = false;

  for (const ref of refs) {
    const result = validateRef(ref, packet);
    if (result.ok) {
      kept.push(ref);
      continue;
    }
    const wasSupport = ref.use === "supportingFact";
    dropped.push({ boardClaimId: ref.boardClaimId, reason: result.reason, wasSupport });
    if (wasSupport) downgraded = true;
  }

  const advice = { ...response.advice, supportingFacts: kept };
  if (downgraded) {
    advice.reflection = { ...advice.reflection, confidence: Math.min(advice.reflection.confidence, DOWNGRADE_CAP) };
  }
  const nextResponse = {
    ...response,
    advice,
    ...(downgraded && "confidenceCap" in response
      ? { confidenceCap: Math.min(response.confidenceCap, DOWNGRADE_CAP) }
      : {}),
  } as CoachResponse;

  return { response: nextResponse, dropped, downgraded };
}
```

- [ ] **Step 4: Run tests + type-check**

Run: `npm test -- --run tests/coachOutputGuard.test.ts && npm run type-check`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/ai/coachOutputGuard.ts tests/coachOutputGuard.test.ts
git commit -m "feat(bridge): coachOutputGuard structured firewall + single invalid-ref rule (slice 4 task 4)"
```

---

### Task 5: No-regression lock for the existing coach + guard no-ops without a packet

**Files:**
- Modify: `src/ai/CoachAgent.ts` (thread an optional `boardEvidence?: BoardEvidencePacket` through `runCoachTurn`; call the guard ONLY when present, right before the final return / inside `withCoachTurnTelemetry` boundary)
- Test: `tests/coachOutputGuard.test.ts` (append a no-op case) + run existing coach suite

**Interfaces:**
- Consumes: `applyBoardFactFirewall` (Task 4).
- Produces: `runCoachTurn` accepts an added optional field `boardEvidence?: BoardEvidencePacket | null`; when absent/null the response is returned unchanged (guard not invoked).

- [ ] **Step 1: Write the failing test (guard is a no-op when no packet)**

```ts
// tests/coachOutputGuard.test.ts (append)
it("no packet → guard is never applied (caller passes undefined): pure passthrough invariant", () => {
  // applyBoardFactFirewall is only called when a packet exists; assert the contract by
  // confirming an unchanged response when refs are all valid (proxy for passthrough).
  const r = hyp([]);
  const out = applyBoardFactFirewall(r, packet());
  expect(out.dropped).toHaveLength(0);
  expect(out.downgraded).toBe(false);
  expect((out.response as typeof r).advice.supportingFacts).toEqual([]);
});
```

- [ ] **Step 2: Run to verify current behavior** (this should already pass given Task 4; the real lock is the wiring + existing suite)

Run: `npm test -- --run tests/coachOutputGuard.test.ts`
Expected: PASS.

- [ ] **Step 3: Thread the optional packet through `runCoachTurn` (guard only when present)**

In `src/ai/CoachAgent.ts`, extend the `runCoachTurn` argument type with `boardEvidence?: BoardEvidencePacket | null`, and at each point a final `CoachResponse` is about to be returned (the `buildCoachResponseFromAdvice` results in `hypothesis`/`diagnosis` paths), wrap with:

```ts
import { applyBoardFactFirewall } from "@/ai/coachOutputGuard";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";

function guardIfBoardInitiated(response: CoachResponse, boardEvidence?: BoardEvidencePacket | null): CoachResponse {
  if (!boardEvidence) return response;
  return applyBoardFactFirewall(response, boardEvidence).response;
}
```

Apply `guardIfBoardInitiated(response, boardEvidence)` at the return sites. Keep the injection an explicit isolated path — do NOT route `boardEvidence` through the ambient `coachContext` assembly.

- [ ] **Step 4: Run the FULL existing coach suite (non-regression) + type-check**

Run: `npm test -- --run && npm run type-check`
Then: `git checkout -- src/ai/generated/coach-observability.jsonl`
Expected: all existing coach tests (LineupLab/shapeContext, audit, question-mode) green; new code paths inert when `boardEvidence` absent.

- [ ] **Step 5: Commit**

```bash
git add src/ai/CoachAgent.ts tests/coachOutputGuard.test.ts
git commit -m "feat(bridge): thread optional one-shot packet through runCoachTurn, guard no-ops without it (slice 4 task 5)"
```

---

### Task 6: Wiring / entry point (button → client → API → guard)

**Files:**
- Modify: `api/coach-agent.ts` (accept `body.boardEvidence`, pass to `runCoachTurn`)
- Modify: `src/ai/coachAgentClient.ts` (add `boardEvidence` to the request body; new helper `requestBoardScenarioTurn`)
- Modify: `src/ai/CoachAgentPrompt.ts` (firewall instruction: when a board packet is present, the model must cite board facts only via `supportingFacts` referencing packet claim ids, must not invent numbers, and must use `limitation`/`questionTrigger` when `grounded:false`)
- Modify: `src/board/components/TacticalBoardAiPanel.tsx` (the "Consultar al coach sobre este ajuste" button on the scenario readout)
- Test: `tests/coachAgentBoardWiring.test.ts`

**Interfaces:**
- Consumes: `buildBoardEvidencePacket` (Task 2), `requestCoachTurn` pattern (existing client).
- Produces: `requestBoardScenarioTurn(input: string, packet: BoardEvidencePacket, coachContext?): Promise<CoachResponse>`; `api/coach-agent` parses `boardEvidence` and forwards it.

- [ ] **Step 1: Write the failing wiring test (client sends packet in body, one-shot)**

```ts
// tests/coachAgentBoardWiring.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { requestBoardScenarioTurn } from "@/ai/coachAgentClient";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";

const packet = { source: "boardScenario", scope: "drawnSituation", scenarioId: "raise-block", title: "t",
  readout: { confidence: "medium", evidenceLevel: "partial", expectedBenefit: "b", mainRisk: "r" },
  boardEvidence: { authority: "high", evidenceStrength: "partial", hasGroundedMetrics: true, factualClaims: [] } } as BoardEvidencePacket;

afterEach(() => vi.restoreAllMocks());

describe("requestBoardScenarioTurn", () => {
  it("posts boardEvidence in the request body and returns a parsed CoachResponse", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ mode: "question", intent: { domains: ["block"], specificity: "specific", requestType: "diagnosis", impliedClaims: [] }, selectedQuestions: [], blockedClaims: [], evidenceAudit: { covered: [], missing: [], criticalMissingCount: 0, evidenceStrength: "partial" }, confidenceCap: 0.5 }), { status: 200 }),
    );
    await requestBoardScenarioTurn("¿conviene subir el bloque?", packet);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.boardEvidence).toMatchObject({ source: "boardScenario" });
    expect(body.input).toContain("subir el bloque");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run tests/coachAgentBoardWiring.test.ts`
Expected: FAIL — `requestBoardScenarioTurn` not exported.

- [ ] **Step 3: Implement client + API + prompt instruction + button**

Client (`src/ai/coachAgentClient.ts`):
```ts
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";

export async function requestBoardScenarioTurn(
  input: string,
  boardEvidence: BoardEvidencePacket,
  coachContext?: CoachAgentRuntimeContext | null,
): Promise<CoachResponse> {
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, coachContext, boardEvidence }), // one-shot: not stored anywhere
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Coach agent request failed.");
  const parsed = CoachResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Coach agent response had an invalid format.");
  return parsed.data;
}
```

API (`api/coach-agent.ts`): after parsing `coachContext`, add
```ts
const boardEvidence = body.boardEvidence ?? null; // explicit isolated path; validated shape-wise downstream
// ...
const response = await runCoachTurn({ input, coachContext, collectedEvidence, interviewState, skipInterview, boardEvidence });
```

Prompt (`src/ai/CoachAgentPrompt.ts`): append a clearly delimited firewall block, only relevant when a packet is present, instructing: cite board facts ONLY via `supportingFacts` entries that reference packet claim ids; never alter numbers; if a claim is `grounded:false` use `limitation`/`questionTrigger`, never `supportingFact`; if there are no factual claims, do not assert any observed board fact.

Button (`src/board/components/TacticalBoardAiPanel.tsx`): in the `consequenceOverlay` readout block, add
```tsx
<button type="button" className="rombo-scenario-ask-coach" onClick={onAskCoach}>
  Consultar al coach sobre este ajuste
</button>
```
with an `onAskCoach` prop wired by the parent to `requestBoardScenarioTurn(question, buildBoardEvidencePacket(consequenceOverlay))`. The packet is built at click and not stored.

- [ ] **Step 4: Run wiring test + full suite + type-check + build**

Run: `npm test -- --run tests/coachAgentBoardWiring.test.ts && npm run type-check && npm run build`
Then: `git checkout -- src/ai/generated/coach-observability.jsonl`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/coach-agent.ts src/ai/coachAgentClient.ts src/ai/CoachAgentPrompt.ts src/board/components/TacticalBoardAiPanel.tsx tests/coachAgentBoardWiring.test.ts
git commit -m "feat(bridge): board 'consultar al coach' button → one-shot packet via /api (slice 4 task 6)"
```

---

### Task 7: Render validated board facts (from structure, not prose)

**Files:**
- Create: `src/board/boardFactPresentation.ts` (pure: validated references → display rows)
- Modify: `src/board/components/TacticalBoardAiPanel.tsx` (render the coach answer's validated board-fact rows)
- Test: `tests/boardFactPresentation.test.ts`

**Interfaces:**
- Consumes: `BoardEvidencePacket`, `CoachBoardClaimReference`.
- Produces: `renderableBoardFacts(packet, supportingFacts): Array<{ id: string; text: string }>` — for each KEPT reference, builds the row text FROM the packet claim (the source of truth), NOT from the coach prose or `copiedValues`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/boardFactPresentation.test.ts
import { describe, it, expect } from "vitest";
import { renderableBoardFacts } from "@/board/boardFactPresentation";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";

const packet = { source: "boardScenario", scope: "drawnSituation", scenarioId: "raise-block", title: "t",
  readout: { confidence: "medium", evidenceLevel: "partial", expectedBenefit: "b", mainRisk: "r" },
  boardEvidence: { authority: "high", evidenceStrength: "partial", hasGroundedMetrics: true, factualClaims: [
    { id: "press", kind: "zone-count", zoneLabel: "Presión alta", own: 3, rival: 2, delta: 1, grounded: true },
    { id: "gap", kind: "coverage", zoneId: "gap", zoneLabel: "Espacio a la espalda", covering: 0, grounded: true, excludes: "backs" },
  ] } } as BoardEvidencePacket;

describe("renderableBoardFacts (from validated structure)", () => {
  it("renders text from the packet claim, ignoring coach copiedValues", () => {
    const rows = renderableBoardFacts(packet, [
      { boardClaimId: "press", use: "supportingFact", copiedValues: { own: 9, rival: 9, delta: 9 } }, // lie
    ]);
    expect(rows).toEqual([{ id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" }]);
  });

  it("only renders referenced + present claims; unknown ids produce no row", () => {
    const rows = renderableBoardFacts(packet, [{ boardClaimId: "ghost", use: "supportingFact" }]);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run tests/boardFactPresentation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement render-from-structure**

```ts
// src/board/boardFactPresentation.ts
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { CoachBoardClaimReference } from "@/ai/CoachSchemas";

export function renderableBoardFacts(
  packet: BoardEvidencePacket,
  supportingFacts: CoachBoardClaimReference[],
): Array<{ id: string; text: string }> {
  const rows: Array<{ id: string; text: string }> = [];
  for (const ref of supportingFacts) {
    const claim = packet.boardEvidence.factualClaims.find((c) => c.id === ref.boardClaimId);
    if (!claim) continue; // never render an unvalidated reference
    if (claim.kind === "zone-count") {
      rows.push({ id: claim.id, text: `${claim.zoneLabel}: ${claim.own} propios vs ${claim.rival} rival (${claim.delta >= 0 ? "+" : ""}${claim.delta})` });
    } else {
      rows.push({ id: claim.id, text: `${claim.zoneLabel}: ${claim.covering} cobertura${claim.covering === 1 ? "" : "s"}` });
    }
  }
  return rows;
}
```

In `TacticalBoardAiPanel.tsx`, when a coach answer is present, render `renderableBoardFacts(packet, response.advice.supportingFacts)` as plain rows (muted, like slice-3's grounding rows). The coach prose renders separately; board-fact rows come ONLY from this function.

- [ ] **Step 4: Run tests + type-check + build**

Run: `npm test -- --run tests/boardFactPresentation.test.ts && npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board/boardFactPresentation.ts src/board/components/TacticalBoardAiPanel.tsx tests/boardFactPresentation.test.ts
git commit -m "feat(bridge): render board facts from validated structure, never prose (slice 4 task 7)"
```

---

### Task 8: Residual prose scan (secondary, fragile, documented)

**Files:**
- Create: `src/ai/coachProseScan.ts`
- Test: `tests/coachProseScan.test.ts`

**Interfaces:**
- Produces: `scanProseForBoardContradictions(prose: string, renderedFacts: Array<{ id: string; text: string }>): Array<{ claimId: string; note: string }>` — best-effort, compares prose ONLY against the small set of rendered (validated) facts. Documented in-file as fragile and explicitly NOT the firewall.

- [ ] **Step 1: Write the failing test (slice-3-style: structure says 3v2, prose says 5v1)**

```ts
// tests/coachProseScan.test.ts
import { describe, it, expect } from "vitest";
import { scanProseForBoardContradictions } from "@/ai/coachProseScan";

describe("scanProseForBoardContradictions (best-effort, NOT the firewall)", () => {
  it("flags an obvious numeric contradiction against a rendered fact", () => {
    const flags = scanProseForBoardContradictions(
      "tenés 5 contra 1 en la presión alta, dominás",
      [{ id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" }],
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].claimId).toBe("press");
  });

  it("no rendered facts → no flags (nothing to contradict)", () => {
    expect(scanProseForBoardContradictions("cualquier prosa", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run tests/coachProseScan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the best-effort scan**

```ts
// src/ai/coachProseScan.ts
// FRAGILE BY DESIGN. This is a secondary net, NOT the firewall. The firewall is
// the structured coachOutputGuard. This only catches obvious numeric contradictions
// between free prose and the small set of already-validated, rendered board facts.

export function scanProseForBoardContradictions(
  prose: string,
  renderedFacts: Array<{ id: string; text: string }>,
): Array<{ claimId: string; note: string }> {
  const flags: Array<{ claimId: string; note: string }> = [];
  const proseNumbers = (prose.match(/\d+/g) ?? []).map(Number);
  for (const fact of renderedFacts) {
    const factNumbers = (fact.text.match(/\d+/g) ?? []).map(Number);
    if (factNumbers.length === 0) continue;
    // Heuristic: a "N vs M" pair in the prose that names neither of the fact's numbers,
    // near the zone label, is a likely contradiction.
    const labelHit = fact.text.split(":")[0].toLowerCase();
    const mentionsZone = prose.toLowerCase().includes(labelHit);
    const sharesNoNumber = proseNumbers.length >= 2 && !factNumbers.some((n) => proseNumbers.includes(n));
    if (mentionsZone && sharesNoNumber) {
      flags.push({ claimId: fact.id, note: "prose numbers differ from validated board fact" });
    }
  }
  return flags;
}
```

(Surface flags in telemetry/audit only — they do not gate the turn.)

- [ ] **Step 4: Run tests + type-check**

Run: `npm test -- --run tests/coachProseScan.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/coachProseScan.ts tests/coachProseScan.test.ts
git commit -m "feat(bridge): best-effort prose contradiction scan (secondary net, not the firewall) (slice 4 task 8)"
```

---

### Task 9: End-to-end board-initiated flow

**Files:**
- Test: `tests/boardCoachBridgeE2E.test.ts`

**Interfaces:**
- Consumes: `buildBoardEvidencePacket`, `applyBoardFactFirewall`, `renderableBoardFacts`.

This task adds no new production code — it locks the composed behavior (packet → guard → render) end to end, and confirms the existing coach path is untouched.

- [ ] **Step 1: Write the end-to-end tests**

```ts
// tests/boardCoachBridgeE2E.test.ts
import { describe, it, expect } from "vitest";
import { buildConsequenceOverlay } from "@/board/scenarioBoardConsequence";
import { buildBoardEvidencePacket } from "@/board/boardEvidencePacket";
import { applyBoardFactFirewall } from "@/ai/coachOutputGuard";
import { renderableBoardFacts } from "@/board/boardFactPresentation";
// `hyp` (minimal hypothesis CoachResponse builder) is exported from the shared
// fixture created in Task 4; raise-block scene helpers from the shared fixture in Task 2.
import { hyp } from "./fixtures/coachBridgeFixtures";
import { raiseBlockSim, raiseBlockScene, sceneWith } from "./fixtures/raiseBlockFixtures";

describe("board→coach bridge end-to-end (raise-block)", () => {
  it("grounded: a valid supportingFact survives the guard and renders from structure", () => {
    const packet = buildBoardEvidencePacket(buildConsequenceOverlay(raiseBlockSim(), raiseBlockScene(false)));
    const pressId = packet.boardEvidence.factualClaims[0].id;
    const guarded = applyBoardFactFirewall(hyp([{ boardClaimId: pressId, use: "supportingFact" }]), packet);
    expect(guarded.downgraded).toBe(false);
    const rows = renderableBoardFacts(packet, guarded.response.mode !== "question" ? guarded.response.advice.supportingFacts : []);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("ungrounded (empty board): a board fact used as support is dropped + downgraded, renders nothing", () => {
    const packet = buildBoardEvidencePacket(buildConsequenceOverlay(raiseBlockSim(), sceneWith([])));
    const anyId = packet.boardEvidence.factualClaims[0]?.id ?? "press";
    const guarded = applyBoardFactFirewall(hyp([{ boardClaimId: anyId, use: "supportingFact" }]), packet);
    expect(guarded.downgraded).toBe(true);
    const rows = renderableBoardFacts(packet, guarded.response.mode !== "question" ? guarded.response.advice.supportingFacts : []);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new e2e + the FULL suite + type-check + build**

Run: `npm test -- --run && npm run type-check && npm run build`
Then: `git checkout -- src/ai/generated/coach-observability.jsonl`
Expected: all green; existing coach path unchanged.

- [ ] **Step 3: Commit**

```bash
git add tests/boardCoachBridgeE2E.test.ts
git commit -m "test(bridge): end-to-end board-initiated flow, grounded + ungrounded raise-block (slice 4 task 9)"
```

---

## Notes for the implementer

- **`@/` alias** everywhere (matches slices 1-3).
- After any full `npm test`, the coach suite mutates `src/ai/generated/coach-observability.jsonl` — revert it before committing.
- The `runCoachTurn` return sites in `CoachAgent.ts` are several (`hypothesis`/`diagnosis` via `buildCoachResponseFromAdvice`); apply the guard once at the boundary (Task 5) rather than at each site if a single choke point exists near `withCoachTurnTelemetry`. If no single choke point exists, wrap each advice-bearing return and note it in the task report.
- Keep `CoachAgent.ts` edits minimal and the board-evidence path explicit/isolated — it is a CLAUDE.md sensitive zone.
