import { describe, expect, it } from "vitest";
import { pitchDimensions } from "../src/viewer/lib/coords";
import { getMatchFrame } from "../src/viewer/lib/matchEngine";
import {
  TOP_CHIP_MIN_DIST,
  computeTopView,
  getTopFocus,
  relevantGoalSides,
  separateTopMarkers,
} from "../src/viewer/topFraming";
import { catalog } from "../src/data/exercises/catalog";
import type { Exercise } from "../src/data/schemas";

// W2 T2: encuadre cenital. Logica pura extraida de Scene3D — estos tests NO
// montan R3F y NO tocan src/viewer/lib/* (coords/matchEngine se consumen como
// caja negra, sus propios tests quedan intactos).

function byId(id: string): Exercise {
  const exercise = catalog.find((item) => item.id === id);
  if (!exercise) throw new Error(`exercise no encontrado: ${id}`);
  return exercise;
}

const CANVAS_SIZES = [
  { width: 1130, height: 630 },
  { width: 1600, height: 900 },
  { width: 900, height: 700 },
];

describe("separateTopMarkers (anti-colision de chips)", () => {
  it("separa un duelo pegado hasta la distancia minima", () => {
    const out = separateTopMarkers([
      { x: 0, z: 0 },
      { x: 0.5, z: 0 },
    ]);
    const dist = Math.hypot(out[1].x - out[0].x, out[1].z - out[0].z);
    expect(dist).toBeGreaterThanOrEqual(TOP_CHIP_MIN_DIST - 1e-9);
    // Empuje simetrico: el punto medio del par no se mueve.
    expect((out[0].x + out[1].x) / 2).toBeCloseTo(0.25, 6);
  });

  it("no toca puntos que ya estan separados", () => {
    const input = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 0, z: 10 },
    ];
    expect(separateTopMarkers(input)).toEqual(input);
  });

  it("es determinista con superpuestos exactos", () => {
    const input = [
      { x: 3, z: 3 },
      { x: 3, z: 3 },
    ];
    const a = separateTopMarkers(input);
    const b = separateTopMarkers(input);
    expect(a).toEqual(b);
    const dist = Math.hypot(a[1].x - a[0].x, a[1].z - a[0].z);
    expect(dist).toBeGreaterThanOrEqual(TOP_CHIP_MIN_DIST - 1e-9);
  });

  it("no muta la entrada", () => {
    const input = [
      { x: 0, z: 0 },
      { x: 0.5, z: 0 },
    ];
    separateTopMarkers(input);
    expect(input[1]).toEqual({ x: 0.5, z: 0 });
  });
});

describe("relevantGoalSides + getTopFocus (arco en el encuadre)", () => {
  it("con arquero en escena, el arco de su lado entra a los bounds", () => {
    const exercise = byId("pressing-portero-recibe");
    const frame = getMatchFrame(exercise, 3);
    const hasKeeper = frame.actors.some((pose) =>
      /gk|arq|port|keeper/i.test(pose.actor.role),
    );
    expect(hasKeeper).toBe(true);

    const sides = relevantGoalSides(frame, exercise.scene.pitchMode);
    expect(sides.length).toBeGreaterThanOrEqual(1);

    const { length } = pitchDimensions(exercise.scene.pitchMode);
    const focus = getTopFocus(frame, exercise.scene.pitchMode);
    // El encuadre debe cubrir hasta el fondo del arco relevante.
    for (const goalX of sides) {
      const reach = Math.abs(goalX - focus.x) + 5; // 5 = FOCUS_PADDING/2
      expect(focus.spanX / 2 + 5).toBeGreaterThanOrEqual(
        Math.min(reach, length / 2),
      );
    }
  });

  it("en half/third el fondo -x se encuadra hasta la linea (sin profundidad de red: Pitch3D no dibuja arco ahi)", () => {
    for (const exercise of catalog) {
      const mode = exercise.scene.pitchMode;
      if (mode !== "half" && mode !== "third") continue;
      const half = pitchDimensions(mode).length / 2;
      const frame = getMatchFrame(exercise, exercise.scene.duration / 2);
      for (const side of relevantGoalSides(frame, mode)) {
        if (side < 0) {
          // linea de fondo + respiro minimo, nunca la profundidad del arco
          expect(side).toBeGreaterThanOrEqual(-half - 0.6 - 1e-9);
        } else {
          expect(side).toBeLessThanOrEqual(half + 2.4 + 1e-9);
        }
      }
    }
  });
});

describe("computeTopView (anti-letterbox)", () => {
  it("la ventana visible nunca excede cancha+margen en ningun ejercicio del catalogo", () => {
    for (const exercise of catalog) {
      const mode = exercise.scene.pitchMode;
      const { length, width } = pitchDimensions(mode);
      for (const t of [0, exercise.scene.duration / 2]) {
        const frame = getMatchFrame(exercise, t);
        const focus = getTopFocus(frame, mode);
        for (const size of CANVAS_SIZES) {
          const view = computeTopView(focus, size, mode);
          const halfViewW = size.width / (2 * view.zoom);
          const halfViewH = size.height / (2 * view.zoom);
          // Bordes visibles dentro de cancha + margen (arco/red incluidos).
          expect(view.x + halfViewW).toBeLessThanOrEqual(length / 2 + 4.5 + 1e-6);
          expect(view.x - halfViewW).toBeGreaterThanOrEqual(-length / 2 - 4.5 - 1e-6);
          expect(view.z + halfViewH).toBeLessThanOrEqual(width / 2 + 2.5 + 1e-6);
          expect(view.z - halfViewH).toBeGreaterThanOrEqual(-width / 2 - 2.5 - 1e-6);
        }
      }
    }
  });

  it("con la accion pegada a una linea, el centro se corre en vez de mostrar negro", () => {
    // Accion en la esquina superior de una cancha full.
    const focus = { x: 50, z: 30, spanX: 12, spanZ: 12 };
    const view = computeTopView(focus, { width: 1130, height: 630 }, "full");
    const { length, width } = pitchDimensions("full");
    const halfViewW = 1130 / (2 * view.zoom);
    const halfViewH = 630 / (2 * view.zoom);
    expect(view.x + halfViewW).toBeLessThanOrEqual(length / 2 + 4.5 + 1e-6);
    expect(view.z + halfViewH).toBeLessThanOrEqual(width / 2 + 2.5 + 1e-6);
  });
});
