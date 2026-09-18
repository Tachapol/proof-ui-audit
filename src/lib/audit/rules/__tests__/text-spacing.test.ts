import { describe, it, expect } from 'vitest';
import { evaluateTextSpacing, TEXT_SPACING_OVERRIDE_CSS } from '../text-spacing';

describe('Text Spacing Rule (WCAG 2.2 SC 1.4.12)', () => {
  const url = 'http://localhost:3123/fixtures/text-spacing-demo';
  const viewport = { width: 375, height: 667 };

  it('includes required WCAG 2.2 SC 1.4.12 CSS properties in override string', () => {
    expect(TEXT_SPACING_OVERRIDE_CSS).toContain('line-height: 1.5 !important');
    expect(TEXT_SPACING_OVERRIDE_CSS).toContain('letter-spacing: 0.12em !important');
    expect(TEXT_SPACING_OVERRIDE_CSS).toContain('word-spacing: 0.16em !important');
    expect(TEXT_SPACING_OVERRIDE_CSS).toContain('margin-bottom: 2em !important');
  });

  describe('Clean Text Spacing Pass (TEST-12)', () => {
    it('evaluates fluid text container that expands without clipping as pass', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.fluid-card',
          element: 'div',
          textSnippet: 'This text container adapts naturally to increased spacing.',
          baseline: {
            width: 300,
            height: 60,
            scrollHeight: 60,
            clientHeight: 60,
            scrollWidth: 300,
            clientWidth: 300,
            isClipped: false,
            boundingBox: { x: 20, y: 100, width: 300, height: 60 },
          },
          candidate: {
            width: 300,
            height: 90, // expands naturally
            scrollHeight: 90,
            clientHeight: 90,
            scrollWidth: 300,
            clientWidth: 300,
            isClipped: false,
            boundingBox: { x: 20, y: 100, width: 300, height: 90 },
          },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('pass');
      expect(issue.ruleId).toBe('text-spacing');
      expect(issue.title).toContain('Text adapts cleanly');
      expect(issue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });
  });

  describe('Deterministically Clipped Candidate Fail (TEST-13)', () => {
    it('evaluates fixed-height container with clipped overflow as candidateFail', () => {
      // Container is constrained to 40px height with overflow: hidden
      const issue = evaluateTextSpacing(
        {
          selector: 'div.fixed-pill-box',
          element: 'div',
          accessibleName: 'Notification banner',
          textSnippet: 'Important multi-line alert message that gets truncated.',
          baseline: {
            width: 250,
            height: 40,
            scrollHeight: 40,
            clientHeight: 40,
            scrollWidth: 250,
            clientWidth: 250,
            isClipped: false,
            boundingBox: { x: 20, y: 200, width: 250, height: 40 },
          },
          candidate: {
            width: 250,
            height: 40, // height constrained!
            scrollHeight: 68, // text expanded to 68px!
            clientHeight: 40,
            scrollWidth: 250,
            clientWidth: 250,
            isClipped: true,
            boundingBox: { x: 20, y: 200, width: 250, height: 40 },
          },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('candidateFail');
      expect(issue.initialPriority).toBe('P1'); // 28px deficit > 15px
      expect(issue.measured.clipDeficitPx).toBe(28);
      expect(issue.measured.isClipped).toBe(true);
      expect(issue.priorityRationale).toContain('Project Heuristic P1 (Not WCAG Severity)');
      expect(issue.title).toContain('clipped under text spacing override');
    });

    it('assigns P2 for moderate text clipping (<15px)', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.slightly-clipped-badge',
          element: 'div',
          textSnippet: 'Badge title slightly cut off',
          baseline: {
            width: 150,
            height: 30,
            scrollHeight: 30,
            clientHeight: 30,
            scrollWidth: 150,
            clientWidth: 150,
            isClipped: false,
            boundingBox: { x: 20, y: 250, width: 150, height: 30 },
          },
          candidate: {
            width: 150,
            height: 30,
            scrollHeight: 38,
            clientHeight: 30,
            scrollWidth: 150,
            clientWidth: 150,
            isClipped: true,
            boundingBox: { x: 20, y: 250, width: 150, height: 30 },
          },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('candidateFail');
      expect(issue.initialPriority).toBe('P2');
      expect(issue.measured.clipDeficitPx).toBe(8);
    });
  });

  describe('Ambiguous Overlap Review (TEST-14)', () => {
    it('evaluates text expansion collision as needsReview with exception', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.overlapping-badge-group',
          element: 'div',
          textSnippet: 'Floating status label overlapping adjacent icon',
          baseline: {
            width: 120,
            height: 24,
            scrollHeight: 24,
            clientHeight: 24,
            scrollWidth: 120,
            clientWidth: 120,
            isClipped: false,
            boundingBox: { x: 50, y: 300, width: 120, height: 24 },
          },
          candidate: {
            width: 150,
            height: 36,
            scrollHeight: 36,
            clientHeight: 36,
            scrollWidth: 150,
            clientWidth: 150,
            isClipped: false,
            boundingBox: { x: 50, y: 300, width: 150, height: 36 },
          },
          isAmbiguousOverlap: true,
          hasTextOverlap: true,
        },
        url,
        viewport
      );

      expect(issue.status).toBe('needsReview');
      expect(issue.title).toContain('Text expansion collision requires review');
      expect(issue.exception).toContain('Ambiguous text overlap review');
      expect(issue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });
  });
});
