import { z } from "zod";

export const PositionSchema = z.enum([
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LW",
  "RW",
  "ST",
  "WB",
  "AM",
]);

export const Vec2Schema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const Vec3Schema = Vec2Schema.extend({
  z: z.number().default(0),
});

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  num: z.number().int().min(1).max(99),
  positions: z.array(PositionSchema).min(1),
  foot: z.enum(["L", "R", "Both"]),
  status: z.enum(["available", "doubt", "injured", "suspended"]),
  profile: z.string(),
  attributes: z.object({
    speed: z.number().min(0).max(100),
    stamina: z.number().min(0).max(100),
    pass: z.number().min(0).max(100),
    control: z.number().min(0).max(100),
    press: z.number().min(0).max(100),
    duel: z.number().min(0).max(100),
    tactical: z.number().min(0).max(100),
  }),
  height: z.number().optional(),
  age: z.number().optional(),
  preferredJersey: z.number().optional(),
  photo: z.string().optional(),
});

export const LayerSchema = z.enum([
  "withBall",
  "withoutBall",
  "press",
  "cover",
  "altA",
  "altB",
  "rival",
  "abp",
  "notes",
]);

export const KeyframeSchema = z.object({
  t: z.number().min(0),
  pos: Vec2Schema,
  ease: z.enum(["linear", "smooth", "ease-in", "ease-out"]).optional(),
});

export const ActorSchema = z.object({
  id: z.string(),
  team: z.enum(["own", "rival", "neutral"]),
  num: z.number().int().min(1).max(99),
  role: z.string(),
  start: Vec2Schema,
  path: z.array(KeyframeSchema).default([]),
  facingMode: z.enum(["auto", "ball", "opponent", "fixed"]).default("auto"),
  state: z
    .array(
      z.object({
        t: z.number().min(0),
        state: z.enum([
          "idle",
          "walk",
          "jog",
          "sprint",
          "press",
          "receive",
          "kick",
          "slide",
          "header",
        ]),
      }),
    )
    .default([]),
});

export const BallSchema = z.object({
  start: Vec3Schema,
  path: z
    .array(
      z.object({
        t: z.number().min(0),
        pos: Vec3Schema,
        carrier: z.string().optional(),
      }),
    )
    .default([]),
  carrier: z.string().optional(),
});

export const OverlaySchema = z.object({
  id: z.string(),
  type: z.enum(["pass", "run", "press", "dribble", "cover", "lineBlocked"]),
  from: z.union([z.string(), Vec2Schema]),
  to: z.union([z.string(), Vec2Schema]),
  start: z.number().min(0),
  end: z.number().min(0),
  label: z.string().optional(),
  layer: LayerSchema,
});

export const ZoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  rect: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().min(0).max(100),
    h: z.number().min(0).max(100),
  }),
  color: z.string(),
  layer: LayerSchema,
  visibleInPhases: z.array(z.string()),
});

export const TriggerSchema = z.object({
  id: z.string(),
  description: z.string(),
  whenT: z.number().min(0),
  cause: z.object({
    actorId: z.string(),
    action: z.enum([
      "backPass",
      "badControl",
      "receiveBack",
      "closedLateral",
      "cbCarry",
      "ballToPivot",
    ]),
  }),
  visualMarker: z
    .object({
      pos: Vec2Schema,
      icon: z.string(),
    })
    .optional(),
  activatesOverlays: z.array(z.string()).default([]),
});

export const PhaseSchema = z.object({
  id: z.enum(["setup", "execution", "outcome"]),
  name: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  activeLayers: z.array(LayerSchema),
  notes: z.string().optional(),
});

export const MaterialSchema = z.object({
  name: z.string(),
  qty: z.number().min(0),
  unit: z.string(),
});

export const SceneSchema = z.object({
  duration: z.number().positive(),
  pitchMode: z.enum(["full", "half", "third", "small"]),
  actors: z.array(ActorSchema),
  ball: BallSchema,
  overlays: z.array(OverlaySchema).default([]),
  zones: z.array(ZoneSchema).default([]),
  triggers: z.array(TriggerSchema).default([]),
  phases: z.array(PhaseSchema).length(3),
});

export const ExerciseSchema = z.object({
  id: z.string(),
  title: z.string(),
  phase: z.enum([
    "attackOrg",
    "defenseOrg",
    "transOff",
    "transDef",
    "abpOff",
    "abpDef",
  ]),
  principle: z.string(),
  level: z.string(),
  intensity: z.enum(["low", "med", "high", "veryHigh"]),
  rpe: z.number().int().min(1).max(10),
  density: z.number().min(0).max(1),
  players: z.object({ min: z.number().int(), max: z.number().int() }),
  duration: z.number().positive(),
  space: z.string(),
  material: z.array(MaterialSchema),
  objective: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
  }),
  organization: z.string(),
  rules: z.array(z.string()),
  coaching: z.array(z.string()),
  errors: z.array(z.string()),
  success: z.string(),
  progressions: z.array(z.string()),
  regressions: z.array(z.string()),
  scene: SceneSchema,
  authorNotes: z.string().optional(),
});

export const SessionBlockSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  durationMin: z.number().positive(),
  notes: z.string().optional(),
  swappable: z.boolean().default(true),
  /**
   * Optional reference to a Quick Sketch (`Sketch.id`, see src/sketch/).
   * Additive/backward-compatible pointer — does not change session totals,
   * materials, or objectives. See `attachSketchToSessionBlock` /
   * `detachSketchFromSessionBlock` in useAppStore for the write path.
   */
  sketchId: z.string().optional(),
  /**
   * Optional reference to a structured Tactical Board (`TacticalBoard.id`, see
   * src/board/). This is additive and independent from `sketchId`: Quick
   * Sketch remains the fast/disposable surface, while boardId/boardSceneId
   * links a reusable semantic board or one specific scene to the block.
   */
  boardId: z.string().optional(),
  boardSceneId: z.string().optional(),
  /**
   * Optional "marked as done" flag, set from Pitch-side Mode while running a
   * session on the field (see `src/sessions/PitchSideView.tsx`). Purely a UI
   * checkbox for the coach during training — additive/backward-compatible,
   * does not affect session totals, materials, or objectives. Written via the
   * existing generic `updateSessionBlock(id, patch)` action, same pattern as
   * `sketchId` above — no new store action or migration needed.
   */
  done: z.boolean().optional(),
});

export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string().optional(),
  blocks: z.array(SessionBlockSchema),
  staffNotes: z.string().optional(),
  computed: z
    .object({
      totalDuration: z.number(),
      totalLoad: z.number(),
      materials: z.array(MaterialSchema),
      primaryObjectives: z.array(z.string()),
    })
    .optional(),
});

export const MicrocycleDaySchema = z.enum([
  "MD+1",
  "MD+2",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
  "MD",
]);

export const AlertSchema = z.object({
  severity: z.enum(["info", "warn", "error"]),
  message: z.string(),
});

export const MicrocycleSchema = z.object({
  id: z.string(),
  name: z.string(),
  weekOf: z.string(),
  days: z.record(
    MicrocycleDaySchema,
    z.object({
      objective: z.string(),
      targetLoad: z.enum(["low", "med", "high"]),
      sessionId: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  alerts: z.array(AlertSchema).default([]),
});

export const LineupSchema = z.object({
  id: z.string(),
  name: z.string(),
  formation: z.string(),
  ownPositions: z.array(
    z.object({
      playerId: z.string(),
      pos: Vec2Schema,
      role: z.string(),
    }),
  ),
  rivalPositions: z
    .array(
      z.object({
        playerId: z.string().optional(),
        pos: Vec2Schema,
        role: z.string(),
      }),
    )
    .optional(),
});

export type Position = z.infer<typeof PositionSchema>;
export type Vec2 = z.infer<typeof Vec2Schema>;
export type Vec3 = z.infer<typeof Vec3Schema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Ball = z.infer<typeof BallSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type SessionBlock = z.infer<typeof SessionBlockSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Microcycle = z.infer<typeof MicrocycleSchema>;
export type Lineup = z.infer<typeof LineupSchema>;
export type Alert = z.infer<typeof AlertSchema>;
