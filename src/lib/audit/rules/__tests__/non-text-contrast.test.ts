import { describe, it, expect } from 'vitest';
import { evaluateNonTextContrast, NON_TEXT_CONTRAST_THRESHOLD } from '../non-text-contrast';
import { calculateContrastRatioRaw } from '../../color-math';

describe('Non-text Contrast Rule (WCAG 2.2 SC 1.4.11)', () => {
  const url = 'http://localhost:3123/fixtures/text-contrast-demo';
  const viewport = { width: 375, height: 667 };

  describe('Core Threshold Evaluations (TEST-04, TEST-05)', () => {
    it('evaluates UI component contrast >= 3:1 as pass', () => {
      // Dark border #676767 on white #ffffff is ~4.9:1
      const passIssue = evaluateNonTextContrast(
        {
          selector: 'input#search-box',
          element: 'input',
          accessibleName: 'Search query',
          componentType: 'ui-component-border',
          indicatorColor: '#676767',
          adjacentColor: '#ffffff',
          boundingBox: { x: 20, y: 100, width: 250, height: 44 },
        },
        url,
        viewport
      );

      expect(passIssue.status).toBe('pass');
      expect(passIssue.measured.contrastRatio).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_THRESHOLD);
      expect(passIssue.ruleId).toBe('non-text-contrast');
      expect(passIssue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });

    it('evaluates UI component contrast < 3:1 as candidateFail', () => {
      // Light border #e2e2e0 on white #ffffff is ~1.2:1
      const failIssue = evaluateNonTextContrast(
        {
          selector: 'button#unselected-pill',
          element: 'button',
          accessibleName: 'Filter tag',
          componentType: 'ui-component-border',
          indicatorColor: '#e2e2e0',
          adjacentColor: '#ffffff',
          boundingBox: { x: 20, y: 160, width: 80, height: 32 },
        },
        url,
        viewport
      );

      expect(failIssue.status).toBe('candidateFail');
      expect(failIssue.initialPriority).toBe('P1');
      expect(failIssue.measured.contrastRatio).toBeLessThan(NON_TEXT_CONTRAST_THRESHOLD);
      expect(failIssue.priorityRationale).toContain('Project Heuristic P1 (Not WCAG Severity)');
    });
  });

  describe('Section D Non-Text Boundaries & Exceptions', () => {
    it('exempts inactive/disabled controls as pass with explicit exception (Excluded/Not Applicable)', () => {
      const inactiveIssue = evaluateNonTextContrast(
        {
          selector: 'button#btn-disabled',
          element: 'button',
          accessibleName: 'Disabled action',
          componentType: 'ui-component-border',
          indicatorColor: '#e0e0e0',
          adjacentColor: '#ffffff',
          isInactiveOrDisabled: true,
          boundingBox: { x: 20, y: 260, width: 100, height: 40 },
        },
        url,
        viewport
      );

      expect(inactiveIssue.status).toBe('pass');
      expect(inactiveIssue.exception).toContain('Inactive control exception (SC 1.4.11)');
      expect(inactiveIssue.exception).toContain('excluded and not applicable');
      expect(inactiveIssue.title).toContain('Inactive control excluded');
      expect(inactiveIssue.priorityRationale).toContain('recorded as excluded / not applicable');
    });

    it('exempts decorative elements and logos from SC 1.4.11', () => {
      const decorIssue = evaluateNonTextContrast(
        {
          selector: 'svg.brand-logo',
          element: 'svg',
          accessibleName: 'Company logo',
          componentType: 'graphical-object',
          indicatorColor: '#cccccc',
          adjacentColor: '#ffffff',
          isDecorativeOrLogo: true,
          boundingBox: { x: 10, y: 10, width: 40, height: 40 },
        },
        url,
        viewport
      );

      expect(decorIssue.status).toBe('pass');
      expect(decorIssue.exception).toContain('Decorative or logo exception (SC 1.4.11)');
      expect(decorIssue.title).toContain('Decorative element excluded');
    });

    it('marks uncertain component state or meaning as needsReview', () => {
      const reviewIssue = evaluateNonTextContrast(
        {
          selector: 'svg.status-indicator-dot',
          element: 'svg',
          accessibleName: 'Unknown indicator',
          componentType: 'graphical-object',
          indicatorColor: '#d0d5dd',
          adjacentColor: '#ffffff',
          isStateMeaningUncertain: true,
          boundingBox: { x: 20, y: 220, width: 12, height: 12 },
        },
        url,
        viewport
      );

      expect(reviewIssue.status).toBe('needsReview');
      expect(reviewIssue.exception).toContain('Uncertain component state/meaning review');
      expect(reviewIssue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
      expect(reviewIssue.priorityRationale).toContain('Designer reprioritization supported');
    });

    it('tests exact 3.0:1 threshold boundary', () => {
      // #949494 on #ffffff is ~3.03:1 (meets 3:1)
      const ratio94 = calculateContrastRatioRaw('#949494', '#ffffff');
      expect(ratio94).toBeGreaterThanOrEqual(3.0);

      const pass94 = evaluateNonTextContrast(
        {
          selector: '#border-3-0',
          element: 'div',
          accessibleName: 'Border 3.0',
          componentType: 'ui-component-border',
          indicatorColor: '#949494',
          adjacentColor: '#ffffff',
          boundingBox: { x: 0, y: 0, width: 100, height: 40 },
        },
        url,
        viewport
      );
      expect(pass94.status).toBe('pass');

      // #969696 on #ffffff is ~2.93:1 (fails 3:1)
      const ratio96 = calculateContrastRatioRaw('#969696', '#ffffff');
      expect(ratio96).toBeLessThan(3.0);

      const fail96 = evaluateNonTextContrast(
        {
          selector: '#border-2-9',
          element: 'div',
          accessibleName: 'Border 2.9',
          componentType: 'ui-component-border',
          indicatorColor: '#969696',
          adjacentColor: '#ffffff',
          boundingBox: { x: 0, y: 0, width: 100, height: 40 },
        },
        url,
        viewport
      );
      expect(fail96.status).toBe('candidateFail');
    });
  });
});
