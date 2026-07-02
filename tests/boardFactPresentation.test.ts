import { describe, it, expect } from "vitest";
import {
  allFreeStateFactRefs,
  renderableBoardFacts,
  renderableFreeStateFacts,
} from "@/board/boardFactPresentation";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { BoardFreeStateEvidencePacket } from "@/board/boardFreeStateEvidencePacket";
import type { CoachBoardClaimReference } from "@/ai/CoachSchemas";

function packetWith(
  claims: BoardEvidencePacket["boardEvidence"]["factualClaims"],
): BoardEvidencePacket {
  return {
    source: "boardScenario",
    scope: "drawnSituation",
    scenarioId: "raise-block",
    title: "Subir el bloque",
    readout: {
      confidence: "medium",
      evidenceLevel: "partial",
      expectedBenefit: "x",
      mainRisk: "y",
    },
    boardEvidence: {
      authority: "high",
      evidenceStrength: "partial",
      hasGroundedMetrics: true,
      factualClaims: claims,
    },
  };
}

describe("renderableBoardFacts", () => {
  it("renders text from the CLAIM, ignoring a lying copiedValues", () => {
    const packet = packetWith([
      {
        id: "press",
        kind: "zone-count",
        zoneLabel: "Presión alta",
        own: 3,
        rival: 2,
        delta: 1,
        grounded: true,
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      {
        boardClaimId: "press",
        use: "supportingFact",
        copiedValues: { own: 9 }, // a lie — must be ignored
      },
    ];
    const rows = renderableBoardFacts(packet, refs);
    expect(rows).toEqual([
      { id: "press", text: "Presión alta: 3 propios vs 2 rival (+1)" },
    ]);
    // the lie never surfaces
    expect(rows[0].text).not.toContain("9");
  });

  it("ignores an unknown boardClaimId (no row)", () => {
    const packet = packetWith([
      {
        id: "press",
        kind: "zone-count",
        zoneLabel: "Presión alta",
        own: 3,
        rival: 2,
        delta: 1,
        grounded: true,
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "does-not-exist", use: "supportingFact" },
    ];
    expect(renderableBoardFacts(packet, refs)).toEqual([]);
  });

  it("CONSERVATIVE LOCK: a limitation ref to a grounded:false claim renders NO row", () => {
    const packet = packetWith([
      {
        id: "press",
        kind: "zone-count",
        zoneLabel: "Presión alta",
        own: 3,
        rival: 2,
        delta: 1,
        grounded: false,
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "press", use: "limitation" },
    ];
    expect(renderableBoardFacts(packet, refs)).toEqual([]);
  });

  it("CONSERVATIVE LOCK: a questionTrigger ref to a grounded:false claim renders NO row (not even as a question)", () => {
    const packet = packetWith([
      {
        id: "gap",
        kind: "coverage",
        zoneId: "gap",
        zoneLabel: "Espacio a la espalda",
        covering: 0,
        grounded: false,
        excludes: "backs",
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "gap", use: "questionTrigger" },
    ];
    expect(renderableBoardFacts(packet, refs)).toEqual([]);
  });

  it("renders a grounded:true zone-count supportingFact with the claim's numbers", () => {
    const packet = packetWith([
      {
        id: "press",
        kind: "zone-count",
        zoneLabel: "Presión alta",
        own: 2,
        rival: 5,
        delta: -3,
        grounded: true,
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "press", use: "supportingFact" },
    ];
    expect(renderableBoardFacts(packet, refs)).toEqual([
      { id: "press", text: "Presión alta: 2 propios vs 5 rival (-3)" },
    ]);
  });

  it("pluralizes coverage rows (N=1 singular, N!=1 plural)", () => {
    const packet = packetWith([
      {
        id: "gap1",
        kind: "coverage",
        zoneId: "gap1",
        zoneLabel: "Zona uno",
        covering: 1,
        grounded: true,
        excludes: "backs",
      },
      {
        id: "gap0",
        kind: "coverage",
        zoneId: "gap0",
        zoneLabel: "Zona cero",
        covering: 0,
        grounded: true,
        excludes: "backs",
      },
      {
        id: "gap2",
        kind: "coverage",
        zoneId: "gap2",
        zoneLabel: "Zona dos",
        covering: 2,
        grounded: true,
        excludes: "backs",
      },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "gap1", use: "supportingFact" },
      { boardClaimId: "gap0", use: "supportingFact" },
      { boardClaimId: "gap2", use: "supportingFact" },
    ];
    expect(renderableBoardFacts(packet, refs)).toEqual([
      { id: "gap1", text: "Zona uno: 1 cobertura" },
      { id: "gap0", text: "Zona cero: 0 coberturas" },
      { id: "gap2", text: "Zona dos: 2 coberturas" },
    ]);
  });
});

function freeStatePacketWith(
  claims: BoardFreeStateEvidencePacket["freeStateEvidence"]["factualClaims"],
): BoardFreeStateEvidencePacket {
  return {
    source: "boardFreeState",
    scope: "currentScene",
    boardId: "board-1",
    sceneId: "scene-1",
    freeStateEvidence: {
      authority: "high",
      factualClaims: claims,
    },
  };
}

describe("renderableFreeStateFacts", () => {
  it("renders one row per claim kind with human text", () => {
    const packet = freeStatePacketWith([
      { id: "formation-own", kind: "formation", side: "own", formation: "4-3-3", grounded: true },
      { id: "token-count-rival", kind: "tokenCount", side: "rival", count: 11, grounded: true },
      { id: "object-count-arrow-pass", kind: "objectCount", objectType: "arrow", semantic: "pass", count: 3, grounded: true },
      { id: "object-count-note", kind: "objectCount", objectType: "note", count: 2, grounded: true },
      { id: "scene-active", kind: "scene", title: "Respuesta inicial", index: 0, totalScenes: 2, grounded: true },
      { id: "layers-visible", kind: "layers", visible: ["attack", "defense"], grounded: true },
    ]);
    const refs = allFreeStateFactRefs(packet);
    expect(renderableFreeStateFacts(packet, refs)).toEqual([
      { id: "formation-own", text: "Formacion propia: 4-3-3" },
      { id: "token-count-rival", text: "Fichas rivales: 11" },
      { id: "object-count-arrow-pass", text: "Flechas (pass): 3" },
      { id: "object-count-note", text: "Notas: 2" },
      { id: "scene-active", text: "Escena activa: Respuesta inicial (1/2)" },
      { id: "layers-visible", text: "Capas visibles: attack, defense" },
    ]);
  });

  it("ignores an unknown boardClaimId (no row)", () => {
    const packet = freeStatePacketWith([
      { id: "formation-own", kind: "formation", side: "own", formation: "4-3-3", grounded: true },
    ]);
    const refs: CoachBoardClaimReference[] = [
      { boardClaimId: "does-not-exist", use: "supportingFact" },
    ];
    expect(renderableFreeStateFacts(packet, refs)).toEqual([]);
  });

  it("empty visible layers renders an explicit 'ninguna' row, not a blank", () => {
    const packet = freeStatePacketWith([
      { id: "layers-visible", kind: "layers", visible: [], grounded: true },
    ]);
    const refs = allFreeStateFactRefs(packet);
    expect(renderableFreeStateFacts(packet, refs)).toEqual([
      { id: "layers-visible", text: "Capas visibles: ninguna" },
    ]);
  });
});
