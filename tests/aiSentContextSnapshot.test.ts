import { describe, expect, it } from "vitest";
import { buildSentContextSnapshot } from "../src/ai/AiView";
import { DEFAULT_OPPONENT_SCOUT } from "../src/scout/opponentScout";

describe("W17 (mc-21) — buildSentContextSnapshot: resumen contable de lo enviado", () => {
  it("real vacio: sin shape, sin scout, sin observaciones ni reportes", () => {
    const snapshot = buildSentContextSnapshot({
      coachShapeContext: null,
      lineupLabShapes: [],
      availablePlayers: 0,
      totalPlayers: 0,
      opponentScout: DEFAULT_OPPONENT_SCOUT,
      manualObservationsCount: 0,
      reportsCount: 0,
    });

    expect(snapshot).toEqual({
      shapeLabel: "Sin shape activo",
      squadLabel: "Disponibles 0/0",
      scoutLabel: "Sin scout de rival",
      observationsLabel: "Observaciones: 0",
      reportsLabel: "Reportes recientes: 0",
    });
  });

  it("demo con scout cargado (W13): usa el rival del scout y cuenta plantel/observaciones/reportes", () => {
    const snapshot = buildSentContextSnapshot({
      coachShapeContext: null,
      lineupLabShapes: [{ name: "4-3-3 base" }],
      availablePlayers: 11,
      totalPlayers: 12,
      opponentScout: {
        ...DEFAULT_OPPONENT_SCOUT,
        rival: "Atletico Norte",
        probableSystem: "4-2-3-1",
      },
      manualObservationsCount: 1,
      reportsCount: 3,
    });

    expect(snapshot).toEqual({
      shapeLabel: "Shape: 4-3-3 base",
      squadLabel: "Disponibles 11/12",
      scoutLabel: "Scout: Atletico Norte",
      observationsLabel: "Observaciones: 1",
      reportsLabel: "Reportes recientes: 3",
    });
  });

  it("prioriza el nombre del shape publicado (coachShapeContext) sobre el primer shape de lineupLab", () => {
    const snapshot = buildSentContextSnapshot({
      coachShapeContext: {
        formation: "4-3-3",
        selectedShapeId: "shape-1",
        selectedShapeName: "Shape publicado",
        currentBoardSummary: "",
        currentBoard: [],
        shapes: [],
      },
      lineupLabShapes: [{ name: "Otro shape sin publicar" }],
      availablePlayers: 10,
      totalPlayers: 12,
      opponentScout: DEFAULT_OPPONENT_SCOUT,
      manualObservationsCount: 0,
      reportsCount: 0,
    });

    expect(snapshot.shapeLabel).toBe("Shape: Shape publicado");
  });
});
