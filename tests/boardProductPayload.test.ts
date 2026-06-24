import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_BOARD_LAYERS,
  DEFAULT_EXERCISE_BUILDER,
  DEFAULT_TACTICAL_PROBLEM,
  type PlanningBoardPlayer,
  buildBoardPayload,
  inferAiInterpretation,
} from "@/board";
import {
  createDefaultBoard,
  createSemanticArrow,
  createTacticalZone,
} from "@/board";
import { describe, expect, it } from "vitest";

describe("product tactical board payload", () => {
  it("builds the generator payload from board state", () => {
    const board = createDefaultBoard("Salida limpia");
    const scene = {
      ...board.scenes[0],
      arrows: [
        createSemanticArrow(
          "pass",
          { kind: "point", point: { x: 32, y: 50 } },
          { kind: "point", point: { x: 52, y: 45 } },
          { label: "Pase interior", tacticalMeaning: "Progresar por dentro" },
        ),
      ],
      zones: [
        createTacticalZone("danger", 44, 38, 18, 18, {
          label: "Riesgo central",
          tacticalMeaning: "Perdida en carril central",
        }),
      ],
    };
    const roster: PlanningBoardPlayer[] = [
      {
        id: "p-10",
        name: "Facu",
        position: "Enganche",
        number: 10,
        traits: "buen pase filtrado",
        team: "A",
        role: "Organizador",
        task: "Apoyo",
      },
    ];

    const payload = buildBoardPayload(board, scene, {
      currentView: "Ataque",
      tacticalProblem: DEFAULT_TACTICAL_PROBLEM,
      roster,
      teamAFormation: "4-3-3",
      exercise: DEFAULT_EXERCISE_BUILDER,
      layers: DEFAULT_BOARD_LAYERS,
    });

    expect(payload.boardId).toBe(board.id);
    expect(payload.currentView).toBe("Ataque");
    expect(payload.formations.teamA).toBe("4-3-3");
    expect(
      payload.annotations.some((annotation) => annotation.type === "ballRoute"),
    ).toBe(true);
    expect(
      payload.annotations.some((annotation) => annotation.type === "zone"),
    ).toBe(true);
    expect(payload.exercise.objective).toContain("Salida");
    expect(payload.aiInterpretation.length).toBeGreaterThan(0);
  });

  it("degrades honestly and stays verdict-free with no anchored actions", () => {
    const arrows = [
      createSemanticArrow(
        "pressure",
        { kind: "point", point: { x: 60, y: 48 } },
        { kind: "point", point: { x: 72, y: 48 } },
      ),
    ];
    const input = { players: [], objects: [], arrows, zones: [] };
    const a = inferAiInterpretation(input);
    const b = inferAiInterpretation(input);
    expect(a).toEqual(b); // deterministico
    // Flecha point->point: sin antecedente anclado -> dice que falta, no inventa.
    expect(a.join(" ")).toContain("ninguna anclada");
    // Hechos, no veredictos.
    expect(a.join(" ").toLowerCase()).not.toMatch(/ventaja|superioridad/);
  });

  it("reads anchored player-to-player relations from the graph", () => {
    const board = createDefaultBoard("Relacion");
    const objects = board.scenes[0].objects;
    const [first, second] = objects.filter(
      (object) => object.type === "playerToken",
    );
    const arrows = [
      createSemanticArrow(
        "pass",
        { kind: "object", objectId: first.id },
        { kind: "object", objectId: second.id },
      ),
    ];
    const findings = inferAiInterpretation({
      players: [],
      objects,
      arrows,
      zones: [],
    });
    // El finding nombra a ambos jugadores: hecho estructural (la flecha existe).
    expect(
      findings.some(
        (finding) =>
          finding.includes(`el ${first.number}`) &&
          finding.includes(`el ${second.number}`),
      ),
    ).toBe(true);
  });

  it("reports positional token counts per zone as a fact", () => {
    const board = createDefaultBoard("Posicional");
    const objects = board.scenes[0].objects;
    const ownCount = objects.filter(
      (object) => object.type === "playerToken",
    ).length;
    const zone = createTacticalZone("danger", 0, 0, 100, 100);
    const findings = inferAiInterpretation({
      players: [],
      objects,
      arrows: [],
      zones: [zone],
    });
    expect(
      findings.some((finding) => finding.includes(`${ownCount} propios`)),
    ).toBe(true);
  });

  it("uses an honest training CTA, not a fake generator/animation promise", () => {
    // The board UI is split across TacticalBoardView and its extracted
    // subcomponents, so assert the CTA text across the whole board module.
    const boardDir = join(process.cwd(), "src", "board");
    const componentsDir = join(boardDir, "components");
    const sources = [
      readFileSync(join(boardDir, "TacticalBoardView.tsx"), "utf8"),
      ...readdirSync(componentsDir).map((file) =>
        readFileSync(join(componentsDir, file), "utf8"),
      ),
    ].join("\n");

    // The hero action turns the board into a trainable session block.
    expect(sources).toContain("Llevar al entrenamiento");
    // The JSON payload export stays, but only as a secondary action.
    expect(sources).toContain("Exportar payload (JSON)");
    // The fake "generator"/animation promises are retired as primary CTAs.
    expect(sources).not.toContain("Animar jugada");
    expect(sources).not.toContain("Enviar al generador");
    expect(sources).not.toContain("Generar secuencia desde pizarra");
  });
});
