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
  | "no-intent"
  | "role-mismatch"
  | "weak-structure";

export type ExerciseDomain =
  | "buildUp"
  | "pressing"
  | "defensiveTransition"
  | "attack"
  | "defense"
  | "setPieces";

export type ValidationIssue = {
  severity: ValidationSeverity;
  tag: ValidationTag;
  message: string;
  ref?: string;
};

export type ExerciseValidation = {
  exerciseId: string;
  domains: ExerciseDomain[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  score: number;
  tags: ValidationTag[];
  critical: boolean;
};

const BALL_NEAR_DISTANCE = 14;

// Peso de cada problema sobre el score (0-100). Un error descuenta el peso
// completo; un warning, la mitad. Asi el score discrimina calidad en vez de
// quedar binario (100 / roto).
const TAG_WEIGHT: Record<ValidationTag, number> = {
  "broken-ref": 30,
  "missing-metadata": 20,
  "missing-gk": 28,
  "no-pressure-to-target": 22,
  "missing-opposition": 18,
  "pressure-inverted": 26,
  "gk-out-of-area": 10,
  "ball-far-from-target": 8,
  "no-intent": 12,
  "role-mismatch": 14,
  "weak-structure": 10,
};

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

  const domains = resolveDomains(exercise, text);
  for (const domain of domains) {
    issues.push(...DOMAIN_VALIDATORS[domain](exercise, actorById));
  }

  return summarize(exercise.id, domains, issues);
}

// Un ejercicio puede tocar mas de un dominio (ej: salida + ataque). Corremos
// todos los validators aplicables. La deteccion combina fase + palabras clave.
function resolveDomains(exercise: Exercise, text: string): ExerciseDomain[] {
  const domains = new Set<ExerciseDomain>();

  switch (exercise.phase) {
    case "attackOrg": {
      if (/salida|progres|construir|apoyo|tercer hombre|pivote/.test(text)) {
        domains.add("buildUp");
      }
      if (
        /finaliz|ruptura|ataque|amplitud|centro|remate|banda|aislad/.test(text)
      ) {
        domains.add("attack");
      }
      if (domains.size === 0) domains.add("attack");
      break;
    }
    case "defenseOrg": {
      if (mentionsKeeper(text) || /presion|salto|acoso|aprie/.test(text)) {
        domains.add("pressing");
      }
      if (/bloque|bascular|defender|cerrar|proteger|linea|marca/.test(text)) {
        domains.add("defense");
      }
      if (domains.size === 0) domains.add("defense");
      break;
    }
    case "transDef":
      domains.add("defensiveTransition");
      break;
    case "transOff":
      domains.add("attack");
      break;
    case "abpOff":
    case "abpDef":
      domains.add("setPieces");
      break;
  }

  return [...domains];
}

type DomainValidator = (
  exercise: Exercise,
  actorById: ReadonlyMap<string, Actor>,
) => ValidationIssue[];

const DOMAIN_VALIDATORS: Record<ExerciseDomain, DomainValidator> = {
  buildUp: checkBuildUp,
  pressing: checkPressing,
  defensiveTransition: checkDefensiveTransition,
  attack: checkAttack,
  defense: checkDefense,
  setPieces: checkSetPieces,
};

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

// --- Validators por dominio (emiten sobre todo warnings: bajan score y
// discriminan calidad, sin cuarentenar contenido funcional pero generico). ---

function checkBuildUp(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const actors = exercise.scene.actors;

  if (
    !actors.some(
      (actor) =>
        isKeeperRole(actor.role) ||
        isDefenderRole(actor.role) ||
        isPivotRole(actor.role),
    )
  ) {
    issues.push({
      severity: "warning",
      tag: "weak-structure",
      message:
        "salida sin linea baja (arquero/central/pivote) que inicie la construccion",
    });
  }
  if (!exercise.scene.overlays.some((overlay) => overlay.type === "pass")) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message: "salida sin pases que representen la progresion",
    });
  }
  if (!hasTeam(exercise, "rival")) {
    issues.push({
      severity: "warning",
      tag: "missing-opposition",
      message: "salida sin oposicion que justifique la construccion",
    });
  }

  return issues;
}

function checkAttack(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!exercise.scene.actors.some((actor) => isAttackerRole(actor.role))) {
    issues.push({
      severity: "warning",
      tag: "role-mismatch",
      message: "ataque sin perfil de finalizacion/extremo en escena",
    });
  }
  const hasForwardIntent =
    exercise.scene.overlays.some(
      (overlay) => overlay.type === "run" || overlay.type === "pass",
    ) || exercise.scene.triggers.length > 0;
  if (!hasForwardIntent) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message: "ataque sin carreras/pases ni trigger que generen la accion",
    });
  }
  if (!hasTeam(exercise, "rival")) {
    issues.push({
      severity: "warning",
      tag: "missing-opposition",
      message: "ataque sin oposicion",
    });
  }

  return issues;
}

function checkDefense(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (
    !exercise.scene.actors.some(
      (actor) => isDefenderRole(actor.role) || isKeeperRole(actor.role),
    )
  ) {
    issues.push({
      severity: "warning",
      tag: "role-mismatch",
      message: "defensa sin perfiles defensivos en escena",
    });
  }
  const hasDefensiveIntent =
    exercise.scene.overlays.some((overlay) =>
      ["cover", "lineBlocked", "press"].includes(overlay.type),
    ) || exercise.scene.triggers.length > 0;
  if (!hasDefensiveIntent) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message: "defensa sin coberturas/cierres ni trigger que la disparen",
    });
  }
  if (!hasTeam(exercise, "rival")) {
    issues.push({
      severity: "warning",
      tag: "missing-opposition",
      message: "defensa sin equipo rival al que defender",
    });
  }

  return issues;
}

function checkDefensiveTransition(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!(hasTeam(exercise, "own") && hasTeam(exercise, "rival"))) {
    issues.push({
      severity: "warning",
      tag: "missing-opposition",
      message: "transicion defensiva sin los dos equipos",
    });
  }
  const hasReaction =
    exercise.scene.overlays.some((overlay) =>
      ["press", "cover", "lineBlocked"].includes(overlay.type),
    ) || exercise.scene.triggers.length > 0;
  if (!hasReaction) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message:
        "transicion defensiva sin reaccion (presion/cobertura/trigger) tras perdida",
    });
  }

  return issues;
}

function checkSetPieces(exercise: Exercise): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!exercise.scene.actors.some((actor) => isKeeperRole(actor.role))) {
    issues.push({
      severity: "warning",
      tag: "missing-gk",
      message: "ABP sin arquero en escena",
    });
  }
  if (exercise.scene.overlays.length === 0) {
    issues.push({
      severity: "warning",
      tag: "no-intent",
      message: "ABP sin overlays que representen la jugada ensayada",
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
  domains: ExerciseDomain[],
  issues: ValidationIssue[],
): ExerciseValidation {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  let deduction = 0;
  for (const issue of issues) {
    const weight = TAG_WEIGHT[issue.tag];
    deduction += issue.severity === "error" ? weight : weight * 0.5;
  }
  const score = Math.round(Math.max(0, Math.min(100, 100 - deduction)));
  const tags = [...new Set(issues.map((issue) => issue.tag))];

  return {
    exerciseId,
    domains,
    errors,
    warnings,
    score,
    tags,
    critical: errors.length > 0,
  };
}

function hasTeam(exercise: Exercise, team: Actor["team"]): boolean {
  return exercise.scene.actors.some((actor) => actor.team === team);
}

function mentionsKeeper(normalizedText: string): boolean {
  return /arquero|portero|guardameta/.test(normalizedText);
}

function isKeeperRole(role: string): boolean {
  return /\b(gk|arq|portero|arquero|guardameta)\b/.test(normalize(role));
}

function isDefenderRole(role: string): boolean {
  return /\b(cb|dfc|def|lb|rb|wb|lat|libero)\b/.test(normalize(role));
}

function isPivotRole(role: string): boolean {
  return /\b(piv|pivote|cdm|mcd)\b/.test(normalize(role));
}

function isAttackerRole(role: string): boolean {
  return /\b(st|dc|cf|fin|ei|ed|ew|lw|rw|delant|punta|extrem|ariete|fw)\b/.test(
    normalize(role),
  );
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
