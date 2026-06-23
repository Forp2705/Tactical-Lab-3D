import {
  ExerciseSchema,
  LineupSchema,
  MicrocycleSchema,
  PlayerSchema,
  SessionSchema,
  Vec2Schema,
} from "@/data";
import { DEFAULT_GAME_MODEL, GameModelSchema } from "@/data/gameModel";
import {
  DEFAULT_OPPONENT_SCOUT,
  OpponentScoutSchema,
} from "@/scout/opponentScout";
import { TeamIdentitySetupSchema } from "@/data/teamIdentitySetup";
import { SketchSchema } from "@/sketch/sketchSchemas";
import { TacticalBoardSchema } from "@/board";
import Dexie, { type Table } from "dexie";
import { z } from "zod";

export const APP_SNAPSHOT_VERSION = 8;

const VideoMomentSchema = z.enum([
  "firstHalf",
  "secondHalf",
  "extraTime",
  "unknown",
]);

const VideoTagSnapshotSchema = z
  .object({
    id: z.string().optional(),
    matchId: z.string().optional(),
    label: z.string(),
    time: z.number().min(0),
    moment: VideoMomentSchema.optional(),
    playerId: z.string().optional(),
    playerName: z.string().optional(),
    zone: z.string().optional(),
    note: z.string().optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
  })
  .transform((tag) => ({
    ...tag,
    id: tag.id || makeStableEventId("tag", tag.time, tag.label),
    matchId: tag.matchId || "current-match",
    moment: tag.moment ?? videoMomentFromTime(tag.time),
    severity: tag.severity ?? "medium",
  }));

const VideoTrackSnapshotSchema = z
  .object({
    id: z.string().optional(),
    matchId: z.string().optional(),
    time: z.number().min(0),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    label: z.string(),
    moment: VideoMomentSchema.optional(),
    playerId: z.string().optional(),
    playerName: z.string().optional(),
    zone: z.string().optional(),
    note: z.string().optional(),
  })
  .transform((track) => ({
    ...track,
    id: track.id || makeStableEventId("track", track.time, track.label),
    matchId: track.matchId || "current-match",
    moment: track.moment ?? videoMomentFromTime(track.time),
  }));

const LineupLabShapeSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: z.enum(["attack", "defense", "transition", "buildup", "abp"]),
  positions: z.record(z.string(), Vec2Schema),
  notes: z.string().optional(),
  createdAt: z.number(),
});

const LineupLabSavedTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  fromShapeId: z.string(),
  fromShapeName: z.string(),
  toShapeId: z.string(),
  toShapeName: z.string(),
  notes: z.string().optional(),
  createdAt: z.number(),
});

const LineupLabSnapshotSchema = z.object({
  shapes: z.array(LineupLabShapeSchema).default([]),
  savedTransitions: z.array(LineupLabSavedTransitionSchema).default([]),
  pendingShapeId: z.string().nullable().default(null),
});

const ManualObservationSnapshotSchema = z.object({
  id: z.string().optional(),
  teamId: z.string().default("team-real-default"),
  text: z.string().min(1),
  createdAt: z.string().optional(),
  source: z.enum(["home", "postMatch"]).default("home"),
}).transform((observation) => ({
  ...observation,
  id:
    observation.id ||
    makeStableEventId("manual-observation", Date.parse(observation.createdAt ?? "") || Date.now(), observation.text),
  createdAt: observation.createdAt ?? new Date().toISOString(),
}));

const LibraryRecentOpenSnapshotSchema = z.object({
  exerciseId: z.string(),
  at: z.string(),
});

const WeeklyDecisionSessionIntentSnapshotSchema = z.object({
  problem: z.string(),
  objective: z.string(),
  successSignal: z.string(),
  reviewCriteria: z.string(),
});

const WeeklyDecisionThreadSnapshotSchema = z
  .object({
    id: z.string(),
    teamId: z.string().default("team-real-default"),
    problem: z.string().min(1),
    origin: z.enum(["manualObservation", "coach", "postMatch", "evolution"]),
    evidenceIds: z.array(z.string()).default([]),
    mode: z.enum(["hypothesis", "diagnosis"]),
    confidence: z.number().min(0).max(1),
    sessionIntent: WeeklyDecisionSessionIntentSnapshotSchema.nullable().default(null),
    nextReviewCriteria: z.array(z.string()).default([]),
    status: z.enum(["open", "trained", "reviewed", "evolved"]),
    progress: z.enum(["open", "improved", "returned", "recurring", "evolved"]).default("open"),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastReportId: z.string().optional(),
  })
  .nullable()
  .default(null);

// Forma del snapshot definida campo por campo. Mantener el shape separado del
// schema permite validar cada campo de forma aislada para la recuperacion
// tolerante (rescatar lo que se pueda en vez de descartar todo).
const snapshotShape = {
  version: z.number().int().min(1).default(APP_SNAPSHOT_VERSION),
  selectedExerciseId: z.string(),
  view: z.enum([
    "home",
    "library",
    "viewer",
    "team",
    "sessions",
    "video",
    "ai",
    "player",
    "board",
  ]),
  camera: z.enum(["top", "iso", "broadcast"]),
  viewerQuality: z.enum(["high", "medium", "low"]).default("medium"),
  time: z.number().min(0),
  speed: z.number().positive(),
  playing: z.boolean(),
  search: z.string(),
  phase: z.string(),
  level: z.string(),
  principle: z.string(),
  exerciseVariants: z.array(ExerciseSchema).default([]),
  showZones: z.boolean(),
  showRuns: z.boolean(),
  showPasses: z.boolean(),
  showPress: z.boolean(),
  personalSpace: z.boolean().default(false),
  layers: z
    .object({
      withBall: z.boolean(),
      withoutBall: z.boolean(),
      press: z.boolean(),
      cover: z.boolean(),
      altA: z.boolean(),
      altB: z.boolean(),
      rival: z.boolean(),
      abp: z.boolean(),
      notes: z.boolean(),
    })
    .optional(),
  team: z.object({
    id: z.string().default("team-real-default"),
    name: z.string(),
    model: z.string(),
    players: z.array(PlayerSchema),
    selectedPlayerId: z.string(),
    lineups: z.array(LineupSchema),
  }),
  workspaceMode: z.enum(["demo", "real"]).default("real"),
  teamIdentity: TeamIdentitySetupSchema.default({}),
  gameModel: GameModelSchema.default(DEFAULT_GAME_MODEL),
  opponentScout: OpponentScoutSchema.default(DEFAULT_OPPONENT_SCOUT),
  session: SessionSchema,
  microcycle: MicrocycleSchema,
  lineupLab: LineupLabSnapshotSchema.optional(),
  tags: z.array(VideoTagSnapshotSchema),
  tracks: z.array(VideoTrackSnapshotSchema),
  manualObservations: z.array(ManualObservationSnapshotSchema).default([]),
  weeklyDecisionThread: WeeklyDecisionThreadSnapshotSchema.default(null),
  libraryFavoriteIds: z.array(z.string()).default([]),
  libraryRecentOpens: z.array(LibraryRecentOpenSnapshotSchema).default([]),
  sketches: z.array(SketchSchema).default([]),
  tacticalBoards: z.array(TacticalBoardSchema).default([]),
  activeBoardId: z.string().nullable().default(null),
  activeBoardSceneId: z.string().nullable().default(null),
  aiPrompt: z.string(),
} as const;

const AppSnapshotSchema = z.object(snapshotShape).passthrough();

type NormalizedAppSnapshot = z.infer<typeof AppSnapshotSchema>;
export type AppSnapshot = z.input<typeof AppSnapshotSchema>;

type SnapshotRow = { key: string; value: unknown; savedAt?: number };

export class TacticalLabDb extends Dexie {
  snapshots!: Table<SnapshotRow, string>;

  constructor() {
    super("tactical-lab-3d");
    this.version(1).stores({
      snapshots: "key",
    });
  }
}

export const db = new TacticalLabDb();

const BACKUP_PREFIX = "backup:";

// Registro de migraciones de version. MIGRATIONS[n] toma un snapshot v{n} y
// devuelve un snapshot v{n+1}. Hoy solo existe la version 1, asi que el registro
// esta vacio; al subir APP_SNAPSHOT_VERSION se agrega aca la transformacion.
const MIGRATIONS: Record<
  number,
  (snap: Record<string, unknown>) => Record<string, unknown>
> = {
  1: (snap) => ({
    ...snap,
    version: 2,
    gameModel: snap.gameModel ?? DEFAULT_GAME_MODEL,
    opponentScout: snap.opponentScout ?? DEFAULT_OPPONENT_SCOUT,
  }),
  2: (snap) => ({
    ...snap,
    version: 3,
    weeklyDecisionThread: snap.weeklyDecisionThread ?? null,
  }),
  3: (snap) => {
    const team = typeof snap.team === "object" && snap.team !== null
      ? (snap.team as Record<string, unknown>)
      : {};
    const teamName =
      typeof team.name === "string" ? team.name : "";
    const isDemo =
      teamName === "Rojo FC" || snap.aiPrompt === "Diagnosticar por que el equipo no logra sostener al pivote cuando pierde la primera linea de pase.";
    const existingTeamId =
      typeof team.id === "string" && team.id.trim() ? team.id : "";
    const teamId =
      existingTeamId && !(isDemo && existingTeamId === "team-real-default")
        ? existingTeamId
        : isDemo
          ? "team-demo-rojo-fc"
          : "team-real-default";
    const manualObservations = Array.isArray(snap.manualObservations)
      ? snap.manualObservations.map((observation) =>
          typeof observation === "object" && observation !== null
            ? {
                teamId,
                ...observation,
              }
            : observation,
        )
      : [];
    const weeklyDecisionThread =
      typeof snap.weeklyDecisionThread === "object" &&
      snap.weeklyDecisionThread !== null
        ? {
            teamId,
            ...(snap.weeklyDecisionThread as Record<string, unknown>),
          }
        : null;

    return {
      ...snap,
      version: 4,
      workspaceMode: isDemo ? "demo" : "real",
      team: {
        ...team,
        id: teamId,
      },
      teamIdentity: isDemo
        ? {
            teamName: "Rojo FC",
            baseFormation: "4-3-3",
            preferredDefensiveHeight: "high",
            pressingPreference: "Presion tras perdida y saltos agresivos sobre pase atras.",
            buildUpPreference:
              "Salida corta con pivote visible y extremos altos para fijar amplitud.",
            trainingDays: 3,
            squadLevel: "semiprofesional",
            notes:
              "Semana piloto enfocada en compactar tras perdida y sostener mejor al pivote.",
          }
        : {
            teamName: teamName,
            baseFormation: "",
            preferredDefensiveHeight: "",
            pressingPreference: "",
            buildUpPreference: "",
            trainingDays: 0,
            squadLevel: "",
            notes: "",
          },
      manualObservations,
      weeklyDecisionThread,
    };
  },
  4: (snap) => ({
    ...snap,
    version: 5,
    libraryFavoriteIds: Array.isArray(snap.libraryFavoriteIds)
      ? snap.libraryFavoriteIds
      : [],
    libraryRecentOpens: Array.isArray(snap.libraryRecentOpens)
      ? snap.libraryRecentOpens
      : [],
  }),
  5: (snap) => ({
    ...snap,
    version: 6,
    sketches: Array.isArray(snap.sketches) ? snap.sketches : [],
  }),
  6: (snap) => ({
    ...snap,
    version: 7,
    tacticalBoards: Array.isArray(snap.tacticalBoards) ? snap.tacticalBoards : [],
  }),
  7: (snap) => ({
    ...snap,
    version: 8,
    activeBoardId: typeof snap.activeBoardId === "string" ? snap.activeBoardId : null,
    activeBoardSceneId:
      typeof snap.activeBoardSceneId === "string" ? snap.activeBoardSceneId : null,
  }),
};

function applyVersionMigrations<T extends Record<string, unknown>>(snap: T): T {
  let current: Record<string, unknown> = { ...snap };
  let version = typeof current.version === "number" ? current.version : 0;

  while (version < APP_SNAPSHOT_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) break;
    current = migrate(current);
    const next =
      typeof current.version === "number" ? current.version : version + 1;
    version = next > version ? next : version + 1;
  }

  current.version = APP_SNAPSHOT_VERSION;
  return current as T;
}

export async function loadSnapshot(key = "latest") {
  const row = await db.snapshots.get(key);
  const raw = row?.value;
  if (raw == null) return null;

  // Detectamos si los datos guardados necesitan recuperacion (parse parcial)
  // o migracion de version. En cualquiera de esos casos guardamos primero una
  // copia cruda del estado previo, para no perder nada.
  const full = AppSnapshotSchema.safeParse(raw);
  const rawVersion =
    typeof (raw as { version?: unknown })?.version === "number"
      ? (raw as { version: number }).version
      : 0;
  const needsRecovery = !full.success;
  const needsMigration = rawVersion !== APP_SNAPSHOT_VERSION;

  if (needsRecovery || needsMigration) {
    await backupSnapshot(key, raw);
  }

  return parseSnapshot(raw);
}

export async function saveSnapshot(snapshot: AppSnapshot, key = "latest") {
  const parsed = AppSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return;
  await db.snapshots.put({
    key,
    value: migrateSnapshot(parsed.data),
    savedAt: Date.now(),
  });
}

// Guarda una copia cruda del estado previo antes de migrar/recuperar. Nunca
// pisa un backup ya existente que provenga de esta misma sesion de carga.
async function backupSnapshot(key: string, raw: unknown) {
  try {
    await db.snapshots.put({
      key: `${BACKUP_PREFIX}${key}`,
      value: raw,
      savedAt: Date.now(),
    });
  } catch {
    // El backup es best-effort: si IndexedDB falla, igual seguimos cargando.
  }
}

export async function loadBackupSnapshot(key = "latest") {
  const row = await db.snapshots.get(`${BACKUP_PREFIX}${key}`);
  return row?.value ?? null;
}

function migrateSnapshot(snapshot: NormalizedAppSnapshot): NormalizedAppSnapshot {
  const migrated = applyVersionMigrations(
    snapshot as unknown as Record<string, unknown>,
  ) as unknown as NormalizedAppSnapshot;
  const teamId = migrated.team?.id || "team-real-default";
  return {
    ...migrated,
    version: APP_SNAPSHOT_VERSION,
    exerciseVariants: migrated.exerciseVariants ?? [],
    personalSpace: migrated.personalSpace ?? false,
    viewerQuality: migrated.viewerQuality ?? "medium",
    team: {
      ...migrated.team,
      id: teamId,
    },
    workspaceMode: migrated.workspaceMode ?? "real",
    teamIdentity: migrated.teamIdentity ?? {},
    gameModel: migrated.gameModel ?? DEFAULT_GAME_MODEL,
    opponentScout: migrated.opponentScout ?? DEFAULT_OPPONENT_SCOUT,
    lineupLab: migrated.lineupLab ?? {
      shapes: [],
      savedTransitions: [],
      pendingShapeId: null,
    },
    tags: (migrated.tags ?? []).map(normalizeVideoTag),
    tracks: (migrated.tracks ?? []).map(normalizeVideoTrack),
    manualObservations: (migrated.manualObservations ?? []).map(
      normalizeManualObservation,
    ),
    weeklyDecisionThread: migrated.weeklyDecisionThread
      ? {
          ...migrated.weeklyDecisionThread,
          teamId: migrated.weeklyDecisionThread.teamId || teamId,
        }
      : null,
    libraryFavoriteIds: migrated.libraryFavoriteIds ?? [],
    libraryRecentOpens: migrated.libraryRecentOpens ?? [],
    sketches: migrated.sketches ?? [],
    tacticalBoards: migrated.tacticalBoards ?? [],
    activeBoardId: migrated.activeBoardId ?? null,
    activeBoardSceneId: migrated.activeBoardSceneId ?? null,
  };
}

// Recuperacion tolerante: valida cada campo conocido por separado y conserva
// solo los que pasan. Los campos rotos se descartan y el store los completa con
// sus valores por defecto. Devuelve null solo si no se pudo rescatar ningun
// campo reconocible.
function recoverSnapshot(value: unknown): Partial<NormalizedAppSnapshot> | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  const recovered: Record<string, unknown> = {};

  for (const [field, schema] of Object.entries(snapshotShape)) {
    if (!(field in input)) continue;
    const parsed = (schema as z.ZodTypeAny).safeParse(input[field]);
    if (parsed.success) recovered[field] = parsed.data;
  }

  if (Object.keys(recovered).length === 0) return null;
  return applyVersionMigrations(recovered) as Partial<NormalizedAppSnapshot>;
}

export function parseSnapshot(value: unknown): NormalizedAppSnapshot | null {
  const parsed = AppSnapshotSchema.safeParse(value);
  if (parsed.success) return migrateSnapshot(parsed.data);
  // En recuperacion tolerante devolvemos solo los campos rescatados; el store
  // completa el resto con sus defaults al hacer loadSnapshot. Se castea a
  // AppSnapshot por contrato: el consumidor (store) fusiona sobre el estado.
  return recoverSnapshot(value) as NormalizedAppSnapshot | null;
}

function normalizeVideoTag(
  tag: z.infer<typeof VideoTagSnapshotSchema>,
): z.infer<typeof VideoTagSnapshotSchema> {
  return {
    ...tag,
    id: tag.id ?? makeStableEventId("tag", tag.time, tag.label),
    matchId: tag.matchId ?? "current-match",
    moment: tag.moment ?? videoMomentFromTime(tag.time),
    severity: tag.severity ?? "medium",
  };
}

function normalizeVideoTrack(
  track: z.infer<typeof VideoTrackSnapshotSchema>,
): z.infer<typeof VideoTrackSnapshotSchema> {
  return {
    ...track,
    id: track.id ?? makeStableEventId("track", track.time, track.label),
    matchId: track.matchId ?? "current-match",
    moment: track.moment ?? videoMomentFromTime(track.time),
  };
}

function normalizeManualObservation(
  observation: z.infer<typeof ManualObservationSnapshotSchema>,
): z.infer<typeof ManualObservationSnapshotSchema> {
  return {
    ...observation,
    id:
      observation.id ||
      makeStableEventId(
        "manual-observation",
        Date.parse(observation.createdAt ?? "") || Date.now(),
        observation.text,
      ),
    createdAt: observation.createdAt ?? new Date().toISOString(),
    teamId: observation.teamId ?? "team-real-default",
    source: observation.source ?? "home",
  };
}

function makeStableEventId(prefix: string, time: number, label: string) {
  return `${prefix}-${Math.round(time * 1000)}-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;
}

function videoMomentFromTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return "unknown" as const;
  if (time < 45 * 60) return "firstHalf" as const;
  if (time < 90 * 60) return "secondHalf" as const;
  return "extraTime" as const;
}
