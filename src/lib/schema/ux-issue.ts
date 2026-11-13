import { ProductContextSchema } from '@/lib/schema/product-context';
import { z } from 'zod';
import { AIExplanationResultSchema, AIGenerationRecordSchema } from './ai-response';

export * from './evidence';

export const AuditStatusSchema = z.enum(['pass', 'candidateFail', 'needsReview']);
export type AuditStatus = z.infer<typeof AuditStatusSchema>;

export const DesignerDecisionSchema = z.enum(['accept', 'reject', 'edit', 'reprioritize']);
export type DesignerDecision = z.infer<typeof DesignerDecisionSchema>;

export const ReviewDispositionSchema = z.enum(['confirmed_issue', 'false_positive', 'needs_review', 'accepted_risk']);
export type ReviewDisposition = z.infer<typeof ReviewDispositionSchema>;
export const REVIEW_DISPOSITION_LABELS: Record<ReviewDisposition, string> = {
  confirmed_issue: 'Confirmed Issue', false_positive: 'False Positive',
  needs_review: 'Needs Review', accepted_risk: 'Accepted Risk',
};
// Legacy accept/reject records remain readable; do not infer a disposition from edit/reprioritize.
export function effectiveReviewDisposition(issue: {
  reviewDisposition?: ReviewDisposition; designerDecision?: DesignerDecision;
  decisionHistory?: { action: string }[];
}): ReviewDisposition | undefined {
  if (issue.reviewDisposition) return issue.reviewDisposition;
  const legacy = [...(issue.decisionHistory || [])].reverse().find(event => event.action === 'accept' || event.action === 'reject')?.action || issue.designerDecision;
  return legacy === 'accept' ? 'confirmed_issue' : legacy === 'reject' ? 'false_positive' : undefined;
}

export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export type Priority = z.infer<typeof PrioritySchema>;

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const UXIssueSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  wcagCriterion: z.string().min(1),
  status: AuditStatusSchema,
  title: z.string().min(1),
  description: z.string().min(1),

  url: z.string().min(1),
  viewport: ViewportSchema,

  selector: z.string().min(1),
  element: z.string().min(1),
  role: z.string().optional(),
  accessibleName: z.string().optional(),

  measured: z.record(z.unknown()),
  expected: z.record(z.unknown()),

  boundingBox: BoundingBoxSchema.optional(),
  screenshotPath: z.string().optional(),

  exception: z.string().optional(),

  initialPriority: PrioritySchema,
  priorityRationale: z.string().min(1),

  aiExplanation: z.string().optional(),
  aiRecommendation: z.string().optional(),
  aiExplanationResult: AIExplanationResultSchema.optional(),
  aiGenerationHistory: z.array(AIGenerationRecordSchema).optional(),

  reviewDisposition: ReviewDispositionSchema.optional(),
  reviewReason: z.string().optional(),
  reviewer: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  designerDecision: DesignerDecisionSchema.optional(),
  designerReason: z.string().optional(),
  editedRecommendation: z.string().optional(),
});
export type UXIssue = z.infer<typeof UXIssueSchema>;

export const DecisionRecordSchema = z.object({
  id: z.string().min(1).default(() => crypto.randomUUID()),
  timestamp: z.string().datetime(),
  action: z.enum(['accept', 'reject', 'edit', 'reprioritize', 'review_disposition']),
  reviewer: z.string().optional(),
  previousDisposition: ReviewDispositionSchema.optional(),
  newDisposition: ReviewDispositionSchema.optional(),
  reason: z.string().optional(),
  previousState: DesignerDecisionSchema.optional(),
  newState: DesignerDecisionSchema.optional(),
  fromPriority: PrioritySchema.optional(),
  toPriority: PrioritySchema.optional(),
  originalRecommendation: z.string().optional(),
  previousRecommendation: z.string().optional(),
  editedRecommendation: z.string().optional(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export const GroupedUXIssueSchema = z.object({
  fingerprint: z.string().min(1),
  representative: UXIssueSchema,
  rawOccurrencesCount: z.number().int().positive(),
  occurrences: z.array(UXIssueSchema).min(1),
  status: AuditStatusSchema,
  hasMixedStatus: z.boolean().optional(),
  initialPriority: PrioritySchema,
  currentPriority: PrioritySchema,
  aiExplanation: z.string().optional(),
  aiRecommendation: z.string().optional(),
  aiExplanationResult: AIExplanationResultSchema.optional(),
  aiGenerationHistory: z.array(AIGenerationRecordSchema).optional(),
  reviewDisposition: ReviewDispositionSchema.optional(),
  reviewReason: z.string().optional(),
  reviewer: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  designerDecision: DesignerDecisionSchema.optional(),
  designerReason: z.string().optional(),
  editedRecommendation: z.string().optional(),
  decisionHistory: z.array(DecisionRecordSchema).default([]),
  iterationComparison: z.any().optional(),
});
export type GroupedUXIssue = z.infer<typeof GroupedUXIssueSchema> & {
  iterationComparison?: import('./iteration').IterationComparison;
};

export const AuditSummarySchema = z.object({
  totalRawFindings: z.number().int().nonnegative(),
  totalGroupedIssues: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  candidateFailCount: z.number().int().nonnegative(),
  needsReviewCount: z.number().int().nonnegative(),
});
export type AuditSummary = z.infer<typeof AuditSummarySchema>;

export const AuditRunSchema = z.object({
  pageScreenshots: z.array(z.object({width:z.number(),height:z.number(),path:z.string()})).optional(),
  auditWarnings: z.array(z.string()).optional(),
  productContext: ProductContextSchema.optional(),
  id: z.string().min(1),
  targetUrl: z.string().min(1),
  fixtureId: z.string().optional(),
  timestamp: z.string().datetime(),
  viewports: z.array(ViewportSchema),
  rawIssues: z.array(UXIssueSchema),
  groupedIssues: z.array(GroupedUXIssueSchema),
  summary: AuditSummarySchema,
});
export type AuditRun = z.infer<typeof AuditRunSchema>;
