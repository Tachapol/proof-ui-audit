import { ProductContextSchema } from '@/lib/schema/product-context';
import { z } from 'zod';
import {
  AuditStatusSchema,
  PrioritySchema,
  DesignerDecisionSchema,
  DecisionRecordSchema,
  ViewportSchema,
  BoundingBoxSchema,
} from '@/lib/schema/ux-issue';
import { AIGenerationRecordSchema, AIExplanationResultSchema } from '@/lib/schema/ai-response';

export function sanitizePath(rawPath?: string | null): string | undefined {
  if (!rawPath) return undefined;
  // If it's already a relative web path, keep it
  if (rawPath.startsWith('/screenshots/') || rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }
  // Strip any absolute filesystem paths (e.g., /Users/..., C:\..., /var/...)
  const parts = rawPath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  return `/screenshots/${filename}`;
}

export const ReportOccurrenceSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  wcagCriterion: z.string(),
  status: AuditStatusSchema,
  title: z.string(),
  description: z.string(),
  viewport: ViewportSchema,
  selector: z.string(),
  element: z.string(),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  measured: z.record(z.unknown()),
  expected: z.record(z.unknown()),
  boundingBox: BoundingBoxSchema.optional(),
  screenshotPath: z.string().optional(),
  exception: z.string().optional(),
});

export const ReportIterationComparisonSchema = z.object({
  overrideId: z.string().optional(),
  overrideName: z.string().optional(),
  candidateId: z.string().optional(),
  candidateName: z.string().optional(),
  appliedCss: z.string().optional(),
  candidateCode: z.string().optional(),
  viewport: ViewportSchema.optional(),
  targetSelector: z.string().optional(),

  // Baseline
  baselineMeasurement: z.record(z.unknown()).default({}),
  baselineStatus: AuditStatusSchema.optional(),
  baselineScreenshotPath: z.string().optional(),

  // Candidate
  candidateMeasurement: z.record(z.unknown()).default({}),
  candidateStatus: AuditStatusSchema.optional(),
  candidateScreenshotPath: z.string().optional(),

  // Comparison & Measurements
  expectedThreshold: z.record(z.unknown()).optional(),
  measurementDelta: z.record(z.unknown()).optional(),
  regressionResult: z.enum(['improved', 'unchanged', 'regressed', 'unable_to_verify', 'no_new_failures']).optional(),
  verificationStatus: z.enum(['verified', 'failed', 'unable_to_verify']).optional(),
  verificationErrors: z.array(z.string()).optional(),
  regressionCounts: z.object({
    resolved: z.number().int().nonnegative(),
    persistent: z.number().int().nonnegative(),
    new: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
  }).optional(),
  plainLanguageSummary: z.string().optional(),

  // Events & Decisions
  approvalTimestamp: z.string().optional(),
  approvalReason: z.string().optional(),
  finalDesignerDecision: DesignerDecisionSchema.optional(),
  finalDesignerReason: z.string().optional(),
  finalDecisionTimestamp: z.string().optional(),
  eventHistory: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    type: z.string(),
    description: z.string(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});
export type ReportIterationComparison = z.infer<typeof ReportIterationComparisonSchema>;

export const ReportGroupedIssueSchema = z.object({
  fingerprint: z.string(),
  ruleId: z.string(),
  wcagCriterion: z.string(),
  status: AuditStatusSchema,
  title: z.string(),
  description: z.string(),
  currentPriority: PrioritySchema,
  initialPriority: PrioritySchema,
  priorityRationale: z.string(),
  occurrenceCount: z.number().int().nonnegative(),
  viewports: z.array(ViewportSchema),
  selector: z.string(),
  element: z.string(),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  measured: z.record(z.unknown()),
  expected: z.record(z.unknown()),
  boundingBox: BoundingBoxSchema.optional(),
  screenshotPath: z.string().optional(),
  exception: z.string().optional(),
  // AI Guidance
  aiExplanation: z.string().optional(),
  aiRecommendation: z.string().optional(),
  aiExplanationResult: AIExplanationResultSchema.optional(),
  aiGenerationHistory: z.array(AIGenerationRecordSchema).optional(),
  // Designer Decisions
  designerDecision: DesignerDecisionSchema.optional(),
  designerReason: z.string().optional(),
  editedRecommendation: z.string().optional(),
  decisionHistory: z.array(DecisionRecordSchema).optional(),
  // Remediation & Iteration Proof
  iterationComparison: ReportIterationComparisonSchema.optional(),
  // Occurrences
  occurrences: z.array(ReportOccurrenceSchema),
});

export const ReportMetadataSchema = z.object({
  productContext: ProductContextSchema.optional(),
  runId: z.string(),
  timestamp: z.string(),
  targetUrl: z.string(),
  fixtureId: z.string().optional(),
  viewports: z.array(ViewportSchema),
});

export const ReportSummarySchema = z.object({
  rawFindingCount: z.number().int().nonnegative(),
  groupedIssueCount: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  candidateFailCount: z.number().int().nonnegative(),
  needsReviewCount: z.number().int().nonnegative(),
  priorityCounts: z.object({
    P0: z.number().int().nonnegative(),
    P1: z.number().int().nonnegative(),
    P2: z.number().int().nonnegative(),
    P3: z.number().int().nonnegative(),
  }),
  remediationSummary: z
    .object({
      totalIterated: z.number().int().nonnegative(),
      verifiedCount: z.number().int().nonnegative(),
      regressedCount: z.number().int().nonnegative(),
      unableToVerifyCount: z.number().int().nonnegative(),
    })
    .optional(),
});

export const ReportModelSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  exportTimestamp: z.string(),
  audit: ReportMetadataSchema,
  summary: ReportSummarySchema,
  disclaimers: z.array(z.string()),
  limitations: z.array(z.string()),
  groupedIssues: z.array(ReportGroupedIssueSchema),
  rawOccurrences: z.array(ReportOccurrenceSchema),
});

export type ReportModel = z.infer<typeof ReportModelSchema>;
export type ReportGroupedIssue = z.infer<typeof ReportGroupedIssueSchema>;
export type ReportOccurrence = z.infer<typeof ReportOccurrenceSchema>;
