import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllowlistedOverride,
  validateOverrideForIssue,
  ALLOWLISTED_OVERRIDES,
} from '../allowlisted-overrides';
import {
  computeRegressionResult,
  runIsolatedIterationProof,
  recordFinalIterationDecision,
} from '../isolated-preview';
import { AuditRun } from '@/lib/schema/ux-issue';
import * as db from '@/lib/storage/db';

function createMockRun(): AuditRun {
  return {
    id: 'iteration-test-run',
    targetUrl: 'http://localhost:3123/fixtures/target-size-demo',
    fixtureId: 'target-size-demo',
    timestamp: '2026-09-19T00:00:00.000Z',
    viewports: [{ width: 375, height: 667 }],
    summary: {
      totalRawFindings: 1,
      totalGroupedIssues: 1,
      candidateFailCount: 1,
      needsReviewCount: 0,
      passCount: 0,
    },
    groupedIssues: [
      {
        fingerprint: 'fp-target-size-1',
        status: 'candidateFail',
        initialPriority: 'P1',
        currentPriority: 'P1',
        rawOccurrencesCount: 1,
        decisionHistory: [],
        representative: {
          id: 'occ-ts-1',
          ruleId: 'target-size',
          wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
          status: 'candidateFail',
          title: 'Interactive target smaller than 24x24px',
          description: 'Button is 16x16px',
          url: 'http://localhost:3123/fixtures/target-size-demo',
          viewport: { width: 375, height: 667 },
          selector: 'button.small-btn',
          element: 'button',
          role: 'button',
          accessibleName: 'Close',
          measured: { width: 16, height: 16 },
          expected: { minWidth: 24, minHeight: 24 },
          boundingBox: { x: 10, y: 10, width: 16, height: 16 },
          screenshotPath: '/screenshots/ts-1.png',
          initialPriority: 'P1',
          priorityRationale: 'Undersized button',
        },
        occurrences: [
          {
            id: 'occ-ts-1',
            ruleId: 'target-size',
            wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
            status: 'candidateFail',
            title: 'Interactive target smaller than 24x24px',
            description: 'Button is 16x16px',
            url: 'http://localhost:3123/fixtures/target-size-demo',
            viewport: { width: 375, height: 667 },
            selector: 'button.small-btn',
            element: 'button',
            role: 'button',
            accessibleName: 'Close',
            measured: { width: 16, height: 16 },
            expected: { minWidth: 24, minHeight: 24 },
            boundingBox: { x: 10, y: 10, width: 16, height: 16 },
            screenshotPath: '/screenshots/ts-1.png',
            initialPriority: 'P1',
            priorityRationale: 'Undersized button',
          },
        ],
      },
    ],
    rawIssues: [],
  };
}

describe('Phase 6B: Allowlisted Overrides & Iteration Proof Unit Tests', () => {
  describe('Allowlisted override registry & validation', () => {
    it('retrieves valid allowlisted override by ID', () => {
      const override = getAllowlistedOverride('increase-target-size');
      expect(override).toBeDefined();
      expect(override?.id).toBe('increase-target-size');
      expect(override?.applicableRuleId).toBe('target-size');
      expect(override?.cssText).toContain('min-width: 24px');
    });

    it('rejects unknown override ID', () => {
      const override = getAllowlistedOverride('arbitrary-custom-id');
      expect(override).toBeNull();
    });

    it('rejects override when rule ID mismatches', () => {
      const override = ALLOWLISTED_OVERRIDES['increase-target-size'];
      const result = validateOverrideForIssue(override, 'target-size-demo', 'reflow');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("applies to rule 'target-size', but issue has rule 'reflow'");
    });

    it('rejects override when fixture ID mismatches', () => {
      const override = ALLOWLISTED_OVERRIDES['increase-target-size'];
      const result = validateOverrideForIssue(override, 'reflow-demo', 'target-size');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("applies to fixture 'target-size-demo', but run target is 'reflow-demo'");
    });

    it('approves override matching both rule and fixture', () => {
      const override = ALLOWLISTED_OVERRIDES['increase-target-size'];
      const result = validateOverrideForIssue(override, 'target-size-demo', 'target-size');
      expect(result.valid).toBe(true);
    });
  });

  describe('Regression result classification', () => {
    it('classifies as improved when candidate passes and dimensions increase', () => {
      const res = computeRegressionResult('candidateFail', 'pass', 8, 8);
      expect(res).toBe('improved');
    });

    it('classifies as regressed when dimensions shrink', () => {
      const res = computeRegressionResult('candidateFail', 'candidateFail', -2, -2);
      expect(res).toBe('regressed');
    });

    it('classifies as unchanged when delta is 0', () => {
      const res = computeRegressionResult('candidateFail', 'candidateFail', 0, 0);
      expect(res).toBe('unchanged');
    });
  });

  describe('Isolated iteration proof execution and immutability', () => {
    let mockRun: AuditRun;

    beforeEach(() => {
      mockRun = createMockRun();
      vi.spyOn(db, 'getAuditRun').mockResolvedValue(mockRun);
      vi.spyOn(db, 'saveAuditRun').mockImplementation(async (run) => {
        mockRun = run;
      });
    });

    it('executes isolated iteration proof and stores baseline vs candidate separately', async () => {
      const comparison = await runIsolatedIterationProof({
        runId: mockRun.id,
        fingerprint: 'fp-target-size-1',
        overrideId: 'increase-target-size',
        approvalReason: 'Designer approved 24px optimization preview',
      });

      expect(comparison.overrideId).toBe('increase-target-size');
      expect(comparison.regressionResult).toBe('improved');

      // Baseline remains intact (16x16)
      expect(comparison.baselineMeasurement.width).toBe(16);
      expect(comparison.baselineMeasurement.height).toBe(16);
      expect(comparison.baselineStatus).toBe('candidateFail');

      // Candidate reflects improved values (24x24, pass)
      expect(comparison.candidateMeasurement.width).toBe(24);
      expect(comparison.candidateMeasurement.height).toBe(24);
      expect(comparison.candidateStatus).toBe('pass');

      // Deltas
      expect(comparison.measurementDelta).toEqual({ deltaWidth: 8, deltaHeight: 8 });

      // Baseline representative is NOT modified
      expect(mockRun.groupedIssues[0].representative.measured.width).toBe(16);
      expect(mockRun.groupedIssues[0].representative.status).toBe('candidateFail');

      // Events captured
      expect(comparison.eventHistory).toHaveLength(2);
      expect(comparison.eventHistory[0].type).toBe('approval');
      expect(comparison.eventHistory[1].type).toBe('candidate_evaluated');
    });

    it('records final designer decision with reason validation', async () => {
      // First generate comparison
      await runIsolatedIterationProof({
        runId: mockRun.id,
        fingerprint: 'fp-target-size-1',
        overrideId: 'increase-target-size',
      });

      // Rejecting without reason should fail
      await expect(
        recordFinalIterationDecision(mockRun.id, 'fp-target-size-1', 'reject', '')
      ).rejects.toThrow(/descriptive designer reason/);

      // Accepting candidate
      const updated = await recordFinalIterationDecision(
        mockRun.id,
        'fp-target-size-1',
        'accept',
        'Candidate 24px button meets target size comfortably'
      );

      expect(updated.finalDesignerDecision).toBe('accept');
      expect(updated.finalDesignerReason).toBe('Candidate 24px button meets target size comfortably');
      expect(updated.finalDecisionTimestamp).toBeDefined();

      // Full event history preserved
      expect(updated.eventHistory).toHaveLength(3);
      expect(updated.eventHistory[2].type).toBe('final_decision');
    });
  });
});
