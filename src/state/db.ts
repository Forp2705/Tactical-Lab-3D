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

const AppSnapshotSchema = z
  .object({
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
  })
  .passthrough();

export type AppSnapshot = z.infer<typeof AppSnapshotSchema>;

export class TacticalLabDb extends Dexie {
  snapshots!: Table<{ key: string; value: AppSnapshot | null }, string>;

  constructor() {
    super("tactical-lab-3d");
    this.version(1).stores({
      snapshots: "key",
    });
  }
}

export const db = new TacticalLabDb();

export async function loadSnapshot(key = "latest") {
  const row = await db.snapshots.get(key);
  return parseSnapshot(row?.value);
}

export async function saveSnapshot(snapshot: AppSnapshot, key = "latest") {
  const parsed = AppSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return;
  await db.snapshots.put({ key, value: migrateSnapshot(parsed.data) });
}

function migrateSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    version: APP_SNAPSHOT_VERSION,
    exerciseVariants: snapshot.exerciseVariants ?? [],
    personalSpace: snapshot.personalSpace ?? false,
  };
}

export function parseSnapshot(value: unknown) {
  const parsed = AppSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  return migrateSnapshot(parsed.data);
}
