import type {
  CoachResponse,
  CollectedAnswer,
  ContextualQuestion,
  EvidenceAudit,
  ImpliedClaim,
  TacticalIntent,
} from "@/ai/CoachSchemas";
import type {
  Exercise,
  Layer,
  Lineup,
  Material,
  Microcycle,
  Player,
  Session,
  Vec2,
} from "@/data";
import {
  DEFAULT_GAME_MODEL,
  EMPTY_GAME_MODEL,
  type GameModel,
  normalizeGameModel,
} from "@/data/gameModel";
import {
  createDemoTeamIdentitySetup,
  createEmptyTeamIdentitySetup,
  isTeamIdentityConfigured,
  summarizeTeamIdentity,
  type TeamIdentitySetup,
} from "@/data/teamIdentitySetup";
import {
  DEFAULT_OPPONENT_SCOUT,
  type OpponentScout,
  normalizeOpponentScout,
} from "@/scout/opponentScout";
import { APP_SNAPSHOT_VERSION } from "./db";
import { createBlankSketch, SketchSchema, type Sketch } from "@/sketch/sketchSchemas";
import {
  buildSessionPlanFromDiagnosis,
  buildSessionPlanFromWeeklyThread,
  materializeDiagnosisSession,
} from "@/sessions/diagnosisSession";
import { catalog, demoPlayers, ExerciseSchema } from "@/data";
import {
  PILOT_DIAGNOSIS_PROMPT,
  PILOT_SESSION_BLOCKS,
  PILOT_SESSION_NOTES,
} from "@/demo/pilotState";
import {
  buildPendingPostMatchImport,
  buildThreadFromCoachResponse,
  buildThreadFromObservation,
  buildThreadFromPostMatchReport,
  buildSessionIntentFromProblem,
  evolveThreadStatus,
  type PendingPostMatchImport,
  type WeeklyDecisionSessionIntent,
  type WeeklyDecisionThread,
  type WeeklyDecisionThreadProgress,
  type WeeklyDecisionThreadReportInput,
} from "@/state/weeklyDecisionThread";
import { create } from "zustand";

export type ViewId =
  | "home"
  | "library"
  | "viewer"
  | "team"
  | "sessions"
  | "video"
  | "ai"
  | "player";
export type CameraId = "top" | "iso" | "broadcast";
export type ViewerQuality = "high" | "medium" | "low";
export type AiMode = "coach" | "postMatch";

export type ExportStatus = {
  phase: "recording" | "encoding";
  format: "mp4" | "gif" | "png";
};

export type LibraryRecentOpen = {
  exerciseId: string;
  at: string;
};

export type VideoMoment = "firstHalf" | "secondHalf" | "extraTime" | "unknown";

export type VideoEventSeverity = "low" | "medium" | "high";

export type VideoTag = {
  id: string;
  matchId: string;
  label: string;
  time: number;
  moment: VideoMoment;
  playerId?: string;
  playerName?: string;
  zone?: string;
  note?: string;
  severity: VideoEventSeverity;
};

export type VideoTrack = {
  id: string;
  matchId: string;
  time: number;
  x: number;
  y: number;
  label: string;
  moment: VideoMoment;
  playerId?: string;
  playerName?: string;
  zone?: string;
  note?: string;
};

export type ManualObservationSource = "home" | "postMatch";

export type ManualObservation = {
  id: string;
  teamId: string;
  text: string;
  createdAt: string;
  source: ManualObservationSource;
};

type VideoTagInput = Omit<VideoTag, "id" | "moment" | "severity"> & {
  id?: string;
  moment?: VideoMoment;
  severity?: VideoEventSeverity;
};

type VideoTrackInput = Omit<VideoTrack, "id" | "moment"> & {
  id?: string;
  moment?: VideoMoment;
};

type ManualObservationInput = Omit<ManualObservation, "id" | "createdAt" | "teamId"> & {
  teamId?: string;
  id?: string;
  createdAt?: string;
};

export type CoachShapePlayer = {
  playerId: string;
  name: string;
  role: string;
  x: number;
  y: number;
};

export type CoachShapeSummary = {
  id: string;
  name: string;
  phase: string;
  notes?: string;
  summary: string;
  metrics?: CoachShapeMetrics;
  players: CoachShapePlayer[];
};

export type CoachRivalReference = {
  id: string;
  num: number;
  role: string;
  x: number;
  y: number;
};

export type CoachShapeContext = {
  formation: string;
  selectedShapeId: string | null;
  selectedShapeName?: string;
  currentBoardSummary: string;
  currentMetrics?: CoachShapeMetrics;
  currentBoard: CoachShapePlayer[];
  transition?: {
    fromShapeId: string | null;
    fromShapeName?: string;
    toShapeId: string | null;
    toShapeName?: string;
  };
  shapes: CoachShapeSummary[];
  savedTransitions?: CoachSavedTransitionSummary[];
  rivalReference?: CoachRivalReference[];
};

export type CoachShapeMetrics = {
  width: number;
  depth: number;
  compactness: number;
  duels: number;
  heatScore: number;
  blockHeight: number;
  center: { x: number; z: number };
  lineDistances: {
    defense?: number;
    midfield?: number;
    attack?: number;
    defenseToMidfield?: number;
    midfieldToAttack?: number;
    defenseToAttack?: number;
  };
};

export type CoachSavedTransitionSummary = {
  id: string;
  name: string;
  fromShapeId: string;
  fromShapeName: string;
  toShapeId: string;
  toShapeName: string;
  notes?: string;
};

export type LabShapePhase = "attack" | "defense" | "transition" | "buildup" | "abp";

export type LineupLabShape = {
  id: string;
  name: string;
  phase: LabShapePhase;
  positions: Record<string, Vec2>;
  notes?: string;
  createdAt: number;
};

export type LineupLabSavedTransition = {
  id: string;
  name: string;
  fromShapeId: string;
  fromShapeName: string;
  toShapeId: string;
  toShapeName: string;
  notes?: string;
  createdAt: number;
};

export type LineupLabStoreState = {
  shapes: LineupLabShape[];
  savedTransitions: LineupLabSavedTransition[];
  pendingShapeId: string | null;
};

type TeamState = {
  id: string;
  name: string;
  model: string;
  players: Player[];
  selectedPlayerId: string;
  lineups: Lineup[];
};

export type WorkspaceMode = "demo" | "real";

export type CoachInterviewRuntimeState = {
  active: boolean;
  intent: TacticalIntent | null;
  temptingClaims: ImpliedClaim[];
  audit: EvidenceAudit | null;
  questions: ContextualQuestion[];
  collectedEvidence: CollectedAnswer[];
  turn: number;
  skipped: boolean;
};

type AppState = {
  version: number;
  selectedExerciseId: string;
  view: ViewId;
  camera: CameraId;
  viewerQuality: ViewerQuality;
  time: number;
  speed: number;
  playing: boolean;
  search: string;
  phase: string;
  level: string;
  principle: string;
  exerciseVariants: Exercise[];
  showZones: boolean;
  showRuns: boolean;
  showPasses: boolean;
  showPress: boolean;
  personalSpace: boolean;
  layers: Record<Layer, boolean>;
  team: TeamState;
  workspaceMode: WorkspaceMode;
  teamIdentity: TeamIdentitySetup;
  gameModel: GameModel;
  opponentScout: OpponentScout;
  session: Session;
  microcycle: Microcycle;
  lineupLab: LineupLabStoreState;
  tags: VideoTag[];
  tracks: VideoTrack[];
  manualObservations: ManualObservation[];
  weeklyDecisionThread: WeeklyDecisionThread | null;
  aiMode: AiMode;
  aiPrompt: string;
  coachInterview: CoachInterviewRuntimeState;
  pendingPostMatchImport: PendingPostMatchImport | null;
  coachShapeContext: CoachShapeContext | null;
  initialized: boolean;
  viewerExerciseOverride: Exercise | null;
  presentationMode: boolean;
  exportStatus: ExportStatus | null;
  libraryFavoriteIds: string[];
  libraryRecentOpens: LibraryRecentOpen[];
  sketches: Sketch[];
  setView: (view: ViewId) => void;
  setPresentationMode: (enabled: boolean) => void;
  setExportStatus: (status: ExportStatus | null) => void;
  setCamera: (camera: CameraId) => void;
  setViewerQuality: (quality: ViewerQuality) => void;
  setTime: (time: number) => void;
  setSpeed: (speed: number) => void;
  togglePlaying: () => void;
  selectExercise: (id: string) => void;
  duplicateSelectedExercise: () => void;
  createExerciseVariantFrom: (
    exerciseId: string,
    options?: { title?: string; authorNotes?: string },
  ) => string | null;
  createExerciseFromShape: (
    shapeId: string,
    options?: { title?: string; authorNotes?: string },
  ) => string | null;
  importExerciseVariant: (exercise: Exercise) => string | null;
  createBlankExercise: (options?: { title?: string }) => string | null;
  toggleLibraryFavorite: (exerciseId: string) => void;
  recordLibraryOpen: (exerciseId: string) => void;
  createSketch: (options?: { title?: string }) => string;
  updateSketch: (id: string, patch: Partial<Omit<Sketch, "id" | "createdAt">>) => void;
  deleteSketch: (id: string) => void;
  renameSketch: (id: string, title: string) => void;
  attachSketchToSessionBlock: (blockId: string, sketchId: string) => void;
  detachSketchFromSessionBlock: (blockId: string) => void;
  setSearch: (value: string) => void;
  setFilter: (key: "phase" | "level" | "principle", value: string) => void;
  toggleLayer: (
    key: "showZones" | "showRuns" | "showPasses" | "showPress",
  ) => void;
  togglePersonalSpace: () => void;
  toggleTacticalLayer: (layer: Layer) => void;
  addTag: (tag: VideoTagInput) => void;
  addTrack: (track: VideoTrackInput) => void;
  updateTrack: (id: string, patch: Partial<Omit<VideoTrack, "id">>) => void;
  removeTrack: (id: string) => void;
  clearAssistedTracks: (matchId?: string) => void;
  addManualObservation: (observation: ManualObservationInput) => string | null;
  removeManualObservation: (id: string) => void;
  clearManualObservations: () => void;
  activateWeeklyThreadFromObservation: (observationId: string) => void;
  addToSession: (exerciseId: string) => void;
  updateSessionBlock: (
    id: string,
    patch: Partial<Session["blocks"][number]>,
  ) => void;
  removeSessionBlock: (id: string) => void;
  reorderSessionBlocks: (activeId: string, overId: string) => void;
  addLineup: (lineup: Lineup) => void;
  applyLineupToViewer: (lineupId: string) => void;
  setLineupLabShapes: (shapes: LineupLabShape[]) => void;
  setLineupLabTransitions: (
    savedTransitions: LineupLabSavedTransition[],
  ) => void;
  requestApplyShape: (shapeId: string) => void;
  consumePendingShape: () => void;
  addPlayer: () => void;
  loadDemoWorkspace: () => void;
  loadRealWorkspace: () => void;
  updateTeamIdentity: (patch: Partial<TeamIdentitySetup>) => void;
  removePlayer: (id: string) => void;
  setSelectedPlayerId: (id: string) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  updateGameModel: (patch: Partial<GameModel>) => void;
  updateOpponentScout: (patch: Partial<OpponentScout>) => void;
  createSessionFromWeeklyThread: () => boolean;
  createSessionFromCoachAdvice: (response: CoachResponse) => boolean;
  syncWeeklyThreadFromPostMatchReport: (
    report: WeeklyDecisionThreadReportInput,
  ) => void;
  syncWeeklyThreadProgress: (
    progress: WeeklyDecisionThreadProgress,
    reportId?: string,
  ) => void;
  loadSnapshot: (snapshot: Partial<AppState>) => void;
  markInitialized: () => void;
  setAiMode: (mode: AiMode) => void;
  setAiPrompt: (prompt: string) => void;
  recordCoachAnswer: (answer: CollectedAnswer) => void;
  clearCoachAnswer: (questionId: string) => void;
  applyCoachTurnResult: (response: CoachResponse) => void;
  skipCoachInterview: () => void;
  resetCoachInterview: () => void;
  queuePostMatchManualObservations: (observationIds: string[]) => void;
  setPendingPostMatchImport: (value: PendingPostMatchImport | null) => void;
  consumePendingPostMatchImport: () => PendingPostMatchImport | null;
  setCoachShapeContext: (context: CoachShapeContext | null) => void;
};

const makeSession = (): Session => ({
  id: "session_1",
  name: "Sesion semanal",
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
  name: "Microciclo semanal",
  weekOf: new Date().toISOString().slice(0, 10),
  days: {
    "MD+1": { objective: "Recuperacion", targetLoad: "low" },
    "MD+2": { objective: "Base aerobica", targetLoad: "low" },
    "MD-4": { objective: "Principio principal", targetLoad: "high" },
    "MD-3": { objective: "Intensidad", targetLoad: "high" },
    "MD-2": { objective: "ABP + ajustes", targetLoad: "med" },
    "MD-1": { objective: "Activacion", targetLoad: "low" },
    MD: { objective: "Partido", targetLoad: "med" },
  },
  alerts: [],
});

const initialTeam: TeamState = {
  id: "team-real-default",
  name: "",
  model: "",
  players: [],
  selectedPlayerId: "",
  lineups: [],
};

const initialLineupLab: LineupLabStoreState = {
  shapes: [],
  savedTransitions: [],
  pendingShapeId: null,
};

const initialCoachInterview: CoachInterviewRuntimeState = {
  active: false,
  intent: null,
  temptingClaims: [],
  audit: null,
  questions: [],
  collectedEvidence: [],
  turn: 0,
  skipped: false,
};

function buildThreadSessionIntentFromSession(session: Session, problem: string) {
  return buildSessionIntentFromProblem(problem, {
    objective:
      extractTaggedValue(session.staffNotes, "Objetivo tactico") ||
      "Transformar el problema tactico en una respuesta entrenable.",
    successSignal:
      extractTaggedValue(session.staffNotes, "Senales del sabado") ||
      "Definir que comportamiento debe aparecer en el siguiente partido.",
    reviewCriteria:
      extractTaggedValue(session.staffNotes, "Test de miercoles") ||
      "Revisar el ajuste en el siguiente partido.",
  });
}

function isSessionLinkedToThread(session: Session, thread: WeeklyDecisionThread) {
  const text = normalizeObservationText(
    [
      session.staffNotes,
      ...session.blocks.map((block) => block.notes ?? ""),
    ].join("\n"),
  );
  return (
    text.includes(normalizeObservationText(thread.problem)) ||
    text.includes(normalizeObservationText(thread.sessionIntent?.objective ?? ""))
  );
}

function syncThreadWithSessionPlan(
  thread: WeeklyDecisionThread,
  plan: DiagnosisSessionPlanLike,
): WeeklyDecisionThread {
  const sessionIntent: WeeklyDecisionSessionIntent = {
    problem: plan.problemStatement,
    objective: plan.tacticalObjective,
    successSignal:
      plan.saturdaySignals[0] ||
      thread.sessionIntent?.successSignal ||
      "Validar una mejor ejecucion del ajuste.",
    reviewCriteria:
      plan.reviewFocus ||
      thread.sessionIntent?.reviewCriteria ||
      "Revisar el ajuste en el siguiente partido.",
  };

  return {
    ...thread,
    problem: plan.problemStatement,
    confidence: thread.confidence,
    sessionIntent,
    nextReviewCriteria: [
      sessionIntent.reviewCriteria,
      ...plan.saturdaySignals,
    ].filter(Boolean),
    status: "trained",
    progress: thread.progress === "evolved" ? "open" : thread.progress,
    updatedAt: new Date().toISOString(),
  };
}

type DiagnosisSessionPlanLike = {
  problemStatement: string;
  tacticalObjective: string;
  reviewFocus: string;
  saturdaySignals: string[];
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

function recomputeSession(
  blocks: Session["blocks"],
  variants: Exercise[] = [],
) {
  const materials = new Map<string, Material>();
  const objectives = new Set<string>();
  let totalDuration = 0;
  let totalLoad = 0;

  for (const block of blocks) {
    const exercise = findExercise(block.exerciseId, variants);
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

const seededSession: Session = {
  ...makeSession(),
  name: "Semana piloto - compactar tras perdida",
  blocks: PILOT_SESSION_BLOCKS,
  computed: recomputeSession(PILOT_SESSION_BLOCKS),
  staffNotes: PILOT_SESSION_NOTES,
};

const seededMicrocycle: Microcycle = {
  ...makeMicrocycle(),
  days: {
    "MD+1": { objective: "Recuperacion", targetLoad: "low" },
    "MD+2": { objective: "Base aerobica", targetLoad: "low" },
    "MD-4": { objective: "Principio principal", targetLoad: "high" },
    "MD-3": { objective: "Intensidad", targetLoad: "high" },
    "MD-2": { objective: "ABP + ajustes", targetLoad: "med" },
    "MD-1": { objective: "Activacion", targetLoad: "low" },
    MD: { objective: "Partido", targetLoad: "med" },
  },
};

const seededTeam: TeamState = {
  ...initialTeam,
  id: "team-demo-rojo-fc",
  name: "Rojo FC",
  players: demoPlayers,
  selectedPlayerId: demoPlayers[0]?.id ?? "",
  model: "4-3-3 agresivo, presion tras perdida y ataques por banda",
};

const seededWeeklyDecisionThread: WeeklyDecisionThread = {
  id: "weekly-thread-seed",
  teamId: seededTeam.id,
  problem: PILOT_DIAGNOSIS_PROMPT,
  origin: "coach",
  evidenceIds: [],
  mode: "hypothesis",
  confidence: 0.56,
  sessionIntent: buildThreadSessionIntentFromSession(
    seededSession,
    PILOT_DIAGNOSIS_PROMPT,
  ),
  nextReviewCriteria: [
    extractTaggedValue(seededSession.staffNotes, "Test de miercoles") ||
      "Revisar el ajuste en el siguiente partido.",
  ],
  status: seededSession.blocks.length ? "trained" : "open",
  progress: "open",
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

function createRealWorkspaceState() {
  return {
    workspaceMode: "real" as const,
    team: {
      ...initialTeam,
      id: "team-real-default",
    },
    teamIdentity: createEmptyTeamIdentitySetup(),
    gameModel: EMPTY_GAME_MODEL,
    session: makeSession(),
    microcycle: makeMicrocycle(),
    manualObservations: [] as ManualObservation[],
    weeklyDecisionThread: null as WeeklyDecisionThread | null,
    aiPrompt: "",
  };
}

function createDemoWorkspaceState() {
  return {
    workspaceMode: "demo" as const,
    team: seededTeam,
    teamIdentity: createDemoTeamIdentitySetup(),
    gameModel: DEFAULT_GAME_MODEL,
    session: seededSession,
    microcycle: seededMicrocycle,
    manualObservations: [] as ManualObservation[],
    weeklyDecisionThread: seededWeeklyDecisionThread,
    aiPrompt: PILOT_DIAGNOSIS_PROMPT,
  };
}

function ensureTeamState(team?: Partial<TeamState> | null): TeamState {
  return {
    id: team?.id?.trim() || "team-real-default",
    name: team?.name?.trim() ?? "",
    model: team?.model?.trim() ?? "",
    players: team?.players ?? [],
    selectedPlayerId: team?.selectedPlayerId ?? "",
    lineups: team?.lineups ?? [],
  };
}

function inferWorkspaceModeFromSnapshot(snapshot: Partial<AppState>, team: TeamState) {
  if (snapshot.workspaceMode === "demo" || snapshot.workspaceMode === "real") {
    return snapshot.workspaceMode;
  }
  if (
    team.id === seededTeam.id ||
    team.name === seededTeam.name ||
    snapshot.aiPrompt === PILOT_DIAGNOSIS_PROMPT
  ) {
    return "demo" as const;
  }
  return "real" as const;
}

export const useAppStore = create<AppState>((set, get) => ({
  ...createRealWorkspaceState(),
  version: APP_SNAPSHOT_VERSION,
  selectedExerciseId: catalog[0]?.id ?? "",
  view: "home",
  camera: "iso",
  viewerQuality: "medium",
  time: 0,
  speed: 1,
  playing: false,
  search: "",
  phase: "all",
  level: "all",
  principle: "all",
  exerciseVariants: [],
  showZones: true,
  showRuns: true,
  showPasses: true,
  showPress: true,
  personalSpace: false,
  layers: defaultLayers,
  opponentScout: DEFAULT_OPPONENT_SCOUT,
  lineupLab: initialLineupLab,
  tags: [],
  tracks: [],
  aiMode: "coach",
  coachInterview: initialCoachInterview,
  pendingPostMatchImport: null,
  coachShapeContext: null,
  initialized: false,
  viewerExerciseOverride: null,
  presentationMode: false,
  exportStatus: null,
  libraryFavoriteIds: [],
  libraryRecentOpens: [],
  sketches: [],
  setView: (view) =>
    set({
      view,
      presentationMode: view === "viewer" ? get().presentationMode : false,
    }),
  setPresentationMode: (enabled) => set({ presentationMode: enabled }),
  setExportStatus: (exportStatus) => set({ exportStatus }),
  setCamera: (camera) => set({ camera }),
  setViewerQuality: (viewerQuality) => set({ viewerQuality }),
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
  duplicateSelectedExercise: () => {
    const state = get();
    const source = findExercise(
      state.selectedExerciseId,
      state.exerciseVariants,
    );
    if (!source) return;
    const variant = cloneExerciseVariant(source);
    set({
      exerciseVariants: [...state.exerciseVariants, variant],
      selectedExerciseId: variant.id,
      viewerExerciseOverride: null,
      time: 0,
      playing: false,
    });
  },
  createExerciseVariantFrom: (exerciseId, options) => {
    const state = get();
    const source = findExercise(exerciseId, state.exerciseVariants);
    if (!source) return null;
    const variant = cloneExerciseVariant(source, options);
    set({
      exerciseVariants: [...state.exerciseVariants, variant],
      selectedExerciseId: variant.id,
      viewerExerciseOverride: null,
      view: "viewer",
      time: 0,
      playing: false,
    });
    return variant.id;
  },
  createExerciseFromShape: (shapeId, options) => {
    const state = get();
    const shape = state.lineupLab.shapes.find((item) => item.id === shapeId);
    if (!shape) return null;
    const exercise = buildExerciseFromShape(shape, state.team.players, options);
    if (!exercise) return null;
    set({
      exerciseVariants: [...state.exerciseVariants, exercise],
      selectedExerciseId: exercise.id,
      viewerExerciseOverride: null,
      view: "viewer",
      time: 0,
      playing: false,
    });
    return exercise.id;
  },
  importExerciseVariant: (exercise) => {
    const state = get();
    const result = ExerciseSchema.safeParse(exercise);
    if (!result.success) return null;
    const id = makeUniqueExerciseId(result.data.id, state.exerciseVariants);
    const imported = cloneImportedExercise(result.data, id);
    set({
      exerciseVariants: [...state.exerciseVariants, imported],
      selectedExerciseId: imported.id,
      viewerExerciseOverride: null,
      view: "library",
      time: 0,
      playing: false,
    });
    return imported.id;
  },
  createBlankExercise: (options) => {
    const state = get();
    const exercise = buildBlankExercise(options, state.exerciseVariants);
    set({
      exerciseVariants: [...state.exerciseVariants, exercise],
      selectedExerciseId: exercise.id,
      viewerExerciseOverride: null,
      view: "viewer",
      time: 0,
      playing: false,
    });
    return exercise.id;
  },
  toggleLibraryFavorite: (exerciseId) => {
    const state = get();
    const isFavorite = state.libraryFavoriteIds.includes(exerciseId);
    set({
      libraryFavoriteIds: isFavorite
        ? state.libraryFavoriteIds.filter((id) => id !== exerciseId)
        : [...state.libraryFavoriteIds, exerciseId],
    });
  },
  recordLibraryOpen: (exerciseId) => {
    const state = get();
    const at = new Date().toISOString();
    const withoutCurrent = state.libraryRecentOpens.filter(
      (entry) => entry.exerciseId !== exerciseId,
    );
    set({
      libraryRecentOpens: [{ exerciseId, at }, ...withoutCurrent].slice(0, 24),
    });
  },
  createSketch: (options) => {
    const sketch = createBlankSketch(options?.title);
    set((state) => ({ sketches: [...state.sketches, sketch] }));
    return sketch.id;
  },
  updateSketch: (id, patch) =>
    set((state) => ({
      sketches: state.sketches.map((sketch) => {
        if (sketch.id !== id) return sketch;
        const next = { ...sketch, ...patch, updatedAt: new Date().toISOString() };
        const parsed = SketchSchema.safeParse(next);
        return parsed.success ? parsed.data : sketch;
      }),
    })),
  deleteSketch: (id) =>
    set((state) => ({
      sketches: state.sketches.filter((sketch) => sketch.id !== id),
      session: {
        ...state.session,
        blocks: state.session.blocks.map((block) =>
          block.sketchId === id ? { ...block, sketchId: undefined } : block,
        ),
      },
    })),
  renameSketch: (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((state) => ({
      sketches: state.sketches.map((sketch) =>
        sketch.id === id
          ? { ...sketch, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString() }
          : sketch,
      ),
    }));
  },
  attachSketchToSessionBlock: (blockId, sketchId) => {
    const state = get();
    if (!state.sketches.some((sketch) => sketch.id === sketchId)) return;
    const blocks = state.session.blocks.map((block) =>
      block.id === blockId ? { ...block, sketchId } : block,
    );
    set({
      session: {
        ...state.session,
        blocks,
        computed: recomputeSession(blocks, state.exerciseVariants),
      },
    });
  },
  detachSketchFromSessionBlock: (blockId) => {
    const state = get();
    const blocks = state.session.blocks.map((block) =>
      block.id === blockId ? { ...block, sketchId: undefined } : block,
    );
    set({
      session: {
        ...state.session,
        blocks,
        computed: recomputeSession(blocks, state.exerciseVariants),
      },
    });
  },
  setSearch: (value) => set({ search: value }),
  setFilter: (key, value) =>
    set({ [key]: value } as Pick<AppState, "phase" | "level" | "principle">),
  toggleLayer: (key) =>
    set({ [key]: !get()[key] } as Pick<
      AppState,
      "showZones" | "showRuns" | "showPasses" | "showPress"
    >),
  togglePersonalSpace: () => set({ personalSpace: !get().personalSpace }),
  toggleTacticalLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  addTag: (tag) =>
    set({
      tags: [
        ...get().tags,
        {
          ...tag,
          id: tag.id ?? makeEntityId("tag"),
          moment: tag.moment ?? videoMomentFromTime(tag.time),
          severity: tag.severity ?? "medium",
        },
      ],
    }),
  addTrack: (track) =>
    set({
      tracks: [
        ...get().tracks,
        {
          ...track,
          id: track.id ?? makeEntityId("track"),
          moment: track.moment ?? videoMomentFromTime(track.time),
        },
      ],
    }),
  updateTrack: (id, patch) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === id ? { ...track, ...patch } : track,
      ),
    })),
  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((track) => track.id !== id),
    })),
  clearAssistedTracks: (matchId) =>
    set((state) => ({
      tracks: state.tracks.filter((track) => {
        const isAssisted = track.label.startsWith("assist-");
        const isSameMatch = !matchId || track.matchId === matchId;
        return !(isAssisted && isSameMatch);
      }),
    })),
  addManualObservation: (observation) => {
    const text = observation.text.trim();
    if (!text) return null;

    const nextId = observation.id ?? makeEntityId("manual-observation");
    set((state) => ({
      manualObservations: [
        {
          id: nextId,
          teamId: observation.teamId || state.team.id,
          text,
          createdAt: observation.createdAt ?? new Date().toISOString(),
          source: observation.source,
        },
        ...state.manualObservations.filter(
          (item) =>
            item.teamId !== (observation.teamId || state.team.id) ||
            normalizeObservationText(item.text) !== normalizeObservationText(text),
        ),
      ].slice(0, 12),
    }));
    return nextId;
  },
  removeManualObservation: (id) =>
    set((state) => ({
      manualObservations: state.manualObservations.filter(
        (observation) => observation.id !== id,
      ),
      weeklyDecisionThread:
        state.weeklyDecisionThread &&
        state.weeklyDecisionThread.evidenceIds.includes(id)
          ? {
              ...state.weeklyDecisionThread,
              evidenceIds: state.weeklyDecisionThread.evidenceIds.filter(
                (evidenceId) => evidenceId !== id,
              ),
              updatedAt: new Date().toISOString(),
            }
          : state.weeklyDecisionThread,
    })),
  clearManualObservations: () =>
    set((state) => ({
      manualObservations: state.manualObservations.filter(
        (observation) => observation.teamId !== state.team.id,
      ),
    })),
  activateWeeklyThreadFromObservation: (observationId) =>
    set((state) => {
      const observation = state.manualObservations.find(
        (item) => item.id === observationId && item.teamId === state.team.id,
      );
      if (!observation) return state;
      return {
        weeklyDecisionThread: buildThreadFromObservation(
          observation,
          state.team.id,
          state.weeklyDecisionThread,
        ),
      };
    }),
  addToSession: (exerciseId) => {
    const exercise = findExercise(exerciseId, get().exerciseVariants);
    if (!exercise) return;
    const nextBlock = {
      id: crypto.randomUUID(),
      exerciseId,
      durationMin: exercise.duration,
      swappable: true,
    };
    const session = get().session;
    const blocks = [...session.blocks, nextBlock];
    const thread = get().weeklyDecisionThread;
    set({
      session: {
        ...session,
        blocks,
        computed: recomputeSession(blocks, get().exerciseVariants),
      },
      weeklyDecisionThread: thread
        ? {
            ...thread,
            sessionIntent:
              thread.sessionIntent ??
              buildSessionIntentFromProblem(thread.problem),
            status: "trained",
            updatedAt: new Date().toISOString(),
          }
        : thread,
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
          computed: recomputeSession(blocks, state.exerciseVariants),
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
          computed: recomputeSession(blocks, state.exerciseVariants),
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
          computed: recomputeSession(blocks, state.exerciseVariants),
        },
      };
    }),
  addLineup: (lineup) =>
    set({ team: { ...get().team, lineups: [...get().team.lineups, lineup] } }),
  applyLineupToViewer: (lineupId) => {
    const state = get();
    const lineup = state.team.lineups.find((item) => item.id === lineupId);
    const base =
      findExercise(state.selectedExerciseId, state.exerciseVariants) ??
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
  setLineupLabShapes: (shapes) =>
    set((state) => ({
      lineupLab: {
        ...state.lineupLab,
        shapes: shapes.map((shape) => ({
          ...shape,
          positions: clonePositions(shape.positions),
        })),
      },
    })),
  setLineupLabTransitions: (savedTransitions) =>
    set((state) => ({
      lineupLab: {
        ...state.lineupLab,
        savedTransitions: savedTransitions.map((transition) => ({
          ...transition,
        })),
      },
    })),
  requestApplyShape: (shapeId) =>
    set((state) => ({
      view: "team",
      lineupLab: {
        ...state.lineupLab,
        pendingShapeId: shapeId,
      },
    })),
  consumePendingShape: () =>
    set((state) => ({
      lineupLab: {
        ...state.lineupLab,
        pendingShapeId: null,
      },
    })),
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
  loadDemoWorkspace: () =>
    set((state) => ({
      ...createDemoWorkspaceState(),
      aiMode: state.aiMode,
      coachInterview: initialCoachInterview,
      pendingPostMatchImport: null,
      coachShapeContext: null,
      lineupLab: initialLineupLab,
    })),
  loadRealWorkspace: () =>
    set((state) => ({
      ...createRealWorkspaceState(),
      aiMode: state.aiMode,
      coachInterview: initialCoachInterview,
      pendingPostMatchImport: null,
      coachShapeContext: null,
      lineupLab: initialLineupLab,
    })),
  updateTeamIdentity: (patch) =>
    set((state) => {
      const nextIdentity = {
        ...state.teamIdentity,
        ...patch,
      };
      const summary = summarizeTeamIdentity(nextIdentity);
      return {
        teamIdentity: nextIdentity,
        team: {
          ...state.team,
          name: nextIdentity.teamName.trim(),
          model: isTeamIdentityConfigured(nextIdentity) ? summary : "",
        },
      };
    }),
  removePlayer: (id) =>
    set((state) => {
      if (state.team.players.length <= 1) return {};
      const players = state.team.players.filter((player) => player.id !== id);
      const selectedPlayerId =
        state.team.selectedPlayerId === id
          ? players[0]?.id ?? ""
          : state.team.selectedPlayerId;
      return {
        team: {
          ...state.team,
          players,
          selectedPlayerId,
          lineups: state.team.lineups.map((lineup) => ({
            ...lineup,
            ownPositions: lineup.ownPositions.filter(
              (position) => position.playerId !== id,
            ),
          })),
        },
        lineupLab: {
          ...state.lineupLab,
          shapes: state.lineupLab.shapes.map((shape) => ({
            ...shape,
            positions: Object.fromEntries(
              Object.entries(shape.positions).filter(
                ([playerId]) => playerId !== id,
              ),
            ),
          })),
          pendingShapeId: null,
        },
        coachShapeContext: null,
      };
    }),
  setSelectedPlayerId: (id) =>
    set({ team: { ...get().team, selectedPlayerId: id } }),
  updatePlayer: (id, patch) =>
    set((state) => {
      const requestedNum =
        typeof patch.num === "number"
          ? uniqueJerseyNumber(patch.num, id, state.team.players)
          : undefined;
      const safePatch =
        requestedNum === undefined ? patch : { ...patch, num: requestedNum };

      return {
        team: {
          ...state.team,
          players: state.team.players.map((player) =>
            player.id === id ? { ...player, ...safePatch } : player,
          ),
        },
      };
    }),
  updateGameModel: (patch) =>
    set((state) => ({
      gameModel: normalizeGameModel({
        ...state.gameModel,
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    })),
  updateOpponentScout: (patch) =>
    set((state) => ({
      opponentScout: normalizeOpponentScout({
        ...state.opponentScout,
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    })),
  createSessionFromWeeklyThread: () => {
    const state = get();
    const thread = state.weeklyDecisionThread;
    if (!thread) return false;

    if (isSessionLinkedToThread(state.session, thread) && state.session.blocks.length) {
      set({
        view: "sessions",
        weeklyDecisionThread: {
          ...thread,
          status: "trained",
          updatedAt: new Date().toISOString(),
        },
      });
      return true;
    }

    const plan = buildSessionPlanFromWeeklyThread(thread, [
      ...catalog,
      ...state.exerciseVariants,
    ]);
    const nextSession = materializeDiagnosisSession(
      state.session,
      plan,
      [...catalog, ...state.exerciseVariants],
    );
    const nextThread = syncThreadWithSessionPlan(thread, plan);
    set({
      session: nextSession,
      view: "sessions",
      weeklyDecisionThread: nextThread,
    });
    return true;
  },
  createSessionFromCoachAdvice: (response) => {
    if (response.mode === "question") return false;
    const state = get();
    const nextThread =
      buildThreadFromCoachResponse(
        response,
        state.aiPrompt,
        state.team.id,
        state.weeklyDecisionThread,
      ) ??
      state.weeklyDecisionThread;
    if (!nextThread) return false;
    const plan = buildSessionPlanFromDiagnosis(response.advice, [
      ...catalog,
      ...state.exerciseVariants,
    ]);
    const nextSession = materializeDiagnosisSession(
      state.session,
      plan,
      [...catalog, ...state.exerciseVariants],
    );
    if (!nextSession.blocks.length) return false;
    set({
      session: nextSession,
      view: "sessions",
      weeklyDecisionThread: syncThreadWithSessionPlan(nextThread, plan),
    });
    return true;
  },
  loadSnapshot: (snapshot) =>
    set((current) => {
      const nextTeam = ensureTeamState(
        (snapshot.team as Partial<TeamState> | undefined) ?? current.team,
      );
      const workspaceMode = inferWorkspaceModeFromSnapshot(snapshot, nextTeam);
      const fallbackIdentity =
        workspaceMode === "demo"
          ? createDemoTeamIdentitySetup()
          : createEmptyTeamIdentitySetup();
      return {
        ...current,
        ...snapshot,
        workspaceMode,
        team: nextTeam,
        teamIdentity: {
          ...fallbackIdentity,
          ...(snapshot.teamIdentity ?? current.teamIdentity),
          teamName:
            snapshot.teamIdentity?.teamName ??
            nextTeam.name ??
            fallbackIdentity.teamName,
        },
        layers: { ...defaultLayers, ...snapshot.layers },
        gameModel: normalizeGameModel(snapshot.gameModel ?? current.gameModel),
        opponentScout: normalizeOpponentScout(
          snapshot.opponentScout ?? current.opponentScout,
        ),
        manualObservations:
          snapshot.manualObservations?.map((observation) => ({
            ...observation,
            teamId: observation.teamId || nextTeam.id,
          })) ?? current.manualObservations,
        weeklyDecisionThread: snapshot.weeklyDecisionThread
          ? {
              ...snapshot.weeklyDecisionThread,
              teamId: snapshot.weeklyDecisionThread.teamId || nextTeam.id,
            }
          : current.weeklyDecisionThread,
        coachInterview: initialCoachInterview,
        initialized: true,
      };
    }),
  markInitialized: () => set({ initialized: true }),
  setAiMode: (aiMode) =>
    set({ aiMode, coachInterview: initialCoachInterview }),
  setAiPrompt: (prompt) =>
    set((state) => ({
      aiPrompt: prompt,
      coachInterview:
        prompt === state.aiPrompt ? state.coachInterview : initialCoachInterview,
    })),
  recordCoachAnswer: (answer) =>
    set((state) => {
      const nextEvidence = [
        ...state.coachInterview.collectedEvidence.filter(
          (item) => item.questionId !== answer.questionId,
        ),
        answer,
      ];

      return {
        coachInterview: {
          ...state.coachInterview,
          active: true,
          collectedEvidence: nextEvidence,
        },
      };
    }),
  clearCoachAnswer: (questionId) =>
    set((state) => ({
      coachInterview: {
        ...state.coachInterview,
        collectedEvidence: state.coachInterview.collectedEvidence.filter(
          (item) => item.questionId !== questionId,
        ),
      },
    })),
  applyCoachTurnResult: (response) =>
    set((state) => {
      const nextThread =
        buildThreadFromCoachResponse(
          response,
          state.aiPrompt,
          state.team.id,
          state.weeklyDecisionThread,
        ) ??
        state.weeklyDecisionThread;
      if (response.mode === "question") {
        return {
          coachInterview: {
            ...state.coachInterview,
            active: true,
            intent: response.intent,
            temptingClaims: response.blockedClaims,
            audit: response.evidenceAudit,
            questions: response.selectedQuestions,
            turn: state.coachInterview.turn + 1,
            skipped: false,
          },
          weeklyDecisionThread: nextThread,
        };
      }

      return {
        coachInterview: {
          ...state.coachInterview,
          active: response.mode === "hypothesis",
          intent: response.intent,
          temptingClaims: state.coachInterview.temptingClaims,
          audit: response.evidenceAudit,
          questions:
            response.mode === "hypothesis" ? response.followUpQuestions : [],
          turn: state.coachInterview.turn + 1,
          skipped: false,
        },
        weeklyDecisionThread: nextThread,
      };
    }),
  skipCoachInterview: () =>
    set((state) => ({
      coachInterview: {
        ...state.coachInterview,
        skipped: true,
      },
    })),
  resetCoachInterview: () => set({ coachInterview: initialCoachInterview }),
  queuePostMatchManualObservations: (observationIds) =>
    set((state) => ({
      pendingPostMatchImport: buildPendingPostMatchImport(
        state.manualObservations,
        observationIds,
        state.team.id,
        state.weeklyDecisionThread?.id ?? null,
      ),
    })),
  setPendingPostMatchImport: (pendingPostMatchImport) =>
    set({ pendingPostMatchImport }),
  consumePendingPostMatchImport: () => {
    const value = get().pendingPostMatchImport;
    set({ pendingPostMatchImport: null });
    return value;
  },
  syncWeeklyThreadFromPostMatchReport: (savedReport) =>
    set((state) => ({
      weeklyDecisionThread: buildThreadFromPostMatchReport(
        savedReport,
        state.team.id,
        state.weeklyDecisionThread,
      ),
    })),
  syncWeeklyThreadProgress: (progress, reportId) =>
    set((state) => ({
      weeklyDecisionThread: state.weeklyDecisionThread
        ? evolveThreadStatus(state.weeklyDecisionThread, progress, reportId)
        : state.weeklyDecisionThread,
    })),
  setCoachShapeContext: (coachShapeContext) => set({ coachShapeContext }),
}));

export function getExerciseById(id: string) {
  return (
    findExercise(id, useAppStore.getState().exerciseVariants) ?? catalog[0]
  );
}

export function getAllExercises() {
  return [...catalog, ...useAppStore.getState().exerciseVariants];
}

export function getSelectedPlayer(state = useAppStore.getState()) {
  return (
    state.team.players.find(
      (player) => player.id === state.team.selectedPlayerId,
    ) ?? state.team.players[0]
  );
}

function extractTaggedValue(notes: string | undefined, label: string) {
  if (!notes?.trim()) return "";
  const line = notes
    .split(/\r?\n/)
    .find((entry) =>
      entry.toLowerCase().startsWith(`${label.toLowerCase()}:`),
    );
  return line?.split(":").slice(1).join(":").trim() ?? "";
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

function cloneExerciseVariant(
  source: Exercise,
  options?: { title?: string; authorNotes?: string },
): Exercise {
  return {
    ...source,
    id: `${source.id}__variant__${Date.now()}`,
    title: options?.title?.trim() || `${source.title} - variante`,
    authorNotes: [source.authorNotes, options?.authorNotes, "Variante local"]
      .filter(Boolean)
      .join(" | "),
    scene: {
      ...source.scene,
      actors: source.scene.actors.map((actor) => ({
        ...actor,
        start: { ...actor.start },
        path: actor.path.map((keyframe) => ({
          ...keyframe,
          pos: { ...keyframe.pos },
        })),
        state: actor.state.map((stateItem) => ({ ...stateItem })),
      })),
      ball: {
        ...source.scene.ball,
        start: { ...source.scene.ball.start },
        path: source.scene.ball.path.map((keyframe) => ({
          ...keyframe,
          pos: { ...keyframe.pos },
        })),
      },
      overlays: source.scene.overlays.map((overlay) => ({ ...overlay })),
      zones: source.scene.zones.map((zone) => ({
        ...zone,
        rect: { ...zone.rect },
        visibleInPhases: [...zone.visibleInPhases],
      })),
      triggers: source.scene.triggers.map((trigger) => ({
        ...trigger,
        cause: { ...trigger.cause },
        visualMarker: trigger.visualMarker
          ? { ...trigger.visualMarker, pos: { ...trigger.visualMarker.pos } }
          : undefined,
        activatesOverlays: [...trigger.activatesOverlays],
      })),
      phases: source.scene.phases.map((phase) => ({
        ...phase,
        activeLayers: [...phase.activeLayers],
      })),
    },
  };
}

function cloneImportedExercise(source: Exercise, id: string): Exercise {
  return {
    ...cloneExerciseVariant(source, {
      title: source.title,
      authorNotes: "Jugada importada",
    }),
    id,
    title: source.title,
  };
}

function makeUniqueExerciseId(id: string, variants: Exercise[]) {
  const base = id.trim() || `custom-exercise-${Date.now()}`;
  if (!findExercise(base, variants)) return base;
  return `${base}__custom__${Date.now()}`;
}

function clonePositions(positions: Record<string, Vec2>): Record<string, Vec2> {
  return Object.fromEntries(
    Object.entries(positions).map(([id, pos]) => [id, { ...pos }]),
  );
}

function buildExerciseFromShape(
  shape: LineupLabShape,
  players: Player[],
  options?: { title?: string; authorNotes?: string },
): Exercise | null {
  const actors = Object.entries(shape.positions)
    .map(([playerId, pos]) => {
      const player = players.find((item) => item.id === playerId);
      if (!player) return null;
      return {
        id: `shape-${shape.id}-${playerId}`,
        team: "own" as const,
        num: player.num,
        role: player.positions[0] ?? "CM",
        start: { ...pos },
        path: [],
        facingMode: "auto" as const,
        state: [{ t: 0, state: "idle" as const }],
      };
    })
    .filter((actor): actor is NonNullable<typeof actor> => Boolean(actor));
  if (!actors.length) return null;
  const firstActor = actors[0];
  const playerCount = actors.length;

  return {
    id: `shape-exercise-${shape.id}-${Date.now()}`,
    title:
      options?.title?.trim() ||
      `Ejercicio desde shape: ${shape.name}`,
    phase: phaseFromShape(shape.phase),
    principle: "shape táctico",
    level: "intermedio",
    intensity: "med",
    rpe: 5,
    density: 0.55,
    players: {
      min: playerCount,
      max: playerCount,
    },
    duration: 12,
    space: "Cancha completa adaptable",
    material: [{ name: "conos", qty: 8, unit: "u" }],
    objective: {
      primary: `Transformar el shape "${shape.name}" en una tarea de campo.`,
      secondary: shape.notes,
    },
    organization:
      "Ubicar al equipo en el shape guardado y trabajar movimientos por fases.",
    rules: [
      "Congelar la estructura inicial antes de activar la circulación.",
      "Corregir distancias entre líneas antes de sumar oposición.",
      "Repetir la transición hasta que las alturas sean coordinadas.",
    ],
    coaching: [
      "Ajustar altura del bloque como unidad, no por líneas aisladas.",
      "Mantener referencias de ancho y profundidad según el rol.",
      "Pedir comunicación entre centrales, pivote y extremos antes del pase.",
    ],
    errors: [
      "Saltar una línea sin que la siguiente achique.",
      "Perder amplitud por mirar solo la pelota.",
      "Transformar el shape en posiciones fijas sin comportamiento.",
    ],
    success:
      "El equipo reconoce la estructura, conserva distancias y llega coordinado a la siguiente fase.",
    progressions: [
      "Agregar rival pasivo.",
      "Agregar pérdida y transición defensiva.",
      "Limitar toques para acelerar decisiones.",
    ],
    regressions: [
      "Trabajar sin oposición.",
      "Reducir a una zona del campo.",
      "Separar defensa, medio y ataque por bloques.",
    ],
    scene: {
      duration: 10,
      pitchMode: "full",
      actors,
      ball: {
        start: {
          ...(firstActor?.start ?? { x: 50, y: 50 }),
          z: 0,
        },
        path: [],
        carrier: firstActor?.id,
      },
      overlays: [],
      zones: [],
      triggers: [],
      phases: [
        {
          id: "setup",
          name: "Setup",
          start: 0,
          end: 3,
          activeLayers: ["withBall", "withoutBall", "notes"],
          notes: "Ordenar referencias del shape.",
        },
        {
          id: "execution",
          name: "Ejecución",
          start: 3,
          end: 8,
          activeLayers: ["withBall", "withoutBall", "press", "cover"],
          notes: "Activar movimiento coordinado.",
        },
        {
          id: "outcome",
          name: "Resultado",
          start: 8,
          end: 10,
          activeLayers: ["withBall", "withoutBall", "notes"],
          notes: "Evaluar distancias y roles.",
        },
      ],
    },
    authorNotes: [shape.notes, options?.authorNotes, "Creado desde Lineup Lab"]
      .filter(Boolean)
      .join(" | "),
  };
}

function buildBlankExercise(
  options: { title?: string } | undefined,
  existingVariants: Exercise[],
): Exercise {
  const title = options?.title?.trim() || "Nuevo ejercicio";
  const id = makeUniqueExerciseId(
    `ejercicio-nuevo-${Date.now()}`,
    existingVariants,
  );

  return {
    id,
    title,
    phase: "attackOrg",
    principle: "A definir",
    level: "U18+",
    intensity: "med",
    rpe: 5,
    density: 0.5,
    players: { min: 1, max: 22 },
    duration: 15,
    space: "Cancha completa adaptable",
    material: [],
    objective: {
      primary: "Definir el objetivo principal de esta tarea.",
    },
    organization:
      "Describe aqui como se organiza la tarea: espacios, roles y referencias.",
    rules: [],
    coaching: [],
    errors: [],
    success: "Definir la senal de exito de esta tarea.",
    progressions: [],
    regressions: [],
    scene: {
      duration: 10,
      pitchMode: "full",
      actors: [],
      ball: {
        start: { x: 50, y: 50, z: 0 },
        path: [],
      },
      overlays: [],
      zones: [],
      triggers: [],
      phases: [
        {
          id: "setup",
          name: "Setup",
          start: 0,
          end: 3,
          activeLayers: ["withBall", "withoutBall"],
          notes: "Arma la escena: agrega jugadores, pelota y movimientos.",
        },
        {
          id: "execution",
          name: "Ejecución",
          start: 3,
          end: 8,
          activeLayers: ["withBall", "withoutBall"],
          notes: "",
        },
        {
          id: "outcome",
          name: "Resultado",
          start: 8,
          end: 10,
          activeLayers: ["withBall", "withoutBall"],
          notes: "",
        },
      ],
    },
    authorNotes:
      "Ejercicio creado desde cero. Completa los campos y la escena segun lo necesites.",
  };
}

function phaseFromShape(phase: LabShapePhase): Exercise["phase"] {
  if (phase === "defense") return "defenseOrg";
  if (phase === "transition") return "transDef";
  if (phase === "abp") return "abpOff";
  return "attackOrg";
}

function findExercise(id: string, variants: Exercise[]) {
  return (
    variants.find((exercise) => exercise.id === id) ??
    catalog.find((exercise) => exercise.id === id)
  );
}

function uniqueJerseyNumber(
  requested: number,
  playerId: string,
  players: Player[],
) {
  const used = new Set(
    players
      .filter((player) => player.id !== playerId)
      .map((player) => player.num),
  );
  let next = Math.max(1, Math.min(99, Math.round(requested)));
  while (used.has(next) && next < 99) next += 1;
  while (used.has(next) && next > 1) next -= 1;
  return next;
}

function endpointIsValid(
  endpoint: Exercise["scene"]["overlays"][number]["from"],
  actorIds: Set<string>,
) {
  return typeof endpoint !== "string" || actorIds.has(endpoint);
}

function makeEntityId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function normalizeObservationText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function videoMomentFromTime(time: number): VideoMoment {
  if (!Number.isFinite(time) || time < 0) return "unknown";
  if (time < 45 * 60) return "firstHalf";
  if (time < 90 * 60) return "secondHalf";
  return "extraTime";
}
