import type { Player } from "@/data";
import type { WeeklyDecisionThread } from "@/state/weeklyDecisionThread";
import { z } from "zod";
import { zoneStyle } from "./boardActionStyle";

export const BOARD_SCHEMA_VERSION = 2;

const NormalizedCoordSchema = z.number().min(0).max(100);

export const BoardPointSchema = z.object({
  x: NormalizedCoordSchema,
  y: NormalizedCoordSchema,
});
export type BoardPoint = z.infer<typeof BoardPointSchema>;

export const BoardPitchModeSchema = z.enum(["full", "half", "third", "small"]);
export type BoardPitchMode = z.infer<typeof BoardPitchModeSchema>;

export const BoardLayerSchema = z.enum([
  "withBall",
  "withoutBall",
  "press",
  "cover",
  "recovery",
  "rival",
  "abp",
  "notes",
]);
export type BoardLayer = z.infer<typeof BoardLayerSchema>;

export const BoardPhaseTypeSchema = z.enum([
  "salida",
  "ataque posicional",
  "presión alta",
  "bloque medio",
  "bloque bajo",
  "transición ofensiva",
  "transición defensiva",
  "ABP ofensiva",
  "ABP defensiva",
  "custom",
]);
export type BoardPhaseType = z.infer<typeof BoardPhaseTypeSchema>;
export type BoardPhase = z.infer<typeof BoardPhaseSchema>;

export const BoardVisibilitySchema = z.enum(["staff", "player", "export"]);
export type BoardVisibility = z.infer<typeof BoardVisibilitySchema>;

export const BoardObjectTypeSchema = z.enum([
  "playerToken",
  "opponentToken",
  "ball",
  "note",
  "equipmentMarker",
]);
export type BoardObjectType = z.infer<typeof BoardObjectTypeSchema>;

export const BoardArrowSemanticSchema = z.enum([
  "movement",
  "pass",
  "pressure",
  "cover",
  "recovery",
  "run",
  "rotation",
  // Vocabulario futbolero ampliado (aditivo: boards viejos siguen parseando).
  // La tool rail elige una de estas semanticas directo, sin capa lossy.
  "longPass",
  "cross",
  "switch",
  "carry",
  "support",
  "mark",
  "shot",
]);
export type BoardArrowSemantic = z.infer<typeof BoardArrowSemanticSchema>;

export const BoardZoneSemanticSchema = z.enum([
  "press",
  "occupation",
  "freeSpace",
  "danger",
  "block",
  "channel",
  "custom",
]);
export type BoardZoneSemantic = z.infer<typeof BoardZoneSemanticSchema>;

export const BoardInstructionScopeSchema = z.enum([
  "global",
  "scene",
  "player",
  "line",
  "zone",
  "rival",
  "session",
]);
export type BoardInstructionScope = z.infer<typeof BoardInstructionScopeSchema>;

export const BoardZoneShapeSchema = z.enum(["rectangle", "circle"]);
export type BoardZoneShape = z.infer<typeof BoardZoneShapeSchema>;

export const BoardStyleSchema = z.object({
  color: z.string().max(40).optional(),
  dashed: z.boolean().optional(),
  tone: z.string().max(32).optional(),
});
export type BoardStyle = z.infer<typeof BoardStyleSchema>;

export const BoardRosterLinkSchema = z.object({
  playerId: z.string().min(1).optional(),
  displayName: z.string().min(1).max(80),
  number: z.number().int().min(1).max(99),
  role: z.string().min(1).max(60),
  linkedAt: z.string(),
});
export type BoardRosterLink = z.infer<typeof BoardRosterLinkSchema>;

export const BoardObjectSchema = z.object({
  id: z.string().min(1),
  type: BoardObjectTypeSchema,
  label: z.string().min(1).max(80),
  position: BoardPointSchema,
  rotationDeg: z.number().min(0).max(360).default(0),
  number: z.number().int().min(1).max(99).optional(),
  role: z.string().max(60).optional(),
  note: z.string().max(220).optional(),
  tacticalMeaning: z.string().max(220).optional(),
  style: BoardStyleSchema.default({}),
  rosterLink: BoardRosterLinkSchema.optional(),
  linkedPlayerId: z.string().optional(),
  linkedPhase: BoardPhaseTypeSchema.optional(),
  visibility: BoardVisibilitySchema.default("staff"),
  locked: z.boolean().default(false),
  isDangerPlayer: z.boolean().default(false),
});
export type BoardObject = z.infer<typeof BoardObjectSchema>;

export const BoardArrowEndpointSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("object"), objectId: z.string().min(1) }),
  z.object({ kind: z.literal("point"), point: BoardPointSchema }),
]);
export type BoardArrowEndpoint = z.infer<typeof BoardArrowEndpointSchema>;

export const BoardArrowSchema = z.object({
  id: z.string().min(1),
  semantic: BoardArrowSemanticSchema,
  from: BoardArrowEndpointSchema,
  to: BoardArrowEndpointSchema,
  layer: BoardLayerSchema.default("withBall"),
  label: z.string().max(80).optional(),
  style: BoardStyleSchema.default({}),
  tacticalMeaning: z.string().max(220).optional(),
  // Intencion tactica corta y zona objetivo de la accion (aditivos, opcionales).
  // La fase se sigue leyendo de `linkedPhase` (no se duplica con un `phase`).
  intent: z.string().max(220).optional(),
  // TODO(P0.4): cablear targetZoneId. Hoy ninguna interaccion lo setea (deferral
  // CONSCIENTE de P0.3). Se conecta en P0.4 via selector "zona objetivo" del
  // inspector + segundo-click-sobre-zona (necesita que el canvas reporte la
  // zona al flujo de dibujo). No dejar huerfano.
  targetZoneId: z.string().optional(),
  visibility: BoardVisibilitySchema.default("staff"),
  linkedPlayerId: z.string().optional(),
  linkedObjectId: z.string().optional(),
  linkedPhase: BoardPhaseTypeSchema.optional(),
});
export type BoardArrow = z.infer<typeof BoardArrowSchema>;

export const BoardZoneSchema = z
  .object({
    id: z.string().min(1),
    semantic: BoardZoneSemanticSchema,
    label: z.string().min(1).max(80),
    shape: BoardZoneShapeSchema,
    x: NormalizedCoordSchema,
    y: NormalizedCoordSchema,
    w: z.number().min(1).max(100),
    h: z.number().min(1).max(100),
    layer: BoardLayerSchema.default("notes"),
    color: z.string().min(1).max(40).default("#c7df5f"),
    style: BoardStyleSchema.default({}),
    tacticalMeaning: z.string().max(220).optional(),
    visibility: BoardVisibilitySchema.default("staff"),
    linkedPhase: BoardPhaseTypeSchema.optional(),
  })
  .refine((zone) => zone.x + zone.w <= 100 && zone.y + zone.h <= 100, {
    message: "Board zone must stay inside normalized pitch bounds",
  });
export type BoardZone = z.infer<typeof BoardZoneSchema>;

export const BoardInstructionSchema = z.object({
  id: z.string().min(1),
  scope: BoardInstructionScopeSchema,
  title: z.string().min(1).max(90),
  text: z.string().min(1).max(360),
  phase: BoardPhaseTypeSchema.optional(),
  objectIds: z.array(z.string()).default([]),
  coachingCue: z.boolean().default(false),
  trigger: z.string().max(160).optional(),
  desiredOutcome: z.string().max(180).optional(),
  visibility: BoardVisibilitySchema.default("staff"),
});
export type BoardInstruction = z.infer<typeof BoardInstructionSchema>;

export const BoardPhaseSchema = z.object({
  id: z.string().min(1),
  type: BoardPhaseTypeSchema,
  title: z.string().min(1).max(80),
  durationMin: z.number().min(0).default(0),
});

export const BoardSceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  phaseLabel: BoardPhaseTypeSchema,
  phases: z.array(BoardPhaseSchema).min(1),
  objects: z.array(BoardObjectSchema).default([]),
  arrows: z.array(BoardArrowSchema).default([]),
  zones: z.array(BoardZoneSchema).default([]),
  instructions: z.array(BoardInstructionSchema).default([]),
  notes: z.string().max(1000).default(""),
});
export type BoardScene = z.infer<typeof BoardSceneSchema>;

// Board "workspace": the editor-side planning data that used to live in
// localStorage (see TacticalBoardView). Folded into the model so a board is the
// single source of truth and persists via Dexie. Defaults below mirror the
// view-facing constants in productBoardTypes.ts.
export const BoardWorkspacePlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  number: z.union([z.string(), z.number()]),
  traits: z.string(),
  team: z.enum(["A", "B"]),
  x: z.number().optional(),
  y: z.number().optional(),
  role: z.string().optional(),
  task: z.string().optional(),
});

export const BoardWorkspaceViewSchema = z.enum([
  "Ataque",
  "Defensa",
  "Transicion",
  "ABP",
]);

export const BoardWorkspaceProblemSchema = z.object({
  problem: z.string(),
  objective: z.string(),
});

export const BoardWorkspaceExerciseSchema = z.object({
  objective: z.string(),
  players: z.string(),
  space: z.string(),
  duration: z.string(),
  rule: z.string(),
  successCondition: z.string(),
  progression: z.string(),
  coachCorrection: z.string(),
});

export const BoardWorkspaceLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
});

export const BoardWorkspaceSchema = z.object({
  roster: z.array(BoardWorkspacePlayerSchema).default([]),
  problem: BoardWorkspaceProblemSchema.default({
    problem: "Nos presionan alto y no salimos limpio",
    objective: "Encontrar pase interior y tercer hombre",
  }),
  exercise: BoardWorkspaceExerciseSchema.default({
    objective: "Salida ante presion alta",
    players: "6v4 + arquero",
    space: "35x40",
    duration: "12 min",
    rule: "Gol doble si progresa por tercer hombre",
    successCondition: "Superar primera linea y fijar al 6",
    progression: "Anadir comodin interior",
    coachCorrection: "Perfilar cuerpo y jugar de cara",
  }),
  layers: z.array(BoardWorkspaceLayerSchema).default([
    { id: "attack", name: "Ataque", visible: true },
    { id: "defense", name: "Defensa", visible: true },
    { id: "offensiveTransition", name: "Transicion ofensiva", visible: true },
    { id: "defensiveTransition", name: "Transicion defensiva", visible: true },
    { id: "setPieces", name: "ABP / Balon parado", visible: true },
    { id: "counterPress", name: "Presion tras perdida", visible: true },
    { id: "midBlock", name: "Bloque medio", visible: true },
  ]),
  currentView: BoardWorkspaceViewSchema.default("Ataque"),
  teamAFormation: z.string().default("4-3-3"),
});
export type BoardWorkspace = z.infer<typeof BoardWorkspaceSchema>;

export const TacticalBoardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  version: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  linkedWeeklyFocusId: z.string().optional(),
  plannedSolution: z.boolean().default(false),
  defaults: z.object({
    pitchMode: BoardPitchModeSchema,
    sceneDurationMin: z.number().positive(),
  }),
  opponent: z.object({
    formation: z.string().max(24).default("4-4-2"),
    block: z.enum(["high", "mid", "low"]).default("mid"),
    strongSide: z
      .enum(["left", "right", "central", "unknown"])
      .default("unknown"),
    weakSide: z
      .enum(["left", "right", "central", "unknown"])
      .default("unknown"),
    showRival: z.boolean().default(true),
  }),
  globalInstruction: z.string().max(420).default(""),
  sessionCoachingPoints: z.array(z.string().max(180)).default([]),
  successSignals: z.array(z.string().max(180)).default([]),
  scenes: z.array(BoardSceneSchema).min(1),
  instructions: z.array(BoardInstructionSchema).default([]),
  workspace: BoardWorkspaceSchema.default({}),
});
export type TacticalBoard = z.infer<typeof TacticalBoardSchema>;

export type BoardSessionDraft = {
  sourceBoardId: string;
  title: string;
  totalDurationMin: number;
  blocks: Array<{
    id: string;
    sceneId: string;
    title: string;
    durationMin: number;
    objective: string;
    organization: string;
    coachingCues: string[];
    constraints: string;
    successSignal: string;
  }>;
  staffNotes: string;
};

let boardSeed = 0;

export function createBoardId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  boardSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${boardSeed}`;
}

export function createDefaultBoard(
  title = "Pizarra tactica",
  options?: { weeklyThread?: WeeklyDecisionThread | null; players?: Player[] },
): TacticalBoard {
  const now = new Date().toISOString();
  const cleanTitle =
    title.trim() ||
    options?.weeklyThread?.problem?.slice(0, 100) ||
    "Pizarra tactica";
  const firstScene = createDefaultBoardScene(
    "Respuesta inicial",
    "salida",
    options?.players ?? [],
  );
  const objective =
    options?.weeklyThread?.sessionIntent?.objective ??
    "Modelar la respuesta tactica y convertirla en una consigna entrenable.";
  const success =
    options?.weeklyThread?.sessionIntent?.successSignal ??
    "El equipo reconoce la conducta y la repite con oposicion.";
  return TacticalBoardSchema.parse({
    id: createBoardId("board"),
    title: cleanTitle,
    description: options?.weeklyThread?.problem ?? "",
    version: BOARD_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    linkedWeeklyFocusId: options?.weeklyThread?.id,
    plannedSolution: Boolean(options?.weeklyThread),
    defaults: {
      pitchMode: "full",
      sceneDurationMin: 8,
    },
    opponent: {
      formation: "4-4-2",
      block: "mid",
      strongSide: "unknown",
      weakSide: "unknown",
      showRival: true,
    },
    globalInstruction: objective,
    sessionCoachingPoints: [objective],
    successSignals: [success],
    scenes: [firstScene],
    instructions: [
      createInstruction("global", "Objetivo tactico", objective, {
        coachingCue: true,
        visibility: "player",
      }),
      createInstruction("session", "Senal de exito", success, {
        coachingCue: true,
        visibility: "player",
      }),
    ],
    workspace: {
      roster: (options?.players ?? []).map((player) => ({
        id: player.id,
        name: player.name,
        position: player.positions[0] ?? "Sin puesto",
        number: player.num,
        traits: player.profile,
        team: "A" as const,
      })),
      problem: {
        problem:
          (options?.weeklyThread?.problem ?? "") ||
          "Nos presionan alto y no salimos limpio",
        objective: objective || "Encontrar pase interior y tercer hombre",
      },
      currentView: "Ataque",
      teamAFormation: "4-3-3",
    },
  });
}

export function createDefaultBoardScene(
  title: string,
  phaseLabel: BoardPhaseType = "salida",
  players: Player[] = [],
): BoardScene {
  const sceneId = createBoardId("scene");
  return BoardSceneSchema.parse({
    id: sceneId,
    title,
    phaseLabel,
    phases: [
      {
        id: `${sceneId}-setup`,
        type: phaseLabel,
        title: phaseLabel,
        durationMin: 2,
      },
      {
        id: `${sceneId}-execute`,
        type: phaseLabel,
        title: "Ejecucion",
        durationMin: 4,
      },
      {
        id: `${sceneId}-review`,
        type: phaseLabel,
        title: "Revision",
        durationMin: 2,
      },
    ],
    objects: [
      createBall(),
      ...createOwnShape(players),
      ...createOpponentShape("4-4-2"),
    ],
    arrows: [],
    zones: [],
    notes: "",
    instructions: [
      createInstruction(
        "scene",
        "Consigna de escena",
        "Definir la conducta que debe aparecer en esta fase.",
        {
          phase: phaseLabel,
          visibility: "player",
        },
      ),
    ],
  });
}

export function createInstruction(
  scope: BoardInstructionScope,
  title: string,
  text: string,
  patch: Partial<
    Omit<BoardInstruction, "id" | "scope" | "title" | "text">
  > = {},
): BoardInstruction {
  return BoardInstructionSchema.parse({
    id: createBoardId("instruction"),
    scope,
    title,
    text,
    objectIds: patch.objectIds ?? [],
    coachingCue: patch.coachingCue ?? false,
    visibility: patch.visibility ?? "staff",
    phase: patch.phase,
    trigger: patch.trigger,
    desiredOutcome: patch.desiredOutcome,
  });
}

export function createBall(
  position: BoardPoint = { x: 36, y: 50 },
): BoardObject {
  return BoardObjectSchema.parse({
    id: createBoardId("ball"),
    type: "ball",
    label: "Pelota",
    position,
    tacticalMeaning: "Ubicacion del balon",
    visibility: "player",
  });
}

export function createPlayerToken(
  player: Player | null,
  position: BoardPoint,
  role: string,
  number: number,
): BoardObject {
  return BoardObjectSchema.parse({
    id: createBoardId("player"),
    type: "playerToken",
    label: player?.name ?? role,
    position,
    number: player?.num ?? number,
    role,
    linkedPlayerId: player?.id,
    tacticalMeaning: "Referencia propia",
    visibility: "player",
    rosterLink: player
      ? {
          playerId: player.id,
          displayName: player.name,
          number: player.num,
          role,
          linkedAt: new Date().toISOString(),
        }
      : undefined,
  });
}

export function createOpponentToken(
  position: BoardPoint,
  role: string,
  number: number,
  patch: Partial<Pick<BoardObject, "label" | "isDangerPlayer" | "note">> = {},
): BoardObject {
  return BoardObjectSchema.parse({
    id: createBoardId("opponent"),
    type: "opponentToken",
    label: patch.label ?? role,
    position,
    number,
    role,
    note: patch.note,
    tacticalMeaning: "Referencia rival",
    visibility: "staff",
    isDangerPlayer: patch.isDangerPlayer ?? false,
  });
}

export function createSemanticArrow(
  semantic: BoardArrowSemantic,
  from: BoardArrowEndpoint,
  to: BoardArrowEndpoint,
  patch: Partial<Omit<BoardArrow, "id" | "semantic" | "from" | "to">> = {},
): BoardArrow {
  return BoardArrowSchema.parse({
    id: createBoardId("arrow"),
    semantic,
    from,
    to,
    layer: patch.layer ?? layerForArrow(semantic),
    label: patch.label,
    style: patch.style ?? {},
    tacticalMeaning: patch.tacticalMeaning ?? labelForArrow(semantic),
    visibility: patch.visibility ?? "staff",
    linkedPlayerId: patch.linkedPlayerId,
    linkedObjectId: patch.linkedObjectId,
    linkedPhase: patch.linkedPhase,
  });
}

export function createTacticalZone(
  semantic: BoardZoneSemantic,
  x: number,
  y: number,
  w: number,
  h: number,
  patch: Partial<
    Omit<BoardZone, "id" | "semantic" | "x" | "y" | "w" | "h">
  > = {},
): BoardZone {
  return BoardZoneSchema.parse({
    id: createBoardId("zone"),
    semantic,
    label: patch.label ?? labelForZone(semantic),
    shape: patch.shape ?? "rectangle",
    x,
    y,
    w,
    h,
    layer: patch.layer ?? "notes",
    color: patch.color ?? colorForZone(semantic),
    style: patch.style ?? {},
    tacticalMeaning: patch.tacticalMeaning ?? labelForZone(semantic),
    visibility: patch.visibility ?? "staff",
    linkedPhase: patch.linkedPhase,
  });
}

export function duplicateBoardScene(
  board: TacticalBoard,
  sceneId: string,
): TacticalBoard {
  const index = board.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return board;
  const source = board.scenes[index];
  const objectIdMap = new Map<string, string>();
  const objects = source.objects.map((object) => {
    const id = createBoardId("obj");
    objectIdMap.set(object.id, id);
    return { ...object, id };
  });
  const duplicate: BoardScene = {
    ...source,
    id: createBoardId("scene"),
    title: `${source.title} copia`.slice(0, 100),
    objects,
    arrows: source.arrows.map((arrow) => ({
      ...arrow,
      id: createBoardId("arrow"),
      from: remapEndpoint(arrow.from, objectIdMap),
      to: remapEndpoint(arrow.to, objectIdMap),
    })),
    zones: source.zones.map((zone) => ({ ...zone, id: createBoardId("zone") })),
    instructions: source.instructions.map((instruction) => ({
      ...instruction,
      id: createBoardId("instruction"),
      objectIds: instruction.objectIds.map((id) => objectIdMap.get(id) ?? id),
    })),
  };
  return touchBoard(board, [
    ...board.scenes.slice(0, index + 1),
    duplicate,
    ...board.scenes.slice(index + 1),
  ]);
}

export function reorderBoardScenes(
  board: TacticalBoard,
  fromIndex: number,
  toIndex: number,
): TacticalBoard {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= board.scenes.length ||
    toIndex >= board.scenes.length ||
    fromIndex === toIndex
  ) {
    return board;
  }
  const scenes = board.scenes.slice();
  const [scene] = scenes.splice(fromIndex, 1);
  scenes.splice(toIndex, 0, scene);
  return touchBoard(board, scenes);
}

export function summarizeBoard(board: TacticalBoard): string {
  return [
    `${board.title}: ${board.scenes.length} escena(s)`,
    board.globalInstruction,
    ...board.scenes.map((scene, index) => {
      const semantics = [
        ...new Set([
          ...scene.arrows.map((arrow) => arrow.semantic),
          ...scene.zones.map((zone) => zone.semantic),
        ]),
      ];
      return `${index + 1}. ${scene.title} (${scene.phaseLabel}; ${scene.objects.length} objetos; ${semantics.join(", ")})`;
    }),
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeBoardForAi(board: TacticalBoard) {
  return {
    id: board.id,
    title: board.title,
    linkedWeeklyFocusId: board.linkedWeeklyFocusId,
    plannedSolution: board.plannedSolution,
    globalInstruction: board.globalInstruction,
    successSignals: board.successSignals,
    scenes: board.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      phase: scene.phaseLabel,
      arrows: scene.arrows.map((arrow) => ({
        semantic: arrow.semantic,
        tacticalMeaning: arrow.tacticalMeaning,
        label: arrow.label,
      })),
      zones: scene.zones.map((zone) => ({
        semantic: zone.semantic,
        label: zone.label,
        tacticalMeaning: zone.tacticalMeaning,
      })),
      instructions: scene.instructions.map((instruction) => ({
        scope: instruction.scope,
        title: instruction.title,
        text: instruction.text,
        visibility: instruction.visibility,
      })),
    })),
  };
}

export function generateBoardSessionDraft(
  board: TacticalBoard,
): BoardSessionDraft {
  const blocks = board.scenes.map((scene, index) => {
    const durationMin =
      scene.phases.reduce((sum, phase) => sum + phase.durationMin, 0) ||
      board.defaults.sceneDurationMin;
    const coachingCues = [
      ...scene.instructions
        .filter(
          (instruction) =>
            instruction.coachingCue || instruction.visibility === "player",
        )
        .map((instruction) => instruction.text),
      ...board.sessionCoachingPoints,
    ].slice(0, 4);
    return {
      id: `board-block-${index + 1}`,
      sceneId: scene.id,
      title: scene.title,
      durationMin,
      objective:
        scene.instructions[0]?.text ||
        board.globalInstruction ||
        `Trabajar ${scene.title}`,
      organization: `${scene.objects.filter((object) => object.type === "playerToken").length || 11} propios vs ${scene.objects.filter((object) => object.type === "opponentToken").length} rivales. Fase: ${scene.phaseLabel}.`,
      coachingCues,
      constraints:
        scene.notes || "Mantener referencias de rol, distancia y timing.",
      successSignal:
        board.successSignals[0] ||
        scene.instructions.find((instruction) => instruction.desiredOutcome)
          ?.desiredOutcome ||
        "El comportamiento aparece bajo oposicion.",
    };
  });
  return {
    sourceBoardId: board.id,
    title: board.title,
    totalDurationMin: blocks.reduce((sum, block) => sum + block.durationMin, 0),
    blocks,
    staffNotes: summarizeBoard(board).slice(0, 900),
  };
}

function createOwnShape(players: Player[]): BoardObject[] {
  const slots = [
    ["GK", 8, 50],
    ["LB", 24, 20],
    ["CB", 22, 40],
    ["CB", 22, 60],
    ["RB", 24, 80],
    ["CM", 45, 35],
    ["CDM", 40, 50],
    ["CM", 45, 65],
    ["LW", 70, 24],
    ["ST", 78, 50],
    ["RW", 70, 76],
  ] as const;
  return slots.map(([role, x, y], index) =>
    createPlayerToken(
      players[index] ?? null,
      { x, y },
      role,
      players[index]?.num ?? index + 1,
    ),
  );
}

export function createOpponentShape(formation: string): BoardObject[] {
  const slots = opponentSlots(formation);
  return slots.map((slot, index) =>
    createOpponentToken({ x: slot.x, y: slot.y }, slot.role, index + 1, {
      isDangerPlayer: slot.role === "ST" && index === slots.length - 1,
    }),
  );
}

function opponentSlots(formation: string) {
  const shapes: Record<
    string,
    Array<{ role: string; x: number; y: number }>
  > = {
    "4-4-2": [
      { role: "GK", x: 94, y: 50 },
      { role: "LB", x: 76, y: 80 },
      { role: "CB", x: 78, y: 60 },
      { role: "CB", x: 78, y: 40 },
      { role: "RB", x: 76, y: 20 },
      { role: "LM", x: 56, y: 80 },
      { role: "CM", x: 57, y: 58 },
      { role: "CM", x: 57, y: 42 },
      { role: "RM", x: 56, y: 20 },
      { role: "ST", x: 34, y: 42 },
      { role: "ST", x: 34, y: 58 },
    ],
    "4-2-3-1": [
      { role: "GK", x: 94, y: 50 },
      { role: "LB", x: 76, y: 80 },
      { role: "CB", x: 78, y: 60 },
      { role: "CB", x: 78, y: 40 },
      { role: "RB", x: 76, y: 20 },
      { role: "CDM", x: 60, y: 42 },
      { role: "CDM", x: 60, y: 58 },
      { role: "LW", x: 42, y: 78 },
      { role: "CAM", x: 44, y: 50 },
      { role: "RW", x: 42, y: 22 },
      { role: "ST", x: 28, y: 50 },
    ],
    "5-3-2": [
      { role: "GK", x: 94, y: 50 },
      { role: "LWB", x: 74, y: 84 },
      { role: "CB", x: 78, y: 64 },
      { role: "CB", x: 80, y: 50 },
      { role: "CB", x: 78, y: 36 },
      { role: "RWB", x: 74, y: 16 },
      { role: "CM", x: 56, y: 38 },
      { role: "CDM", x: 58, y: 50 },
      { role: "CM", x: 56, y: 62 },
      { role: "ST", x: 34, y: 42 },
      { role: "ST", x: 34, y: 58 },
    ],
  };
  return shapes[formation] ?? shapes["4-4-2"];
}

function touchBoard(board: TacticalBoard, scenes: BoardScene[]): TacticalBoard {
  return TacticalBoardSchema.parse({
    ...board,
    scenes,
    updatedAt: new Date().toISOString(),
  });
}

function remapEndpoint(
  endpoint: BoardArrowEndpoint,
  objectIdMap: ReadonlyMap<string, string>,
): BoardArrowEndpoint {
  if (endpoint.kind === "point") return endpoint;
  return {
    ...endpoint,
    objectId: objectIdMap.get(endpoint.objectId) ?? endpoint.objectId,
  };
}

function layerForArrow(semantic: BoardArrowSemantic): BoardLayer {
  if (semantic === "pressure") return "press";
  if (semantic === "cover" || semantic === "mark") return "cover";
  if (semantic === "recovery") return "recovery";
  if (
    semantic === "pass" ||
    semantic === "run" ||
    semantic === "movement" ||
    semantic === "rotation" ||
    semantic === "longPass" ||
    semantic === "cross" ||
    semantic === "carry" ||
    semantic === "support" ||
    semantic === "switch" ||
    semantic === "shot"
  ) {
    return "withBall";
  }
  return "notes";
}

export function labelForArrow(semantic: BoardArrowSemantic) {
  return {
    movement: "Movimiento",
    pass: "Pase",
    pressure: "Presion",
    cover: "Cobertura",
    recovery: "Repliegue",
    run: "Ruptura",
    rotation: "Rotacion",
    longPass: "Pase largo",
    cross: "Centro",
    switch: "Cambio de orientacion",
    carry: "Conduccion",
    support: "Apoyo",
    mark: "Marca",
    shot: "Disparo",
  }[semantic];
}

export function labelForZone(semantic: BoardZoneSemantic) {
  return {
    press: "Zona de presion",
    occupation: "Ocupacion",
    freeSpace: "Espacio libre",
    danger: "Zona de riesgo",
    block: "Bloque",
    channel: "Carril",
    custom: "Zona",
  }[semantic];
}

// --- Patches puros del inspector (P0.4). Logica testeable; el hook solo cablea.

// Cambio de tipo de flecha: re-deriva el tacticalMeaning SOLO si estaba en el
// default del tipo viejo (no pisa un texto que el usuario edito). El color de
// la flecha no se guarda: sigue solo via arrowStyle en render.
export function arrowSemanticPatch(
  arrow: BoardArrow,
  semantic: BoardArrowSemantic,
): Partial<BoardArrow> {
  const patch: Partial<BoardArrow> = { semantic };
  if (arrow.tacticalMeaning === labelForArrow(arrow.semantic)) {
    patch.tacticalMeaning = labelForArrow(semantic);
  }
  return patch;
}

// Destino de la accion: `targetZoneId` y un `to` anclado a objeto son
// MUTUAMENTE EXCLUYENTES (una sola fuente de verdad). Setear zona objetivo
// mueve `to` al centroide de la zona (snapshot) y rompe el anclaje a objeto;
// limpiar zona objetivo borra el campo. (Seguir a la zona si se mueve = P0.4b.)
export function arrowTargetZonePatch(zone: BoardZone | null): Partial<BoardArrow> {
  if (!zone) return { targetZoneId: undefined };
  return {
    targetZoneId: zone.id,
    to: {
      kind: "point",
      point: { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 },
    },
  };
}

// Cambio de tipo de zona: re-deriva color/label SOLO si estaban en default.
export function zoneSemanticPatch(
  zone: BoardZone,
  semantic: BoardZoneSemantic,
): { semantic: BoardZoneSemantic; color?: string; label?: string } {
  const patch: { semantic: BoardZoneSemantic; color?: string; label?: string } =
    { semantic };
  if (zone.color === colorForZone(zone.semantic)) {
    patch.color = colorForZone(semantic);
  }
  if (zone.label === labelForZone(zone.semantic)) {
    patch.label = labelForZone(semantic);
  }
  return patch;
}

function colorForZone(semantic: BoardZoneSemantic) {
  // Single-source: el color por semantica vive en boardActionStyle (lo
  // comparten canvas y export).
  return zoneStyle(semantic).color;
}
