import { describe, expect, it } from "vitest";
import { inferDomainsFromText } from "../src/ai/exerciseMatching";

const CASES = [
  {
    input: "Nos cuesta salir limpio",
    expected: ["buildUp"],
  },
  {
    input: "Al 5 lo aprietan y recibe de espaldas",
    expected: ["buildUp"],
  },
  {
    input: "Mi equipo defiende como el orto",
    expected: ["defense"],
  },
  {
    input: "El 9 queda aislado",
    expected: ["attack"],
  },
  {
    input: "Queremos subir el bloque",
    expected: ["pressing", "block"],
  },
  {
    input: "El rival presiona alto",
    expected: ["pressing"],
  },
  {
    input: "Nos ganan por banda",
    expected: ["defense", "duels"],
  },
  {
    input: "No generamos situaciones",
    expected: ["attack"],
  },
  {
    input: "Perdemos la pelota y quedamos partidos",
    expected: ["defensiveTransition", "block"],
  },
  {
    input: "Sufrimos en pelota parada",
    expected: ["setPieces"],
  },
];

describe("coach retrieval eval baseline", () => {
  for (const item of CASES) {
    it(`clasifica dominio: ${item.input}`, () => {
      const domains = inferDomainsFromText(item.input);
      for (const expected of item.expected) {
        expect(domains).toContain(expected);
      }
    });
  }
});
