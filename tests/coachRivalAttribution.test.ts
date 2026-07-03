import { describe, expect, it } from "vitest";
import { formatOpponentScoutContext } from "../src/ai/CoachAgent";

// mc-10 Brief A: the scout already reaches the prompt; these assert the 3-level
// attribution HONESTY rule and the no-scout default (composer unit, same pattern
// as the freeState-facts tests). Acceptance A1-A4.
const scoutWithData = {
  opponentScout: {
    rival: "Rival FC",
    probableSystem: "4-4-2",
    pressing: "presion alta orientada a banda",
    buildUp: "salida corta por central",
    strengths: ["transiciones rapidas"],
    vulnerabilities: ["espalda de los laterales", "segunda pelota"],
    keyPlayers: ["#10 enganche"],
    setPieces: "amenaza en corner al primer palo",
    rhythm: "alto",
    risks: ["contra rapida"],
    notes: "juegan mejor de local",
  },
};

describe("formatOpponentScoutContext — rival attribution (Brief A)", () => {
  it("A1: con scout, incluye el encabezado de atribucion staff por encima del resumen", () => {
    const block = formatOpponentScoutContext(scoutWithData);
    const headerIdx = block.indexOf(
      "OPPONENT SCOUT (staff-declared belief, not verified fact)",
    );
    const summaryIdx = block.indexOf("Vulnerabilidades:");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    // el resumen del scout aparece DESPUES del encabezado de atribucion
    expect(summaryIdx).toBeGreaterThan(headerIdx);
    expect(block).toContain("Nivel 1");
    expect(block).toContain("Nivel 2");
    expect(block).toContain("Nivel 3");
    expect(block).toContain("segun el scout cargado por el staff");
  });

  it("A2: el bloque con scout instruye no subir confianza por el scout solo, ni inventar", () => {
    const block = formatOpponentScoutContext(scoutWithData);
    expect(block).toContain("NO subas la confianza por el scout solo");
    expect(block).toContain(
      "NUNCA inventes formacion, coordenadas ni conducta del rival",
    );
  });

  it("A3: sin scout -> sentinel + prohibicion + >=1 pregunta de scout, sin valores del rival", () => {
    const block = formatOpponentScoutContext({});
    expect(block).toContain("No opponent scout loaded.");
    expect(block.toLowerCase()).toContain(
      "no hagas ninguna afirmacion sobre la formacion",
    );
    const hasScoutQuestion = block
      .split("\n")
      .some((line) => line.trim().startsWith("- ") && line.includes("?"));
    expect(hasScoutQuestion).toBe(true);
    // no debe listar datos concretos del rival cuando no hay scout
    expect(block).not.toContain("Sistema probable:");
    expect(block).not.toContain("Vulnerabilidades:");
  });

  it("A3b: un scout presente pero vacio se trata como sin-scout", () => {
    const block = formatOpponentScoutContext({ opponentScout: { rival: "" } });
    expect(block).toContain("No opponent scout loaded.");
  });

  it("A4: el bloque de rival NO contiene coordenadas x/y del rival (presencia-only intacta)", () => {
    const block = formatOpponentScoutContext(scoutWithData);
    expect(block).not.toMatch(/\bx\s*[:=]\s*-?\d/i);
    expect(block).not.toMatch(/\by\s*[:=]\s*-?\d/i);
    expect(block).not.toMatch(/\b\d{1,3}\s*,\s*\d{1,3}\b/);
    expect(block).not.toContain("rivalReference");
  });
});
