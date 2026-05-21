import type { Layer, Lineup, Microcycle, Player, Session } from "@/data";
import Dexie, { type Table } from "dexie";

export type AppSnapshot = {
  version: number;
  selectedExerciseId: string;
  view: "library" | "viewer" | "team" | "sessions" | "video" | "ai" | "player";
  camera: "top" | "iso" | "broadcast";
  time: number;
  speed: number;
  playing: boolean;
  search: string;
  phase: string;
  level: string;
  principle: string;
  showZones: boolean;
  showRuns: boolean;
  showPasses: boolean;
  showPress: boolean;
  layers?: Record<Layer, boolean>;
  team: {
    name: string;
    model: string;
    players: Player[];
    selectedPlayerId: string;
    lineups: Lineup[];
  };
  session: Session;
  microcycle: Microcycle;
  tags: { label: string; time: number }[];
  tracks: { time: number; x: number; y: number; label: string }[];
  aiPrompt: string;
};

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
  return row?.value ?? null;
}

export async function saveSnapshot(snapshot: AppSnapshot, key = "latest") {
  await db.snapshots.put({ key, value: snapshot });
}
