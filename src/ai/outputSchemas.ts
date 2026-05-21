import { z } from "zod";

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
  linkedExercises: z.array(z.string()).default([]),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;
