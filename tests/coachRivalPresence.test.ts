import { describe, expect, it } from "vitest";
import { formatShapeRuntimeContext } from "../src/ai/CoachAgent";

// T1: el contexto del prompt debe exponer la PRESENCIA del rival (si/no), nunca
// las posiciones decorativas del tablero (serian evidencia fabricada).
describe("formatShapeRuntimeContext rival presence (T1)", () => {
  const baseShape = {
    formation: "4-3-3",
    selectedShapeName: "Base semanal",
  };

  it("expone presencia 'si' y NO filtra las posiciones del rival", () => {
    const out = formatShapeRuntimeContext({
      ...baseShape,
      rivalReference: [
        { id: "rival-ref-1", num: 1, role: "RIV", x: 70, y: 50 },
        { id: "rival-ref-2", num: 2, role: "RIV", x: 80, y: 30 },
        { id: "rival-ref-3", num: 3, role: "RIV", x: 88, y: 50 },
      ],
    });

    expect(out).toContain("Referencia rival cargada en el tablero: si");
    // Ninguna coordenada del rival debe aparecer como dato posicional.
    expect(out).not.toMatch(/\b70\b/);
    expect(out).not.toMatch(/\b80\b/);
    expect(out).not.toMatch(/\b88\b/);
    expect(out).not.toMatch(/\b30\b/);
  });

  it("expone presencia 'no' cuando no hay referencia rival", () => {
    const out = formatShapeRuntimeContext(baseShape);
    expect(out).toContain("Referencia rival cargada en el tablero: no");
  });

  it("expone presencia 'no' cuando rivalReference es un array vacio", () => {
    const out = formatShapeRuntimeContext({ ...baseShape, rivalReference: [] });
    expect(out).toContain("Referencia rival cargada en el tablero: no");
  });
});
