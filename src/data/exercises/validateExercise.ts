import type { Actor, Exercise, Overlay, Vec2 } from "../schemas.js";

// Auditoria deterministica de la calidad logica de un ejercicio. Pura: sin LLM,
// sin fecha, sin random. Misma entrada -> misma salida. La idea es detectar
// ejercicios incoherentes (ej: "presion al arquero" sin arquero) antes de que
// lleguen a Quick Start / diagnostico, NO maquillarlos desde el viewer.

export type ValidationSeverity = "error" | "warning";

export type ValidationTag =
  | "broken-ref"
  | "missing-metadata"
  | "missing-opposition"
  | "missing-gk"
  | "gk-out-of-area"
  | "ball-far-from-target"
  | "no-pressure-to-target"
  | "pressure-inverted"
  | "no-intent";

export type ValidationIssue = {
  severity: ValidationSeverity;
  tag: ValidationTag;
  message: string;
  ref?: string;
};

export type ExerciseValidation = {
  exerciseId: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  score: number;
  tags: ValidationTag[];
  critical: boolean;
};

const ERROR_WEIGHT = 25;
const WARNING_WEIGHT = 8;
const BALL_NEAR_DISTANCE = 14;

export function validateExercise(exercise: Exercise): ExerciseValidation {
  const actorById = new Map(
    exercise.scene.actors.map((actor) => [actor.id, actor] as const),
  );
  const issues: ValidationIssue[] = [];

  issues.push(...checkReferences(exercise, actorById));
  issues.push(...checkMetadata(exercise));

  const text = normalize(
    [
      exercise.title,
      exercise.principle,
      exercise.objective.primary,
      exercise.objective.secondary ?? "",
    ].join(" "),
  );

  if (mentionsKeeper(text)) {
    issues.push(...checkKeeperPressing(exercise, actorById));
  }
  if (isPressingExercise(exercise, text)) {
    issues.push(...checkPressing(exercise, actorById));
  }

  return summarize(exercise.id, issues);
}

function checkReferences(
  exercise: Exercise,
  actorById: ReadonlyMap<string, Actor>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const overlayIds = new Set(
    exercise.scene.overlays.map((overlay) => overlay.id),
  );

  const requireActor = (id: string, where: string) => {
    if (!actorById.has(id)) {
      issues.push({
        severity: "error",
        tag: "broken-ref",
        message: `${where} apunta a un actor inexistente: ${id}`,
        ref: id,
      });
    }
  };

  for (const overlay of exercise.scene.overlays) {
    if (typeof overlay.from === "string") {
      requireActor(overlay.from, `overlay ${overlay.id}.from`);
    }
    if (typeof overlay.to === "string") {
      requireActor(overlay.to, `overlay ${overlay.id}.to`);
    }
  }

  for (const trigger of exercise.scene.triggers) {
    requireActor(trigger.cause.actorId, `trigger ${trigger.id}.cause.actorId`);
    for (const overlayId of trigger.activatesOverlays) {
      if (!overlayIds.has(overlayId)) {
        issues.push({
          severity: "error",
          tag: "broken-ref",
          message: `trigger ${trigger.id} activa un overlay inexistente: ${overlayId}`,
          ref: overlayId,
        });
      }
    }
  }

  const ball = exercise.scene.ball;
  if (ball.carrier) requireActor(ball.carrier, "ball.carrier");
  for (const point of ball.path) {
    if (point.carrier) requireActor(point.carrier, "ball.path.carrier");
  }

  return issues;
}

function checkMetadata(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!exercise.objective.primary.trim()) {
    issues.push({
      severity: "error",
      tag: "missing-metadata",
      message: "objective.primary vacio",
    });
  }
  if (exercise.scene.actors.length === 0) {
    issues.push({
      severity: "error",
      tag: "missing-metadata",
      message: "el ejercicio no tiene actores",
    });
  }
  if (
    exercise.players.min <= 0 ||
    exercise.players.min > exercise.players.max
  ) {
    issues.push({
      severity: "error",
      tag: "missing-metadata",
      message: `rango de jugadores invalido: ${exercise.players.min}-${exercise.players.max}`,
    });
  }
  if (!exercise.success.trim()) {
    issues.push({
      severity: "warning",
      tag: "missing-metadata",
      message: "no hay senal de exito (success)",
    });
  }
  if (exercise.coaching.filter((point) => point.trim()).length < 2) {
    issues.push({
      severity: "warning",
      tag: "missing-metadata",
      message: "menos de 2 coaching points utiles",
    });
  }

  return issues;
}

// Reglas para ejercicios cuyo titulo/principio habla de arquero/portero.
function checkKeeperPressing(
  exercise: Exercise,
  actorById: ReadonlyMap<string, Actor>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keeper = exercise.scene.actors.find((actor) =>
    isKeeperRole(actor.role),
  );

  if (!keeper) {
    issues.push({
      severity: "error",
      tag: "missing-gk",
      message:
        "el ejercicio habla de arquero pero no hay ningun actor con rol GK/arquero",
    });
    return issues;
  }

  if (!inKeeperZone(keeper.start)) {
    issues.push({
      severity: "warning",
      tag: "gk-out-of-area",
      message: `el arquero arranca fuera de zona logica de arco/area (${keeper.start.x}/${keeper.start.y})`,
      ref: keeper.id,
    });
  }

  const ballPoints = [
    exercise.scene.ball.start,
    ...exercise.scene.ball.path.map((point) => point.pos),
  ];
  const ballReachesKeeper = ballPoints.some(
    (point) => distance(point, keeper.start) <= BALL_NEAR_DISTANCE,
  );
  if (!ballReachesKeeper) {
    issues.push({
      severity: "warning",
      tag: "ball-far-from-target",
      message: "la pelota nunca inicia ni llega cerca del arquero",
    });
  }

  const pressesKeeperSide = exercise.scene.overlays.some(
    (overlay) =>
      overlay.type === "press" &&
      typeof overlay.to === "string" &&
      (overlay.to === keeper.id ||
        actorById.get(overlay.to)?.team === keeper.team),
  );
  if (!pressesKeeperSide) {
    issues.push({
      severity: "error",
      tag: "no-pressure-to-target",
      message: "no hay presion dirigida al arquero ni a su linea de salida",
    });
  }

  const hasIntent =
    exercise.scene.overlays.some((overlay) => overlay.type === "press") ||
    exercise.scene.triggers.some((trigger) =>
      ["backPass", "receiveBack", "cbCarry"].includes(trigger.cause.action),
    );
  if (!hasIntent) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message:
        "no hay overlay de presion ni trigger de pase atras que represente la intencion",
    });
  }

  return issues;
}

// Reglas para ejercicios de pressing en general (con o sin arquero).
function checkPressing(
  exercise: Exercise,
  actorById: ReadonlyMap<string, Actor>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const teams = new Set(exercise.scene.actors.map((actor) => actor.team));

  if (!(teams.has("own") && teams.has("rival"))) {
    issues.push({
      severity: "error",
      tag: "missing-opposition",
      message: "un ejercicio de pressing necesita equipo propio y rival",
    });
  }

  const pressOverlays = exercise.scene.overlays.filter(
    (overlay) =>
      overlay.type === "press" &&
      typeof overlay.from === "string" &&
      typeof overlay.to === "string",
  );
  if (
    pressOverlays.length > 0 &&
    !pressOverlays.some((overlay) => isCrossTeamPress(overlay, actorById))
  ) {
    issues.push({
      severity: "error",
      tag: "pressure-inverted",
      message:
        "toda la presion va contra companeros del mismo equipo (presion invertida)",
    });
  }

  const hasCoherentMovement =
    exercise.scene.overlays.some((overlay) =>
      ["press", "cover", "lineBlocked"].includes(overlay.type),
    ) || exercise.scene.triggers.length > 0;
  if (!hasCoherentMovement) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message: "no hay overlay de presion/cobertura ni trigger que la dispare",
    });
  }

  return issues;
}

function isCrossTeamPress(
  overlay: Overlay,
  actorById: ReadonlyMap<string, Actor>,
): boolean {
  if (typeof overlay.from !== "string" || typeof overlay.to !== "string") {
    return false;
  }
  const fromTeam = actorById.get(overlay.from)?.team;
  const toTeam = actorById.get(overlay.to)?.team;
  return Boolean(fromTeam && toTeam && fromTeam !== toTeam);
}

function summarize(
  exerciseId: string,
  issues: ValidationIssue[],
): ExerciseValidation {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const rawScore =
    100 - errors.length * ERROR_WEIGHT - warnings.length * WARNING_WEIGHT;
  const score = Math.max(0, Math.min(100, rawScore));
  const tags = [...new Set(issues.map((issue) => issue.tag))];

  return {
    exerciseId,
    errors,
    warnings,
    score,
    tags,
    critical: errors.length > 0,
  };
}

function mentionsKeeper(normalizedText: string): boolean {
  return /arquero|portero|guardameta/.test(normalizedText);
}

function isPressingExercise(
  exercise: Exercise,
  normalizedText: string,
): boolean {
  const phaseFits =
    exercise.phase === "defenseOrg" || exercise.phase === "transDef";
  const textFits = /presion|salto|acoso|aprie|trigger arquero|recupera/.test(
    normalizedText,
  );
  return phaseFits && textFits;
}

function isKeeperRole(role: string): boolean {
  return /\b(gk|arq|portero|arquero|guardameta)\b/.test(normalize(role));
}

// Arco/area: cerca de cualquiera de las dos lineas de fondo y dentro del ancho
// razonable. Coordenadas de cancha 0-100, independientes del pitchMode.
function inKeeperZone(pos: Vec2): boolean {
  const nearGoalLine = pos.x <= 18 || pos.x >= 82;
  const withinWidth = pos.y >= 20 && pos.y <= 80;
  return nearGoalLine && withinWidth;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
