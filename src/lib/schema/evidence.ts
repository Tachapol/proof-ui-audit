import { z } from 'zod';

// ==========================================
// 1. Rule-Specific Measured Evidence Schemas
// ==========================================

export const TargetSizeEvidenceSchema = z.object({
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  isInline: z.boolean().default(false),
  hasSufficientSpacing: z.boolean().default(false),
  spacingDeficitPx: z.number().optional(),
  isUserAgentDefault: z.boolean().optional(),
  isEssentialCandidate: z.boolean().optional(),
  hasEquivalentTarget: z.boolean().optional(),
  unresolvedReason: z.string().optional(),
}).passthrough();
export type TargetSizeEvidence = z.infer<typeof TargetSizeEvidenceSchema>;

export const TextContrastEvidenceSchema = z.object({
  contrastRatio: z.number().positive(),
  fontSizePx: z.number().positive().optional(),
  fontWeight: z.number().positive().optional(),
  isLargeText: z.boolean().default(false),
  color: z.string().min(1).optional(),
  backgroundColor: z.string().min(1).optional(),
  hasComplexBackground: z.boolean().default(false),
  unresolvedReason: z.string().optional(),
}).passthrough();
export type TextContrastEvidence = z.infer<typeof TextContrastEvidenceSchema>;

export const NonTextContrastEvidenceSchema = z.object({
  contrastRatio: z.number().positive(),
  componentType: z.string().min(1).default('ui-component'),
  indicatorColor: z.string().min(1).optional(),
  adjacentColor: z.string().min(1).optional(),
  isInactiveOrDisabled: z.boolean().default(false),
  isStateMeaningUncertain: z.boolean().default(false),
  unresolvedReason: z.string().optional(),
}).passthrough();
export type NonTextContrastEvidence = z.infer<typeof NonTextContrastEvidenceSchema>;

export const ReflowEvidenceSchema = z.object({
  scrollWidth: z.number().nonnegative().optional(),
  clientWidth: z.number().nonnegative().optional(),
  horizontalOverflowPx: z.number().nonnegative().optional(),
  isEssential2D: z.boolean().optional(),
  clipDeficitPx: z.number().nonnegative().optional(),
  ancestorSelector: z.string().optional(),
  violation: z.string().optional(),
  overflowingElementsCount: z.number().nonnegative().optional(),
  computedStyles: z.record(z.unknown()).optional(),
  unresolvedReason: z.string().optional(),
}).passthrough();
export type ReflowEvidence = z.infer<typeof ReflowEvidenceSchema>;

export const TextSpacingEvidenceSchema = z.object({
  baselineHeight: z.number().nonnegative().optional(),
  candidateHeight: z.number().nonnegative().optional(),
  baselineScrollHeight: z.number().nonnegative().optional(),
  candidateScrollHeight: z.number().nonnegative().optional(),
  candidateClientHeight: z.number().nonnegative().optional(),
  clipDeficitPx: z.number().nonnegative().default(0),
  horizontalClipDeficitPx: z.number().nonnegative().optional(),
  isClipped: z.boolean().default(false),
  hasTextOverlap: z.boolean().default(false),
  isControlObscured: z.boolean().default(false),
  isBoundingBoxEscaped: z.boolean().default(false),
  unresolvedReason: z.string().optional(),
}).passthrough();
export type TextSpacingEvidence = z.infer<typeof TextSpacingEvidenceSchema>;

// Map ruleId to its evidence schema
export const RULE_EVIDENCE_SCHEMAS = {
  'target-size': TargetSizeEvidenceSchema,
  'text-contrast': TextContrastEvidenceSchema,
  'non-text-contrast': NonTextContrastEvidenceSchema,
  'reflow': ReflowEvidenceSchema,
  'text-spacing': TextSpacingEvidenceSchema,
} as const;

export type RuleId = keyof typeof RULE_EVIDENCE_SCHEMAS;

// ==========================================
// 2. Rule Expected Threshold Schemas
// ==========================================

export const TargetSizeExpectedSchema = z.object({
  minWidth: z.number().positive().default(24),
  minHeight: z.number().positive().default(24),
  thresholdDescription: z.string().min(1),
}).passthrough();

export const TextContrastExpectedSchema = z.object({
  minRatio: z.number().positive(),
  thresholdDescription: z.string().min(1),
}).passthrough();

export const NonTextContrastExpectedSchema = z.object({
  minRatio: z.number().positive().default(3),
  thresholdDescription: z.string().min(1),
}).passthrough();

export const ReflowExpectedSchema = z.object({
  maxOverflowPx: z.number().nonnegative().default(1.0),
  thresholdDescription: z.string().min(1),
}).passthrough();

export const TextSpacingExpectedSchema = z.object({
  maxClipDeficitPx: z.number().nonnegative().default(0),
  thresholdDescription: z.string().min(1),
}).passthrough();

export const RULE_EXPECTED_SCHEMAS = {
  'target-size': TargetSizeExpectedSchema,
  'text-contrast': TextContrastExpectedSchema,
  'non-text-contrast': NonTextContrastExpectedSchema,
  'reflow': ReflowExpectedSchema,
  'text-spacing': TextSpacingExpectedSchema,
} as const;

// ==========================================
// 3. Validation & Evidence Formatting Helpers
// ==========================================

export interface FormattedMetric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  rawValue: unknown;
  isViolation?: boolean;
}

/**
 * Validates measured evidence against the known schema for a rule.
 */
export function validateRuleEvidence(ruleId: string, measured: unknown) {
  const schema = RULE_EVIDENCE_SCHEMAS[ruleId as RuleId];
  if (!schema) {
    return { valid: true, data: measured, isKnownRule: false };
  }
  const result = schema.safeParse(measured);
  if (!result.success) {
    return { valid: false, error: result.error.message, isKnownRule: true };
  }
  return { valid: true, data: result.data, isKnownRule: true };
}

/**
 * Extracts structured, human-readable metrics with explicit units from measured evidence.
 */
export function extractEvidenceMetrics(
  ruleId: string,
  measured: Record<string, unknown> = {},
  expected?: Record<string, unknown>
): FormattedMetric[] {
  const metrics: FormattedMetric[] = [];

  switch (ruleId) {
    case 'target-size': {
      const w = typeof measured.width === 'number' ? Math.round(measured.width) : undefined;
      const h = typeof measured.height === 'number' ? Math.round(measured.height) : undefined;
      const minW = typeof expected?.minWidth === 'number' ? expected.minWidth : 24;
      const minH = typeof expected?.minHeight === 'number' ? expected.minHeight : 24;

      if (w !== undefined && h !== undefined) {
        metrics.push({
          key: 'dimensions',
          label: 'Dimensions',
          value: `${w} × ${h}`,
          unit: 'px',
          rawValue: { width: w, height: h },
          isViolation: w < minW || h < minH,
        });
      }
      if (measured.isInline !== undefined) {
        metrics.push({
          key: 'isInline',
          label: 'Inline Element',
          value: measured.isInline ? 'Yes (Exception applies)' : 'No',
          rawValue: measured.isInline,
        });
      }
      if (measured.hasSufficientSpacing !== undefined) {
        metrics.push({
          key: 'spacing',
          label: '24px Spacing Circle',
          value: measured.hasSufficientSpacing ? 'Sufficient (Pass)' : 'Insufficient',
          rawValue: measured.hasSufficientSpacing,
          isViolation: !measured.hasSufficientSpacing && (w !== undefined && (w < minW || (h !== undefined && h < minH))),
        });
      }
      break;
    }

    case 'text-contrast':
    case 'non-text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio : undefined;
      const minRatio = typeof expected?.minRatio === 'number' ? expected.minRatio : (ruleId === 'text-contrast' ? 4.5 : 3.0);

      if (ratio !== undefined) {
        metrics.push({
          key: 'contrastRatio',
          label: 'Contrast Ratio',
          value: `${ratio.toFixed(2)}:1`,
          unit: ':1',
          rawValue: ratio,
          isViolation: ratio < minRatio,
        });
      }
      if (typeof measured.fontSizePx === 'number') {
        metrics.push({
          key: 'fontSizePx',
          label: 'Font Size',
          value: `${measured.fontSizePx}`,
          unit: 'px',
          rawValue: measured.fontSizePx,
        });
      }
      if (typeof measured.fontWeight === 'number') {
        metrics.push({
          key: 'fontWeight',
          label: 'Font Weight',
          value: `${measured.fontWeight}`,
          rawValue: measured.fontWeight,
        });
      }
      if (measured.isLargeText !== undefined) {
        metrics.push({
          key: 'isLargeText',
          label: 'Large Text',
          value: measured.isLargeText ? 'Yes (≥ 3:1 threshold)' : 'No (≥ 4.5:1 threshold)',
          rawValue: measured.isLargeText,
        });
      }
      const fg = (measured.color || measured.indicatorColor || measured.textColor) as string | undefined;
      if (fg) {
        metrics.push({
          key: 'foreground',
          label: ruleId === 'text-contrast' ? 'Text Color' : 'Indicator Color',
          value: fg,
          rawValue: fg,
        });
      }
      const bg = (measured.backgroundColor || measured.adjacentColor) as string | undefined;
      if (bg) {
        metrics.push({
          key: 'background',
          label: ruleId === 'text-contrast' ? 'Background Color' : 'Adjacent Color',
          value: bg,
          rawValue: bg,
        });
      }
      break;
    }

    case 'reflow': {
      const overflow = typeof measured.horizontalOverflowPx === 'number' ? measured.horizontalOverflowPx : undefined;
      if (overflow !== undefined) {
        metrics.push({
          key: 'horizontalOverflowPx',
          label: 'Horizontal Overflow',
          value: `${overflow}`,
          unit: 'px',
          rawValue: overflow,
          isViolation: overflow > 1.0,
        });
      }
      if (typeof measured.scrollWidth === 'number' && typeof measured.clientWidth === 'number') {
        metrics.push({
          key: 'widths',
          label: 'Scroll / Client Width',
          value: `${measured.scrollWidth}px / ${measured.clientWidth}px`,
          rawValue: { scrollWidth: measured.scrollWidth, clientWidth: measured.clientWidth },
        });
      }
      if (typeof measured.clipDeficitPx === 'number' && measured.clipDeficitPx > 0) {
        metrics.push({
          key: 'clipDeficitPx',
          label: 'Ancestor Clip Deficit',
          value: `${measured.clipDeficitPx}`,
          unit: 'px',
          rawValue: measured.clipDeficitPx,
          isViolation: true,
        });
      }
      if (measured.isEssential2D) {
        metrics.push({
          key: 'isEssential2D',
          label: 'Essential 2D Layout',
          value: 'Yes (Table, Map, or Diagram Exception)',
          rawValue: true,
        });
      }
      break;
    }

    case 'text-spacing': {
      const deficit = typeof measured.clipDeficitPx === 'number' ? measured.clipDeficitPx : undefined;
      if (deficit !== undefined) {
        metrics.push({
          key: 'clipDeficitPx',
          label: 'Clipping Deficit',
          value: `${deficit}`,
          unit: 'px',
          rawValue: deficit,
          isViolation: deficit > 0,
        });
      }
      if (typeof measured.baselineHeight === 'number' && typeof measured.candidateHeight === 'number') {
        metrics.push({
          key: 'heights',
          label: 'Height Expansion',
          value: `${Math.round(measured.baselineHeight)}px → ${Math.round(measured.candidateHeight)}px`,
          rawValue: { baseline: measured.baselineHeight, candidate: measured.candidateHeight },
        });
      }
      if (measured.isClipped) {
        metrics.push({
          key: 'isClipped',
          label: 'Text Clipped',
          value: 'Yes (Overflow restricted)',
          rawValue: true,
          isViolation: true,
        });
      }
      if (measured.hasTextOverlap) {
        metrics.push({
          key: 'hasTextOverlap',
          label: 'Text Overlap',
          value: 'Yes (Collision detected)',
          rawValue: true,
          isViolation: true,
        });
      }
      if (measured.isControlObscured) {
        metrics.push({
          key: 'isControlObscured',
          label: 'Adjacent Control Obscured',
          value: 'Yes (Interactive target blocked)',
          rawValue: true,
          isViolation: true,
        });
      }
      break;
    }

    default: {
      // Fallback: enumerate raw entries
      for (const [key, value] of Object.entries(measured)) {
        if (value !== undefined && typeof value !== 'object') {
          metrics.push({
            key,
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
            value: String(value),
            rawValue: value,
          });
        }
      }
      break;
    }
  }

  return metrics;
}

/**
 * Returns a concise single-line summary with exact units for display in cards and reports.
 */
export function getRuleEvidenceSummary(
  ruleId: string,
  measured: Record<string, unknown> = {},
  expected?: Record<string, unknown>
): string {
  switch (ruleId) {
    case 'target-size': {
      const w = measured.width !== undefined ? Math.round(Number(measured.width)) : '?';
      const h = measured.height !== undefined ? Math.round(Number(measured.height)) : '?';
      const minW = expected?.minWidth ?? 24;
      const minH = expected?.minHeight ?? 24;
      return `Measured: ${w} × ${h} px (Minimum expected: ${minW} × ${minH} px)`;
    }
    case 'text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio.toFixed(2) : '?';
      const minRatio = typeof expected?.minRatio === 'number' ? expected.minRatio.toFixed(1) : '4.5';
      return `Measured contrast: ${ratio}:1 (Required: ≥ ${minRatio}:1)`;
    }
    case 'non-text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio.toFixed(2) : '?';
      const minRatio = typeof expected?.minRatio === 'number' ? expected.minRatio.toFixed(1) : '3.0';
      return `Measured contrast: ${ratio}:1 (Required: ≥ ${minRatio}:1)`;
    }
    case 'reflow': {
      const overflow = typeof measured.horizontalOverflowPx === 'number' ? Math.round(measured.horizontalOverflowPx) : 0;
      return overflow > 1
        ? `Horizontal overflow: ${overflow} px (Max allowed: 1.0 px)`
        : `Reflow compliant: overflow ${overflow} px`;
    }
    case 'text-spacing': {
      const deficit = typeof measured.clipDeficitPx === 'number' ? Math.round(measured.clipDeficitPx) : 0;
      return deficit > 0
        ? `Clipping deficit: ${deficit} px under expanded text spacing`
        : `Text spacing compliant: no clipping detected`;
    }
    default:
      return Object.entries(measured)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
  }
}

