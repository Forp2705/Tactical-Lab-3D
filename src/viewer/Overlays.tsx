import type { Overlay } from "@/data";
import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { Euler, type Object3D, Quaternion, Vector3 } from "three";
import type { PitchMode } from "./lib/coords";
import type { MatchFrame } from "./lib/matchEngine";
import { pitchPointToWorld } from "./lib/runtime";

type OverlayProps = {
  overlays: Overlay[];
  mode: PitchMode;
  frame: MatchFrame;
};

const COLORS: Record<Overlay["type"], string> = {
  pass: "#f8d86a",
  run: "#5eead4",
  press: "#ff6b6b",
  dribble: "#7dd3fc",
  cover: "#d1d5db",
  lineBlocked: "#f472b6",
};

// Las lineas tacticas van bien por encima del plano (markers de top viven a
// y~0.15) y se dibujan sin depth-test para que nunca queden tapadas por los
// jugadores en iso/broadcast. Eso garantiza que pase/presion/carrera se lean
// en las tres camaras.
const LINE_Y = 0.36;
const ARC_LIFT = 0.06;
const UP = new Vector3(0, 1, 0);

const LINE_WIDTH: Record<Overlay["type"], number> = {
  pass: 2.6,
  run: 3.2,
  press: 3.4,
  dribble: 2.6,
  cover: 2.4,
  lineBlocked: 3,
};

export function OverlayLayer({ overlays, mode, frame }: OverlayProps) {
  const actorPositions = useMemo(
    () =>
      new Map(frame.actors.map((pose) => [pose.actor.id, pose.pos] as const)),
    [frame.actors],
  );

  return (
    <group>
      {overlays.map((overlay) => {
        const from = resolveOverlayPoint(overlay.from, actorPositions);
        const to = resolveOverlayPoint(overlay.to, actorPositions);
        if (!from || !to) return null;
        const start = pitchPointToWorld(from, mode);
        const end = pitchPointToWorld(to, mode);
        const mid = [
          (start.x + end.x) / 2,
          LINE_Y + ARC_LIFT,
          (start.z + end.z) / 2 + 0.8,
        ] as const;
        const color = COLORS[overlay.type];
        const head = arrowHead(start, end, color);
        return (
          <group key={overlay.id}>
            <Line
              ref={setLineOverlayMaterial}
              points={[
                [start.x, LINE_Y, start.z],
                [mid[0], mid[1], mid[2]],
                [end.x, LINE_Y, end.z],
              ]}
              color={color}
              lineWidth={LINE_WIDTH[overlay.type]}
              dashed={overlay.type === "pass"}
              dashSize={overlay.type === "pass" ? 0.6 : 0}
              gapSize={overlay.type === "pass" ? 0.34 : 0}
              renderOrder={6}
            />
            {head ? (
              <mesh
                position={head.position}
                rotation={head.rotation}
                renderOrder={7}
              >
                <coneGeometry args={[0.46, 1.18, 14]} />
                <meshBasicMaterial
                  color={color}
                  depthTest={false}
                  transparent
                  toneMapped={false}
                />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

type TacticalLineMaterial = {
  depthTest: boolean;
  depthWrite: boolean;
  transparent: boolean;
  toneMapped: boolean;
};

// drei `Line` crea su material internamente; setear `material-*` por props
// crashea en construccion. Lo ajustamos por ref una vez que el material existe:
// asi las lineas se dibujan por encima de los jugadores (sin depth-test) y se
// leen en las tres camaras.
function setLineOverlayMaterial(line: Object3D | null) {
  if (!line) return;
  const material = (line as { material?: TacticalLineMaterial }).material;
  if (!material) return;
  material.depthTest = false;
  material.depthWrite = false;
  material.transparent = true;
  material.toneMapped = false;
}

function arrowHead(
  start: { x: number; z: number },
  end: { x: number; z: number },
  _color: string,
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.6) return null;

  const dir = new Vector3(dx, 0, dz).divideScalar(length);
  const quaternion = new Quaternion().setFromUnitVectors(UP, dir);
  const euler = new Euler().setFromQuaternion(quaternion);
  // El cono apunta a +Y por defecto; tras rotar, su punta queda sobre `dir`.
  // Lo retrocedemos media altura para que la punta caiga justo en `end`.
  const back = 0.59;
  return {
    position: [end.x - dir.x * back, LINE_Y, end.z - dir.z * back] as [
      number,
      number,
      number,
    ],
    rotation: [euler.x, euler.y, euler.z] as [number, number, number],
  };
}

function resolveOverlayPoint(
  endpoint: Overlay["from"],
  actorPositions: ReadonlyMap<string, MatchFrame["actors"][number]["pos"]>,
) {
  if (typeof endpoint !== "string") return endpoint;
  return actorPositions.get(endpoint) ?? null;
}
