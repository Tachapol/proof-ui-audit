import { describe, it, expect } from 'vitest';
import { getDefaultRecommendation, isElementExcluded } from '../recommendation';
import { AuditStatus } from '@/lib/schema/ux-issue';

describe('Recommendation Semantics Across All Five Rule Families (Phase 7 Correction)', () => {
  const ruleFamilies = [
    'target-size',
    'text-contrast',
    'non-text-contrast',
    'reflow',
    'text-spacing',
  ] as const;

  describe('Pass status semantics', () => {
    it('satisfies requirement without recommending exceptions, remediation, or action across all 5 families', () => {
      for (const ruleId of ruleFamilies) {
        const rec = getDefaultRecommendation({
          ruleId,
          status: 'pass',
          element: 'button',
          selector: '#test-btn',
        });

        // Must state requirement satisfied
        expect(rec).toMatch(/Requirement satisfied|threshold satisfied/i);
        // Must explicitly state no remediation required
        expect(rec).toMatch(/no remediation required/i);
        // Must NEVER recommend exceptions or reviews for a pass
        expect(rec).not.toMatch(/essential exception/i);
        expect(rec).not.toMatch(/review whether/i);
        expect(rec).not.toMatch(/adjust/i);
        expect(rec).not.toMatch(/increase/i);
      }
    });
  });

  describe('CandidateFail status semantics', () => {
    it('provides evidence-grounded actionable correction across all 5 families', () => {
      for (const ruleId of ruleFamilies) {
        const rec = getDefaultRecommendation({
          ruleId,
          status: 'candidateFail',
          element: 'div',
          selector: '.container',
        });

        expect(rec).toBeTruthy();
        // Must propose remediation/correction
        expect(rec).toMatch(/Increase|Adjust|Replace|Remove/);
        // Must not describe as satisfied
        expect(rec).not.toMatch(/Requirement satisfied/i);
      }
    });
  });

  describe('NeedsReview status semantics', () => {
    it('uses cautious exception and context language across all 5 families', () => {
      for (const ruleId of ruleFamilies) {
        const rec = getDefaultRecommendation({
          ruleId,
          status: 'needsReview',
          element: 'a',
          selector: 'a.inline-link',
          exception: 'Inline target exception candidate',
        });

        expect(rec).toBeTruthy();
        // Must mandate designer review / verification
        expect(rec).toMatch(/designer (must|should) (visually )?(review|verify|determine|confirm|inspect)/i);
        // Must not claim pass or automatic correction
        expect(rec).not.toMatch(/Requirement satisfied/i);
      }
    });
  });

  describe('Excluded / Not Applicable semantics', () => {
    it('explains exclusion without describing it as a measured pass', () => {
      for (const ruleId of ruleFamilies) {
        const rec = getDefaultRecommendation({
          ruleId,
          status: 'pass',
          element: 'input',
          selector: 'input:disabled',
          exception: 'Inactive control exception (SC 1.4.11): component is excluded and not applicable',
        });

        expect(rec).toMatch(/excluded/i);
        expect(rec).toMatch(/no .*remediation required/i);
        // Must not present as a measured pass of criteria
        expect(rec).not.toMatch(/meets or exceeds/i);
        expect(rec).not.toMatch(/threshold satisfied/i);
      }
    });

    it('correctly identifies excluded status from exception text', () => {
      expect(isElementExcluded('pass', 'Excluded under SC 1.4.11')).toBe(true);
      expect(isElementExcluded('pass', 'Inactive control: excluded and not applicable')).toBe(true);
      expect(isElementExcluded('pass', undefined)).toBe(false);
      expect(isElementExcluded('pass', 'Inline target exception')).toBe(false);
    });
  });
});
