import {
  ExerciseSchema,
  LineupSchema,
  MicrocycleSchema,
  PlayerSchema,
  SessionSchema,
} from "@/data";
import Dexie, { type Table } from "dexie";
import { z } from "zod";

export const APP_SNAPSHOT_VERSION = 1;

// Forma del snapshot definida campo por campo. Mantener el shape separado del
// schema permite validar cada campo de forma aislada para la recuperacion
// tolerante (rescatar lo que se pueda en vez de descartar todo).
const snapshotShape = {
  version: z.number().int().min(1).default(APP_SNAPSHOT_VERSION),
  selectedExerciseId: z.string(),
  view: z.enum([
    "library",
    "viewer",
    "team",
    "sessions",
    "video",
    "ai",
    "player",
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
    name: z.string(),
    model: z.string(),
    players: z.array(PlayerSchema),
    selectedPlayerId: z.string(),
    lineups: z.array(LineupSchema),
  }),
  session: SessionSchema,
  microcycle: MicrocycleSchema,
  tags: z.array(z.object({ label: z.string(), time: z.number().min(0) })),
  tracks: z.array(
    z.object({
      time: z.number().min(0),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      label: z.string(),
    }),
  ),
  aiPrompt: z.string(),
} as const;

const AppSnapshotSchema = z.object(snapshotShape).passthrough();

export type AppSnapshot = z.infer<typeof AppSnapshotSchema>;

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
> = {};

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

function migrateSnapshot(snapshot: AppSnapshot): AppSnapshot {
  const migrated = applyVersionMigrations(
    snapshot as unknown as Record<string, unknown>,
  ) as unknown as AppSnapshot;
  return {
    ...migrated,
    version: APP_SNAPSHOT_VERSION,
    exerciseVariants: migrated.exerciseVariants ?? [],
    personalSpace: migrated.personalSpace ?? false,
    viewerQuality: migrated.viewerQuality ?? "medium",
  };
}

// Recuperacion tolerante: valida cada campo conocido por separado y conserva
// solo los que pasan. Los campos rotos se descartan y el store los completa con
// sus valores por defecto. Devuelve null solo si no se pudo rescatar ningun
// campo reconocible.
function recoverSnapshot(value: unknown): Partial<AppSnapshot> | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  const recovered: Record<string, unknown> = {};

  for (const [field, schema] of Object.entries(snapshotShape)) {
    if (!(field in input)) continue;
    const parsed = (schema as z.ZodTypeAny).safeParse(input[field]);
    if (parsed.success) recovered[field] = parsed.data;
  }

  if (Object.keys(recovered).length === 0) return null;
  return applyVersionMigrations(recovered) as Partial<AppSnapshot>;
}

export function parseSnapshot(value: unknown): AppSnapshot | null {
  const parsed = AppSnapshotSchema.safeParse(value);
  if (parsed.success) return migrateSnapshot(parsed.data);
  // En recuperacion tolerante devolvemos solo los campos rescatados; el store
  // completa el resto con sus defaults al hacer loadSnapshot. Se castea a
  // AppSnapshot por contrato: el consumidor (store) fusiona sobre el estado.
  return recoverSnapshot(value) as AppSnapshot | null;
}
