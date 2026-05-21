import type { Actor, Exercise, Overlay, Trigger, Vec2, Vec3 } from "@/data";
import { interpolatePath, interpolateVec2, smoothstep } from "./interpolation";

export type EngineActorPose = {
  actor: Actor;
  pos: Vec2;
  prev: Vec2;
  next: Vec2;
  direction: number;
  moving: boolean;
  hasBall: boolean;
  motion: ActorMotion;
};

export type ActorMotion =
  | "Idle"
  | "Walk"
  | "Run"
  | "Sprint"
  | "SlowWalk"
  | "DefensiveIdle"
  | "Pass"
  | "Receive"
  | "Press"
  | "Turn"
  | "Kick"
  | "Slide"
  | "Header"
  | "Celebrate";

export type EngineBallPose = {
  pos: Vec3;
  carrier?: string;
  state: "carried" | "pass" | "dribble" | "loose" | "intercepted";
  actionId?: string;
  interceptedBy?: string;
};

export type MatchFrame = {
  actors: EngineActorPose[];
  ball: EngineBallPose;
  triggers: Trigger[];
};

type Endpoint = {
  pos: Vec2;
  carrier?: string;
  team?: Actor["team"];
};

type Interception = {
  actorId: string;
  pos: Vec2;
  progress: number;
};

export function getMatchFrame(exercise: Exercise, time: number): MatchFrame {
  const actors = applyPersonalSpace(
    exercise.scene.actors.map((actor) => actorPoseAt(actor, time)),
  );
  const ball = getEngineBallPose(exercise, actors, time);

  return {
    actors: actors.map((pose) => ({
      ...pose,
      hasBall: ball.carrier === pose.actor.id,
      motion: classifyActorMotion(exercise, pose, time, ball),
    })),
    ball,
    triggers: getActiveTriggers(exercise, time),
  };
}

function getActiveTriggers(exercise: Exercise, time: number) {
  return exercise.scene.triggers.filter(
    (trigger) => time >= trigger.whenT && time <= trigger.whenT + 1.2,
  );
}

export function actorPoseAt(actor: Actor, time: number): EngineActorPose {
  const { pos, prev, next } = interpolatePath(actor.start, actor.path, time);
  const distance = Math.hypot(next.x - prev.x, next.y - prev.y);

  return {
    actor,
    pos: clampPitchPoint(pos),
    prev,
    next,
    direction: actorDirectionFromPoints(prev, next),
    moving: distance > 0.8,
    hasBall: false,
    motion: distance > 0.8 ? "Run" : "Idle",
  };
}

export function actorDirectionFromPoints(prev: Vec2, next: Vec2) {
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (Math.hypot(dx, dy) < 0.001) return 0;
  return Math.atan2(dy, dx);
}

function getEngineBallPose(
  exercise: Exercise,
  frameActors: EngineActorPose[],
  time: number,
): EngineBallPose {
  const actions = exercise.scene.overlays
    .filter((overlay) => overlay.type === "pass" || overlay.type === "dribble")
    .sort((a, b) => a.start - b.start);

  if (actions.length === 0) return fallbackBallFromPath(exercise, time);

  const active = actions.find(
    (overlay) => time >= overlay.start && time <= overlay.end,
  );
  if (active) {
    return active.type === "dribble"
      ? dribbleBall(exercise, frameActors, active, time)
      : passBall(exercise, frameActors, active, time);
  }

  const previous = actions.filter((overlay) => overlay.end < time).at(-1);
  if (previous) {
    const completed =
      previous.type === "pass"
        ? passBall(exercise, frameActors, previous, previous.end)
        : dribbleBall(exercise, frameActors, previous, previous.end);
    const carrier = completed.interceptedBy ?? completed.carrier;
    const endpoint = carrier
      ? resolveEndpoint(exercise, carrier, time)
      : resolveEndpoint(exercise, previous.to, time);

    if (endpoint) {
      return {
        pos: { ...endpoint.pos, z: 0 },
        carrier: endpoint.carrier,
        state: completed.interceptedBy ? "intercepted" : "carried",
        actionId: previous.id,
        interceptedBy: completed.interceptedBy,
      };
    }
  }

  const next = actions.find((overlay) => time < overlay.start);
  if (next) {
    const endpoint = resolveEndpoint(exercise, next.from, time);
    if (endpoint) {
      return {
        pos: { ...endpoint.pos, z: 0 },
        carrier: endpoint.carrier,
        state: "carried",
        actionId: next.id,
      };
    }
  }

  return fallbackBallFromPath(exercise, time);
}

function passBall(
  exercise: Exercise,
  frameActors: EngineActorPose[],
  action: Overlay,
  time: number,
): EngineBallPose {
  const from = resolveEndpoint(exercise, action.from, action.start);
  const to = resolveEndpoint(exercise, action.to, action.end);
  if (!from || !to) return fallbackBallFromPath(exercise, time);

  const rawT = clamp01(
    (time - action.start) / Math.max(0.001, action.end - action.start),
  );
  const interception = findInterception(frameActors, action, from, to);
  const target = interception?.pos ?? to.pos;
  const distance = distance2d(from.pos, target);
  const targetProgress = interception
    ? Math.max(0.12, interception.progress)
    : 1;
  const localT = interception ? clamp01(rawT / targetProgress) : rawT;
  const travelT = ballTravelT(localT, distance);
  const pos = interpolateVec2(from.pos, target, travelT);
  const lift = ballLift(localT, distance);

  if (interception && rawT >= targetProgress) {
    const carrier = resolveEndpoint(exercise, interception.actorId, time);
    return {
      pos: { ...(carrier?.pos ?? interception.pos), z: 0 },
      carrier: interception.actorId,
      state: "intercepted",
      actionId: action.id,
      interceptedBy: interception.actorId,
    };
  }

  if (!interception && rawT > 0.88 && to.carrier) {
    const carrier = resolveEndpoint(exercise, to.carrier, time);
    return {
      pos: { ...(carrier?.pos ?? to.pos), z: 0 },
      carrier: to.carrier,
      state: "carried",
      actionId: action.id,
    };
  }

  return {
    pos: { ...pos, z: lift },
    carrier: rawT < 0.12 ? from.carrier : undefined,
    state: "pass",
    actionId: action.id,
  };
}

function dribbleBall(
  exercise: Exercise,
  _frameActors: EngineActorPose[],
  action: Overlay,
  time: number,
): EngineBallPose {
  const from = resolveEndpoint(exercise, action.from, action.start);
  const to = resolveEndpoint(exercise, action.to, action.end);
  if (!from || !to) return fallbackBallFromPath(exercise, time);
  const rawT = clamp01(
    (time - action.start) / Math.max(0.001, action.end - action.start),
  );
  const touchT = dribbleTouchT(rawT);
  const carrierEndpoint = from.carrier
    ? resolveEndpoint(exercise, from.carrier, time)
    : null;
  const pos = carrierEndpoint?.pos ?? interpolateVec2(from.pos, to.pos, touchT);

  return {
    pos: { ...pos, z: 0 },
    carrier: from.carrier,
    state: "dribble",
    actionId: action.id,
  };
}

function resolveEndpoint(
  exercise: Exercise,
  endpoint: Overlay["from"],
  time: number,
): Endpoint | null {
  if (typeof endpoint !== "string") return { pos: endpoint };

  const actor = exercise.scene.actors.find((entry) => entry.id === endpoint);
  if (!actor) return null;
  const pose = actorPoseAt(actor, time);
  const touchDistance = pose.moving ? 1.1 : 0.72;

  return {
    pos: clampPitchPoint({
      x: pose.pos.x + Math.cos(pose.direction) * touchDistance,
      y: pose.pos.y + Math.sin(pose.direction) * touchDistance,
    }),
    carrier: endpoint,
    team: actor.team,
  };
}

function findInterception(
  frameActors: EngineActorPose[],
  action: Overlay,
  from: Endpoint,
  to: Endpoint,
): Interception | null {
  if (!from.team) return null;
  const sourceId = typeof action.from === "string" ? action.from : null;
  const targetId = typeof action.to === "string" ? action.to : null;
  const passDistance = distance2d(from.pos, to.pos);
  if (passDistance < 6) return null;

  const candidates = frameActors
    .filter((pose) => pose.actor.id !== sourceId && pose.actor.id !== targetId)
    .filter(
      (pose) => pose.actor.team !== from.team && pose.actor.team !== "neutral",
    )
    .map((pose) => {
      const projection = projectPointOnSegment(pose.pos, from.pos, to.pos);
      return {
        actorId: pose.actor.id,
        pos: projection.point,
        progress: projection.t,
        laneDistance: distance2d(pose.pos, projection.point),
      };
    })
    .filter((entry) => entry.progress > 0.12 && entry.progress < 0.9)
    .filter((entry) => entry.laneDistance < interceptionRadius(passDistance))
    .sort((a, b) => a.progress - b.progress);

  return candidates[0] ?? null;
}

function applyPersonalSpace(actors: EngineActorPose[]) {
  const adjusted = actors.map((pose) => ({ ...pose, pos: { ...pose.pos } }));
  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (let a = 0; a < adjusted.length; a += 1) {
      for (let b = a + 1; b < adjusted.length; b += 1) {
        const first = adjusted[a];
        const second = adjusted[b];
        const minDistance = first.actor.team === second.actor.team ? 2.1 : 1.55;
        const dx = second.pos.x - first.pos.x;
        const dy = second.pos.y - first.pos.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        if (distance >= minDistance) continue;

        const push = (minDistance - distance) * 0.5;
        const ux = dx / distance;
        const uy = dy / distance;
        first.pos = clampPitchPoint({
          x: first.pos.x - ux * push,
          y: first.pos.y - uy * push,
        });
        second.pos = clampPitchPoint({
          x: second.pos.x + ux * push,
          y: second.pos.y + uy * push,
        });
      }
    }
  }

  return adjusted;
}

export function classifyActorMotion(
  exercise: Exercise,
  pose: EngineActorPose,
  time: number,
  ball: EngineBallPose,
): ActorMotion {
  const actorId = pose.actor.id;
  const active = exercise.scene.overlays.filter(
    (overlay) => time >= overlay.start && time <= overlay.end,
  );
  const activePress = active.find(
    (overlay) => overlay.type === "press" && overlay.from === actorId,
  );
  if (activePress) return "Press";

  const activePassFrom = active.find(
    (overlay) => overlay.type === "pass" && overlay.from === actorId,
  );
  if (activePassFrom) {
    const progress =
      (time - activePassFrom.start) /
      Math.max(0.001, activePassFrom.end - activePassFrom.start);
    return progress < 0.48 ? "Pass" : pose.moving ? "Run" : "Idle";
  }

  const activePassTo = active.find(
    (overlay) => overlay.type === "pass" && overlay.to === actorId,
  );
  if (activePassTo) {
    const remaining = activePassTo.end - time;
    return remaining < 0.45 ? "Receive" : pose.moving ? "Run" : "DefensiveIdle";
  }

  const activeDribble = active.find(
    (overlay) => overlay.type === "dribble" && overlay.from === actorId,
  );
  if (activeDribble || ball.carrier === actorId) {
    return pose.moving ? "Run" : "Idle";
  }

  const activeRun = active.find(
    (overlay) => overlay.type === "run" && overlay.from === actorId,
  );
  if (activeRun) return "Sprint";

  const activeCover = active.find(
    (overlay) => overlay.type === "cover" && overlay.from === actorId,
  );
  if (activeCover) return pose.moving ? "Walk" : "DefensiveIdle";

  const speedHint = Math.hypot(
    pose.next.x - pose.prev.x,
    pose.next.y - pose.prev.y,
  );
  if (pose.moving && speedHint > 12) return "Sprint";
  if (pose.moving && speedHint < 4) return "Walk";
  if (pose.moving) return "Run";
  return "Idle";
}

function fallbackBallFromPath(
  exercise: Exercise,
  time: number,
): EngineBallPose {
  const ball = exercise.scene.ball;
  const points = [
    { t: 0, pos: ball.start, carrier: ball.carrier },
    ...ball.path,
  ].sort((a, b) => a.t - b.t);
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (time >= current.t && time <= next.t) {
      const t = smoothstep(
        (time - current.t) / Math.max(0.001, next.t - current.t),
      );
      return {
        pos: {
          x: current.pos.x + (next.pos.x - current.pos.x) * t,
          y: current.pos.y + (next.pos.y - current.pos.y) * t,
          z:
            (current.pos.z ?? 0) +
            ((next.pos.z ?? 0) - (current.pos.z ?? 0)) * t,
        },
        carrier: current.carrier ?? next.carrier,
        state: "loose",
      };
    }
  }

  const last = points.filter((point) => time >= point.t).at(-1) ?? points[0];
  return {
    pos: last.pos,
    carrier: last.carrier,
    state: last.carrier ? "carried" : "loose",
  };
}

function projectPointOnSegment(point: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.001) return { point: a, t: 0 };
  const t = clamp01(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq);

  return {
    point: {
      x: a.x + dx * t,
      y: a.y + dy * t,
    },
    t,
  };
}

function ballTravelT(t: number, distance: number) {
  const clamped = clamp01(t);
  const punch = 1 - (1 - clamped) ** (distance > 26 ? 1.38 : 2.05);
  const settle = smoothstep(clamped);

  return clamp01(punch * 0.72 + settle * 0.28);
}

function dribbleTouchT(t: number) {
  const clamped = clamp01(t);
  const touchPulse = Math.sin(clamped * Math.PI * 4) * 0.018;

  return clamp01(smoothstep(clamped) + touchPulse);
}

function ballLift(t: number, distance: number) {
  if (distance < 18) return Math.sin(Math.PI * clamp01(t)) * 0.18;
  if (distance < 34) return Math.sin(Math.PI * clamp01(t)) * 0.55;
  return Math.sin(Math.PI * clamp01(t)) * 1.05;
}

function interceptionRadius(passDistance: number) {
  if (passDistance < 18) return 1.35;
  if (passDistance < 34) return 1.7;
  return 2.05;
}

function distance2d(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPitchPoint(point: Vec2): Vec2 {
  return {
    x: Math.max(1.5, Math.min(98.5, point.x)),
    y: Math.max(1.5, Math.min(98.5, point.y)),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
