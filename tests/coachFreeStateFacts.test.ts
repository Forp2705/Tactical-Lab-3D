import { describe, expect, it } from "vitest";
import { formatFreeStateFactsBlock } from "../src/ai/CoachAgent";

describe("formatFreeStateFactsBlock (free-state board facts section)", () => {
  it("renderiza los factualClaims como hechos contables neutros con su id", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [
        { id: "fs-formation", statement: "Formacion propia declarada: 4-3-3" },
        { id: "fs-tokens", statement: "Fichas propias: 11" },
        { id: "fs-arrows", statement: "Flechas de pase: 3" },
        { id: "fs-scene", statement: "Escena: 2 de 4" },
        { id: "fs-layers", statement: "Capas visibles: ataque" },
      ],
    });

    // Trae su propio separador inicial para ir pegado al valor anterior del prompt.
    expect(block.startsWith("\n\nHECHOS DEL TABLERO (estado libre):")).toBe(true);
    expect(block).toContain("- fs-formation: Formacion propia declarada: 4-3-3");
    expect(block).toContain("- fs-tokens: Fichas propias: 11");
    expect(block).toContain("- fs-arrows: Flechas de pase: 3");
    expect(block).toContain("- fs-scene: Escena: 2 de 4");
    expect(block).toContain("- fs-layers: Capas visibles: ataque");
    // Instruccion estilo slice 4: citables por id, nada fuera de la lista es evidencia.
    expect(block).toContain("Podes citarlos por id como evidencia del tablero");
    expect(block).toContain("Lo que no aparece en esta lista no es evidencia del tablero");
  });

  it("sin packet devuelve '' (garantiza prompt byte-identico al actual)", () => {
    expect(formatFreeStateFactsBlock(undefined)).toBe("");
    expect(formatFreeStateFactsBlock(null)).toBe("");
  });

  it("packet vacio o sin claims => seccion omitida ('')", () => {
    expect(formatFreeStateFactsBlock({})).toBe("");
    expect(formatFreeStateFactsBlock({ factualClaims: [] })).toBe("");
    expect(formatFreeStateFactsBlock({ factualClaims: "no-array" })).toBe("");
  });

  it("acepta el packet anidado bajo freeStateEvidence.factualClaims", () => {
    const block = formatFreeStateFactsBlock({
      freeStateEvidence: {
        factualClaims: [{ id: "fs-tokens", statement: "Fichas propias: 11" }],
      },
    });
    expect(block).toContain("- fs-tokens: Fichas propias: 11");
  });

  it("fallback neutro kind=value cuando el claim no trae statement", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [{ id: "fs-scene", kind: "scene", value: "2 de 4" }],
    });
    expect(block).toContain("- fs-scene: scene = 2 de 4");
  });

  it("ignora claims sin id y no inventa texto", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [
        { statement: "hecho sin id" },
        { id: "fs-ok", statement: "Fichas propias: 11" },
      ],
    });
    expect(block).toContain("- fs-ok: Fichas propias: 11");
    expect(block).not.toContain("hecho sin id");
  });
});
