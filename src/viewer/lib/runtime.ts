import type { Exercise, Layer, Vec2 } from "@/data";
import { type PitchMode, pitchToWorld } from "./coords";

export function getActivePhase(exercise: Exercise, time: number) {
  return (
    exercise.scene.phases.find(
      (phase) => time >= phase.start && time <= phase.end,
    ) ?? exercise.scene.phases[0]
  );
}

export function getVisibleOverlays(
  exercise: Exercise,
  time: number,
  layers: Record<Layer, boolean>,
) {
  const executionStart =
    exercise.scene.phases.find((phase) => phase.id === "execution")?.start ?? 0;
  if (time < executionStart) return [];

  return exercise.scene.overlays.filter((overlay) => {
    if (time < overlay.start || time > overlay.end + 0.5) return false;
    return layers[overlay.layer];
  });
}

export function getVisibleZones(
  exercise: Exercise,
  time: number,
  layers?: Record<Layer, boolean>,
) {
  const phase = getActivePhase(exercise, time);
  return exercise.scene.zones.filter((zone) => {
    if (layers && !layers[zone.layer]) return false;
    return zone.visibleInPhases.length === 0
      ? true
      : zone.visibleInPhases.includes(phase.id);
  });
}

export function pitchPointToWorld(point: Vec2, mode: PitchMode) {
  return pitchToWorld(point, mode);
}

export function worldFromPitch(point: Vec2, mode: PitchMode) {
  const world = pitchToWorld(point, mode);
  return [world.x, 0, world.z] as const;
}
