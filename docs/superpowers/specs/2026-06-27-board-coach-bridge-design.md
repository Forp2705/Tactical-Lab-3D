# Board → CoachAgent Bridge — Slice 4 (v1: raise-block)

**Date:** 2026-06-27
**Status:** Approved (design); pending implementation plan
**Base:** `main` @ `1d65189` (slices 1+2+3 merged). Branch: `feat/board-coach-bridge`.
**Predecessors:** Slice 1 (sandbox + detectAttackDir + raise-block consequence), Slice 2 (coordinated rival response), Slice 3 (board-derived zone superiority → grounding → confidence). All in `main`.
**Next:** writing-plans → TDD with subagents, PO review per checkpoint.

---

## 1. Direction & problem

The board produces a deterministic, audited tactical situation (slices 1-3: anchored actions, grounding, honest confidence with no false "high", no verdicts). The conversational coach (`CoachAgent`) never receives it. Slice 4 connects the two: the staff consults the coach about an adjustment, **grounded by the board's signal** and **bounded by a firewall** so the coach cannot undo the honesty the board installed.

The central risk: the generative coach, left to its prose, can over-assert what the deterministic layer deliberately refused to assert. The firewall is the defense, and it must not depend on parsing prose.

---

## 2. Entry point & v1 scope

**Board-initiated (explicit):** a button **"Consultar al coach sobre este ajuste"** on the scenario readout. **One-shot packet:** a snapshot is taken at click, travels with that one query, and dies there. NOT ambient — it is not saved as `shapeContext`, does not leak into future queries.

**v1 = `raise-block` only.** Covers cases 1 and 2; not case 3.

**The three cases (named in the spec):**
1. **raise-block, populated board** → `factualClaims` with `grounded:true` → the structured firewall validates the facts.
2. **raise-block, empty board** → a board model exists → claims are `grounded:false` / limitations → the guard prevents using them as `supportingFact`.
3. **the other 8 scenarios** → no authored draw-back, no `factualClaims` → pure tactical judgment. **Deferred to the next slice** (same entry point, no `factualClaims`; their honesty rides on the existing audit + the firewall as a floor).

**Honest framing:** v1 does **not** close the asymmetry — it isolates the *new* factual-claim firewall over the one modeled scenario. Case 3 (the principal value: the coach covering what the board does not draw) is the next slice.

---

## 3. Honesty model — board-as-evidence, not dictator

The board's grounding enters as a **high-authority evidence source** that the coach's existing `EvidenceAudit` integrates — NOT as an external cap imposed from outside.

- **Factual claims about the drawing:** the board is authority → the coach may not alter numbers or invent superiorities.
- **Tactical judgment:** the board is one input inside the `EvidenceAudit`, alongside memory/reports/knowledge; the coach computes the final confidence.
- **"Ungrounded by the board" ≠ "the coach knows nothing":** it only means "do not assert facts about the drawing"; it does not block tactical concepts the coach knows.

Mapping onto existing coach machinery (no invented knobs):
- board `evidenceLevel` → `evidenceAudit.evidenceStrength` (same enum).
- board `confidence` → an input to the audit (not a hard global cap).
- `question-mode` / `confidenceCap` already exist and are reused for downgrade.

---

## 4. The packet (evidence contract — structured values)

Built board-side by a pure function `buildBoardEvidencePacket(overlay: ConsequenceOverlay): BoardEvidencePacket`, mapping from `overlay.readout` (slice 3/7: `confidence`, `evidenceLevel`, `grounding.{zones,hasGroundedMetrics}`, `tacticalRows`, `expectedBenefit`, `mainRisk`).

```ts
type BoardFactualClaim =
  | { id: string; kind: "zone-count"; zoneLabel: string; own: number; rival: number; delta: number; grounded: boolean }
  | { id: string; kind: "coverage"; zoneId: string; zoneLabel: string; covering: number; grounded: boolean; excludes: "backs" };

type BoardEvidencePacket = {
  source: "boardScenario";
  scope: "drawnSituation";
  scenarioId: ScenarioId;
  title: string;
  readout: { confidence: Confidence; evidenceLevel: EvidenceLevel; expectedBenefit: string; mainRisk: string }; // audit INPUT, not a global cap
  boardEvidence: {
    authority: "high";
    evidenceStrength: EvidenceLevel;     // same enum as board evidenceLevel
    hasGroundedMetrics: boolean;
    factualClaims: BoardFactualClaim[];   // structured numbers; any display `text` is a hint, NEVER a validation source
    summary?: string;
  };
};
```

**Resolved detail (this design):** every `BoardFactualClaim` carries a stable `id` and a `kind` discriminator, so the coach can reference a claim by `boardClaimId` and the guard can validate existence + values. The `zone-count` claim maps from a `superiority` tacticalRow (+ `grounded` = the press grounding zone's `populated`); the `coverage` claim maps from a `coverage` tacticalRow (+ `grounded` = the gap grounding zone's all-token `populated`, preserving slice-7's "CB-in-gap grounds the read while covering=0" distinction).

**Why structured numbers, not formatted text:** so the firewall validates number-against-number, not string-match.

**No raw scene in v1:** the LLM would reinterpret geometry → a second reading. Source of truth = the already-audited readout/grounding. If later needed, a `rawBoardSnapshot` would be added **explicitly marked as non-audited**.

---

## 5. The firewall (lock in `coachOutputGuard`, not just the prompt)

**Two layers:** the prompt instructs + `coachOutputGuard` validates/blocks post-hoc, **server-side in the `/api/coach-agent` flow, after generation, before return** (the firewall does not trust the client).

- **Invariant of every board-initiated request** (not conditional on "having facts"): `factualClaims: []` ⇒ **zero factual board claims permitted** in output.
- **Backbone = structured validation:** the coach references the `factualClaims` in a structured field (`supportingFacts`); the guard compares structure-vs-structure against the packet (existence, `grounded`, values) — zero NLP, robust.
- **Render-from-structure:** board facts in the coach's output are rendered **from the validated structure, not from prose**.
- **Prose-scan = secondary best-effort net**, explicitly fragile, NOT the firewall.
- **Double prose lock:** prose may not exceed (a) the coach's final integrated confidence, nor (b) the board's grounding in sentences describing the drawing. The structured layer is hard-locked; free prose = prompt + best-effort + documented residual.

**Coach output schema addition** (resolved detail): the coach response gains a structured field
```ts
type CoachBoardClaimReference = {
  boardClaimId: string;
  use: "supportingFact" | "limitation" | "questionTrigger";
  copiedValues?: { own?: number; rival?: number; delta?: number; covering?: number }; // if present, guard checks == source claim exactly
};
// e.g. response.supportingFacts: CoachBoardClaimReference[]
```
Placement on the coach response schema (advice vs response-level) is a plan-time decision; it must be a structured array the guard reads, and the prompt must instruct the model to populate it whenever it uses a board fact.

---

## 6. Invalid-reference handling — single rule

**Always remove invalid references from the board-fact render.** **Downgrade the turn only when the invalid reference appears in `supportingFacts`** (a structured support position). Stray / non-support → drop + telemetry, no downgrade. **The turn never explodes** (downgrade = lower `confidenceCap` / force `question-mode`).

Resulting categories:

| Situation | Action |
|---|---|
| unknown `boardClaimId` in `supportingFacts` | drop + downgrade |
| unknown `boardClaimId` outside `supportingFacts` | drop + audit only |
| `grounded:false` used as `supportingFact` | drop/reclassify + downgrade |
| value mismatch in copied structured values | drop + downgrade |
| `factualClaims: []` + board-fact in `supportingFacts` | drop + downgrade |
| contradiction in prose only | best-effort scan, documented residual |

**Three dimensions:**
- **render safety** — the unvalidated is never shown as a board fact.
- **reasoning safety** — if it altered/invented facts in a support position, the answer does not ship at normal confidence.
- **UX safety** — the turn survives; no error to staff except on a complete structural failure.

---

## 7. Boundary (CLAUDE.md sensitive zone)

- Board → `/api/coach-agent` with the structured packet. **Never import `CoachAgent` in React.**
- Injection as an **explicit, isolated path**, not tangled into the ambient context assembly (it is NOT `shapeContext`).
- **Map onto the coach's existing machinery, do not invent knobs:** board `evidenceLevel` → `evidenceAudit.evidenceStrength`; board `confidence` → audit input; `question-mode` / `confidenceCap` already exist.
- `coachOutputGuard` is a focused server-side unit with a well-defined interface: `(response, packet) → { sanitizedResponse, droppedReferences, downgraded }`.

---

## 8. Tests / locks

1. **Structured validation:** `supportingFacts` referencing board facts must match the packet (existence, `grounded`, values); mismatch → drop + downgrade (single rule).
2. **Empty fact-set:** a board fact in `supportingFacts` with `factualClaims: []` → drop + downgrade.
3. **Render-from-structure:** board facts render from validated structure, not prose.
4. **Structural downgrade:** invalid reference in `supportingFacts` → confidence lowered / `question-mode`; outside `supportingFacts` → audit only, no downgrade.
5. **Prose lock best-effort:** an obvious numeric contradiction in prose → flag (documented as fragile).
6. **Non-regression:** existing coach tests (LineupLab/`shapeContext`, audit, question-mode) stay green.
7. **Boundary:** no `CoachAgent` import in React; packet travels via `/api`.

All structured-layer locks are TDD (red → green). Full suite + `tsc` clean before any commit.

---

## 9. Out of scope (v1)

- Case 3 (scenarios without a board model / the other 8) → next slice.
- Ambient injection (b)/(c) → future.
- Raw board scene in the packet.
- A perfect semantic prose parser (fragile NLP).

---

## 10. Resolved review points

- **Entry point** — RESOLVED: board-initiated, one-shot packet (button on the readout). Not ambient.
- **v1 coverage** — RESOLVED: raise-block only (grounded + empty); firewall always runs on board-initiated requests, including `factualClaims: []`.
- **Over-assertion guard** — RESOLVED: structured-reference validation is the firewall; prose-scan is a documented best-effort net; single invalid-reference rule (§6).
- **`BoardFactualClaim` ids + `kind`** — RESOLVED: every claim has a stable `id` + `kind` discriminator for referencing/validation.
- **Guard location** — RESOLVED: server-side in `/api/coach-agent`, post-generation, pre-return.
- **No knob invention** — RESOLVED: maps onto existing `evidenceAudit.evidenceStrength` / `confidenceCap` / `question-mode`.
