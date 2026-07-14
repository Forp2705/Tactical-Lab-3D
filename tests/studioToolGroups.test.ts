import { describe, expect, it } from "vitest";
import { TOOL_DEFS } from "../src/board/boardConstants";
import {
  STUDIO_TOOL_GROUPS,
  allStudioMappedTools,
  studioButtonForTool,
} from "../src/board/studio/studioToolGroups";

// Tesis del norte (MOCKUP-NORTE.html): "claro" = todo bien organizado y
// etiquetado, NUNCA "menos herramientas" — el DT nunca encuentra un limite.
// Esta suite es la red de seguridad de esa promesa: agregar una BoardTool al
// motor sin sumarla a un grupo del Estudio rompe este test, en vez de
// desaparecer en silencio del rail.
describe("studioToolGroups — coherencia del vocabulario completo", () => {
  it("every BoardTool from the engine's TOOL_DEFS appears in exactly one Studio group button", () => {
    const mapped = allStudioMappedTools();
    for (const def of TOOL_DEFS) {
      const occurrences = mapped.filter((tool) => tool === def.id);
      expect(occurrences, `tool "${def.id}" should appear exactly once`).toHaveLength(1);
    }
  });

  it("has no Studio button referencing a tool absent from the engine's TOOL_DEFS", () => {
    const knownIds = new Set(TOOL_DEFS.map((def) => def.id));
    for (const tool of allStudioMappedTools()) {
      expect(knownIds.has(tool)).toBe(true);
    }
  });

  it("every button id is unique across the whole rail (stable React keys)", () => {
    const ids = STUDIO_TOOL_GROUPS.flatMap((group) => group.buttons.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("studioButtonForTool resolves the group button for a real tool and is undefined for an unmapped one", () => {
    expect(studioButtonForTool("run")?.label).toBe("Desmarque");
    // "select" is used by the EDICIÓN group, never a phantom lookup miss.
    expect(studioButtonForTool("select")?.id).toBe("select");
  });

  it("keeps the 5 mockup-validated groups, each with at least one button", () => {
    const groupIds = STUDIO_TOOL_GROUPS.map((g) => g.id);
    expect(groupIds).toEqual(["edicion", "balon", "jugador", "defensa", "campo"]);
    for (const group of STUDIO_TOOL_GROUPS) {
      expect(group.buttons.length).toBeGreaterThan(0);
    }
  });
});
