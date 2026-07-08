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
};

// Same regex-on-role pattern as GK_ROLE/CB_ROLE in scenarioBoardConsequence.ts.
const LEFT_ROLE = /\b(lb|lwb|lm|lw)\b/i;
const RIGHT_ROLE = /\b(rb|rwb|rm|rw)\b/i;
const CENTRE_BACK_ROLE = /\b(cb|dfc|central|centre[-\s]?back|center[-\s]?back)\b/i;

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

/**
 * Resolves which side (left/right) a token's role represents. Primary source:
 * the token's own `.role` free text (regex match, same doctrine as
 * isOwnCentreBack). Fallback: linkedPlayerId resolved against `roster`'s
 * structured `Player.positions` enum — but ONLY for the positions that are
 * explicitly side-literal (LB/LW, RB/RW); a generic `WB` doesn't disambiguate
 * side, so it never resolves. If neither source matches, returns null —
 * NEVER guessed from `y` (that is the very quantity lateralBias compares,
 * so using it to decide "who is the left back" would be circular).
 */
function resolveSide(
  object: BoardObject,
  roster: Player[],
): { side: Side; fromRole: boolean } | null {
  if (object.role) {
    if (LEFT_ROLE.test(object.role)) return { side: "left", fromRole: true };
    if (RIGHT_ROLE.test(object.role)) return { side: "right", fromRole: true };
  }
  const player = object.linkedPlayerId
    ? roster.find((item) => item.id === object.linkedPlayerId)
    : undefined;
  if (player) {
    if (player.positions.includes("LB") || player.positions.includes("LW")) {
      return { side: "left", fromRole: false };
    }
    if (player.positions.includes("RB") || player.positions.includes("RW")) {
      return { side: "right", fromRole: false };
    }
  }
  return null;
}

function deriveLateralBiasRead(
  own: BoardObject[],
  dir: 1 | -1,
  roster: Player[],
): TacticalRead | null {
  let left: { object: BoardObject; fromRole: boolean } | null = null;
  let right: { object: BoardObject; fromRole: boolean } | null = null;
  for (const object of own) {
    const resolved = resolveSide(object, roster);
    if (!resolved) continue;
    if (resolved.side === "left" && !left) {
      left = { object, fromRole: resolved.fromRole };
    } else if (resolved.side === "right" && !right) {
      right = { object, fromRole: resolved.fromRole };
    }
  }
  if (!left || !right) return null; // silence: at least one side unresolved

  const diff = dir * (left.object.position.x - right.object.position.x);
  if (Math.abs(diff) < LATERAL_BIAS_THRESHOLD) return null; // balanced shape

  const magnitude = Math.round(Math.abs(diff));
  const advancedSide = diff > 0 ? "izquierdo" : "derecho";
  const laggingSide = diff > 0 ? "derecho" : "izquierdo";
  const bothFromRole = left.fromRole && right.fromRole;

  return {
    id: "lateral-bias",
    kind: "lateralBias",
    text: `Lateral ${advancedSide} +${magnitude} adelantado que el ${laggingSide}`,
    confidence:
      magnitude >= LATERAL_BIAS_HIGH_CONFIDENCE ? "high" : "medium",
    evidenceLevel: bothFromRole ? "sufficient" : "partial",
    grounded: true,
  };
}

function deriveBlockHeightRead(
  own: BoardObject[],
  dir: 1 | -1,
): TacticalRead | null {
  const backs = own.filter((object) => {
    if (!object.role) return false;
    return (
      CENTRE_BACK_ROLE.test(object.role) ||
      LEFT_ROLE.test(object.role) ||
      RIGHT_ROLE.test(object.role)
    );
  });
  // Ambient/passive surface: fewer than 2 recognizable backs is silence, not
  // a "missing roles" note (that pattern is reserved for the explicit
  // "Probar un ajuste" flow in scenarioBoardConsequence.ts; here it would be
  // filler noise the product audit explicitly bans).
  if (backs.length < 2) return null;

  // Advancement toward the rival goal, normalized so 0 = at the own goal,
  // 100 = at the rival goal, regardless of which physical side dir attacks.
  const advancement = (x: number) => (dir === 1 ? x : 100 - x);
  const depth =
    backs.reduce((sum, o) => sum + advancement(o.position.x), 0) /
    backs.length;

  const label =
    depth < BLOCK_THIRD_LOW
      ? "bajo"
      : depth > BLOCK_THIRD_HIGH
        ? "alto"
        : "medio";

  return {
    id: "block-height",
    kind: "blockHeight",
    text: `Bloque ${label}`,
    confidence: backs.length >= 3 ? "high" : "medium",
    evidenceLevel: backs.length >= 3 ? "sufficient" : "partial",
    grounded: true,
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
