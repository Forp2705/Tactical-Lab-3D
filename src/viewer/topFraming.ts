import type { PitchMode } from "./lib/coords";
import { pitchDimensions } from "./lib/coords";
import type { MatchFrame } from "./lib/matchEngine";
import { worldFromPitch } from "./lib/runtime";

// Logica PURA del encuadre cenital (top). Extraida de Scene3D.tsx para poder
// testearla sin montar R3F. No toca src/viewer/lib/*: consume coords/runtime
// como cualquier otro consumidor.

export type TopFocus = {
  x: number;
  z: number;
  spanX: number;
  spanZ: number;
};

// Margen para que las fichas y sus etiquetas no queden pegadas al borde.
const FOCUS_PADDING = 10;

// Profundidad visible del arco (postes + red) mas alla de la linea de gol.
const GOAL_DEPTH = 2.4;

// Medio ancho de boca del arco reglamentario (~7.32m) con un poco de aire.
const GOAL_HALF_MOUTH = 4;

// Diametro efectivo del chip de top (disco 1.26 + aro 1.46) con respiro para
// que dos numeros vecinos no se toquen.
export const TOP_CHIP_MIN_DIST = 2.7;

// Margen visible permitido mas alla de las lineas al encuadrar: en X cubre
// arco+red, en Z apenas la banda tecnica. Es lo maximo de "fuera de cancha"
// que la camara top puede mostrar (mata las bandas negras).
const VIEW_PAD_X = 4.5;
const VIEW_PAD_Z = 2.5;

function isKeeperRole(role: string) {
  return /gk|arq|port|keeper/i.test(role);
}

// Fondos de cancha (coordenada X world) que deben entrar al encuadre: el
// fondo es contexto obligatorio si hay arquero en escena o si la accion entra
// al ultimo cuarto — sin esto el ejercicio de arquero corta el arco/area a la
// espalda del GK. Donde Pitch3D dibuja arco (+x en todos los modos; -x solo
// en full/small) se suma la profundidad de la red; donde no hay malla igual
// se encuadra hasta la linea de fondo (hay ejercicios hand-authored en half
// con el GK del lado sin arco: el contexto espacial vale igual).
export function relevantGoalSides(
  frame: MatchFrame,
  mode: PitchMode,
): number[] {
  const { length } = pitchDimensions(mode);
  const half = length / 2;
  const hasNegGoalMesh = mode === "full" || mode === "small";
  const negDepth = hasNegGoalMesh ? GOAL_DEPTH : 0.6;
  const sides = new Set<number>();

  const xs: number[] = [];
  for (const pose of frame.actors) {
    const world = worldFromPitch(pose.pos, mode);
    xs.push(world[0]);
    if (!isKeeperRole(pose.actor.role)) continue;
    if (world[0] >= 0) sides.add(half + GOAL_DEPTH);
    else sides.add(-half - negDepth);
  }
  const ballWorld = worldFromPitch(
    { x: frame.ball.pos.x, y: frame.ball.pos.y },
    mode,
  );
  xs.push(ballWorld[0]);

  if (xs.length) {
    if (Math.max(...xs) > half / 2) sides.add(half + GOAL_DEPTH);
    if (Math.min(...xs) < -half / 2) sides.add(-half - negDepth);
  }
  return [...sides];
}

export function getTopFocus(frame: MatchFrame, mode: PitchMode): TopFocus {
  const points = frame.actors.map((pose) => {
    const world = worldFromPitch(pose.pos, mode);
    return { x: world[0], z: world[2] };
  });
  const ballWorld = worldFromPitch(
    { x: frame.ball.pos.x, y: frame.ball.pos.y },
    mode,
  );
  points.push({ x: ballWorld[0], z: ballWorld[2] });

  if (points.length === 0) return { x: 0, z: 0, spanX: 40, spanZ: 26 };

  // El arco relevante entra a los bounds: sin esto, un ejercicio de arquero
  // encuadra el bloque y corta el arco (contexto tactico principal).
  for (const goalX of relevantGoalSides(frame, mode)) {
    points.push({ x: goalX, z: -GOAL_HALF_MOUTH }, { x: goalX, z: GOAL_HALF_MOUTH });
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const { length, width } = pitchDimensions(mode);

  return {
    x: clamp((minX + maxX) / 2, -length / 2, length / 2),
    z: clamp((minZ + maxZ) / 2, -width / 2, width / 2),
    spanX: Math.max(6, maxX - minX) + FOCUS_PADDING,
    spanZ: Math.max(6, maxZ - minZ) + FOCUS_PADDING,
  };
}

export type TopView = {
  zoom: number;
  x: number;
  z: number;
};

// Zoom de fit de la accion + dos garantias anti-letterbox:
// 1) piso de zoom: la ventana visible nunca excede cancha+margen (sin bandas
//    negras arriba/abajo ni a los costados);
// 2) clamp del centro: el rect visible se corre para quedar dentro de
//    cancha+margen aunque la accion este pegada a una linea.
export function computeTopView(
  focus: TopFocus,
  size: { width: number; height: number },
  mode: PitchMode,
): TopView {
  const { length, width } = pitchDimensions(mode);
  const spanX = Math.max(8, focus.spanX);
  const spanZ = Math.max(8, focus.spanZ);
  const fit = Math.min(
    (size.width * 0.82) / spanX,
    (size.height * 0.8) / spanZ,
  );
  const noBandsFloor = Math.max(
    size.height / (width + VIEW_PAD_Z * 2),
    size.width / (length + VIEW_PAD_X * 2),
  );
  const zoom = clamp(
    Math.max(fit, noBandsFloor),
    Math.max(9, noBandsFloor),
    Math.max(40, noBandsFloor),
  );
  const halfViewW = size.width / (2 * zoom);
  const halfViewH = size.height / (2 * zoom);
  return {
    zoom,
    x: clampCenter(focus.x, halfViewW, length / 2 + VIEW_PAD_X),
    z: clampCenter(focus.z, halfViewH, width / 2 + VIEW_PAD_Z),
  };
}

function clampCenter(value: number, halfView: number, halfWorld: number) {
  const limit = halfWorld - halfView;
  if (limit <= 0) return 0;
  return clamp(value, -limit, limit);
}

// Anti-colision de chips en top: los duelos (dos jugadores en el mismo metro)
// se funden en un solo blob ilegible. Relajacion de 2 pasadas que empuja cada
// par mas cerca que minDist simetricamente sobre su vector de separacion.
// SOLO afecta la posicion de render del marcador; el engine no cambia.
export function separateTopMarkers(
  points: { x: number; z: number }[],
  minDist = TOP_CHIP_MIN_DIST,
): { x: number; z: number }[] {
  const out = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x;
        const dz = out[j].z - out[i].z;
        const dist = Math.hypot(dx, dz);
        if (dist >= minDist) continue;
        // Superpuestos exactos: separar sobre X, deterministico.
        const ux = dist > 1e-6 ? dx / dist : 1;
        const uz = dist > 1e-6 ? dz / dist : 0;
        const push = (minDist - dist) / 2;
        out[i].x -= ux * push;
        out[i].z -= uz * push;
        out[j].x += ux * push;
        out[j].z += uz * push;
      }
    }
  }
  return out;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
