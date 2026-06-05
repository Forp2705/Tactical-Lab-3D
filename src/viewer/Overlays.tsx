import { Line } from "@react-three/drei";
import { useMemo } from "react";
import type { Overlay } from "@/data";
import { pitchPointToWorld } from "./lib/runtime";
import type { PitchMode } from "./lib/coords";
import type { MatchFrame } from "./lib/matchEngine";

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
        const mid = [(start.x + end.x) / 2, 0.12, (start.z + end.z) / 2 + 0.8] as const;
        return (
          <group key={overlay.id}>
            <Line
              points={[
                [start.x, 0.12, start.z],
                [mid[0], 0.16, mid[2]],
                [end.x, 0.12, end.z],
              ]}
              color={COLORS[overlay.type]}
              lineWidth={1}
              dashed={overlay.type === "pass"}
              dashSize={overlay.type === "pass" ? 0.35 : 0}
              gapSize={overlay.type === "pass" ? 0.22 : 0}
            />
            {overlay.label ? (
              <mesh position={mid}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshBasicMaterial color={COLORS[overlay.type]} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function resolveOverlayPoint(
  endpoint: Overlay["from"],
  actorPositions: ReadonlyMap<string, MatchFrame["actors"][number]["pos"]>,
) {
  if (typeof endpoint !== "string") return endpoint;
  return actorPositions.get(endpoint) ?? null;
}
