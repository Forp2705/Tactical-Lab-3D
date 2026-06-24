import type {
  BoardArrow,
  BoardObject,
  BoardScene,
  BoardZone,
  TacticalBoard,
} from "./boardModel";

export type PlanningBoardPlayer = {
  id: string;
  name: string;
  position: string;
  number: string | number;
  traits: string;
  team: "A" | "B";
  x?: number;
  y?: number;
  role?: string;
  task?: string;
};

export type CurrentBoardView = "Ataque" | "Defensa" | "Transicion" | "ABP";

export type TacticalProblem = {
  problem: string;
  objective: string;
};

export type ExerciseBuilder = {
  objective: string;
  players: string;
  space: string;
  duration: string;
  rule: string;
  successCondition: string;
  progression: string;
  coachCorrection: string;
};

export type BoardAnnotation = {
  id: string;
  type:
    | "arrow"
    | "line"
    | "zone"
    | "text"
    | "cone"
    | "mannequin"
    | "ballRoute"
    | "pressureLine"
    | "shot"
    | "cross"
    | "run"
    | "block";
  label?: string;
  from?: string;
  to?: string;
  points?: Array<{ x: number; y: number }>;
  color?: string;
  layer?: string;
  intent?: string;
};

export type PlanningBoardLayer = {
  id: string;
  name: string;
  visible: boolean;
};

export type BoardPayload = {
  boardId: string;
  title: string;
  currentView: CurrentBoardView;
  tacticalProblem: TacticalProblem;
  players: PlanningBoardPlayer[];
  formations: {
    teamA: string;
    teamB: string;
  };
  annotations: BoardAnnotation[];
  exercise: ExerciseBuilder;
  layers: PlanningBoardLayer[];
  aiInterpretation: string[];
};

export const DEFAULT_BOARD_LAYERS: PlanningBoardLayer[] = [
  { id: "attack", name: "Ataque", visible: true },
  { id: "defense", name: "Defensa", visible: true },
  { id: "offensiveTransition", name: "Transicion ofensiva", visible: true },
  { id: "defensiveTransition", name: "Transicion defensiva", visible: true },
  { id: "setPieces", name: "ABP / Balon parado", visible: true },
  { id: "counterPress", name: "Presion tras perdida", visible: true },
  { id: "midBlock", name: "Bloque medio", visible: true },
];

export const DEFAULT_TACTICAL_PROBLEM: TacticalProblem = {
  problem: "Nos presionan alto y no salimos limpio",
  objective: "Encontrar pase interior y tercer hombre",
};

export const DEFAULT_EXERCISE_BUILDER: ExerciseBuilder = {
  objective: "Salida ante presion alta",
  players: "6v4 + arquero",
  space: "35x40",
  duration: "12 min",
  rule: "Gol doble si progresa por tercer hombre",
  successCondition: "Superar primera linea y fijar al 6",
  progression: "Anadir comodin interior",
  coachCorrection: "Perfilar cuerpo y jugar de cara",
};

type PayloadOptions = {
  currentView: CurrentBoardView;
  tacticalProblem: TacticalProblem;
  roster: PlanningBoardPlayer[];
  teamAFormation: string;
  exercise: ExerciseBuilder;
  layers: PlanningBoardLayer[];
  aiInterpretation?: string[];
};

export function buildBoardPayload(
  board: TacticalBoard,
  scene: BoardScene,
  options: PayloadOptions,
): BoardPayload {
  const players = collectPayloadPlayers(scene.objects, options.roster);
  const annotations = [
    ...scene.arrows.map(annotationFromArrow),
    ...scene.zones.map(annotationFromZone),
    ...scene.objects.flatMap(annotationFromObject),
  ];
  const aiInterpretation =
    options.aiInterpretation ??
    inferAiInterpretation({
      tacticalProblem: options.tacticalProblem,
      players,
      arrows: scene.arrows,
      zones: scene.zones,
      exercise: options.exercise,
    });

  return {
    boardId: board.id,
    title: board.title,
    currentView: options.currentView,
    tacticalProblem: options.tacticalProblem,
    players,
    formations: {
      teamA: options.teamAFormation,
      teamB: board.opponent.formation,
    },
    annotations,
    exercise: options.exercise,
    layers: options.layers,
    aiInterpretation,
  };
}

export function inferAiInterpretation({
  tacticalProblem,
  players,
  arrows,
  zones,
  exercise,
}: {
  tacticalProblem: TacticalProblem;
  players: PlanningBoardPlayer[];
  arrows: BoardArrow[];
  zones: BoardZone[];
  exercise: ExerciseBuilder;
}): string[] {
  const findings: string[] = [];
  const connector =
    players.find((player) =>
      `${player.position} ${player.role ?? ""} ${player.task ?? ""}`
        .toLowerCase()
        .includes("enganche"),
    ) ??
    players.find((player) =>
      `${player.position} ${player.role ?? ""} ${player.task ?? ""}`
        .toLowerCase()
        .includes("medio"),
    );

  if (connector) {
    findings.push(`El ${connector.number} es el conector principal.`);
  }
  if (
    /interior|tercer hombre|dentro|central/i.test(
      `${tacticalProblem.objective} ${exercise.rule}`,
    )
  ) {
    findings.push("Se busca progresar por dentro.");
  }
  if (
    zones.some(
      (zone) => zone.semantic === "danger" || zone.semantic === "freeSpace",
    )
  ) {
    findings.push("Hay una zona critica que debe protegerse tras perdida.");
  }
  if (
    arrows.some(
      (arrow) =>
        arrow.semantic === "pressure" || /presion/i.test(arrow.label ?? ""),
    )
  ) {
    findings.push("La presion necesita cobertura inmediata.");
  }
  if (
    !arrows.some(
      (arrow) => arrow.semantic === "cover" || arrow.semantic === "recovery",
    )
  ) {
    findings.push("Falta cobertura inmediata tras perdida.");
  }
  if (findings.length === 0) {
    findings.push(
      "La pizarra define una intencion, pero necesita mas roles o anotaciones para generar una secuencia precisa.",
    );
  }

  return findings.slice(0, 4);
}

function collectPayloadPlayers(
  objects: BoardObject[],
  roster: PlanningBoardPlayer[],
): PlanningBoardPlayer[] {
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const objectPlayers = objects
    .filter(
      (object) =>
        object.type === "playerToken" || object.type === "opponentToken",
    )
    .map((object) => {
      const linked = object.linkedPlayerId
        ? rosterById.get(object.linkedPlayerId)
        : undefined;
      return {
        id: object.linkedPlayerId ?? object.id,
        name: linked?.name ?? object.rosterLink?.displayName ?? object.label,
        position: linked?.position ?? object.role ?? "Sin puesto",
        number: linked?.number ?? object.number ?? "",
        traits: linked?.traits ?? object.note ?? "",
        team: object.type === "opponentToken" ? "B" : "A",
        x: object.position.x,
        y: object.position.y,
        role: object.role,
        task: object.note,
      } satisfies PlanningBoardPlayer;
    });

  const usedRosterIds = new Set(objectPlayers.map((player) => player.id));
  const bench = roster.filter((player) => !usedRosterIds.has(player.id));
  return [...objectPlayers, ...bench];
}

function annotationFromArrow(arrow: BoardArrow): BoardAnnotation {
  const typeBySemantic: Record<
    BoardArrow["semantic"],
    BoardAnnotation["type"]
  > = {
    movement: "arrow",
    pass: "ballRoute",
    pressure: "pressureLine",
    cover: "arrow",
    recovery: "arrow",
    run: "run",
    rotation: "arrow",
    longPass: "ballRoute",
    cross: "cross",
    switch: "ballRoute",
    carry: "arrow",
    support: "arrow",
    mark: "pressureLine",
  };
  return {
    id: arrow.id,
    type: typeBySemantic[arrow.semantic],
    label: arrow.label,
    from: arrow.from.kind === "object" ? arrow.from.objectId : undefined,
    to: arrow.to.kind === "object" ? arrow.to.objectId : undefined,
    points: [
      arrow.from.kind === "point" ? arrow.from.point : undefined,
      arrow.to.kind === "point" ? arrow.to.point : undefined,
    ].filter((point): point is { x: number; y: number } => Boolean(point)),
    color: arrow.style?.color,
    layer: arrow.layer,
    intent: arrow.tacticalMeaning,
  };
}

function annotationFromZone(zone: BoardZone): BoardAnnotation {
  return {
    id: zone.id,
    type: zone.semantic === "block" ? "block" : "zone",
    label: zone.label,
    points: [
      { x: zone.x, y: zone.y },
      { x: zone.x + zone.w, y: zone.y + zone.h },
    ],
    color: zone.color ?? zone.style?.color,
    layer: zone.layer,
    intent: zone.tacticalMeaning,
  };
}

function annotationFromObject(object: BoardObject): BoardAnnotation[] {
  if (object.type === "note") {
    return [
      {
        id: object.id,
        type: "text",
        label: object.label,
        points: [object.position],
        color: object.style?.color,
        layer: object.linkedPhase,
        intent: object.tacticalMeaning,
      },
    ];
  }
  if (object.type !== "equipmentMarker") {
    return [];
  }
  const label = `${object.label} ${object.tacticalMeaning ?? ""}`.toLowerCase();
  const type: BoardAnnotation["type"] = label.includes("mani")
    ? "mannequin"
    : label.includes("porter")
      ? "block"
      : "cone";
  return [
    {
      id: object.id,
      type,
      label: object.label,
      points: [object.position],
      color: object.style?.color,
      intent: object.tacticalMeaning,
    },
  ];
}
