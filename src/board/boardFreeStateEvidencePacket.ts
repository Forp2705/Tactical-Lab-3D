// src/board/boardFreeStateEvidencePacket.ts — client-safe; NO server-only imports.
//
// Sibling packet type to BoardEvidencePacket (boardEvidencePacket.ts), for the
// "ask the coach about the current free-form scene" bridge (mc-21 w2 B) — as
// opposed to the slice-4 packet, which only covers the canned "raise-block"
// scenario overlay. Kept as a SEPARATE schema on purpose: BoardEvidencePacketSchema
// uses `source`/`scope` as fixed literals and is wrapped in `.superRefine()`
// (ZodEffects), so it does not compose cleanly into a discriminatedUnion without
// touching the already-hardened slice-4 firewall code. This file never imports
// from or mutates that one.
//
// Doctrine (same as slice 4): every claim here is a DIRECT COUNT or a DECLARED
// value read off the scene/workspace — never an inferred tactical judgement
// ("high block", "overload on the wing", etc). No positions/coordinates in this
// first version. `grounded` is always `true` by construction, kept as an
// explicit field so the render layer can apply the identical defensive guard
// used for the scenario packet, even though it never trips today.
import { z } from "zod";
import type { BoardScene, TacticalBoard } from "@/board/boardModel";

const FreeStateFactualClaimSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("formation"),
    side: z.enum(["own", "rival"]),
    formation: z.string().min(1),
    grounded: z.literal(true),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("tokenCount"),
    side: z.enum(["own", "rival"]),
    count: z.number().int().min(0),
    grounded: z.literal(true),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("objectCount"),
    objectType: z.enum(["arrow", "zone", "note"]),
    // Declared semantic (the value the user picked in the tool rail /
    // inspector), never free text. Notes have no subtype, so omitted there.
    semantic: z.string().min(1).optional(),
    count: z.number().int().min(1),
    grounded: z.literal(true),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("scene"),
    title: z.string().min(1),
    index: z.number().int().min(0),
    totalScenes: z.number().int().min(1),
    grounded: z.literal(true),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("layers"),
    visible: z.array(z.string()),
    grounded: z.literal(true),
  }),
]);

export const BoardFreeStateEvidencePacketSchema = z
  .object({
    source: z.literal("boardFreeState"),
    scope: z.literal("currentScene"),
    boardId: z.string().min(1),
    sceneId: z.string().min(1),
    freeStateEvidence: z.object({
      authority: z.literal("high"),
      factualClaims: z.array(FreeStateFactualClaimSchema),
    }),
  })
  // Same reasoning as the scenario packet: duplicate claim ids are a
  // conceptual bypass of "the authoritative claim for an id" even with a
  // perfect firewall, so they are rejected here (land in malformed).
  .superRefine((packet, ctx) => {
    const ids = packet.freeStateEvidence.factualClaims.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "factualClaims ids must be unique",
        path: ["freeStateEvidence", "factualClaims"],
      });
    }
  });

export type FreeStateFactualClaim = z.infer<typeof FreeStateFactualClaimSchema>;
export type BoardFreeStateEvidencePacket = z.infer<
  typeof BoardFreeStateEvidencePacketSchema
>;

/**
 * The ONLY validated entry point for an incoming free-state packet (used by
 * the API gate in `api/coach-agent.ts`). Pure + client-safe. Mirrors
 * `parseIncomingBoardEvidence`'s absent/ok/malformed contract exactly — a
 * malformed packet must NEVER be silently downgraded to "absent".
 */
export function parseIncomingBoardFreeState(
  raw: unknown,
):
  | { status: "absent" }
  | { status: "ok"; packet: BoardFreeStateEvidencePacket }
  | { status: "malformed" } {
  if (raw === undefined || raw === null) return { status: "absent" };
  const parsed = BoardFreeStateEvidencePacketSchema.safeParse(raw);
  return parsed.success
    ? { status: "ok", packet: parsed.data }
    : { status: "malformed" };
}

/**
 * One-shot, pure mapper: current board/scene -> BoardFreeStateEvidencePacket.
 * Reads only counts and declared values (semantics, formation strings, layer
 * ids, scene title/index) — never object positions. Returns a fresh object;
 * reads no store/global.
 */
export function buildBoardFreeStateEvidencePacket(
  board: TacticalBoard,
  scene: BoardScene,
  teamAFormation: string,
  activeLayers: Set<string>,
): BoardFreeStateEvidencePacket {
  const claims: FreeStateFactualClaim[] = [];

  claims.push({
    id: "formation-own",
    kind: "formation",
    side: "own",
    formation: teamAFormation,
    grounded: true,
  });
  claims.push({
    id: "formation-rival",
    kind: "formation",
    side: "rival",
    formation: board.opponent.formation,
    grounded: true,
  });

  const ownTokenCount = scene.objects.filter(
    (object) => object.type === "playerToken",
  ).length;
  const rivalTokenCount = scene.objects.filter(
    (object) => object.type === "opponentToken",
  ).length;
  claims.push({
    id: "token-count-own",
    kind: "tokenCount",
    side: "own",
    count: ownTokenCount,
    grounded: true,
  });
  claims.push({
    id: "token-count-rival",
    kind: "tokenCount",
    side: "rival",
    count: rivalTokenCount,
    grounded: true,
  });

  const arrowCountsBySemantic = new Map<string, number>();
  for (const arrow of scene.arrows) {
    arrowCountsBySemantic.set(
      arrow.semantic,
      (arrowCountsBySemantic.get(arrow.semantic) ?? 0) + 1,
    );
  }
  for (const [semantic, count] of [...arrowCountsBySemantic].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    claims.push({
      id: `object-count-arrow-${semantic}`,
      kind: "objectCount",
      objectType: "arrow",
      semantic,
      count,
      grounded: true,
    });
  }

  const zoneCountsBySemantic = new Map<string, number>();
  for (const zone of scene.zones) {
    zoneCountsBySemantic.set(
      zone.semantic,
      (zoneCountsBySemantic.get(zone.semantic) ?? 0) + 1,
    );
  }
  for (const [semantic, count] of [...zoneCountsBySemantic].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    claims.push({
      id: `object-count-zone-${semantic}`,
      kind: "objectCount",
      objectType: "zone",
      semantic,
      count,
      grounded: true,
    });
  }

  const noteCount = scene.objects.filter(
    (object) => object.type === "note",
  ).length;
  if (noteCount > 0) {
    claims.push({
      id: "object-count-note",
      kind: "objectCount",
      objectType: "note",
      count: noteCount,
      grounded: true,
    });
  }

  const sceneIndex = board.scenes.findIndex((item) => item.id === scene.id);
  claims.push({
    id: "scene-active",
    kind: "scene",
    title: scene.title,
    index: sceneIndex === -1 ? 0 : sceneIndex,
    totalScenes: board.scenes.length,
    grounded: true,
  });

  claims.push({
    id: "layers-visible",
    kind: "layers",
    visible: [...activeLayers].sort(),
    grounded: true,
  });

  return {
    source: "boardFreeState",
    scope: "currentScene",
    boardId: board.id,
    sceneId: scene.id,
    freeStateEvidence: {
      authority: "high",
      factualClaims: claims,
    },
  };
}
