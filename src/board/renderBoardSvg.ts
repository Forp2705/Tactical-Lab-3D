import type { Actor, Ball, Layer, Overlay, Scene, Vec2, Zone } from "@/data";
import type { PitchMode } from "@/viewer/lib/coords";

export const BOARD_VIEWBOX_WIDTH = 100;
export const BOARD_VIEWBOX_HEIGHT = 64;

const TEAM_COLORS: Record<Actor["team"], string> = {
  own: "#5eead4",
  rival: "#f87171",
  neutral: "#e5e7eb",
};

const OVERLAY_COLORS: Record<Overlay["type"], string> = {
  pass: "#f8d86a",
  run: "#5eead4",
  press: "#ff6b6b",
  dribble: "#7dd3fc",
  cover: "#d1d5db",
  lineBlocked: "#f472b6",
};

const OVERLAY_DASH: Partial<Record<Overlay["type"], string>> = {
  pass: "1.2 0.9",
  press: "0.8 0.8",
  cover: "2 1.2",
  lineBlocked: "1.8 0.8",
};

export type TacticalBoardSvgOptions = {
  title?: string;
  time?: number;
  activeLayers?: Partial<Record<Layer, boolean>>;
  showZones?: boolean;
  showOverlays?: boolean;
  showPaths?: boolean;
  showLabels?: boolean;
  className?: string;
};

type ActorPose = {
  actor: Actor;
  pos: Vec2;
};

export function renderTacticalBoardSvgMarkup(
  scene: Scene,
  options: TacticalBoardSvgOptions = {},
): string {
  const time = clampTime(options.time ?? 0, scene.duration);
  const title = options.title ?? "Tactical board";
  const showZones = options.showZones ?? true;
  const showOverlays = options.showOverlays ?? true;
  const showPaths = options.showPaths ?? true;
  const showLabels = options.showLabels ?? true;
  const className = options.className
    ? ` class="${escapeXml(options.className)}"`
    : "";
  const poses = scene.actors.map((actor) => ({
    actor,
    pos: actorPositionAt(actor, time),
  }));
  const actorMap = new Map(
    poses.map((pose) => [pose.actor.id, pose.pos] as const),
  );
  const ball = ballPositionAt(scene.ball, time, actorMap);
  const phaseId = phaseAt(scene, time);
  const visibleZones = showZones
    ? scene.zones.filter((zone) =>
        isZoneVisible(zone, phaseId, options.activeLayers),
      )
    : [];
  const visibleOverlays = showOverlays
    ? scene.overlays.filter((overlay) =>
        isOverlayVisible(overlay, time, options.activeLayers),
      )
    : [];

  return `<svg${className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_VIEWBOX_WIDTH} ${BOARD_VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(
    title,
  )}">
  <title>${escapeXml(title)}</title>
  <desc>${escapeXml(
    `Board snapshot at ${time.toFixed(1)} seconds, pitch mode ${scene.pitchMode}.`,
  )}</desc>
  <defs>
    <marker id="board-arrowhead" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="context-stroke" />
    </marker>
    <filter id="board-token-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0.45" stdDeviation="0.45" flood-color="#020617" flood-opacity="0.45" />
    </filter>
  </defs>
  ${renderPitch(scene.pitchMode)}
  ${visibleZones.map(renderZone).join("")}
  ${showPaths ? poses.map(renderActorPath).join("") : ""}
  ${visibleOverlays
    .map((overlay) => renderOverlay(overlay, actorMap, showLabels))
    .join("")}
  ${renderBall(ball)}
  ${poses.map((pose) => renderActor(pose, showLabels)).join("")}
</svg>`;
}

export function getBoardActorPositions(
  scene: Scene,
  time = 0,
): Record<string, Vec2> {
  const t = clampTime(time, scene.duration);
  return Object.fromEntries(
    scene.actors.map((actor) => [actor.id, actorPositionAt(actor, t)]),
  );
}

export function getBoardBallPosition(scene: Scene, time = 0): Vec2 {
  const t = clampTime(time, scene.duration);
  const actors = new Map(
    scene.actors.map((actor) => [actor.id, actorPositionAt(actor, t)] as const),
  );
  return ballPositionAt(scene.ball, t, actors);
}

function renderPitch(mode: PitchMode): string {
  const goalDepth = 2.3;
  return `<g data-board-layer="pitch">
    <rect x="0" y="0" width="${BOARD_VIEWBOX_WIDTH}" height="${BOARD_VIEWBOX_HEIGHT}" rx="1.2" fill="#0f3f2d" />
    <path d="M0 0H100V64H0Z" fill="none" stroke="#d7f5df" stroke-width="0.45" />
    <line x1="50" y1="0" x2="50" y2="64" stroke="#d7f5df" stroke-width="0.32" opacity="0.82" />
    <circle cx="50" cy="32" r="7.1" fill="none" stroke="#d7f5df" stroke-width="0.32" opacity="0.82" />
    <circle cx="50" cy="32" r="0.45" fill="#d7f5df" opacity="0.82" />
    <rect x="0" y="18.2" width="15.7" height="27.6" fill="none" stroke="#d7f5df" stroke-width="0.32" opacity="0.82" />
    <rect x="84.3" y="18.2" width="15.7" height="27.6" fill="none" stroke="#d7f5df" stroke-width="0.32" opacity="0.82" />
    <rect x="0" y="25.4" width="5.2" height="13.2" fill="none" stroke="#d7f5df" stroke-width="0.28" opacity="0.82" />
    <rect x="94.8" y="25.4" width="5.2" height="13.2" fill="none" stroke="#d7f5df" stroke-width="0.28" opacity="0.82" />
    <path d="M0 ${32 - goalDepth}h-1.4v${goalDepth * 2}H0" fill="none" stroke="#d7f5df" stroke-width="0.28" opacity="0.7" />
    <path d="M100 ${32 - goalDepth}h1.4v${goalDepth * 2}H100" fill="none" stroke="#d7f5df" stroke-width="0.28" opacity="0.7" />
    <text x="97.8" y="61.8" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="2.1" fill="#d7f5df" opacity="0.52">${escapeXml(
      mode,
    )}</text>
  </g>`;
}

function renderZone(zone: Zone): string {
  const rect = normalizeRect(zone.rect);
  const color = sanitizeColor(zone.color, "#c7df5f");
  return `<g data-board-layer="zone" data-board-id="${escapeXml(zone.id)}">
    <rect x="${x(rect.x)}" y="${y(rect.y)}" width="${x(rect.w)}" height="${y(rect.h)}" rx="1.2" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="0.45" stroke-dasharray="1.5 1" />
    <text x="${x(rect.x + rect.w / 2)}" y="${y(rect.y + rect.h / 2)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="2.1" font-weight="700" fill="${color}">${escapeXml(
      zone.label,
    )}</text>
  </g>`;
}

function renderActorPath({ actor }: ActorPose): string {
  if (!actor.path.length) return "";
  const color = TEAM_COLORS[actor.team];
  const points = [actor.start, ...actor.path.map((frame) => frame.pos)];
  const d = points
    .map(
      (point, index) => `${index === 0 ? "M" : "L"}${x(point.x)} ${y(point.y)}`,
    )
    .join(" ");
  return `<path data-board-layer="actor-path" data-board-id="${escapeXml(
    actor.id,
  )}" d="${d}" fill="none" stroke="${color}" stroke-width="0.34" stroke-opacity="0.38" stroke-dasharray="1 1" />`;
}

function renderOverlay(
  overlay: Overlay,
  actorMap: ReadonlyMap<string, Vec2>,
  showLabels: boolean,
): string {
  const from = resolvePoint(overlay.from, actorMap);
  const to = resolvePoint(overlay.to, actorMap);
  if (!from || !to) return "";
  const color = OVERLAY_COLORS[overlay.type];
  const dash = OVERLAY_DASH[overlay.type]
    ? ` stroke-dasharray="${OVERLAY_DASH[overlay.type]}"`
    : "";
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return `<g data-board-layer="overlay" data-board-id="${escapeXml(overlay.id)}">
    <line x1="${x(from.x)}" y1="${y(from.y)}" x2="${x(to.x)}" y2="${y(to.y)}" stroke="${color}" stroke-width="0.78" stroke-linecap="round"${dash} marker-end="url(#board-arrowhead)" />
    ${
      showLabels && overlay.label
        ? `<text x="${x(mid.x)}" y="${y(mid.y - 2.2)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="2.1" font-weight="700" fill="${color}">${escapeXml(
            overlay.label,
          )}</text>`
        : ""
    }
  </g>`;
}

function renderBall(pos: Vec2): string {
  return `<g data-board-layer="ball">
    <circle cx="${x(pos.x)}" cy="${y(pos.y)}" r="1.05" fill="#f8fafc" stroke="#0f172a" stroke-width="0.32" />
    <path d="M${x(pos.x) - 0.55} ${y(pos.y)}h1.1M${x(pos.x)} ${
      y(pos.y) - 0.55
    }v1.1" stroke="#0f172a" stroke-width="0.18" stroke-linecap="round" opacity="0.72" />
  </g>`;
}

function renderActor({ actor, pos }: ActorPose, showLabels: boolean): string {
  const color = TEAM_COLORS[actor.team];
  const textColor = actor.team === "neutral" ? "#0f172a" : "#031018";
  return `<g data-board-layer="actor" data-board-id="${escapeXml(actor.id)}" filter="url(#board-token-shadow)">
    <circle cx="${x(pos.x)}" cy="${y(pos.y)}" r="2.35" fill="${color}" stroke="#eff7fa" stroke-width="0.38" />
    <text x="${x(pos.x)}" y="${y(pos.y) + 0.78}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="2.6" font-weight="800" fill="${textColor}">${actor.num}</text>
    ${
      showLabels
        ? `<text x="${x(pos.x)}" y="${y(pos.y) + 5.1}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="1.85" font-weight="700" fill="#eff7fa">${escapeXml(
            actor.role,
          )}</text>`
        : ""
    }
  </g>`;
}

function actorPositionAt(actor: Actor, time: number): Vec2 {
  const frames = actor.path
    .slice()
    .sort((a, b) => a.t - b.t)
    .filter((frame) => frame.t >= 0);
  if (!frames.length || time <= frames[0].t) {
    return frames.length
      ? interpolateVec2(
          actor.start,
          frames[0].pos,
          frames[0].t ? time / frames[0].t : 1,
        )
      : actor.start;
  }

  for (let index = 1; index < frames.length; index += 1) {
    const prev = frames[index - 1];
    const next = frames[index];
    if (time <= next.t) {
      const span = Math.max(0.001, next.t - prev.t);
      return interpolateVec2(prev.pos, next.pos, (time - prev.t) / span);
    }
  }

  return frames.at(-1)?.pos ?? actor.start;
}

function ballPositionAt(
  ball: Ball,
  time: number,
  actorMap: ReadonlyMap<string, Vec2>,
): Vec2 {
  if (ball.carrier) {
    const carrier = actorMap.get(ball.carrier);
    if (carrier) return carrier;
  }

  const frames = ball.path
    .slice()
    .sort((a, b) => a.t - b.t)
    .filter((frame) => frame.t >= 0);
  const start = { x: ball.start.x, y: ball.start.y };
  if (!frames.length || time <= frames[0].t) {
    if (frames[0]?.carrier) {
      const carrier = actorMap.get(frames[0].carrier);
      if (carrier) return carrier;
    }
    return frames.length
      ? interpolateVec2(
          start,
          frames[0].pos,
          frames[0].t ? time / frames[0].t : 1,
        )
      : start;
  }

  for (let index = 1; index < frames.length; index += 1) {
    const prev = frames[index - 1];
    const next = frames[index];
    if (time <= next.t) {
      if (next.carrier) {
        const carrier = actorMap.get(next.carrier);
        if (carrier) return carrier;
      }
      const span = Math.max(0.001, next.t - prev.t);
      return interpolateVec2(prev.pos, next.pos, (time - prev.t) / span);
    }
  }

  const last = frames.at(-1);
  if (last?.carrier) {
    const carrier = actorMap.get(last.carrier);
    if (carrier) return carrier;
  }
  return last?.pos ?? start;
}

function phaseAt(scene: Scene, time: number): string {
  return (
    scene.phases.find((phase) => time >= phase.start && time <= phase.end)
      ?.id ??
    scene.phases[0]?.id ??
    "setup"
  );
}

function isZoneVisible(
  zone: Zone,
  phaseId: string,
  activeLayers?: Partial<Record<Layer, boolean>>,
): boolean {
  if (activeLayers?.[zone.layer] === false) return false;
  return (
    zone.visibleInPhases.length === 0 || zone.visibleInPhases.includes(phaseId)
  );
}

function isOverlayVisible(
  overlay: Overlay,
  time: number,
  activeLayers?: Partial<Record<Layer, boolean>>,
): boolean {
  if (activeLayers?.[overlay.layer] === false) return false;
  return time >= overlay.start && time <= overlay.end + 0.5;
}

function resolvePoint(
  endpoint: Overlay["from"],
  actorMap: ReadonlyMap<string, Vec2>,
): Vec2 | null {
  return typeof endpoint === "string"
    ? (actorMap.get(endpoint) ?? null)
    : endpoint;
}

function interpolateVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  const p = Math.max(0, Math.min(1, t));
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
  };
}

function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.min(duration, time));
}

function normalizeRect(rect: Zone["rect"]): Zone["rect"] {
  return {
    x: Math.max(0, Math.min(100, rect.x)),
    y: Math.max(0, Math.min(100, rect.y)),
    w: Math.max(0, Math.min(100 - rect.x, rect.w)),
    h: Math.max(0, Math.min(100 - rect.y, rect.h)),
  };
}

function x(value: number): number {
  return (
    Math.round(
      (Math.max(0, Math.min(100, value)) / 100) * BOARD_VIEWBOX_WIDTH * 100,
    ) / 100
  );
}

function y(value: number): number {
  return (
    Math.round(
      (Math.max(0, Math.min(100, value)) / 100) * BOARD_VIEWBOX_HEIGHT * 100,
    ) / 100
  );
}

function sanitizeColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  if (/^rgba?\([\d\s.,%]+\)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]+$/i.test(trimmed)) return trimmed;
  return fallback;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
