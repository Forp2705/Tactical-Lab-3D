import { z } from "zod";

export const CoachActionSchema = z.object({
  type: z.enum([
    "openExercise",
    "addToSession",
    "createExerciseVariant",
    "applyLineup",
    "applyShape",
    "createExerciseFromShape",
  ]),
  label: z.string().optional(),
  exerciseId: z.string().optional(),
  lineupId: z.string().optional(),
  shapeId: z.string().optional(),
  title: z.string().optional(),
  rationale: z.string().optional(),
});

export const CoachEvidenceCitationSchema = z.object({
  sourceType: z.enum(["knowledge", "memory", "observation", "report"]),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  relevance: z.number().min(0).max(1).optional(),
});

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
  linkedExercises: z.array(z.string()).default([]),
  actions: z.array(CoachActionSchema).default([]),
  evidenceCitations: z.array(CoachEvidenceCitationSchema).default([]),
});

export const TacticalDomainSchema = z.enum([
  "defense",
  "pressing",
  "block",
  "buildUp",
  "defensiveTransition",
  "offensiveTransition",
  "attack",
  "setPieces",
  "duels",
  "physicalEmotional",
  "systemLineup",
]);

export const EvidenceTargetSchema = z.enum([
  "ownTeam",
  "rival",
  "phase",
  "playerProfile",
  "zone",
  "trigger",
  "frequency",
  "moment",
  "matchContext",
  "cause",
  "risk",
]);

export const SpecificitySchema = z.enum([
  "general",
  "specific",
  "contradictory",
]);

export const RequestTypeSchema = z.enum([
  "diagnosis",
  "quickIdea",
  "generalExplanation",
  "actionPlan",
]);

export const QuestionPurposeSchema = z.enum([
  "classifyProblem",
  "locateZone",
  "identifySubject",
  "confirmTrigger",
  "confirmFrequency",
  "separateCauseFromSymptom",
  "assessRisk",
  "chooseAdjustmentPath",
]);

export const AnswerKindSchema = z.enum([
  "singleChoice",
  "multiChoice",
  "shortText",
  "yesNo",
]);

export const EvidenceStrengthSchema = z.enum([
  "none",
  "weak",
  "partial",
  "sufficient",
]);

export const ImpliedClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  domain: TacticalDomainSchema,
  subject: z.enum(["own", "rival", "both", "unknown"]),
  riskIfWrong: z.enum(["low", "medium", "high"]),
  requiredEvidence: z.array(EvidenceTargetSchema).default([]),
});

export const TacticalIntentSchema = z.object({
  domains: z.array(TacticalDomainSchema).min(1),
  specificity: SpecificitySchema,
  requestType: RequestTypeSchema,
  impliedClaims: z.array(ImpliedClaimSchema).default([]),
});

export const ContextualQuestionSchema = z.object({
  id: z.string().min(1),
  category: TacticalDomainSchema,
  question: z.string().min(1),
  whyItMatters: z.string().min(1),
  informationValue: z.enum(["low", "medium", "high"]),
  tacticalRiskReduced: z.string().default(""),
  expectedImpactOnDiagnosis: z.enum(["low", "medium", "high"]),
  evidenceTarget: EvidenceTargetSchema,
  purpose: QuestionPurposeSchema,
  answerKind: AnswerKindSchema,
  options: z.array(z.string()).optional(),
  blocksClaimIds: z.array(z.string()).default([]),
});

export const EvidenceAuditSchema = z.object({
  covered: z.array(EvidenceTargetSchema).default([]),
  missing: z
    .array(
      z.object({
        target: EvidenceTargetSchema,
        reason: z.string().min(1),
      }),
    )
    .default([]),
  criticalMissingCount: z.number().int().min(0),
  evidenceStrength: EvidenceStrengthSchema,
});

export const CollectedAnswerSchema = z.object({
  questionId: z.string().min(1),
  evidenceTarget: EvidenceTargetSchema,
  category: TacticalDomainSchema,
  answerKind: AnswerKindSchema,
  rawAnswer: z.string().min(1),
});

export const CoachInterviewStateSchema = z.object({
  intent: TacticalIntentSchema,
  temptingClaims: z.array(ImpliedClaimSchema).default([]),
  audit: EvidenceAuditSchema,
});

export const QuestionResponseSchema = z.object({
  mode: z.literal("question"),
  intent: TacticalIntentSchema,
  selectedQuestions: z.array(ContextualQuestionSchema),
  blockedClaims: z.array(ImpliedClaimSchema).default([]),
  evidenceAudit: EvidenceAuditSchema,
  confidenceCap: z.number().min(0).max(1),
});

export const HypothesisResponseSchema = z.object({
  mode: z.literal("hypothesis"),
  advice: CoachMatchAdviceSchema,
  confidenceCap: z.number().min(0).max(1),
  intent: TacticalIntentSchema,
  evidenceAudit: EvidenceAuditSchema,
  followUpQuestions: z.array(ContextualQuestionSchema).default([]),
});

export const DiagnosisResponseSchema = z.object({
  mode: z.literal("diagnosis"),
  advice: CoachMatchAdviceSchema,
  intent: TacticalIntentSchema,
  evidenceAudit: EvidenceAuditSchema,
});

export const CoachResponseSchema = z.discriminatedUnion("mode", [
  QuestionResponseSchema,
  HypothesisResponseSchema,
  DiagnosisResponseSchema,
]);

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
export type CoachAction = z.infer<typeof CoachActionSchema>;
export type CoachEvidenceCitation = z.infer<typeof CoachEvidenceCitationSchema>;
export type CoachMatchAdvice = z.infer<typeof CoachMatchAdviceSchema>;
export type TacticalDomain = z.infer<typeof TacticalDomainSchema>;
export type EvidenceTarget = z.infer<typeof EvidenceTargetSchema>;
export type Specificity = z.infer<typeof SpecificitySchema>;
export type RequestType = z.infer<typeof RequestTypeSchema>;
export type QuestionPurpose = z.infer<typeof QuestionPurposeSchema>;
export type AnswerKind = z.infer<typeof AnswerKindSchema>;
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;
export type ImpliedClaim = z.infer<typeof ImpliedClaimSchema>;
export type TacticalIntent = z.infer<typeof TacticalIntentSchema>;
export type ContextualQuestion = z.infer<typeof ContextualQuestionSchema>;
export type EvidenceAudit = z.infer<typeof EvidenceAuditSchema>;
export type CollectedAnswer = z.infer<typeof CollectedAnswerSchema>;
export type CoachInterviewState = z.infer<typeof CoachInterviewStateSchema>;
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type AiPlan = z.infer<typeof AiPlanSchema>;
