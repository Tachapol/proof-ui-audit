import { z } from 'zod';
import {
  AuditStatusSchema,
  DesignerDecisionSchema,
  ViewportSchema,
  BoundingBoxSchema,
} from './ux-issue';

export const RegressionResultSchema = z.enum(['improved', 'unchanged', 'regressed', 'unable_to_verify']);
export type RegressionResult = z.infer<typeof RegressionResultSchema>;

export const IterationEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  type: z.enum(['approval', 'candidate_evaluated', 'final_decision']),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type IterationEvent = z.infer<typeof IterationEventSchema>;

export const IterationComparisonSchema = z.object({
  overrideId: z.string().min(1),
  overrideName: z.string().min(1),
  appliedCss: z.string().min(1),
  fixtureId: z.string().min(1),
  viewport: ViewportSchema,
  targetSelector: z.string().min(1),

  // Baseline
  baselineMeasurement: z.record(z.unknown()),
  baselineStatus: AuditStatusSchema,
  baselineBoundingBox: BoundingBoxSchema.optional(),
  baselineScreenshotPath: z.string().optional(),

  // Candidate
  candidateMeasurement: z.record(z.unknown()),
  candidateStatus: AuditStatusSchema,
  candidateBoundingBox: BoundingBoxSchema.optional(),
  candidateScreenshotPath: z.string().optional(),

  // Comparison
  expectedThreshold: z.record(z.unknown()),
  measurementDelta: z.record(z.unknown()),
  regressionResult: RegressionResultSchema,
  plainLanguageSummary: z.string().min(1),

  // Approval Event
  approvalTimestamp: z.string().datetime(),
  approvalReason: z.string().optional(),

  // Final Decision (optional until recorded)
  finalDesignerDecision: DesignerDecisionSchema.optional(),
  finalDesignerReason: z.string().optional(),
  finalDecisionTimestamp: z.string().datetime().optional(),

  // Append-only history of iteration events
  eventHistory: z.array(IterationEventSchema),
});

export type IterationComparison = z.infer<typeof IterationComparisonSchema>;
