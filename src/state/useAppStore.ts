import type {
  Exercise,
  Layer,
  Lineup,
  Material,
  Microcycle,
  Player,
  Session,
} from "@/data";
import { catalog, demoPlayers } from "@/data";
import { create } from "zustand";

export type ViewId =
  | "library"
  | "viewer"
  | "team"
  | "sessions"
  | "video"
  | "ai"
  | "player";
export type CameraId = "top" | "iso" | "broadcast";

type TeamState = {
  name: string;
  model: string;
  players: Player[];
  selectedPlayerId: string;
  lineups: Lineup[];
};

type AppState = {
  version: number;
  selectedExerciseId: string;
  view: ViewId;
  camera: CameraId;
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
  layers: Record<Layer, boolean>;
  team: TeamState;
  session: Session;
  microcycle: Microcycle;
  tags: { label: string; time: number }[];
  tracks: { time: number; x: number; y: number; label: string }[];
  aiPrompt: string;
  initialized: boolean;
  viewerExerciseOverride: Exercise | null;
  presentationMode: boolean;
  setView: (view: ViewId) => void;
  setPresentationMode: (enabled: boolean) => void;
  setCamera: (camera: CameraId) => void;
  setTime: (time: number) => void;
  setSpeed: (speed: number) => void;
  togglePlaying: () => void;
  selectExercise: (id: string) => void;
  setSearch: (value: string) => void;
  setFilter: (key: "phase" | "level" | "principle", value: string) => void;
  toggleLayer: (
    key: "showZones" | "showRuns" | "showPasses" | "showPress",
  ) => void;
  toggleTacticalLayer: (layer: Layer) => void;
  addTag: (label: string, time: number) => void;
  addTrack: (x: number, y: number, time: number) => void;
  addToSession: (exerciseId: string) => void;
  updateSessionBlock: (
    id: string,
    patch: Partial<Session["blocks"][number]>,
  ) => void;
  removeSessionBlock: (id: string) => void;
  reorderSessionBlocks: (activeId: string, overId: string) => void;
  addLineup: (lineup: Lineup) => void;
  applyLineupToViewer: (lineupId: string) => void;
  addPlayer: () => void;
  setSelectedPlayerId: (id: string) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  loadSnapshot: (snapshot: Partial<AppState>) => void;
  markInitialized: () => void;
  setAiPrompt: (prompt: string) => void;
};

const makeSession = (): Session => ({
  id: "session_1",
  name: "Sesión demo",
  blocks: [],
  computed: {
    totalDuration: 0,
    totalLoad: 0,
    materials: [],
    primaryObjectives: [],
  },
  staffNotes: "",
});

const makeMicrocycle = (): Microcycle => ({
  id: "micro_1",
  name: "Microciclo demo",
  weekOf: new Date().toISOString().slice(0, 10),
  days: {
    "MD+1": { objective: "Recuperación", targetLoad: "low" },
    "MD+2": { objective: "Base aeróbica", targetLoad: "low" },
    "MD-4": { objective: "Principio principal", targetLoad: "high" },
    "MD-3": { objective: "Intensidad", targetLoad: "high" },
    "MD-2": { objective: "ABP + ajustes", targetLoad: "med" },
    "MD-1": { objective: "Activación", targetLoad: "low" },
    MD: { objective: "Partido", targetLoad: "med" },
  },
  alerts: [],
});

const initialTeam: TeamState = {
  name: "Rojo FC",
  model: "4-3-3 agresivo, presión tras pérdida y ataques por banda",
  players: demoPlayers,
  selectedPlayerId: demoPlayers[0]?.id ?? "",
  lineups: [],
};

const defaultLayers: Record<Layer, boolean> = {
  withBall: true,
  withoutBall: true,
  press: true,
  cover: true,
  altA: true,
  altB: true,
  rival: true,
  abp: true,
  notes: true,
};

function recomputeSession(blocks: Session["blocks"]) {
  const materials = new Map<string, Material>();
  const objectives = new Set<string>();
  let totalDuration = 0;
  let totalLoad = 0;

  for (const block of blocks) {
    const exercise = catalog.find((item) => item.id === block.exerciseId);
    if (!exercise) continue;
    totalDuration += block.durationMin;
    totalLoad += block.durationMin * exercise.rpe;
    objectives.add(exercise.objective.primary);
    for (const material of exercise.material) {
      const existing = materials.get(material.name);
      if (!existing) {
        materials.set(material.name, { ...material });
      } else {
        existing.qty += material.qty;
      }
    }
  }

  return {
    totalDuration,
    totalLoad,
    materials: Array.from(materials.values()),
    primaryObjectives: Array.from(objectives),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  version: 1,
  selectedExerciseId: catalog[0]?.id ?? "",
  view: "library",
  camera: "iso",
  time: 0,
  speed: 1,
  playing: false,
  search: "",
  phase: "all",
  level: "all",
  principle: "all",
  showZones: true,
  showRuns: true,
  showPasses: true,
  showPress: true,
  layers: defaultLayers,
  team: initialTeam,
  session: makeSession(),
  microcycle: makeMicrocycle(),
  tags: [],
  tracks: [],
  aiPrompt: "",
  initialized: false,
  viewerExerciseOverride: null,
  presentationMode: false,
  setView: (view) =>
    set({
      view,
      presentationMode: view === "viewer" ? get().presentationMode : false,
    }),
  setPresentationMode: (enabled) => set({ presentationMode: enabled }),
  setCamera: (camera) => set({ camera }),
  setTime: (time) => set({ time }),
  setSpeed: (speed) => set({ speed }),
  togglePlaying: () => set({ playing: !get().playing }),
  selectExercise: (id) =>
    set({
      selectedExerciseId: id,
      time: 0,
      playing: false,
      viewerExerciseOverride: null,
    }),
  setSearch: (value) => set({ search: value }),
  setFilter: (key, value) =>
    set({ [key]: value } as Pick<AppState, "phase" | "level" | "principle">),
  toggleLayer: (key) =>
    set({ [key]: !get()[key] } as Pick<
      AppState,
      "showZones" | "showRuns" | "showPasses" | "showPress"
    >),
  toggleTacticalLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  addTag: (label, time) => set({ tags: [...get().tags, { label, time }] }),
  addTrack: (x, y, time) =>
    set({ tracks: [...get().tracks, { x, y, time, label: "manual" }] }),
  addToSession: (exerciseId) => {
    const exercise = catalog.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const nextBlock = {
      id: crypto.randomUUID(),
      exerciseId,
      durationMin: exercise.duration,
      swappable: true,
    };
    const session = get().session;
    const blocks = [...session.blocks, nextBlock];
    set({
      session: { ...session, blocks, computed: recomputeSession(blocks) },
    });
  },
  updateSessionBlock: (id, patch) =>
    set((state) => {
      const blocks = state.session.blocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
      );
      return {
        session: {
          ...state.session,
          blocks,
          computed: recomputeSession(blocks),
        },
      };
    }),
  removeSessionBlock: (id) =>
    set((state) => {
      const blocks = state.session.blocks.filter((block) => block.id !== id);
      return {
        session: {
          ...state.session,
          blocks,
          computed: recomputeSession(blocks),
        },
      };
    }),
  reorderSessionBlocks: (activeId, overId) =>
    set((state) => {
      const blocks = [...state.session.blocks];
      const from = blocks.findIndex((block) => block.id === activeId);
      const to = blocks.findIndex((block) => block.id === overId);
      if (from === -1 || to === -1 || from === to) return state;
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return {
        session: {
          ...state.session,
          blocks,
          computed: recomputeSession(blocks),
        },
      };
    }),
  addLineup: (lineup) =>
    set({ team: { ...get().team, lineups: [...get().team.lineups, lineup] } }),
  applyLineupToViewer: (lineupId) => {
    const state = get();
    const lineup = state.team.lineups.find((item) => item.id === lineupId);
    const base =
      catalog.find((item) => item.id === state.selectedExerciseId) ??
      catalog[0];
    if (!lineup || !base) return;

    set({
      viewerExerciseOverride: applyLineupToExercise(
        base,
        lineup,
        state.team.players,
      ),
      view: "viewer",
      time: 0,
      playing: false,
    });
  },
  addPlayer: () => {
    const nextIndex = get().team.players.length + 1;
    const player: Player = {
      id: `pl_${Date.now()}`,
      name: "Nuevo jugador",
      num: nextIndex,
      positions: ["CM"],
      foot: "R",
      status: "available",
      profile: "Perfil a definir",
      attributes: {
        speed: 60,
        stamina: 60,
        pass: 60,
        control: 60,
        press: 60,
        duel: 60,
        tactical: 60,
      },
    };
    set({
      team: {
        ...get().team,
        players: [...get().team.players, player],
        selectedPlayerId: player.id,
      },
    });
  },
  setSelectedPlayerId: (id) =>
    set({ team: { ...get().team, selectedPlayerId: id } }),
  updatePlayer: (id, patch) =>
    set({
      team: {
        ...get().team,
        players: get().team.players.map((player) =>
          player.id === id ? { ...player, ...patch } : player,
        ),
      },
    }),
  loadSnapshot: (snapshot) =>
    set((current) => ({
      ...current,
      ...snapshot,
      layers: { ...defaultLayers, ...snapshot.layers },
      initialized: true,
    })),
  markInitialized: () => set({ initialized: true }),
  setAiPrompt: (prompt) => set({ aiPrompt: prompt }),
}));

export function getExerciseById(id: string) {
  return catalog.find((exercise) => exercise.id === id) ?? catalog[0];
}

export function getSelectedPlayer(state = useAppStore.getState()) {
  return (
    state.team.players.find(
      (player) => player.id === state.team.selectedPlayerId,
    ) ?? state.team.players[0]
  );
}

function applyLineupToExercise(
  exercise: Exercise,
  lineup: Lineup,
  players: Player[],
): Exercise {
  const ownActors = lineup.ownPositions.map((entry) => {
    const player = players.find((item) => item.id === entry.playerId);

    return {
      id: `lineup-${entry.playerId}`,
      team: "own" as const,
      num: player?.num ?? 0,
      role: entry.role,
      start: entry.pos,
      path: [],
      facingMode: "auto" as const,
      state: [],
    };
  });
  const rivalActors =
    lineup.rivalPositions?.map((entry, index) => ({
      id: `lineup-rival-${index}`,
      team: "rival" as const,
      num: index + 1,
      role: entry.role,
      start: entry.pos,
      path: [],
      facingMode: "auto" as const,
      state: [],
    })) ?? [];
  const actors = [
    ...ownActors,
    ...(rivalActors.length
      ? rivalActors
      : exercise.scene.actors.filter((actor) => actor.team === "rival")),
    ...exercise.scene.actors.filter((actor) => actor.team === "neutral"),
  ];
  const actorIds = new Set(actors.map((actor) => actor.id));
  const overlays = exercise.scene.overlays.filter(
    (overlay) =>
      endpointIsValid(overlay.from, actorIds) &&
      endpointIsValid(overlay.to, actorIds),
  );
  const firstOwn = ownActors[0]?.start ?? { x: 50, y: 50 };

  return {
    ...exercise,
    id: `${exercise.id}__lineup__${lineup.id}`,
    title: `${exercise.title} - ${lineup.name}`,
    players: {
      min: ownActors.length,
      max: Math.max(ownActors.length, exercise.players.max),
    },
    scene: {
      ...exercise.scene,
      actors,
      overlays,
      ball: {
        start: { ...firstOwn, z: 0 },
        path: [],
        carrier: ownActors[0]?.id,
      },
    },
  };
}

function endpointIsValid(
  endpoint: Exercise["scene"]["overlays"][number]["from"],
  actorIds: Set<string>,
) {
  return typeof endpoint !== "string" || actorIds.has(endpoint);
}
