// src/ai/CoachChatSchemas.ts — client-safe; NO server-only imports (only zod).
//
// W22-C1 — CONTRACT for the coach multi-turn chat capability.
//
// The owner's decision (textual): "Tendríamos que poner multi turno, como si
// fuese chat también. Para informe o para chat." One mechanism must serve BOTH
// (a) the new "Chat coach" tab of Diagnóstico and (b) re-asking about an
// already-generated report in Consulta táctica (follow-ups anchored to the
// report). This module defines that contract; mc-18 builds the UI against it.
//
// TWO axes of "mode" live in the coach and MUST NOT be confused:
//   - REQUEST mode (here): "advice" | "chat" — chooses the shape of the answer.
//     Absent → "advice", so today's behavior is byte-identical and additive.
//   - RESPONSE mode (CoachSchemas.ts CoachResponse union): question | hypothesis
//     | diagnosis — the informe flow, kept INTACT. Chat answers are their own
//     top-level shape (CoachChatTurnSchema) and never touch that union.
//
// SECURITY DOCTRINE: `history` is text CONTROLLED BY THE USER — it is an
// injection surface. This module only bounds/strips it (structure + caps).
// The prompt layer (next commit) renders it inside a delimited NON-INSTRUCTIVE
// transcript section that can never redefine system instructions, red-check
// verified. Nothing in the chat path ever writes tactical memory.
import { z } from "zod";

// ── Caps ────────────────────────────────────────────────────────────────────
// Per-turn hard char cap: exceeding it is MALFORMED → HTTP 400 (anti-abuse; a
// single turn cannot smuggle an unbounded payload into the injection surface).
export const CHAT_TURN_MAX_CHARS = 2000;

// Request-level ceiling on how many turns a client may send. Generous (a real
// tactical chat runs longer than a handful of exchanges) but bounded; exceeding
// it is MALFORMED → 400. The client sends full history; the SERVER keeps only
// the last CHAT_HISTORY_PROMPT_MAX_TURNS that fit the prompt budget.
export const CHAT_HISTORY_REQUEST_MAX_TURNS = 40;

// Prompt-window budget: the most recent turns injected into the coach prompt.
// Older turns are dropped WITH A NOTE (applied in the prompt-composition commit,
// not by this schema). Exposed here so the request gate and the prompt window
// share one source of truth.
export const CHAT_HISTORY_PROMPT_MAX_TURNS = 12;

// ── History (the multi-turn transcript) ──────────────────────────────────────
// A turn is authored either by the staff (the human) or by the coach (a prior
// assistant turn). The "informe como semilla" case rides on this: the FIRST turn
// may be a `role: "coach"` summary of a Consulta report, so follow-ups anchor to
// that report without re-sending the whole structured advice. See the fixture.
export const CoachChatRoleSchema = z.enum(["staff", "coach"]);

export const CoachChatHistoryTurnSchema = z.object({
  role: CoachChatRoleSchema,
  content: z.string().trim().min(1).max(CHAT_TURN_MAX_CHARS),
});
// Default zod object behavior STRIPS unknown keys — no `.strict()`, no
// `.passthrough()`. A turn carrying extra fields is accepted with those
// fields discarded (they never reach the prompt).

export const CoachChatHistorySchema = z
  .array(CoachChatHistoryTurnSchema)
  .max(CHAT_HISTORY_REQUEST_MAX_TURNS);

// ── Request mode ("advice" | "chat") ─────────────────────────────────────────
export const CoachRequestModeSchema = z.enum(["advice", "chat"]);
export type CoachRequestMode = z.infer<typeof CoachRequestModeSchema>;

// ── Chat response turn ────────────────────────────────────────────────────────
// Compact, validated, and DISTINCT from the informe CoachResponse union. Carries
// `mode: "chat"` so the client can discriminate a chat answer from an advice
// answer at the fetch boundary. `grounded` mirrors the board packet doctrine:
// true only when the reply is backed by cited evidence; false for clarifying /
// interview-style / explicitly-hedged turns. `evidenceRefs` cite source ids from
// the same evidence catalog the advice flow uses (traceability, not fabrication).
export const CoachChatEvidenceRefSchema = z.object({
  sourceType: z.enum([
    "knowledge",
    "memory",
    "observation",
    "report",
    "video",
    "board",
  ]),
  sourceId: z.string().min(1),
  excerpt: z.string().min(1).optional(),
});

export const CoachChatTurnSchema = z.object({
  mode: z.literal("chat"),
  reply: z.string().min(1),
  grounded: z.boolean(),
  followUpQuestions: z.array(z.string().min(1)).default([]),
  evidenceRefs: z.array(CoachChatEvidenceRefSchema).default([]),
  // Optional, same [0,1] convention as advice.reflection.confidence. Absent for
  // pure clarifying turns where no confidence is asserted.
  confidence: z.number().min(0).max(1).optional(),
});

// ── The extended request body (documentation-level composite) ────────────────
// The handler parses fields individually (mirroring its existing per-field
// gate), but this schema documents the FULL extended body and is what the
// fixture/tests validate against. `history` and `mode` are additive and
// optional; every existing field is unchanged.
export const CoachChatRequestBodySchema = z.object({
  input: z.string().min(1),
  mode: CoachRequestModeSchema.optional(),
  history: CoachChatHistorySchema.optional(),
  // coachContext and the existing interview fields flow through unchanged; kept
  // as passthrough-friendly `unknown` here so this contract never re-declares
  // (and thus never drifts from) the runtime-context shape owned elsewhere.
  coachContext: z.unknown().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────
export type CoachChatRole = z.infer<typeof CoachChatRoleSchema>;
export type CoachChatHistoryTurn = z.infer<typeof CoachChatHistoryTurnSchema>;
export type CoachChatHistory = z.infer<typeof CoachChatHistorySchema>;
export type CoachChatEvidenceRef = z.infer<typeof CoachChatEvidenceRefSchema>;
export type CoachChatTurn = z.infer<typeof CoachChatTurnSchema>;

// ── Request gates (mirror parseIncomingBoardEvidence idiom) ──────────────────
// Single validated entry point for the optional `history` field. Absent → no-op;
// valid → forward; malformed → the handler returns HTTP 400. A malformed history
// must NEVER be silently dropped to "absent" — that would let over-length /
// mis-shaped turns slip past the injection-surface bound.
export type CoachHistoryParseResult =
  | { status: "absent" }
  | { status: "ok"; history: CoachChatHistory }
  | { status: "malformed"; error: string };

export function parseIncomingCoachHistory(
  raw: unknown,
): CoachHistoryParseResult {
  if (raw === undefined || raw === null) return { status: "absent" };
  const parsed = CoachChatHistorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "malformed",
      error: parsed.error.issues[0]?.message ?? "Invalid history",
    };
  }
  return { status: "ok", history: parsed.data };
}

// Request mode is intentionally forgiving: ONLY the exact literal "chat" opts in
// to the chat shape; anything absent/unknown resolves to "advice", keeping the
// existing flow byte-identical. (Unlike history, a mis-typed mode is not a 400 —
// it degrades safely to the honest default rather than blocking the turn.)
export function parseCoachRequestMode(raw: unknown): CoachRequestMode {
  return raw === "chat" ? "chat" : "advice";
}
