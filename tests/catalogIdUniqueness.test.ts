import { describe, expect, it } from "vitest";
import { catalog } from "../src/data";

/**
 * mc-22/W1 hallazgo: "defensa-centro-lateral" aparecia dos veces en el
 * catalogo final (una en extraExercises con phase abpDef, otra generada desde
 * compactCuratedSpecs con phase defenseOrg) — dos ejercicios distintos que
 * compartian id por accidente. catalog.find(id) siempre resolvia a la
 * primera; la segunda era 100% inalcanzable. Este test fija la invariante
 * para que una futura colision de id se detecte antes de mergear, no en
 * produccion como un ejercicio fantasma.
 */
describe("catalog — unicidad de ids", () => {
  it("todos los ids del catalogo son unicos", () => {
    const ids = catalog.map((exercise) => exercise.id);
    const seen = new Map<string, number>();
    for (const id of ids) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1);

    expect(
      duplicated,
      `ids duplicados en catalog: ${duplicated.map(([id, count]) => `${id} (x${count})`).join(", ")}`,
    ).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
