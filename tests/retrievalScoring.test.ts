import { describe, expect, it } from "vitest";
import { rankDocuments } from "../src/ai/retrievalScoring";

describe("semantic retrieval scoring", () => {
  it("rankea por vocabulario tactico aunque la query no repita el tag exacto", () => {
    const ranked = rankDocuments(
      "nos parten entre volantes y defensa cuando saltamos a presionar",
      [
        {
          id: "compactness",
          sourceType: "knowledge",
          title: "Compactness",
          text: "El equipo queda largo entre lineas; coordinar achique de defensa y salto de volantes.",
          tags: ["compactness", "pressing"],
          payload: {},
        },
        {
          id: "set-piece",
          sourceType: "knowledge",
          title: "ABP",
          text: "Rutina de corner al segundo palo.",
          tags: ["set-pieces"],
          payload: {},
        },
      ],
      { limit: 2 },
    );

    expect(ranked[0]?.id).toBe("compactness");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    expect(ranked[0]?.matchedTerms.length).toBeGreaterThan(0);
  });

  it("respeta limit y descarta documentos sin relevancia suficiente", () => {
    const ranked = rankDocuments(
      "salida limpia contra presion alta",
      [
        {
          id: "build-up",
          sourceType: "knowledge",
          title: "Build-up",
          text: "Salida limpia, hombre libre y superioridad contra presion alta.",
          tags: ["build-up", "high-block"],
          payload: {},
        },
        {
          id: "crosses",
          sourceType: "knowledge",
          title: "Crosses",
          text: "Centros laterales y segundo palo.",
          tags: ["crosses"],
          payload: {},
        },
        {
          id: "noise",
          sourceType: "knowledge",
          title: "Noise",
          text: "Texto administrativo sin relacion tactica.",
          payload: {},
        },
      ],
      { limit: 1 },
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.id).toBe("build-up");
  });
});
