import { ProductContextSchema } from '@/lib/schema/product-context';
import { z } from 'zod';

export const AIProvenanceSchema = z.enum(['gemini', 'cpe', 'fallback']);
export type AIProvenance = z.infer<typeof AIProvenanceSchema>;

export const AIFallbackReasonSchema = z.enum([
  'no_api_key',
  'provider_timeout',
  'provider_error',
  'empty_response',
  'malformed_json',
  'schema_validation_failed',
  'grounding_failed',
]);
export type AIFallbackReason = z.infer<typeof AIFallbackReasonSchema>;

export const AIExplanationInputSchema = z.object({
  productContext: ProductContextSchema.optional(),
  ruleId: z.enum(['target-size', 'text-contrast', 'non-text-contrast', 'reflow', 'text-spacing']),
  wcagCriterion: z.string().min(1),
  status: z.enum(['pass', 'candidateFail', 'needsReview']),
  title: z.string().min(1),
  description: z.string().min(1),
  selector: z.string().min(1),
  element: z.string().min(1),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  measured: z.record(z.unknown()),
  expected: z.record(z.unknown()),
  exception: z.string().optional(),
  reviewReason: z.string().optional(),
  initialPriority: z.enum(['P0', 'P1', 'P2', 'P3']),
  priorityRationale: z.string().min(1),
});
export type AIExplanationInput = z.infer<typeof AIExplanationInputSchema>;

// Strict model output schema: rejects unknown fields, empty, or whitespace-only strings
export const RawModelOutputSchema = z
  .object({
    explanation: z.string().trim().min(1, 'Explanation cannot be empty or whitespace-only'),
    recommendation: z.string().trim().min(1, 'Recommendation cannot be empty or whitespace-only'),
    requiresDesignerReview: z.boolean(),
    uncertaintyNote: z.string().trim().min(1).optional(),
  })
  .strict();
export type RawModelOutput = z.infer<typeof RawModelOutputSchema>;

// Append-only record of each generation or regeneration event
export const AIGenerationRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  provenance: AIProvenanceSchema,
  isFallback: z.boolean(),
  fallbackReason: AIFallbackReasonSchema.optional(),
  explanation: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  uncertaintyNote: z.string().trim().optional(),
  requiresDesignerReview: z.boolean(),
  evidenceFingerprint: z.string().min(1),
  model: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});
export type AIGenerationRecord = z.infer<typeof AIGenerationRecordSchema>;

export const AIExplanationResultSchema = z.object({
  id: z.string().min(1).optional(),
  explanation: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  requiresDesignerReview: z.boolean(),
  uncertaintyNote: z.string().trim().optional(),
  provenance: AIProvenanceSchema,
  isFallback: z.boolean(),
  fallbackReason: AIFallbackReasonSchema.optional(),
  timestamp: z.string().datetime(),
  model: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  evidenceFingerprint: z.string().optional(),
});
export type AIExplanationResult = z.infer<typeof AIExplanationResultSchema>;
