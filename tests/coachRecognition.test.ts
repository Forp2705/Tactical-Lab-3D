import { describe, expect, it } from "vitest";
import { inferDomainsFromText } from "../src/ai/exerciseMatching";
import { retrieveRelevantKnowledge } from "../src/ai/retrieveRelevantKnowledge";

/**
 * Eval de RECONOCIMIENTO del Coach.
 *
 * Mide la capa determinística que decide en qué fase cae un problema y qué
 * conocimiento se prioriza. Es la red que evita regresiones como la conflación
 * presión/salida: si un cambio de prompt/knowledge/retrieval rompe esto, salta acá
 * en vez de aparecer recién cuando un tester prueba a mano.
 *
 * No prueba la respuesta del LLM (eso necesita la key y es no determinístico);
 * prueba que el problema se reconoce en la fase correcta y trae material de esa fase.
 */

const OFFENSIVE_BUILDUP_CATEGORIES = [
  "build-up",
  "building-up",
  "organized-attack",
  "relational-play",
  "direct-play",
  "principles-of-play",
];

describe("inferDomainsFromText: clasificación de fase por input", () => {
  const cases: Array<{ input: string; mustInclude: string }> = [
    { input: "nos cuesta salir limpio", mustInclude: "buildUp" },
    { input: "el 5 recibe de espaldas y no podemos construir", mustInclude: "buildUp" },
    { input: "no presionamos, dejamos salir cómodo al rival", mustInclude: "pressing" },
    { input: "quedamos muy largos entre líneas", mustInclude: "block" },
    { input: "nos hacen daño en pelota parada", mustInclude: "setPieces" },
    { input: "no generamos situaciones de gol", mustInclude: "attack" },
    { input: "perdemos los duelos en el mediocampo", mustInclude: "duels" },
  ];

  for (const { input, mustInclude } of cases) {
    it(`"${input}" → incluye ${mustInclude}`, () => {
      expect(inferDomainsFromText(input)).toContain(mustInclude);
    });
  }

  it("input vacío de señales cae en defense por defecto", () => {
    expect(inferDomainsFromText("algo no anda bien")).toEqual(["defense"]);
  });
});

describe("anti-conflación: un problema de salida NO debe inferir fases defensivas", () => {
  it('"salir limpio" no se clasifica como presión, defensa ni transición defensiva', () => {
    const domains = inferDomainsFromText(
      "nos cuesta salir limpio. se corta en el 5, recibe de espaldas y lo aprietan dos.",
    );
    expect(domains).toContain("buildUp");
    expect(domains).not.toContain("pressing");
    expect(domains).not.toContain("defense");
    expect(domains).not.toContain("defensiveTransition");
  });
});

describe("retrieveRelevantKnowledge: prioriza conocimiento de la fase del problema", () => {
  it("para un problema de salida (buildUp) trae conceptos de salida/ataque, no de presión/defensa", async () => {
    const results = await retrieveRelevantKnowledge(
      "nos cuesta salir limpio, el 5 recibe de espaldas y los centrales no encuentran pase interior",
      ["buildUp"],
    );
    const categories = results.map((doc) => (doc.payload as { category: string }).category);

    expect(results.length).toBeGreaterThan(0);
    expect(
      categories.some((category) => OFFENSIVE_BUILDUP_CATEGORIES.includes(category)),
    ).toBe(true);
    // El primer resultado debería pertenecer a la fase del problema.
    expect(OFFENSIVE_BUILDUP_CATEGORIES).toContain(categories[0]);
  });

  it("sin dominio, sigue funcionando (comportamiento previo)", async () => {
    const results = await retrieveRelevantKnowledge("nos cuesta salir limpio");
    expect(results.length).toBeGreaterThan(0);
  });
});

/**
 * Gaps de reconocimiento conocidos (documentados para no perderlos de vista).
 * Hoy el matching es por keyword sin tilde y deja pasar estos casos:
 */
describe("gaps conocidos de reconocimiento (keyword frágil)", () => {
  it.todo('"lo aprietan" no matchea "apretar" → no detecta presión rival como contexto');
  it.todo('"nos atacan por banda" infiere attack (rival ataca, no nosotros) → falso positivo de fase ofensiva');
  it.todo("fraseos fuera del diccionario caen en defense por defecto en silencio");
});
