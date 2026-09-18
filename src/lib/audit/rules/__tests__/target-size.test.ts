import { describe, it, expect } from 'vitest';
import { evaluateTargetSize, TARGET_SIZE_THRESHOLD, checkSpacingAlternative } from '../target-size';

describe('Target Size Rule Evaluation (SC 2.5.8)', () => {
  const url = 'http://localhost:3123/fixtures/target-size-demo';
  const viewport = { width: 375, height: 667 };

  it('evaluates target >= 24x24 px as pass (TEST-06)', () => {
    const issue = evaluateTargetSize(
      {
        selector: '#btn-large',
        element: 'button',
        accessibleName: 'Submit Form',
        width: 44,
        height: 44,
        x: 20,
        y: 100,
        isInline: false,
      },
      url,
      viewport
    );

    expect(issue.status).toBe('pass');
    expect(issue.ruleId).toBe('target-size');
    expect(issue.measured.width).toBe(44);
    expect(issue.measured.height).toBe(44);
    expect(issue.expected.minWidth).toBe(TARGET_SIZE_THRESHOLD);
    expect(issue.exception).toBeUndefined();
  });

  it('evaluates target < 24x24 px without spacing as candidateFail (TEST-07)', () => {
    const issue = evaluateTargetSize(
      {
        selector: '#btn-tiny',
        element: 'button',
        accessibleName: 'Remove',
        width: 16,
        height: 16,
        x: 200,
        y: 50,
        isInline: false,
        hasSufficientSpacing: false,
      },
      url,
      viewport
    );

    expect(issue.status).toBe('candidateFail');
    expect(issue.initialPriority).toBe('P1');
    expect(issue.measured.width).toBe(16);
    expect(issue.measured.height).toBe(16);
    expect(issue.description).toContain('failing the WCAG 2.2 SC 2.5.8');
  });

  it('evaluates inline links < 24px as needsReview under inline exception (TEST-08)', () => {
    const issue = evaluateTargetSize(
      {
        selector: 'p > a.terms-link',
        element: 'a',
        accessibleName: 'terms and conditions',
        width: 60,
        height: 18,
        x: 50,
        y: 300,
        isInline: true,
      },
      url,
      viewport
    );

    expect(issue.status).toBe('needsReview');
    expect(issue.exception).toContain('Inline target exception');
    expect(issue.priorityRationale).toContain('inline sentence exception');
  });

  describe('WCAG 2.2 SC 2.5.8 24px Diameter Circle Spacing Geometry (Item A.1)', () => {
    it('passes spacing alternative when distance between undersized target centers >= 24px and circle does not intersect neighbor', () => {
      // Target A: 16x16 at (0, 0) -> center (8, 8)
      const targetA = { x: 0, y: 0, width: 16, height: 16 };
      // Target B: 16x16 at (40, 0) -> center (48, 8). Center distance = 40px >= 24px.
      const targetB = { x: 40, y: 0, width: 16, height: 16 };

      const hasSpacing = checkSpacingAlternative(targetA, [targetA, targetB]);
      expect(hasSpacing).toBe(true);
    });

    it('fails spacing alternative when distance between undersized target centers < 24px (circles intersect)', () => {
      // Target A: 16x16 at (0, 0) -> center (8, 8)
      const targetA = { x: 0, y: 0, width: 16, height: 16 };
      // Target B: 16x16 at (18, 0) -> center (26, 8). Center distance = 18px < 24px.
      const targetB = { x: 18, y: 0, width: 16, height: 16 };

      const hasSpacing = checkSpacingAlternative(targetA, [targetA, targetB]);
      expect(hasSpacing).toBe(false);
    });

    it('fails spacing alternative when 12px radius circle intersects an adjacent target rectangle', () => {
      // Target A: 16x16 at (0, 0) -> center (8, 8). Circle radius 12 reaches x = 20.
      const targetA = { x: 0, y: 0, width: 16, height: 16 };
      // Target B: Large button (44x44) at (18, 0). Left edge is at x=18 (< 20).
      const targetB = { x: 18, y: 0, width: 44, height: 44 };

      const hasSpacing = checkSpacingAlternative(targetA, [targetA, targetB]);
      expect(hasSpacing).toBe(false);
    });
  });
});
