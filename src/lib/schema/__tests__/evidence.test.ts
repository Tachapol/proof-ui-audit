import { describe, it, expect } from 'vitest';
import {
  validateRuleEvidence,
  extractEvidenceMetrics,
  getRuleEvidenceSummary,
  TargetSizeEvidenceSchema,
  TextContrastEvidenceSchema,
  NonTextContrastEvidenceSchema,
  ReflowEvidenceSchema,
  TextSpacingEvidenceSchema,
} from '../evidence';

describe('Evidence Schema & Validation', () => {
  describe('Rule-Specific Validation', () => {
    it('validates target-size evidence correctly', () => {
      const valid = { width: 18.5, height: 20, isInline: false, hasSufficientSpacing: false };
      const res = validateRuleEvidence('target-size', valid);
      expect(res.valid).toBe(true);
      expect(res.isKnownRule).toBe(true);

      const invalid = { width: -5, height: 20 };
      const invalidRes = validateRuleEvidence('target-size', invalid);
      expect(invalidRes.valid).toBe(false);
    });

    it('validates text-contrast evidence correctly', () => {
      const valid = { contrastRatio: 2.84, fontSizePx: 14, fontWeight: 400, color: '#777', backgroundColor: '#fff' };
      const res = validateRuleEvidence('text-contrast', valid);
      expect(res.valid).toBe(true);

      const invalid = { contrastRatio: -1 };
      const invalidRes = validateRuleEvidence('text-contrast', invalid);
      expect(invalidRes.valid).toBe(false);
    });

    it('validates non-text-contrast evidence correctly', () => {
      const valid = { contrastRatio: 2.1, componentType: 'ui-component', indicatorColor: '#bbb', adjacentColor: '#fff' };
      const res = validateRuleEvidence('non-text-contrast', valid);
      expect(res.valid).toBe(true);
    });

    it('validates reflow evidence correctly', () => {
      const valid = { scrollWidth: 360, clientWidth: 320, horizontalOverflowPx: 40 };
      const res = validateRuleEvidence('reflow', valid);
      expect(res.valid).toBe(true);
    });

    it('validates text-spacing evidence correctly', () => {
      const valid = { baselineHeight: 40, candidateHeight: 65, clipDeficitPx: 12, isClipped: true };
      const res = validateRuleEvidence('text-spacing', valid);
      expect(res.valid).toBe(true);
    });

    it('gracefully handles unknown rules with pass-through', () => {
      const unknownRes = validateRuleEvidence('custom-rule', { customMetric: 123 });
      expect(unknownRes.valid).toBe(true);
      expect(unknownRes.isKnownRule).toBe(false);
    });
  });

  describe('Metric Extraction & Units', () => {
    it('extracts dimensions with px units for target-size', () => {
      const metrics = extractEvidenceMetrics('target-size', { width: 18.2, height: 22.4, isInline: false }, { minWidth: 24, minHeight: 24 });
      const dim = metrics.find(m => m.key === 'dimensions');
      expect(dim).toBeDefined();
      expect(dim?.value).toBe('18 × 22');
      expect(dim?.unit).toBe('px');
      expect(dim?.isViolation).toBe(true);
    });

    it('extracts contrast ratio with :1 unit and colors', () => {
      const metrics = extractEvidenceMetrics('text-contrast', {
        contrastRatio: 2.84,
        fontSizePx: 14,
        color: '#777777',
        backgroundColor: '#ffffff',
      }, { minRatio: 4.5 });

      const contrast = metrics.find(m => m.key === 'contrastRatio');
      expect(contrast?.value).toBe('2.84:1');
      expect(contrast?.unit).toBe(':1');
      expect(contrast?.isViolation).toBe(true);

      const fg = metrics.find(m => m.key === 'foreground');
      expect(fg?.value).toBe('#777777');
    });

    it('extracts reflow horizontal overflow with px unit', () => {
      const metrics = extractEvidenceMetrics('reflow', {
        horizontalOverflowPx: 45,
        scrollWidth: 365,
        clientWidth: 320,
      });

      const overflow = metrics.find(m => m.key === 'horizontalOverflowPx');
      expect(overflow?.value).toBe('45');
      expect(overflow?.unit).toBe('px');
      expect(overflow?.isViolation).toBe(true);
    });

    it('extracts text-spacing clipping deficit', () => {
      const metrics = extractEvidenceMetrics('text-spacing', {
        clipDeficitPx: 14,
        baselineHeight: 30,
        candidateHeight: 52,
        isClipped: true,
      });

      const deficit = metrics.find(m => m.key === 'clipDeficitPx');
      expect(deficit?.value).toBe('14');
      expect(deficit?.unit).toBe('px');
      expect(deficit?.isViolation).toBe(true);
    });
  });

  describe('Human-Readable Evidence Summary', () => {
    it('formats target-size summary', () => {
      const summary = getRuleEvidenceSummary('target-size', { width: 18, height: 18 }, { minWidth: 24, minHeight: 24 });
      expect(summary).toBe('Measured: 18 × 18 px (Minimum expected: 24 × 24 px)');
    });

    it('formats text-contrast summary', () => {
      const summary = getRuleEvidenceSummary('text-contrast', { contrastRatio: 2.84 }, { minRatio: 4.5 });
      expect(summary).toBe('Measured contrast: 2.84:1 (Required: ≥ 4.5:1)');
    });

    it('formats non-text-contrast summary', () => {
      const summary = getRuleEvidenceSummary('non-text-contrast', { contrastRatio: 2.1 }, { minRatio: 3.0 });
      expect(summary).toBe('Measured contrast: 2.10:1 (Required: ≥ 3.0:1)');
    });

    it('formats reflow summary', () => {
      const summary = getRuleEvidenceSummary('reflow', { horizontalOverflowPx: 45 });
      expect(summary).toBe('Horizontal overflow: 45 px (Max allowed: 1.0 px)');
    });

    it('formats text-spacing summary', () => {
      const summary = getRuleEvidenceSummary('text-spacing', { clipDeficitPx: 12 });
      expect(summary).toBe('Clipping deficit: 12 px under expanded text spacing');
    });
  });
});
