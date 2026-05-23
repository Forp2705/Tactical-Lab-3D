import { z } from "zod";

export const CoachMatchAdviceSchema = z.object({
  tacticalReading: z.string(),
  probableCause: z.string(),
  mainAdjustment: z.string(),
  onFieldInstructions: z.array(z.string()),
  wednesdayTest: z.string(),
  saturdayFocus: z.string(),
  adjustmentRisks: z.array(z.string()),
  successSignals: z.array(z.string()),
  reflection: z.object({
    mainUncertainty: z.string(),
    missingInformation: z.string(),
    alternativeInterpretation: z.string(),
    confidence: z.number().min(0).max(1),
  }),
});

export const AiPlanSchema = z.object({
  mode: z.enum(["query", "critic", "match"]),
  assumptions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  planA: z.string(),
  planB: z.string(),
  planC: z.string().optional(),
  abpSuggestions: z.array(z.string()),
  risks: z.array(z.string()),
  why: z.array(z.string()),
  checklist: z.array(z.string()),
  linkedExercises: z.array(z.string()),
});

export const TacticalMemoryItemSchema = z.object({
  category: z.string(),
  pattern: z.string(),
  impact: z.string(),
  frequency: z.number().int().min(1),
  severityScore: z.number().min(0).max(1),
  lastSeen: z.string(),
});

export const TacticalMemorySchema = z.array(TacticalMemoryItemSchema);

export type TacticalMemoryItem = z.infer<typeof TacticalMemoryItemSchema>;

export const TacticalKnowledgeItemSchema = z.object({
  category: z.string(),
  principle: z.string(),
  context: z.string(),
  risk: z.string(),
  tags: z.array(z.string()),
});

export const TacticalKnowledgeSchema = z.array(TacticalKnowledgeItemSchema);

export type TacticalKnowledgeItem = z.infer<typeof TacticalKnowledgeItemSchema>;

export const MatchObservationSchema = z.object({
  matchId: z.string(),
  minute: z.number(),
  phase: z.string(),
  observation: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  tags: z.array(z.string()),
});

export const MatchObservationsSchema = z.array(MatchObservationSchema);

export type MatchObservation = z.infer<typeof MatchObservationSchema>;
export type CoachMatchAdvice = z.infer<typeof CoachMatchAdviceSchema>;
export type AiPlan = z.infer<typeof AiPlanSchema>;
