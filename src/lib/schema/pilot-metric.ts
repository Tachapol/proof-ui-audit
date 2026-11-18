import { z } from 'zod';

export const PilotScopeSchema = z.object({
  selector: z.string().trim().min(1).max(500),
  parentHeadingLevel: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();
export type PilotScope = z.infer<typeof PilotScopeSchema>;

export const PilotMetricMetadataSchema = z.object({
  metricId: z.enum(['touch-target-spacing', 'heading-hierarchy']),
  metricVersion: z.literal('1.0.0'),
  unit: z.enum(['CSS px', 'heading level']),
  executionStatus: z.enum(['completed', 'partial', 'skipped', 'error']),
  applicability: z.enum(['applicable', 'not_applicable', 'unknown']),
  basis: z.literal('project-advisory'),
});
export type PilotMetricMetadata = z.infer<typeof PilotMetricMetadataSchema>;

export const PilotMetricResultSchema = PilotMetricMetadataSchema.extend({
  url: z.string(),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  scopeSelector: z.string().nullable(),
  parentHeadingLevel: z.number().int().positive().optional(),
  rawParentHeadingLevel: z.string().nullable().optional(),
  outcome: z.enum(['pass', 'needsReview']).nullable(),
  reason: z.string(),
  measurements: z.array(z.record(z.unknown())),
  limitations: z.array(z.string()),
});
export type PilotMetricResult = z.infer<typeof PilotMetricResultSchema>;
