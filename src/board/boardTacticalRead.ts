// src/board/boardTacticalRead.ts — pure, client-safe, ZERO ties to the coach.
//
// Doctrine (REACTIVE-BOARD-TECH-AUDIT.md + REACTIVE-BOARD-PRODUCT-AUDIT.md):
// deterministic geometry -> tactical reading, no LLM, live while the DT drags.
// A read is MEASUREMENT (grounded: true by construction), never fabrication:
// it describes the drawn token/arrow, never the DT's intent. Silence when the
// scene is balanced, or when the data needed to read honestly is missing, is
// valid output — never fill with a "not enough data" filler chip (that class
// of note only belongs to an EXPLICIT user action like "Probar un ajuste",
// not to this ambient/passive surface).
//
// Isolation (hard rule, hold at every future edit): this file must NEVER
// import from or be imported by CoachAgent.ts, CoachSchemas.ts,
// coachAgentClient.ts, or anything under api/. It must never extend
// boardFreeStateEvidencePacket.ts (that packet is counts-only, no coordinates,
// by deliberate design — see its own file doc). A future `positionalRead`
// claim for the coach packet is an explicit, separate, later decision.
import type { Player } from "@/data";
import type { BoardObject, BoardScene } from "./boardModel";
import { endpointPoint } from "./boardGeometry";
import { countTokensInZone } from "./productBoardTypes";

export type TacticalReadKind =
  | "lateralBias"
  | "blockHeight"
  | "amplitude"
  | "zoneSuperiority"
  | "wideArrowBias";

export type TacticalReadConfidence = "low" | "medium" | "high";
export type TacticalReadEvidence = "none" | "weak" | "partial" | "sufficient";

export type TacticalRead = {
  id: string;
  kind: TacticalReadKind;
  text: string;
  confidence: TacticalReadConfidence;
  evidenceLevel: TacticalReadEvidence;
  grounded: true;
  // Render-only geometry for the ephemeral canvas overlay (never sent to the
  // coach, never rendered as raw text — the chip only ever shows `text`).
  // Set only for the two kinds the overlay covers this wave.
  overlaySide?: "left" | "right"; // lateralBias: which band is loaded
  overlayX?: number; // blockHeight: raw x (0-100) for the ghost line
};

// Same regex-on-role pattern as GK_ROLE/CB_ROLE in scenarioBoardConsequence.ts.
//
// SIDE (left/right) — the broad set, used only to resolve which band a token
// belongs to for lateralBias. Includes wing/mid (lw/lm, rw/rm) because a
// winger still belongs to a band; it just isn't the *anchor* of that band
// (see FULLBACK_* + pickBandAnchor).
const LEFT_ROLE = /\b(lb|lwb|lm|lw)\b/i;
const RIGHT_ROLE = /\b(rb|rwb|rm|rw)\b/i;
// LATERAL (full-back / wing-back) — the *literal* lateral of each side. This is
// the honest anchor for the "sesgo de banda" read: LB vs RB, not LW vs RW.
const FULLBACK_LEFT_ROLE = /\b(lb|lwb)\b/i;
const FULLBACK_RIGHT_ROLE = /\b(rb|rwb)\b/i;
// DEFENSIVE LINE ("bloque") — the football criterion for block height is the
// last line: centre-backs (cb/dfc/central) + full-backs/wing-backs
// (lb/rb/lwb/rwb). Wingers (lw/rw) and midfielders (lm/rm) are NOT the block,
// so an advanced winger must never drag the "altura del bloque" upward
// (W21 calibration, catalog item 1).
const DEFENSIVE_LINE_ROLE =
  /\b(cb|dfc|central|centre[-\s]?back|center[-\s]?back|lb|rb|lwb|rwb)\b/i;

// Advancement toward the rival goal, normalized so 0 = at the own goal,
// 100 = at the rival goal, regardless of which physical side `dir` attacks.
// This is MEASUREMENT of an already-known token, never a way to guess side.
const advancement = (x: number, dir: 1 | -1): number => (dir === 1 ? x : 100 - x);

// Normalized-unit thresholds. Calibrate in vivo per the plan.
const LATERAL_BIAS_THRESHOLD = 15;
const LATERAL_BIAS_HIGH_CONFIDENCE = 25;
const BLOCK_THIRD_LOW = 33;
const BLOCK_THIRD_HIGH = 66;
const AMPLITUDE_WIDE = 60;
const AMPLITUDE_NARROW = 30;
const ZONE_SUPERIORITY_RADIUS = 15;
const WIDE_ARROW_BAND = 20; // y<20 or y>80

function isOwnFieldToken(o: BoardObject): boolean {
  return o.type === "playerToken";
}

type Side = "left" | "right";

type SideResolution = { side: Side; fromRole: boolean; isFullBack: boolean };

/**
 * Resolves which side (left/right) a token's role represents, and whether that
 * role is a *literal lateral* (full-back / wing-back). Primary source: the
 * token's own `.role` free text (regex match, same doctrine as
 * isOwnCentreBack). Fallback: linkedPlayerId resolved against `roster`'s
 * structured `Player.positions` enum — but ONLY for the positions that are
 * explicitly side-literal (LB/LW, RB/RW); a generic `WB` doesn't disambiguate
 * side, so it never resolves. If neither source matches, returns null —
 * NEVER guessed from `y` (that is the very quantity lateralBias compares,
 * so using it to decide "who is the left back" would be circular).
 *
 * DOCTRINE (honesty firewall): SIDE is decided from role/roster text ONLY —
 * never from a coordinate. That is why `resolveSide` takes no position. The
 * separate act of choosing WHICH of two same-side, already-resolved tokens
 * anchors the band (pickBandAnchor) DOES use advancement — that is legitimate
 * measurement of known tokens, not a guess about who is "the left one".
 */
function resolveSide(
  object: BoardObject,
  roster: Player[],
): SideResolution | null {
  if (object.role) {
    if (LEFT_ROLE.test(object.role)) {
      return {
        side: "left",
        fromRole: true,
        isFullBack: FULLBACK_LEFT_ROLE.test(object.role),
      };
    }
    if (RIGHT_ROLE.test(object.role)) {
      return {
        side: "right",
        fromRole: true,
        isFullBack: FULLBACK_RIGHT_ROLE.test(object.role),
      };
    }
  }
  const player = object.linkedPlayerId
    ? roster.find((item) => item.id === object.linkedPlayerId)
    : undefined;
  if (player) {
    if (player.positions.includes("LB")) {
      return { side: "left", fromRole: false, isFullBack: true };
    }
    if (player.positions.includes("LW")) {
      return { side: "left", fromRole: false, isFullBack: false };
    }
    if (player.positions.includes("RB")) {
      return { side: "right", fromRole: false, isFullBack: true };
    }
    if (player.positions.includes("RW")) {
      return { side: "right", fromRole: false, isFullBack: false };
    }
  }
  return null;
}

type BandCandidate = { object: BoardObject; fromRole: boolean; isFullBack: boolean };

/**
 * Picks the token that anchors a band for the lateralBias read (W21 catalog
 * item 2). Old behaviour anchored to the FIRST side-resolved token by scene
 * order, so a winger drawn before the full-back hijacked the read. The honest
 * anchor is the *literal lateral* (LB/RB/LWB/RWB); wingers only anchor when no
 * full-back is on that side. Ties inside the chosen role tier (two full-backs,
 * or a roster-fallback pair) break to the MÁS RETRASADO token — least advanced
 * toward the rival goal, i.e. the lateral, not the projected wing.
 *
 * The tie-break reads `position.x` via `advancement`, but ONLY to disambiguate
 * among tokens whose SIDE is already resolved from role/roster text — never to
 * decide the side itself. That distinction is the honesty firewall.
 */
function pickBandAnchor(
  candidates: BandCandidate[],
  dir: 1 | -1,
): BandCandidate | null {
  if (candidates.length === 0) return null;
  const fullBacks = candidates.filter((c) => c.isFullBack);
  const pool = fullBacks.length > 0 ? fullBacks : candidates;
  return pool.reduce((deepest, c) =>
    advancement(c.object.position.x, dir) <
    advancement(deepest.object.position.x, dir)
      ? c
      : deepest,
  );
}

function deriveLateralBiasRead(
  own: BoardObject[],
  dir: 1 | -1,
  roster: Player[],
): TacticalRead | null {
  const leftCandidates: BandCandidate[] = [];
  const rightCandidates: BandCandidate[] = [];
  for (const object of own) {
    const resolved = resolveSide(object, roster);
    if (!resolved) continue;
    const entry: BandCandidate = {
      object,
      fromRole: resolved.fromRole,
      isFullBack: resolved.isFullBack,
    };
    (resolved.side === "left" ? leftCandidates : rightCandidates).push(entry);
  }
  const left = pickBandAnchor(leftCandidates, dir);
  const right = pickBandAnchor(rightCandidates, dir);
  if (!left || !right) return null; // silence: at least one side unresolved

  const diff = dir * (left.object.position.x - right.object.position.x);
  if (Math.abs(diff) < LATERAL_BIAS_THRESHOLD) return null; // balanced shape

  const magnitude = Math.round(Math.abs(diff));
  const advancedIsLeft = diff > 0;
  const advancedSide = advancedIsLeft ? "izquierdo" : "derecho";
  const laggingSide = advancedIsLeft ? "derecho" : "izquierdo";
  const bothFromRole = left.fromRole && right.fromRole;

  return {
    id: "lateral-bias",
    kind: "lateralBias",
    text: `Lateral ${advancedSide} +${magnitude} adelantado que el ${laggingSide}`,
    confidence:
      magnitude >= LATERAL_BIAS_HIGH_CONFIDENCE ? "high" : "medium",
    evidenceLevel: bothFromRole ? "sufficient" : "partial",
    grounded: true,
    overlaySide: advancedIsLeft ? "left" : "right",
  };
}

function deriveBlockHeightRead(
  own: BoardObject[],
  dir: 1 | -1,
): TacticalRead | null {
  // Block height = the DEFENSIVE LINE only (CB + full-backs/wing-backs). An
  // advanced winger or midfielder is NOT the block and must not raise it, so
  // lw/rw/lm/rm are deliberately excluded here (W21 calibration, item 1).
  const backs = own.filter(
    (object) => !!object.role && DEFENSIVE_LINE_ROLE.test(object.role),
  );
  // Ambient/passive surface: fewer than 2 recognizable backs is silence, not
  // a "missing roles" note (that pattern is reserved for the explicit
  // "Probar un ajuste" flow in scenarioBoardConsequence.ts; here it would be
  // filler noise the product audit explicitly bans).
  if (backs.length < 2) return null;

  const depth =
    backs.reduce((sum, o) => sum + advancement(o.position.x, dir), 0) /
    backs.length;

  const label =
    depth < BLOCK_THIRD_LOW
      ? "bajo"
      : depth > BLOCK_THIRD_HIGH
        ? "alto"
        : "medio";
  const avgRawX =
    backs.reduce((sum, o) => sum + o.position.x, 0) / backs.length;

  return {
    id: "block-height",
    kind: "blockHeight",
    text: `Bloque ${label}`,
    confidence: backs.length >= 3 ? "high" : "medium",
    evidenceLevel: backs.length >= 3 ? "sufficient" : "partial",
    grounded: true,
    overlayX: avgRawX,
  };
}

function deriveAmplitudeRead(own: BoardObject[]): TacticalRead | null {
  const outfield = own.filter(
    (object) => !object.role || !/\b(gk|arquero|portero|golero)\b/i.test(object.role),
  );
  if (outfield.length < 2) return null;

  const ys = outfield.map((o) => o.position.y);
  const spread = Math.max(...ys) - Math.min(...ys);

  if (spread >= AMPLITUDE_WIDE) {
    return {
      id: "amplitude",
      kind: "amplitude",
      text: "Equipo amplio (ocupa toda la cancha en ancho)",
      confidence: "medium",
      evidenceLevel: "sufficient",
      grounded: true,
    };
  }
  if (spread <= AMPLITUDE_NARROW) {
    return {
      id: "amplitude",
      kind: "amplitude",
      text: "Equipo compacto (concentrado en el centro)",
      confidence: "medium",
      evidenceLevel: "sufficient",
      grounded: true,
    };
  }
  return null; // mid-range: no notable signal
}

function deriveZoneSuperiorityRead(scene: BoardScene): TacticalRead | null {
  const ball = scene.objects.find((object) => object.type === "ball");
  if (!ball) return null;
  const rivalCount = scene.objects.filter(
    (object) => object.type === "opponentToken",
  ).length;
  if (rivalCount === 0) return null;

  const rect = {
    x: ball.position.x - ZONE_SUPERIORITY_RADIUS,
    y: ball.position.y - ZONE_SUPERIORITY_RADIUS,
    w: ZONE_SUPERIORITY_RADIUS * 2,
    h: ZONE_SUPERIORITY_RADIUS * 2,
  };
  const { own, rival } = countTokensInZone(scene.objects, rect);
  if (own + rival === 0) return null;

  return {
    id: "zone-superiority",
    kind: "zoneSuperiority",
    text: `Zona del balon: ${own} propios vs ${rival} rivales`,
    confidence: own + rival >= 4 ? "high" : "medium",
    evidenceLevel: own + rival >= 4 ? "sufficient" : "partial",
    grounded: true,
  };
}

const WIDE_ARROW_SEMANTICS = new Set(["cross", "switch", "longPass"]);

function deriveWideArrowBiasRead(scene: BoardScene): TacticalRead | null {
  const wideArrows = scene.arrows.filter((arrow) => {
    if (!WIDE_ARROW_SEMANTICS.has(arrow.semantic)) return false;
    const end = endpointPoint(arrow.to, scene.objects);
    return end.y < WIDE_ARROW_BAND || end.y > 100 - WIDE_ARROW_BAND;
  });
  if (wideArrows.length === 0) return null;

  return {
    id: "wide-arrow-bias",
    kind: "wideArrowBias",
    text: `Juego por afuera declarado (${wideArrows.length} accion${wideArrows.length === 1 ? "" : "es"} hacia la banda)`,
    confidence: wideArrows.length >= 2 ? "high" : "medium",
    evidenceLevel: "sufficient",
    grounded: true,
  };
}

/**
 * scene -> tactical reads, priority-ordered and capped at 3 (same cap
 * pattern as inferAiInterpretationFindings). `roster` is optional (default
 * empty): the 2-argument contract (scene, dir) is fully testable in
 * role-text-only mode; passing the real team roster additionally resolves
 * the linkedPlayerId fallback for lateralBias.
 */
export function deriveTacticalReads(
  scene: BoardScene,
  dir: 1 | -1,
  roster: Player[] = [],
): TacticalRead[] {
  const own = scene.objects.filter(isOwnFieldToken);

  const reads = [
    deriveLateralBiasRead(own, dir, roster),
    deriveBlockHeightRead(own, dir),
    deriveAmplitudeRead(own),
    deriveZoneSuperiorityRead(scene),
    deriveWideArrowBiasRead(scene),
  ].filter((read): read is TacticalRead => read !== null);

  return reads.slice(0, 3);
}
