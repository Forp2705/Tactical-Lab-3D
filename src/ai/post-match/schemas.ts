import { z } from "zod";

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export const SubjectSchema = z.enum(["own", "rival", "both", "unknown"]);

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
  interpretedResult: z
    .object({
      ownGoals: z.number().int().min(0),
      rivalGoals: z.number().int().min(0),
      outcome: z.enum(["win", "draw", "loss"]),
      label: z.string(),
    })
    .optional(),
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
    (input) => Boolean(input.staffNotes?.trim()) || Boolean(input.tags.length),
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
  ownStrengths: z
    .array(
      z.object({
        strength: z.string().min(1),
        evidence: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  ownProblems: z
    .array(
      z.object({
        problem: z.string().min(1),
        evidence: z.array(z.string()).default([]),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .default([]),
  rivalVulnerabilities: z
    .array(
      z.object({
        vulnerability: z.string().min(1),
        evidence: z.array(z.string()).default([]),
        howWeExploitedIt: z.string().optional(),
      }),
    )
    .default([]),
  observedRisks: z
    .array(
      z.object({
        risk: z.string().min(1),
        evidence: z.array(z.string()).default([]),
        owner: SubjectSchema,
      }),
    )
    .default([]),
  tacticalTradeoffs: z
    .array(
      z.object({
        decision: z.string().min(1),
        upside: z.string().min(1),
        downside: z.string().min(1),
        subject: SubjectSchema,
        evidence: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  flankAsymmetries: z
    .array(
      z.object({
        flank: z.enum(["left", "right", "central", "both"]),
        description: z.string().min(1),
        subject: SubjectSchema,
        evidence: z.array(z.string()).default([]),
        implication: z.string().optional(),
      }),
    )
    .default([]),
  tacticalInferences: z
    .array(
      z.object({
        inference: z.string().min(1),
        basedOn: z.array(z.string()).default([]),
        confidence: ConfidenceSchema,
      }),
    )
    .default([]),
  memoryInfluence: z
    .array(
      z.object({
        memoryItem: z.string().min(1),
        usedAs: z.enum(["contextOnly", "supportedByCurrentEvidence"]),
        currentEvidence: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  grounding: z
    .object({
      resultPerspective: z.string(),
      evidenceUsed: z.array(z.string()).default([]),
      unsupportedClaims: z.array(z.string()).default([]),
      subjectAttributionWarnings: z.array(z.string()).default([]),
    })
    .default({
      resultPerspective: "",
      evidenceUsed: [],
      unsupportedClaims: [],
      subjectAttributionWarnings: [],
    }),
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
export type SavedPostMatchReport = z.infer<typeof SavedPostMatchReportSchema>;
export type StaffReview = z.infer<typeof StaffReviewSchema>;
