import { z } from "zod";

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const PostMatchTagSchema = z.object({
  minute: z.number().min(0).max(130).optional(),
  label: z.string().min(1),
  zone: z.string().optional(),
  note: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const MatchContextSchema = z.object({
  opponent: z.string().min(1),
  result: z.string().min(1),
  competition: z.string().optional(),
  date: z.string().optional(),
  ownSystem: z.string().min(1),
  opponentSystem: z.string().optional(),
  venue: z.string().optional(),
});

export const PostMatchInputSchema = z
  .object({
    matchContext: MatchContextSchema,
    planBeforeMatch: z.string().optional(),
    staffNotes: z.string().optional(),
    tags: z.array(PostMatchTagSchema).default([]),
  })
  .refine(
    (input) =>
      Boolean(input.staffNotes?.trim()) || Boolean(input.tags.length),
    {
      message: "Staff notes or at least one tag are required",
      path: ["staffNotes"],
    },
  );

export const MemoryCandidateSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  category: z.enum([
    "teamPattern",
    "playerPattern",
    "opponentPattern",
    "staffPrinciple",
  ]),
  evidence: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
  scope: z.enum(["oneOff", "repeatWatch", "validated"]),
  selectedByStaff: z.boolean().default(false),
});

export const PostMatchReportSchema = z.object({
  id: z.string().optional(),
  createdAt: z.string().optional(),
  matchContext: MatchContextSchema,
  executiveSummary: z.string().min(1),
  matchStory: z.string().min(1),
  keyPatterns: z.array(
    z.object({
      pattern: z.string().min(1),
      evidence: z.array(z.string()).default([]),
      tacticalImpact: z.string().min(1),
    }),
  ),
  mainProblems: z.array(
    z.object({
      problem: z.string().min(1),
      probableCause: z.string().min(1),
      severity: z.enum(["low", "medium", "high"]),
      examplesToReview: z.array(z.string()).default([]),
    }),
  ),
  positives: z.array(z.string()).default([]),
  wednesdayTest: z.array(
    z.object({
      hypothesis: z.string().min(1),
      test: z.string().min(1),
      successSignals: z.array(z.string()).default([]),
      fallbackIfFails: z.string().optional(),
    }),
  ),
  saturdayFocus: z.array(z.string()).default([]),
  risksOfOvercorrection: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  memoryCandidates: z.array(MemoryCandidateSchema).default([]),
  reflection: z.object({
    mainUncertainty: z.string().min(1),
    alternativeInterpretation: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
});

export const StaffReviewSchema = z.object({
  notes: z.string().optional(),
  acceptedMemoryCandidateIds: z.array(z.string()).default([]),
});

export const SavedPostMatchReportSchema = z.object({
  id: z.string().min(1),
  savedAt: z.string(),
  report: PostMatchReportSchema,
  staffReview: StaffReviewSchema,
});

export const SavePostMatchReportRequestSchema = z.object({
  report: PostMatchReportSchema,
  staffReview: StaffReviewSchema.default({
    notes: "",
    acceptedMemoryCandidateIds: [],
  }),
});

export const CommitMemoryCandidatesRequestSchema = z.object({
  reportId: z.string().min(1),
  candidates: z.array(MemoryCandidateSchema).min(1),
});

export type PostMatchInput = z.infer<typeof PostMatchInputSchema>;
export type PostMatchTag = z.infer<typeof PostMatchTagSchema>;
export type PostMatchReport = z.infer<typeof PostMatchReportSchema>;
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;
export type SavedPostMatchReport = z.infer<
  typeof SavedPostMatchReportSchema
>;
export type StaffReview = z.infer<typeof StaffReviewSchema>;
