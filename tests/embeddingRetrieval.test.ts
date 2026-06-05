import { describe, expect, it } from "vitest";
import { rankDocumentsHybrid } from "../src/ai/embeddingRetrieval";

describe("embedding retrieval", () => {
  it("rankea semantically aunque la query no repita keywords exactas", async () => {
    const ranked = await rankDocumentsHybrid(
      "al cinco lo aprietan cuando recibe de espaldas",
      [
        {
          id: "build-up-pivot",
          sourceType: "knowledge",
          title: "Pivote bajo presion",
          text: "Salida interior con apoyos cercanos, tercer hombre y recepcion orientada del mediocentro.",
          tags: ["build-up"],
          payload: {},
        },
        {
          id: "crosses",
          sourceType: "knowledge",
          title: "Centros",
          text: "Atacar el segundo palo con extremo opuesto y lateral profundo.",
          tags: ["crosses"],
          payload: {},
        },
      ],
      {
        limit: 2,
        embeddingProvider: fakeEmbeddingProvider,
      },
    );

    expect(ranked[0]?.id).toBe("build-up-pivot");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("mantiene boosts de recencia y autoridad dentro del ranking hibrido", async () => {
    const ranked = await rankDocumentsHybrid(
      "nos ganan por banda",
      [
        {
          id: "old-wide",
          sourceType: "report",
          title: "Costado defendido mal",
          text: "El lateral queda expuesto por fuera.",
          tags: ["wide-defense"],
          payload: {},
          recencyScore: 0.1,
          authorityScore: 0.4,
        },
        {
          id: "recent-wide",
          sourceType: "report",
          title: "2v1 en banda derecha",
          text: "El rival genero ventajas por fuera y centros atras.",
          tags: ["wide-defense"],
          payload: {},
          recencyScore: 1,
          authorityScore: 0.9,
        },
      ],
      {
        limit: 2,
        embeddingProvider: fakeEmbeddingProvider,
      },
    );

    expect(ranked[0]?.id).toBe("recent-wide");
  });
});

async function fakeEmbeddingProvider(texts: string[]) {
  return texts.map((text) => {
    const normalized = normalize(text);
    const vector = [
      hasAny(normalized, ["salida", "cinco", "5", "pivote", "espaldas", "mediocentro", "tercer hombre"]) ? 1 : 0,
      hasAny(normalized, ["presion", "aprietan", "bajo presion"]) ? 0.8 : 0,
      hasAny(normalized, ["banda", "costado", "por fuera", "lateral", "2v1"]) ? 1 : 0,
      hasAny(normalized, ["centro", "segundo palo", "extremo"]) ? 0.7 : 0,
    ];
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  });
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
