import { describe, expect, it } from "vitest";
import type { Scene } from "../src/data";
import {
  buildBoardBriefingHtml,
  buildBoardFilename,
  buildBoardSvgExport,
  buildTacticalBoardBriefingExport,
  createDefaultBoard,
  createInstruction,
  getBoardActorPositions,
  getBoardBallPosition,
  renderTacticalBoardSvgMarkup,
  slugifyBoardFilenamePart,
} from "../src/board";

const scene: Scene = {
  duration: 10,
  pitchMode: "full",
  actors: [
    {
      id: "own-9",
      team: "own",
      num: 9,
      role: "ST",
      start: { x: 40, y: 50 },
      path: [{ t: 10, pos: { x: 60, y: 40 } }],
      facingMode: "auto",
      state: [],
    },
    {
      id: "rival-4",
      team: "rival",
      num: 4,
      role: "CB",
      start: { x: 68, y: 44 },
      path: [],
      facingMode: "auto",
      state: [],
    },
  ],
  ball: {
    start: { x: 40, y: 50, z: 0 },
    path: [{ t: 10, pos: { x: 60, y: 40, z: 0 }, carrier: "own-9" }],
  },
  overlays: [
    {
      id: "pass-1",
      type: "pass",
      from: "own-9",
      to: { x: 82, y: 34 },
      start: 3,
      end: 7,
      label: "Tercer hombre",
      layer: "withBall",
    },
    {
      id: "hidden-press",
      type: "press",
      from: "rival-4",
      to: "own-9",
      start: 3,
      end: 7,
      layer: "press",
    },
  ],
  zones: [
    {
      id: "zone-1",
      label: "Espalda pivote",
      rect: { x: 55, y: 24, w: 24, h: 18 },
      color: "#c7df5f",
      layer: "withBall",
      visibleInPhases: ["execution"],
    },
  ],
  triggers: [],
  phases: [
    { id: "setup", name: "Setup", start: 0, end: 2.99, activeLayers: [] },
    {
      id: "execution",
      name: "Execution",
      start: 3,
      end: 8,
      activeLayers: ["withBall"],
    },
    { id: "outcome", name: "Outcome", start: 8.01, end: 10, activeLayers: [] },
  ],
};

describe("Tactical Board renderer", () => {
  it("renders a deterministic standalone SVG snapshot", () => {
    const svg = renderTacticalBoardSvgMarkup(scene, {
      title: "Salida & progresion",
      time: 5,
      activeLayers: { press: false },
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("Salida &amp; progresion");
    expect(svg).toContain("data-board-layer=\"pitch\"");
    expect(svg).toContain("data-board-id=\"own-9\"");
    expect(svg).toContain("Tercer hombre");
    expect(svg).toContain("Espalda pivote");
    expect(svg).not.toContain("hidden-press");
  });

  it("interpolates actor and ball positions without requiring the viewer", () => {
    expect(getBoardActorPositions(scene, 5)["own-9"]).toEqual({ x: 50, y: 45 });
    expect(getBoardBallPosition(scene, 5)).toEqual({ x: 50, y: 45 });
  });

  it("clamps snapshot time to the scene duration", () => {
    expect(getBoardActorPositions(scene, 99)["own-9"]).toEqual({ x: 60, y: 40 });
  });
});

describe("Tactical Board export helpers", () => {
  it("builds stable filenames", () => {
    expect(slugifyBoardFilenamePart("Presion tras pérdida!")).toBe(
      "presion-tras-perdida",
    );
    expect(
      buildBoardFilename({
        title: "Presion tras pérdida",
        date: "2026-06-16T12:00:00.000Z",
        extension: "png",
      }),
    ).toBe("romboiq-board-presion-tras-perdida-2026-06-16.png");
  });

  it("returns SVG export content and a matching filename", () => {
    const exported = buildBoardSvgExport({
      scene,
      title: "Ataque lado debil",
      date: "2026-06-16",
      time: 5,
    });

    expect(exported.filename).toBe("romboiq-board-ataque-lado-debil-2026-06-16.svg");
    expect(exported.mimeType).toBe("image/svg+xml;charset=utf-8");
    expect(exported.content).toContain("Ataque lado debil");
  });

  it("builds printable briefing HTML with embedded SVG", () => {
    const html = buildBoardBriefingHtml({
      scene,
      title: "Plan vs 4-4-2",
      date: "2026-06-16",
      time: 5,
      coachingPoints: ["Fijar central antes del pase"],
      staffNotes: ["Revisar altura del lateral"],
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("romboiq-board-briefing-plan-vs-4-4-2-2026-06-16.html");
    expect(html).toContain("<svg");
    expect(html).toContain("Fijar central antes del pase");
    expect(html).toContain("Revisar altura del lateral");
  });

  it("builds honest tactical-board print briefings and filters player content", () => {
    const board = createDefaultBoard("Plan interno");
    const scene = board.scenes[0];
    const tacticalBoard = {
      ...board,
      globalInstruction: "Atraer fuera y encontrar tercer hombre",
      sessionCoachingPoints: ["Corregir perfil corporal del pivote"],
      successSignals: ["El 6 recibe de cara"],
      scenes: [
        {
          ...scene,
          notes: "Staff only: ajustar carga si el grupo pierde ritmo.",
          instructions: [
            createInstruction("player", "Para jugadores", "Cerrar intervalo y saltar juntos.", {
              visibility: "player",
            }),
            createInstruction("scene", "Staff", "No mostrar esta nota al plantel.", {
              visibility: "staff",
            }),
          ],
        },
      ],
    };

    const player = buildTacticalBoardBriefingExport(tacticalBoard, "player", "2026-06-16");
    const staff = buildTacticalBoardBriefingExport(tacticalBoard, "staff", "2026-06-16");

    expect(player.filename).toBe("romboiq-board-plan-interno-jugadores-2026-06-16.html");
    expect(player.html).toContain("Briefing imprimible jugadores");
    expect(player.html).toContain("Cerrar intervalo");
    expect(player.html).not.toContain("Staff only");
    expect(player.html).not.toContain("No mostrar esta nota");
    expect(staff.filename).toBe("romboiq-board-plan-interno-staff-2026-06-16.html");
    expect(staff.html).toContain("Briefing imprimible staff");
    expect(staff.html).toContain("Staff only");
    expect(staff.html).toContain("No mostrar esta nota");
  });
});
