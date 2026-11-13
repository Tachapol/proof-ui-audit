import { describe, it, expect } from 'vitest';
import {
  evaluateIssuePriority,
  comparePriority,
  resolveGroupedPriority,
  PRIORITY_METADATA,
  PRIORITY_DISCLAIMER,
  PRIORITY_ENGINE_VERSION,
} from '../priority-engine';
import { UXIssue } from '@/lib/schema/ux-issue';

describe('Priority Engine — Research & Heuristic Verification', () => {
  describe('1. Versioning & Deterministic 0–100 Severity Scores', () => {
    it('pins the engine version to 1.0.0', () => {
      expect(PRIORITY_ENGINE_VERSION).toBe('1.0.0');
    });

    it('orders priorities correctly: P0 > P1 > P2 > P3', () => {
      const unsorted = ['P3', 'P0', 'P2', 'P1'] as const;
      const sorted = [...unsorted].sort(comparePriority);
      expect(sorted).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('assigns reproducible scores within bounded score ranges', () => {
      // P0: 90-100
      const p0 = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 8, height: 8 },
      });
      expect(p0.priority).toBe('P0');
      expect(p0.severityScore).toBeGreaterThanOrEqual(90);
      expect(p0.severityScore).toBeLessThanOrEqual(100);
      expect(p0.ruleEngineVersion).toBe('1.0.0');

      // P1: 70-89
      const p1 = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 18, height: 18 },
      });
      expect(p1.priority).toBe('P1');
      expect(p1.severityScore).toBeGreaterThanOrEqual(70);
      expect(p1.severityScore).toBeLessThanOrEqual(89);

      // P2: 40-69
      const p2 = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 3.5, isLargeText: false },
      });
      expect(p2.priority).toBe('P2');
      expect(p2.severityScore).toBeGreaterThanOrEqual(40);
      expect(p2.severityScore).toBeLessThanOrEqual(69);

      // P3: 0-39
      const pass = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'pass',
        measured: { width: 32, height: 32 },
      });
      expect(pass.priority).toBe('P3');
      expect(pass.severityScore).toBe(0);

      const review = evaluateIssuePriority({
        ruleId: 'reflow',
        status: 'needsReview',
        measured: { horizontalOverflowPx: 20 },
      });
      expect(review.priority).toBe('P3');
      expect(review.severityScore).toBe(25);
    });
  });

  describe('2. Multi-Viewport Escalation Language Discipline', () => {
    const makeOcc = (width: number, status: 'candidateFail' | 'needsReview' = 'candidateFail'): UXIssue => ({
      id: `occ-${width}`,
      ruleId: 'text-contrast',
      wcagCriterion: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum)',
      status,
      title: 'Contrast deficit',
      description: 'Measured contrast below threshold',
      url: 'http://localhost:3123',
      viewport: { width, height: 800 },
      selector: '#test-btn',
      element: 'button',
      measured: { contrastRatio: 3.2 },
      expected: { minRatio: 4.5 },
      initialPriority: status === 'candidateFail' ? 'P2' : 'P3',
      priorityRationale: `Project Heuristic ${status === 'candidateFail' ? 'P2' : 'P3'} (Not WCAG Severity): Base rationale`,
    });

    it('counts distinct viewports and uses exact language without overgeneralizing to all devices', () => {
      const occurrences = [
        makeOcc(320),
        makeOcc(375),
        makeOcc(1440),
      ];

      const res = resolveGroupedPriority(occurrences);
      expect(res.distinctViewportCount).toBe(3);
      expect(res.priority).toBe('P1');
      // Must use disciplined phrasing
      expect(res.rationale).toContain('พบใน 3 ขนาดหน้าจอที่ทดสอบ (Observed across 3 evaluated test viewports)');
      // Must NOT overclaim "all devices" or "กระทบทุกอุปกรณ์"
      expect(res.rationale).not.toContain('กระทบทุกอุปกรณ์');
      expect(res.rationale).not.toContain('all devices');
    });

    it('does not escalate when occurrences duplicate the same viewport', () => {
      const occurrences = [
        makeOcc(375),
        makeOcc(375),
        makeOcc(375),
      ];

      const res = resolveGroupedPriority(occurrences);
      expect(res.distinctViewportCount).toBe(1);
      expect(res.priority).toBe('P2');
      expect(res.rationale).not.toContain('Observed across 3 evaluated test viewports');
    });
  });

  describe('3. Product Context: Thai, English, Irrelevant, and Missing', () => {
    const baseParams = {
      ruleId: 'text-contrast',
      status: 'candidateFail' as const,
      measured: { contrastRatio: 3.2, isLargeText: false },
    };

    it('elevates priority with English sensitive cohort keywords', () => {
      const res = evaluateIssuePriority({
        ...baseParams,
        productContext: { targetAudience: 'Elderly citizens accessing retirement portal' },
      });
      expect(res.priority).toBe('P1');
      expect(res.factors.some(f => f.includes('Priority elevated'))).toBe(true);
    });

    it('elevates priority with Thai sensitive cohort keywords', () => {
      const res = evaluateIssuePriority({
        ...baseParams,
        productContext: { targetAudience: 'กลุ่มผู้สูงอายุและผู้มีความบกพร่องทางการมองเห็น' },
      });
      expect(res.priority).toBe('P1');
      expect(res.factors.some(f => f.includes('Priority elevated'))).toBe(true);
    });

    it('does not elevate priority for irrelevant contexts in English or Thai', () => {
      const irrelevantEn = evaluateIssuePriority({
        ...baseParams,
        productContext: { targetAudience: 'General e-commerce fashion shoppers on desktop' },
      });
      expect(irrelevantEn.priority).toBe('P2');

      const irrelevantTh = evaluateIssuePriority({
        ...baseParams,
        productContext: { targetAudience: 'บุคคลทั่วไป สั่งซื้ออาหารดิลิเวอรี' },
      });
      expect(irrelevantTh.priority).toBe('P2');
    });

    it('gracefully handles missing, empty, or whitespace-only context without errors', () => {
      const emptyObj = evaluateIssuePriority({ ...baseParams, productContext: {} });
      expect(emptyObj.priority).toBe('P2');

      const undefinedContext = evaluateIssuePriority({ ...baseParams, productContext: undefined });
      expect(undefinedContext.priority).toBe('P2');

      const whitespaceContext = evaluateIssuePriority({ ...baseParams, productContext: { targetAudience: '   ' } });
      expect(whitespaceContext.priority).toBe('P2');
    });
  });

  describe('4. Inconclusive or Missing Evidence Isolation', () => {
    it('caps needsReview at P3 even with sensitive target audience', () => {
      const res = evaluateIssuePriority({
        ruleId: 'text-spacing',
        status: 'needsReview',
        measured: { hasTextOverlap: true },
        productContext: { targetAudience: 'ผู้สูงอายุ' },
      });
      // NeedsReview must NEVER be elevated to confirmed high severity P1 or P0
      expect(res.priority).toBe('P3');
      expect(res.severityScore).toBeLessThanOrEqual(30);
      expect(res.isDeferredSeverity).toBe(true);
      expect(res.rationale).toContain('Deferred Severity');
    });

    it('applies expert weighting configuration when provided', () => {
      const standard = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 18, height: 18 },
        element: 'button',
      });

      const weighted = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 18, height: 18 },
        element: 'button',
        expertWeights: {
          version: 'AHP-Expert-v1',
          deficitMagnitudeWeight: 0.60,
          elementCriticalityWeight: 0.30,
          audienceContextWeight: 0.10,
        },
      });

      expect(weighted.factors.some(f => f.includes('Expert Consensus Weighting Model'))).toBe(true);
      expect(typeof weighted.severityScore).toBe('number');
    });

    it('handles missing or NaN measurement numbers safely as P3 advisory', () => {
      const missingDimensions = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: NaN, height: undefined },
      });
      expect(missingDimensions.priority).toBe('P3');
      expect(missingDimensions.severityScore).toBeLessThanOrEqual(35);
      expect(missingDimensions.factors).toContain('Inconclusive target measurements');

      const missingContrast = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: undefined },
      });
      expect(missingContrast.priority).toBe('P3');
      expect(missingContrast.factors).toContain('Inconclusive contrast measurement');
    });
  });

  describe('5. Designer Override Preservation', () => {
    const occurrences: UXIssue[] = [
      {
        id: 'occ-1',
        ruleId: 'target-size',
        wcagCriterion: 'WCAG 2.2 SC 2.5.8',
        status: 'candidateFail',
        title: 'Target size',
        description: 'Target size deficit',
        url: 'http://localhost:3123',
        viewport: { width: 375, height: 812 },
        selector: '#action-btn',
        element: 'button',
        measured: { width: 18, height: 18 },
        expected: { minWidth: 24, minHeight: 24 },
        initialPriority: 'P1',
        priorityRationale: 'Project Heuristic P1 (Not WCAG Severity): Baseline machine priority',
      },
    ];

    it('preserves human override priority while keeping machine initialPriority separate', () => {
      const res = resolveGroupedPriority(occurrences, {
        priority: 'P0',
        reason: 'Payment submission button on checkout screen must be fixed immediately for Q4 release.',
      });

      expect(res.isDesignerOverridden).toBe(true);
      expect(res.priority).toBe('P0'); // Human overridden priority
      expect(res.initialPriority).toBe('P1'); // Machine calculated priority preserved!
      expect(res.rationale).toContain('Designer Override: P1 → P0');
      expect(res.rationale).toContain('Payment submission button');
    });
  });
});
