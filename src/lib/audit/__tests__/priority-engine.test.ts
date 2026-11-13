import { describe, it, expect } from 'vitest';
import {
  evaluateIssuePriority,
  comparePriority,
  resolveGroupedPriority,
  PRIORITY_METADATA,
  PRIORITY_DISCLAIMER,
} from '../priority-engine';
import { UXIssue } from '@/lib/schema/ux-issue';

describe('Priority Engine', () => {
  describe('Priority Comparison & Sorting', () => {
    it('orders P0 > P1 > P2 > P3 correctly', () => {
      const unsorted = ['P3', 'P0', 'P2', 'P1'] as const;
      const sorted = [...unsorted].sort(comparePriority);
      expect(sorted).toEqual(['P0', 'P1', 'P2', 'P3']);
    });

    it('has metadata and non-WCAG disclaimer for all priorities', () => {
      for (const p of ['P0', 'P1', 'P2', 'P3'] as const) {
        expect(PRIORITY_METADATA[p].label).toContain(p);
        expect(PRIORITY_METADATA[p].shortDescription).toBeDefined();
      }
      expect(PRIORITY_DISCLAIMER).toContain('Not WCAG Severity');
    });
  });

  describe('Rule Priority Evaluation', () => {
    it('evaluates target size: <12px as P0 blocker, <24px as P1', () => {
      const p0 = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 10, height: 10 },
      });
      expect(p0.priority).toBe('P0');
      expect(p0.severityScore).toBeGreaterThanOrEqual(90);
      expect(p0.rationale).toContain('Project Heuristic P0 (Not WCAG Severity)');

      const p1 = evaluateIssuePriority({
        ruleId: 'target-size',
        status: 'candidateFail',
        measured: { width: 18, height: 20 },
      });
      expect(p1.priority).toBe('P1');
      expect(p1.rationale).toContain('Project Heuristic P1 (Not WCAG Severity)');
    });

    it('evaluates text contrast: <2.0 as P1, <4.5 as P2, pass as P3', () => {
      const p1 = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 1.85, isLargeText: false },
      });
      expect(p1.priority).toBe('P1');
      expect(p1.rationale).toContain('Project Heuristic P1');

      const p2 = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 3.2, isLargeText: false },
      });
      expect(p2.priority).toBe('P2');
      expect(p2.rationale).toContain('Project Heuristic P2');

      const p3 = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'pass',
        measured: { contrastRatio: 4.8 },
      });
      expect(p3.priority).toBe('P3');
    });

    it('evaluates reflow: out-of-bounds/clipped button as P0, >50px as P1', () => {
      const p0 = evaluateIssuePriority({
        ruleId: 'reflow',
        status: 'candidateFail',
        element: 'button',
        measured: { clipDeficitPx: 20 },
      });
      expect(p0.priority).toBe('P0');

      const p1 = evaluateIssuePriority({
        ruleId: 'reflow',
        status: 'candidateFail',
        measured: { horizontalOverflowPx: 75 },
      });
      expect(p1.priority).toBe('P1');

      const p2 = evaluateIssuePriority({
        ruleId: 'reflow',
        status: 'candidateFail',
        measured: { horizontalOverflowPx: 20 },
      });
      expect(p2.priority).toBe('P2');
    });

    it('evaluates text spacing: control obscured as P0, horizontal clipping as P1', () => {
      const p0 = evaluateIssuePriority({
        ruleId: 'text-spacing',
        status: 'candidateFail',
        measured: { isControlObscured: true },
      });
      expect(p0.priority).toBe('P0');

      const p1 = evaluateIssuePriority({
        ruleId: 'text-spacing',
        status: 'candidateFail',
        measured: { horizontalClipDeficitPx: 14 },
      });
      expect(p1.priority).toBe('P1');

      const p2 = evaluateIssuePriority({
        ruleId: 'text-spacing',
        status: 'candidateFail',
        measured: { clipDeficitPx: 5 },
      });
      expect(p2.priority).toBe('P2');
    });

    it('evaluates non-text-contrast: <2.0 as P1, >=2.0 as P2', () => {
      const p1 = evaluateIssuePriority({
        ruleId: 'non-text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 1.5 },
      });
      expect(p1.priority).toBe('P1');

      const p2 = evaluateIssuePriority({
        ruleId: 'non-text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 2.4 },
      });
      expect(p2.priority).toBe('P2');
    });

    it('elevates priority when product context targets elderly/low-vision users', () => {
      const standard = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 3.2, isLargeText: false },
      });
      expect(standard.priority).toBe('P2');

      const elevated = evaluateIssuePriority({
        ruleId: 'text-contrast',
        status: 'candidateFail',
        measured: { contrastRatio: 3.2, isLargeText: false },
        productContext: { targetAudience: 'Elderly citizens managing healthcare benefits' },
      });
      expect(elevated.priority).toBe('P1');
      expect(elevated.factors.some(f => f.includes('Priority elevated'))).toBe(true);
    });
  });

  describe('Grouped Priority Resolution', () => {
    const makeOccurrence = (priority: 'P0' | 'P1' | 'P2' | 'P3', width: number): UXIssue => ({
      id: `occ-${width}`,
      ruleId: 'text-contrast',
      wcagCriterion: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum)',
      status: 'candidateFail',
      title: 'Contrast deficit',
      description: 'Contrast below threshold',
      url: 'http://localhost:3123',
      viewport: { width, height: 800 },
      selector: '#btn',
      element: 'button',
      measured: { contrastRatio: 3.2 },
      expected: { minRatio: 4.5 },
      initialPriority: priority,
      priorityRationale: `Project Heuristic ${priority} (Not WCAG Severity): Base rationale`,
    });

    it('retains P0 if any occurrence has P0', () => {
      const occurrences = [makeOccurrence('P2', 375), makeOccurrence('P0', 1440)];
      const res = resolveGroupedPriority(occurrences);
      expect(res.priority).toBe('P0');
    });

    it('escalates P2 to P1 when pervasive across >= 3 viewports', () => {
      const occurrences = [
        makeOccurrence('P2', 320),
        makeOccurrence('P2', 375),
        makeOccurrence('P2', 1440),
      ];
      const res = resolveGroupedPriority(occurrences);
      expect(res.priority).toBe('P1');
      expect(res.rationale).toContain('Composite escalation: Pervasive across 3 distinct viewports');
    });
  });
});
