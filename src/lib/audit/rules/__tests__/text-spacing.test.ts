import { describe, it, expect } from 'vitest';
import {
  evaluateTextSpacing,
  computeMinimumPreservingSpacing,
} from '../text-spacing';

describe('Text Spacing Rule (WCAG 2.2 SC 1.4.12)', () => {
  const url = 'http://localhost:3123/fixtures/text-spacing-demo';
  const viewport = { width: 375, height: 667 };

  describe('Minimum-Preserving Spacing Logic (Item 4)', () => {
    it('preserves existing line-height, letter-spacing, word-spacing, and paragraph margin when already exceeding WCAG minimums', () => {
      const fontSize = 16;
      const result = computeMinimumPreservingSpacing({
        fontSize,
        lineHeightPx: 38.4, // 2.4 * 16 (exceeds 1.5 * 16 = 24px)
        letterSpacingPx: 4.0, // 0.25 * 16 (exceeds 0.12 * 16 = 1.92px)
        wordSpacingPx: 4.8, // 0.30 * 16 (exceeds 0.16 * 16 = 2.56px)
        marginBottomPx: 56.0, // 3.5 * 16 (exceeds 2.0 * 16 = 32px)
      });

      expect(result.isLineHeightPreserved).toBe(true);
      expect(result.targetLineHeightPx).toBe(38.4);

      expect(result.isLetterSpacingPreserved).toBe(true);
      expect(result.targetLetterSpacingPx).toBe(4.0);

      expect(result.isWordSpacingPreserved).toBe(true);
      expect(result.targetWordSpacingPx).toBe(4.8);

      expect(result.isMarginBottomPreserved).toBe(true);
      expect(result.targetMarginBottomPx).toBe(56.0);
    });

    it('enforces required minimums when author spacing is below thresholds', () => {
      const fontSize = 16;
      const result = computeMinimumPreservingSpacing({
        fontSize,
        lineHeightPx: 19.2, // 1.2 * 16 (below 1.5 * 16 = 24px)
        letterSpacingPx: 0, // 0px (below 0.12 * 16 = 1.92px)
        wordSpacingPx: 0, // 0px (below 0.16 * 16 = 2.56px)
        marginBottomPx: 16.0, // 1.0 * 16 (below 2.0 * 16 = 32px)
      });

      expect(result.isLineHeightPreserved).toBe(false);
      expect(result.targetLineHeightPx).toBe(24.0); // 1.5 * 16

      expect(result.isLetterSpacingPreserved).toBe(false);
      expect(result.targetLetterSpacingPx).toBe(1.92); // 0.12 * 16

      expect(result.isWordSpacingPreserved).toBe(false);
      expect(result.targetWordSpacingPx).toBe(2.56); // 0.16 * 16

      expect(result.isMarginBottomPreserved).toBe(false);
      expect(result.targetMarginBottomPx).toBe(32.0); // 2.0 * 16
    });
  });

  describe('Clean Text Spacing Pass (TEST-12)', () => {
    it('evaluates normal wrapping and height expansion without clipping as clean pass', () => {
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
            height: 90, // normal expansion from 60px to 90px!
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
      expect(issue.title).toContain('expands fluidly');
      expect(issue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });
  });

  describe('Deterministically Clipped Candidate Fail (TEST-13)', () => {
    it('evaluates fixed-height container with vertical clipping as candidateFail', () => {
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
            height: 40,
            scrollHeight: 68,
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
      expect(issue.title).toContain('vertically clipped under text spacing override');
    });

    it('evaluates horizontal text clipping as candidateFail', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.fixed-width-strip',
          element: 'div',
          textSnippet: 'SingleLineTextThatCannotWrap',
          baseline: {
            width: 140,
            height: 30,
            scrollHeight: 30,
            clientHeight: 30,
            scrollWidth: 140,
            clientWidth: 140,
            isClipped: false,
            boundingBox: { x: 10, y: 100, width: 140, height: 30 },
          },
          candidate: {
            width: 140,
            height: 30,
            scrollHeight: 30,
            clientHeight: 30,
            scrollWidth: 210, // expanded horizontally beyond 140px!
            clientWidth: 140,
            isClipped: false,
            isHorizontalClipped: true,
            boundingBox: { x: 10, y: 100, width: 140, height: 30 },
          },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('candidateFail');
      expect(issue.title).toContain('horizontally clipped under text spacing override');
      expect(issue.measured.horizontalClipDeficitPx).toBe(70);
    });

    it('evaluates text escaping container bounding box as candidateFail', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.visible-overflow-box',
          element: 'div',
          textSnippet: 'Escaping text',
          baseline: {
            width: 200,
            height: 50,
            scrollHeight: 50,
            clientHeight: 50,
            scrollWidth: 200,
            clientWidth: 200,
            isClipped: false,
            boundingBox: { x: 10, y: 100, width: 200, height: 50 },
          },
          candidate: {
            width: 200,
            height: 50,
            scrollHeight: 50,
            clientHeight: 50,
            scrollWidth: 200,
            clientWidth: 200,
            isClipped: false,
            isBoundingBoxEscaped: true,
            boundingBox: { x: 10, y: 100, width: 200, height: 50 },
          },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('candidateFail');
      expect(issue.title).toContain('escapes container bounding box');
      expect(issue.initialPriority).toBe('P2');
    });

    it('evaluates interactive control obscured by expanded text as P0 candidateFail', () => {
      const issue = evaluateTextSpacing(
        {
          selector: 'div.expanding-card',
          element: 'div',
          textSnippet: 'Expanding text that covers button',
          baseline: {
            width: 250,
            height: 40,
            scrollHeight: 40,
            clientHeight: 40,
            scrollWidth: 250,
            clientWidth: 250,
            isClipped: false,
            boundingBox: { x: 10, y: 50, width: 250, height: 40 },
          },
          candidate: {
            width: 250,
            height: 80,
            scrollHeight: 80,
            clientHeight: 80,
            scrollWidth: 250,
            clientWidth: 250,
            isClipped: false,
            boundingBox: { x: 10, y: 50, width: 250, height: 80 },
          },
          isControlObscured: true,
          obscuredControlSelector: 'button#submit-action',
        },
        url,
        viewport
      );

      expect(issue.status).toBe('candidateFail');
      expect(issue.initialPriority).toBe('P0');
      expect(issue.title).toContain('Interactive control obscured by expanded text');
      expect(issue.description).toContain('button#submit-action');
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
