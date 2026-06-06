import type { Exercise, Layer, Overlay, Zone } from "@/data";
import {
  getActivePhase,
  getVisibleOverlays,
  getVisibleZones,
} from "@/viewer/lib/runtime";
import { getMatchFrame, type MatchFrame } from "@/viewer/lib/matchEngine";
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

type HudActor = {
  id: string;
  label: string;
  x: number;
  y: number;
  tone: "own" | "rival" | "neutral";
};

export function ViewerCanvasHud({
  exercise,
  time,
  cameraMode,
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
  const zones = useMemo(
    () => (showZones ? getVisibleZones(exercise, time, layerState) : []),
    [exercise, layerState, showZones, time],
  );

  const primaryTrigger = frame.triggers[0];
  const activeMovements = overlays
    .slice(0, 4)
    .map((overlay) => describeOverlay(overlay, frame));
  const fieldLabels =
    cameraMode === "top" ? buildFieldLabels(frame, overlays) : [];
  const whyThisMatters =
    primaryTrigger?.description ??
    phase.notes ??
    exercise.coaching[0] ??
    exercise.success;
  const movementText =
    activeMovements[0] ??
    "La fase actual prioriza estructura y orientacion del bloque.";

  return (
    <div className="viewer-hud" aria-hidden>
      <div className="viewer-hud-callout viewer-hud-why">
        <span className="viewer-hud-kicker">Por que importa</span>
        <b>{exercise.objective.primary}</b>
        <p>{whyThisMatters}</p>
      </div>

      <div className="viewer-hud-callout viewer-hud-intent">
        <span className="viewer-hud-kicker">Intencion del movimiento</span>
        <p>{movementText}</p>
      </div>

      {cameraMode === "top"
        ? zones.slice(0, 3).map((zone) => <ZoneBadge key={zone.id} zone={zone} />)
        : null}

      {cameraMode === "top"
        ? fieldLabels.map((actor) => (
            <div
              key={actor.id}
              className={`viewer-field-label ${actor.tone}`}
              style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
            >
              {actor.label}
            </div>
          ))
        : null}
    </div>
  );
}

function ZoneBadge({ zone }: { zone: Zone }) {
  return (
    <div
      className="viewer-zone-badge"
      style={{
        left: `${zone.rect.x + zone.rect.w / 2}%`,
        top: `${zone.rect.y + zone.rect.h / 2}%`,
        borderColor: zone.color,
        boxShadow: `0 0 0 1px ${zone.color}22`,
      }}
    >
      {zone.label}
    </div>
  );
}

function buildFieldLabels(frame: MatchFrame, overlays: Overlay[]): HudActor[] {
  const highlightedIds = new Set<string>();
  for (const overlay of overlays) {
    if (typeof overlay.from === "string") highlightedIds.add(overlay.from);
    if (typeof overlay.to === "string") highlightedIds.add(overlay.to);
  }

  return frame.actors
    .filter(
      (pose) =>
        pose.hasBall ||
        highlightedIds.has(pose.actor.id) ||
        pose.actor.team === "own",
    )
    .slice(0, 12)
    .map((pose) => ({
      id: pose.actor.id,
      label: `${pose.actor.num} ${pose.actor.role}`,
      x: clampPercent(pose.pos.x),
      y: clampPercent(pose.pos.y),
      tone:
        pose.actor.team === "own"
          ? "own"
          : pose.actor.team === "rival"
            ? "rival"
            : "neutral",
    }));
}

function describeOverlay(overlay: Overlay, frame: MatchFrame) {
  const from = actorNameForEndpoint(overlay.from, frame);
  const to = actorNameForEndpoint(overlay.to, frame);
  const verb = overlayVerb(overlay.type);
  const detail = overlay.label ? ` - ${overlay.label}` : "";
  return `${verb}: ${from} -> ${to}${detail}`;
}

function actorNameForEndpoint(
  endpoint: Overlay["from"],
  frame: MatchFrame,
) {
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

function clampPercent(value: number) {
  return Math.max(6, Math.min(94, value));
}
