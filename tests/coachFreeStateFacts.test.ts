import { describe, expect, it } from "vitest";
import { formatFreeStateFactsBlock } from "../src/ai/CoachAgent";

// mc-21's REAL free-state packet is KIND-BASED (per-kind declared fields, no
// `statement`, no `value`). These fixtures mirror that real shape (the earlier
// fixtures tested an imagined `statement` shape, which is why the value-loss gap
// slipped past the workers' tests). The prompt render mirrors mc-21's
// `renderableFreeStateFacts` so prompt and UI declare identical board facts.
describe("formatFreeStateFactsBlock (free-state board facts section)", () => {
  // Full real packet: own+rival formation, 11+11 tokens, 2 pass arrows + 1
  // pressure arrow, 1 press zone, 1 note, scene 1/2, layers attack/defense.
  const realPacket = {
    factualClaims: [
      { id: "formation-own", kind: "formation", side: "own", formation: "4-3-3" },
      { id: "formation-rival", kind: "formation", side: "rival", formation: "4-4-2" },
      { id: "token-count-own", kind: "tokenCount", side: "own", count: 11 },
      { id: "token-count-rival", kind: "tokenCount", side: "rival", count: 11 },
      { id: "object-count-arrow-pass", kind: "objectCount", objectType: "arrow", semantic: "pass", count: 2 },
      { id: "object-count-arrow-pressure", kind: "objectCount", objectType: "arrow", semantic: "pressure", count: 1 },
      { id: "object-count-zone-press", kind: "objectCount", objectType: "zone", semantic: "press", count: 1 },
      { id: "object-count-note", kind: "objectCount", objectType: "note", count: 1 },
      { id: "scene-active", kind: "scene", title: "Salida 1", index: 0, totalScenes: 2 },
      { id: "layers-visible", kind: "layers", visible: ["attack", "defense"] },
    ],
  };

  it("renderiza el packet REAL kind-based con valores legibles (no pierde datos)", () => {
    const block = formatFreeStateFactsBlock(realPacket);

    expect(block.startsWith("\n\nHECHOS DEL TABLERO (estado libre):")).toBe(true);
    // Los valores DEBEN aparecer (regresion del gate mc-99: antes se perdian).
    expect(block).toContain("- formation-own: Formacion propia: 4-3-3");
    expect(block).toContain("- formation-rival: Formacion rival: 4-4-2");
    expect(block).toContain("- token-count-own: Fichas propias: 11");
    expect(block).toContain("- token-count-rival: Fichas rivales: 11");
    expect(block).toContain("- object-count-arrow-pass: Flechas (pass): 2");
    expect(block).toContain("- object-count-arrow-pressure: Flechas (pressure): 1");
    expect(block).toContain("- object-count-zone-press: Zonas (press): 1");
    expect(block).toContain("- object-count-note: Notas: 1");
    expect(block).toContain("- scene-active: Escena activa: Salida 1 (1/2)");
    expect(block).toContain("- layers-visible: Capas visibles: attack, defense");
    // Nunca debe quedar el nombre del kind pelado sin valor.
    expect(block).not.toMatch(/:\s*formation\s*$/m);
    expect(block).not.toMatch(/:\s*tokenCount\s*$/m);
    // Instruccion de cita estilo slice 4.
    expect(block).toContain("Podes citarlos por id como evidencia del tablero");
    expect(block).toContain("Lo que no aparece en esta lista no es evidencia del tablero");
  });

  it("asegura los valores clave 4-3-3 y 11 (re-gate express del probe de dos puntas)", () => {
    const block = formatFreeStateFactsBlock(realPacket);
    expect(block).toContain("Formacion propia: 4-3-3");
    expect(block).toContain("Fichas propias: 11");
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
        factualClaims: [{ id: "token-count-own", kind: "tokenCount", side: "own", count: 11 }],
      },
    });
    expect(block).toContain("- token-count-own: Fichas propias: 11");
  });

  it("layers vacias renderizan 'ninguna', no se pierden", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [{ id: "layers-visible", kind: "layers", visible: [] }],
    });
    expect(block).toContain("- layers-visible: Capas visibles: ninguna");
  });

  it("respeta un statement pre-renderizado si el claim lo trae (precedencia defensiva)", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [{ id: "fs-x", statement: "Fichas propias: 11" }],
    });
    expect(block).toContain("- fs-x: Fichas propias: 11");
  });

  it("fallback generico kind=value para un kind imprevisto con value primitivo", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [{ id: "fs-misc", kind: "misc", value: "x" }],
    });
    expect(block).toContain("- fs-misc: misc = x");
  });

  it("ignora claims sin id y no inventa texto", () => {
    const block = formatFreeStateFactsBlock({
      factualClaims: [
        { kind: "tokenCount", side: "own", count: 11 },
        { id: "token-count-own", kind: "tokenCount", side: "own", count: 11 },
      ],
    });
    expect(block).toContain("- token-count-own: Fichas propias: 11");
    // el claim sin id no debe aparecer como linea propia
    expect(block.match(/Fichas propias: 11/g)?.length).toBe(1);
  });
});
