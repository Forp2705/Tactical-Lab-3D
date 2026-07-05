import type {
  BoardArrow,
  BoardArrowSemantic,
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
      players,
      objects: scene.objects,
      arrows: scene.arrows,
      zones: scene.zones,
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

// Finding con id estable de su origen real (arrow.id / zone.id), para que la
// UI pueda keyear listas sin depender del texto (dos zonas con el mismo
// resumen -p.ej. mismo label y misma ocupacion- generan el mismo texto pero
// nunca el mismo id).
export type AiFinding = { id: string; text: string };

// Lectura deterministica de la escena. Cada finding tiene antecedente
// ESTRUCTURAL en el grafo (una flecha real, una zona, posiciones de fichas).
// Reporta HECHOS que el DT interpreta, no veredictos que la herramienta
// asevera: "3 propios vs 2 rivales en X" (posicional, defendible) en vez de
// "tenemos ventaja" (cualitativo, que un board estatico no sostiene). Si la
// escena no da para leer, lo dice en vez de inventar. Sin LLM.
export function inferAiInterpretationFindings({
  players,
  objects,
  arrows,
  zones,
}: {
  players: PlanningBoardPlayer[];
  objects: BoardObject[];
  arrows: BoardArrow[];
  zones: BoardZone[];
}): AiFinding[] {
  // 1) Relaciones jugador->jugador: hecho estructural (existe una flecha real
  //    anclada de objeto a objeto). Nada de plantillas keyed a un semantic.
  const anchoredLinks = arrows.filter(
    (arrow) => arrow.from.kind === "object" && arrow.to.kind === "object",
  );
  const linkFindings: AiFinding[] = [];
  for (const arrow of anchoredLinks.slice(0, 3)) {
    const from = resolveBoardActor(arrow.from, objects, players);
    const to = resolveBoardActor(arrow.to, objects, players);
    if (from && to) {
      linkFindings.push({
        id: `link:${arrow.id}`,
        text: `${labelBoardActor(from)} ${RELATION_VERB[arrow.semantic]} ${labelBoardActor(to)}.`,
      });
    }
  }

  // 2) Acciones orientadas a una zona (targetZoneId).
  const targetFindings: AiFinding[] = [];
  for (const arrow of arrows.filter((arrow) => arrow.targetZoneId).slice(0, 2)) {
    const zone = zones.find((item) => item.id === arrow.targetZoneId);
    if (!zone) continue;
    const from = resolveBoardActor(arrow.from, objects, players);
    targetFindings.push({
      id: `target:${arrow.id}`,
      text: `${from ? labelBoardActor(from) : "Una accion"} se orienta hacia ${zone.label}.`,
    });
  }

  // 3) Hechos posicionales por zona: conteo de fichas reales, NO veredicto.
  // W6 decision: una linea por zona REAL, nunca deduplicada por texto — el
  // cap anterior a las primeras 2 zonas escondia zonas 3/4 sin motivo (bug de
  // affordance, no decision de producto). Si dos zonas distintas producen el
  // mismo texto (mismo label default + misma ocupacion), se desambigua con el
  // indice de la zona en vez de fusionar las lineas.
  const zoneFacts = zones
    .map((zone, index) => {
      const { own, rival } = countTokensInZone(objects, zone);
      if (own + rival === 0) return null;
      return {
        id: `zone:${zone.id}`,
        text: `En ${zone.label}: ${own} propios vs ${rival} rivales.`,
        zoneNumber: index + 1,
        danger: zone.semantic === "danger",
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null)
    // Prioridad P0.7: zonas de riesgo primero, no reordena el resto (sort
    // estable) — solo afecta la posicion visual, ninguna zona se descarta.
    .sort((a, b) => Number(b.danger) - Number(a.danger));
  const zoneTextOccurrences = new Map<string, number>();
  for (const fact of zoneFacts) {
    zoneTextOccurrences.set(
      fact.text,
      (zoneTextOccurrences.get(fact.text) ?? 0) + 1,
    );
  }
  const zoneFindings: AiFinding[] = zoneFacts.map((fact) => {
    const ambiguous = (zoneTextOccurrences.get(fact.text) ?? 0) > 1;
    return {
      id: fact.id,
      text: ambiguous ? `${fact.text} (zona ${fact.zoneNumber})` : fact.text,
    };
  });

  // P0.7 resuelto: las lineas de zona (entidad tactica real) NUNCA se
  // sacrifican por el cap — antes, un board cargado de links/targets podia
  // empujar zonas 3/4 fuera del slice(0,4) final. El cap ahora aplica solo a
  // links/targets (menor peso tactico que una zona), con links anclados con
  // prioridad sobre las acciones-a-zona dentro de ese presupuesto reducido.
  // Si hay mas de 4 zonas reales con fichas, el total crece por encima de 4:
  // es la misma decision de producto que ya habilito zoneFacts sin cap en W6.
  const CAP = 4;
  const otherBudget = Math.max(0, CAP - zoneFindings.length);
  const otherFindings = [...linkFindings, ...targetFindings].slice(0, otherBudget);
  const findings: AiFinding[] = [...otherFindings, ...zoneFindings];

  // 4) Degradar con honestidad: decir QUE FALTA en vez de inventar.
  if (findings.length === 0) {
    if (arrows.length === 0) {
      findings.push({
        id: "degrade:no-actions",
        text: "La pizarra todavia no tiene acciones. Dibuja flechas ancladas a jugadores para leer relaciones.",
      });
    } else if (anchoredLinks.length === 0) {
      findings.push({
        id: "degrade:no-anchor",
        text: "Hay acciones, pero ninguna anclada de jugador a jugador. Ancla origen y destino para leer relaciones concretas.",
      });
    } else {
      findings.push({
        id: "degrade:no-numbers",
        text: "Faltan numeros o roles en las fichas para describir la relacion con precision.",
      });
    }
  }

  return findings;
}

// Wrapper delgado: mantiene el contrato string[] preexistente (payload JSON
// exportable + tests) sin filtrar el shape rico (con id) hacia afuera.
export function inferAiInterpretation(
  input: Parameters<typeof inferAiInterpretationFindings>[0],
): string[] {
  return inferAiInterpretationFindings(input).map((finding) => finding.text);
}

type BoardActorRef = {
  num?: number;
  role?: string;
  label: string;
  rival: boolean;
};

function resolveBoardActor(
  endpoint: BoardArrow["from"],
  objects: BoardObject[],
  players: PlanningBoardPlayer[],
): BoardActorRef | null {
  if (endpoint.kind !== "object") return null;
  const object = objects.find((item) => item.id === endpoint.objectId);
  if (!object) return null;
  const role =
    object.role ||
    players.find((player) => player.id === object.linkedPlayerId)?.position;
  return {
    num: object.number,
    role,
    label: object.label,
    rival: object.type === "opponentToken",
  };
}

function labelBoardActor(actor: BoardActorRef): string {
  const id = actor.num ? `el ${actor.num}` : actor.label;
  const side = actor.rival ? " rival" : "";
  const role = actor.role ? ` (${actor.role})` : "";
  return `${id}${side}${role}`;
}

// Aproxima toda zona como rectangulo: una zona "circle" se cuenta por su
// bounding-box. Suficiente para lectura tactica. TODO(P0.7): conteo exacto en
// zonas circulares si algun conteo se ve raro.
export type ZoneRect = Pick<BoardZone, "x" | "y" | "w" | "h">;

export function isInsideZoneRect(
  position: { x: number; y: number },
  zone: ZoneRect,
): boolean {
  return (
    position.x >= zone.x &&
    position.x <= zone.x + zone.w &&
    position.y >= zone.y &&
    position.y <= zone.y + zone.h
  );
}

// El UNICO contador de "propios vs rivales en un rectangulo". Wrapper fino
// sobre isInsideZoneRect: ningun otro lugar debe reimplementar la membresia.
// Asi la lectura en pantalla y cualquier conteo futuro consumen la misma
// fuente y no pueden divergir.
export function countTokensInZone(
  objects: BoardObject[],
  rect: ZoneRect,
): { own: number; rival: number } {
  let own = 0;
  let rival = 0;
  for (const object of objects) {
    if (object.type !== "playerToken" && object.type !== "opponentToken")
      continue;
    if (!isInsideZoneRect(object.position, rect)) continue;
    if (object.type === "playerToken") own += 1;
    else rival += 1;
  }
  return { own, rival };
}

// Verbo relacional por semantica: describe la accion DIBUJADA (no es un
// veredicto). Record => el compilador exige una entrada por semantica nueva.
const RELATION_VERB: Record<BoardArrowSemantic, string> = {
  pass: "le pasa a",
  longPass: "le pasa largo a",
  switch: "cambia el juego a",
  cross: "centra a",
  carry: "conduce hacia",
  movement: "se desmarca para",
  run: "rompe para",
  support: "da apoyo a",
  rotation: "rota con",
  shot: "remata asistido por",
  pressure: "presiona a",
  mark: "marca a",
  cover: "cubre a",
  recovery: "repliega cubriendo a",
};

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
    shot: "shot",
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
