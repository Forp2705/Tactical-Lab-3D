import type { Exercise, Layer, Overlay } from "@/data";
import { type MatchFrame, getMatchFrame } from "@/viewer/lib/matchEngine";
import { getActivePhase, getVisibleOverlays } from "@/viewer/lib/runtime";
import { useMemo } from "react";

type ViewerCanvasHudProps = {
  exercise: Exercise;
  time: number;
  cameraMode: "top" | "iso" | "broadcast";
  showZones: boolean;
  showRuns: boolean;
  showPasses: boolean;
  showPress: boolean;
  layers: Record<Layer, boolean>;
  personalSpace?: boolean;
};

export function ViewerCanvasHud({
  exercise,
  time,
  showZones,
  showRuns,
  showPasses,
  showPress,
  layers,
  personalSpace = false,
}: ViewerCanvasHudProps) {
  const phase = useMemo(() => getActivePhase(exercise, time), [exercise, time]);
  const layerState = useMemo(
    () => ({
      ...layers,
      press: layers.press && showPress,
      notes: layers.notes && showZones,
    }),
    [layers, showPress, showZones],
  );
  const frame = useMemo(
    () => getMatchFrame(exercise, time, { personalSpace }),
    [exercise, time, personalSpace],
  );
  const overlays = useMemo(
    () =>
      getVisibleOverlays(exercise, time, layerState).filter((overlay) => {
        if (overlay.type === "run" && !showRuns) return false;
        if (overlay.type === "pass" && !showPasses) return false;
        if (overlay.type === "press" && !showPress) return false;
        return true;
      }),
    [exercise, layerState, showPasses, showPress, showRuns, time],
  );

  const primaryTrigger = frame.triggers[0];
  const activeMovements = overlays
    .slice(0, 4)
    .map((overlay) => describeOverlay(overlay, frame));
  const whyThisMatters =
    primaryTrigger?.description ??
    phase.notes ??
    exercise.coaching[0] ??
    exercise.success;
  const movementText =
    activeMovements[0] ??
    "La fase actual prioriza estructura y orientacion del bloque.";

  // El HUD vive en una franja inferior (lower-third) para no tapar el cluster
  // principal. La lectura de la cancha tiene prioridad sobre el texto.
  return (
    <div className="viewer-hud" aria-hidden>
      <div className="viewer-hud-lower">
        <div className="viewer-hud-callout viewer-hud-why">
          <span className="viewer-hud-kicker">Por que importa</span>
          <b>{exercise.objective.primary}</b>
          <p>{whyThisMatters}</p>
        </div>

        <div className="viewer-hud-callout viewer-hud-intent">
          <span className="viewer-hud-kicker">Intencion del movimiento</span>
          <p>{movementText}</p>
        </div>
      </div>
    </div>
  );
}

function describeOverlay(overlay: Overlay, frame: MatchFrame) {
  const from = actorNameForEndpoint(overlay.from, frame);
  const to = actorNameForEndpoint(overlay.to, frame);
  const verb = overlayVerb(overlay.type);
  const detail = overlay.label ? ` - ${overlay.label}` : "";
  return `${verb}: ${from} -> ${to}${detail}`;
}

function actorNameForEndpoint(endpoint: Overlay["from"], frame: MatchFrame) {
  if (typeof endpoint !== "string") {
    return `zona ${Math.round(endpoint.x)}/${Math.round(endpoint.y)}`;
  }
  const actor = frame.actors.find((pose) => pose.actor.id === endpoint)?.actor;
  if (!actor) return endpoint;
  return `${actor.num} ${actor.role}`;
}

function overlayVerb(type: Overlay["type"]) {
  const labels: Record<Overlay["type"], string> = {
    pass: "Pase objetivo",
    run: "Desmarque",
    press: "Presion",
    dribble: "Conduccion",
    cover: "Cobertura",
    lineBlocked: "Linea cerrada",
  };
  return labels[type];
}
