import { describe, it, expect } from 'vitest';
import {
  evaluateTextContrast,
  isLargeText,
  isBoldWeight,
  normalizeFontWeight,
} from '../text-contrast';
import {
  calculateContrastRatioRaw,
  calculateContrastRatio,
  blendColors,
  compositeLayers,
  applyElementOpacity,
} from '../../color-math';

describe('Text Contrast Rule (WCAG 2.2 SC 1.4.3)', () => {
  const url = 'http://localhost:3123/fixtures/text-contrast-demo';
  const viewport = { width: 375, height: 667 };

  describe('Core Pass and Fail Evaluations (TEST-01, TEST-02)', () => {
    it('evaluates normal text >= 4.5:1 as pass and < 4.5:1 as candidateFail', () => {
      // Pass: #202123 on #ffffff (~16:1)
      const passIssue = evaluateTextContrast(
        {
          selector: 'p.main-body',
          element: 'p',
          textSnippet: 'This is high-contrast readable text.',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#202123',
          backgroundColor: '#ffffff',
          boundingBox: { x: 20, y: 100, width: 300, height: 40 },
        },
        url,
        viewport
      );
      expect(passIssue.status).toBe('pass');
      expect(passIssue.measured.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(passIssue.priorityRationale).toContain('Project Heuristic');

      // Fail: #999999 on #ffffff (~2.84:1)
      const failIssue = evaluateTextContrast(
        {
          selector: 'p.muted-body',
          element: 'p',
          textSnippet: 'This is washed-out secondary text.',
          fontSizePx: 15,
          fontWeight: 400,
          color: '#999999',
          backgroundColor: '#ffffff',
          boundingBox: { x: 20, y: 150, width: 300, height: 40 },
        },
        url,
        viewport
      );
      expect(failIssue.status).toBe('candidateFail');
      expect(failIssue.initialPriority).toBe('P1');
      expect(failIssue.measured.contrastRatio).toBeLessThan(4.5);
      expect(failIssue.priorityRationale).toContain('Project Heuristic P1 (Not WCAG Severity)');
    });

    it('evaluates large text (>= 24px regular or >= 18.66px bold) with 3:1 threshold', () => {
      // Large text pass with 3.5:1
      const passLarge = evaluateTextContrast(
        {
          selector: 'h1.hero-title',
          element: 'h1',
          textSnippet: 'Large Title Header',
          fontSizePx: 28,
          fontWeight: 400,
          color: '#888888',
          backgroundColor: '#ffffff',
          boundingBox: { x: 20, y: 50, width: 300, height: 50 },
        },
        url,
        viewport
      );
      expect(passLarge.status).toBe('pass');
      expect(passLarge.measured.isLargeText).toBe(true);

      // Large text fail < 3:1 (#cccccc on #ffffff is ~1.6:1)
      const failLarge = evaluateTextContrast(
        {
          selector: 'h2.faint-title',
          element: 'h2',
          textSnippet: 'Faint Large Header',
          fontSizePx: 24,
          fontWeight: 700,
          color: '#cccccc',
          backgroundColor: '#ffffff',
          boundingBox: { x: 20, y: 120, width: 300, height: 40 },
        },
        url,
        viewport
      );
      expect(failLarge.status).toBe('candidateFail');
      expect(failLarge.measured.isLargeText).toBe(true);
      expect(failLarge.measured.contrastRatio).toBeLessThan(3.0);
    });
  });

  describe('Exact Font Size and Font Weight Boundaries (Section B Audit)', () => {
    // #888888 on #ffffff has a contrast ratio of ~3.54:1 (passes 3:1, fails 4.5:1)
    const midContrastColor = '#888888';
    const bg = '#ffffff';

    it('distinguishes 23.99px regular (fails 4.5:1) vs 24.00px regular (passes 3.0:1)', () => {
      // 23.99px regular: NOT large text -> requires 4.5:1 -> candidateFail
      const issue23_99 = evaluateTextContrast(
        {
          selector: '#boundary-23-99',
          element: 'p',
          textSnippet: '23.99px regular boundary text',
          fontSizePx: 23.99,
          fontWeight: 400,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 200, height: 30 },
        },
        url,
        viewport
      );
      expect(issue23_99.measured.isLargeText).toBe(false);
      expect(issue23_99.status).toBe('candidateFail');

      // 24.00px regular: IS large text -> requires 3.0:1 -> pass
      const issue24_00 = evaluateTextContrast(
        {
          selector: '#boundary-24-00',
          element: 'p',
          textSnippet: '24.00px regular boundary text',
          fontSizePx: 24.0,
          fontWeight: 400,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 200, height: 30 },
        },
        url,
        viewport
      );
      expect(issue24_00.measured.isLargeText).toBe(true);
      expect(issue24_00.status).toBe('pass');
    });

    it('distinguishes 18.65px bold (fails 4.5:1) vs 18.66px bold (passes 3.0:1)', () => {
      // 18.65px bold: below 18.66px -> NOT large text -> requires 4.5:1 -> candidateFail
      const issue18_65 = evaluateTextContrast(
        {
          selector: '#boundary-18-65-bold',
          element: 'span',
          textSnippet: '18.65px bold text',
          fontSizePx: 18.65,
          fontWeight: 700,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 150, height: 25 },
        },
        url,
        viewport
      );
      expect(issue18_65.measured.isLargeText).toBe(false);
      expect(issue18_65.status).toBe('candidateFail');

      // 18.66px bold: qualifies as large text -> requires 3.0:1 -> pass
      const issue18_66 = evaluateTextContrast(
        {
          selector: '#boundary-18-66-bold',
          element: 'span',
          textSnippet: '18.66px bold text',
          fontSizePx: 18.66,
          fontWeight: 700,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 150, height: 25 },
        },
        url,
        viewport
      );
      expect(issue18_66.measured.isLargeText).toBe(true);
      expect(issue18_66.status).toBe('pass');
    });

    it('distinguishes 18.66px non-bold (fails 4.5:1) vs 18.66px bold (passes 3.0:1)', () => {
      // 18.66px at weight 400: regular -> requires 4.5:1 -> candidateFail
      const issue18_66_normal = evaluateTextContrast(
        {
          selector: '#boundary-18-66-normal',
          element: 'span',
          textSnippet: '18.66px normal text',
          fontSizePx: 18.66,
          fontWeight: 400,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 150, height: 25 },
        },
        url,
        viewport
      );
      expect(issue18_66_normal.measured.isLargeText).toBe(false);
      expect(issue18_66_normal.status).toBe('candidateFail');

      // 18.66px at weight 600 (semi-bold): < 700 -> NOT bold in SC 1.4.3 -> candidateFail
      const issue18_66_semi = evaluateTextContrast(
        {
          selector: '#boundary-18-66-semi',
          element: 'span',
          textSnippet: '18.66px semi-bold text',
          fontSizePx: 18.66,
          fontWeight: 600,
          color: midContrastColor,
          backgroundColor: bg,
          boundingBox: { x: 0, y: 0, width: 150, height: 25 },
        },
        url,
        viewport
      );
      expect(issue18_66_semi.measured.isLargeText).toBe(false);
      expect(issue18_66_semi.status).toBe('candidateFail');
    });

    it('normalizes keyword and numeric font weights correctly', () => {
      expect(normalizeFontWeight('bold')).toBe(700);
      expect(normalizeFontWeight('bolder')).toBe(700);
      expect(normalizeFontWeight('normal')).toBe(400);
      expect(normalizeFontWeight('lighter')).toBe(400);
      expect(normalizeFontWeight('800')).toBe(800);
      expect(normalizeFontWeight(700)).toBe(700);

      expect(isBoldWeight('bold')).toBe(true);
      expect(isBoldWeight(700)).toBe(true);
      expect(isBoldWeight(600)).toBe(false);
      expect(isBoldWeight('normal')).toBe(false);
    });
  });

  describe('Full Precision and Boundary Ratio Tests (Section B Audit)', () => {
    it('evaluates contrast immediately above and below 4.5:1 and 3:1 correctly', () => {
      // #767676 on #ffffff has raw ratio ~4.54:1 (meets 4.5:1)
      const ratio76 = calculateContrastRatioRaw('#767676', '#ffffff');
      expect(ratio76).toBeGreaterThanOrEqual(4.5);

      // #777777 on #ffffff has raw ratio ~4.47:1 (below 4.5:1)
      const ratio77 = calculateContrastRatioRaw('#777777', '#ffffff');
      expect(ratio77).toBeLessThan(4.5);

      const issue76 = evaluateTextContrast(
        {
          selector: '#c-767676',
          element: 'p',
          textSnippet: 'Text at 4.54:1',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#767676',
          backgroundColor: '#ffffff',
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        },
        url,
        viewport
      );
      expect(issue76.status).toBe('pass');

      const issue77 = evaluateTextContrast(
        {
          selector: '#c-777777',
          element: 'p',
          textSnippet: 'Text at 4.47:1',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#777777',
          backgroundColor: '#ffffff',
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        },
        url,
        viewport
      );
      expect(issue77.status).toBe('candidateFail');
    });

    it('ensures rounded display values do not cause false passes', () => {
      // #767575 on #ffffff has raw ratio ~4.498:1
      // If rounded naively via Math.round(4.498 * 100)/100 = 4.50:1.
      // But raw ratio is < 4.5! Classification MUST be candidateFail.
      const raw = calculateContrastRatioRaw('#767575', '#ffffff');
      if (raw < 4.5) {
        const issue = evaluateTextContrast(
          {
            selector: '#boundary-raw',
            element: 'p',
            textSnippet: 'Borderline text',
            fontSizePx: 16,
            fontWeight: 400,
            color: '#767575',
            backgroundColor: '#ffffff',
            boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          },
          url,
          viewport
        );
        expect(issue.status).toBe('candidateFail');
        // Presentation contrastRatio must not falsely round up to 4.50
        expect(issue.measured.contrastRatio).toBeLessThanOrEqual(4.49);
      }
    });
  });

  describe('Effective Background Composition & Opacity (Section C Audit)', () => {
    it('blends semi-transparent foreground over solid background accurately', () => {
      // 50% black over pure white produces pure gray #808080 (128, 128, 128)
      const blended = blendColors({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
      expect(blended.r).toBe(128);
      expect(blended.g).toBe(128);
      expect(blended.b).toBe(128);
      expect(blended.a).toBe(1);
    });

    it('composites multiple ancestor background layers from top to bottom', () => {
      const result = compositeLayers([
        'rgba(255, 0, 0, 0.5)',   // top red 50%
        'rgba(0, 0, 255, 0.5)',   // middle blue 50%
        '#ffffff',                // bottom white 100%
      ]);
      expect(result.isOpaque).toBe(true);
      expect(result.color.a).toBe(1);
    });

    it('marks unresolved transparency reaching the root as needsReview with reason', () => {
      const issue = evaluateTextContrast(
        {
          selector: 'span.translucent',
          element: 'span',
          textSnippet: 'Transparent background reaching root',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#202123',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          hasUnresolvedTransparency: true,
          unresolvedReason: 'Effective background reaches document root with alpha < 1 without an opaque ancestor surface.',
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        },
        url,
        viewport
      );
      expect(issue.status).toBe('needsReview');
      expect(issue.exception).toContain('Unresolved transparency review required');
      expect(issue.exception).toContain('alpha < 1');
      expect(issue.priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });

    it('marks complex backgrounds (gradient, image, canvas, filter) as needsReview', () => {
      const issue = evaluateTextContrast(
        {
          selector: 'div.banner > p',
          element: 'p',
          textSnippet: 'Text on gradient',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#ffffff',
          backgroundColor: '#333333',
          hasComplexBackground: true,
          boundingBox: { x: 0, y: 0, width: 300, height: 50 },
        },
        url,
        viewport
      );
      expect(issue.status).toBe('needsReview');
      expect(issue.exception).toContain('Complex background review required');
    });

    it('classifies text and background inside an ancestor with opacity < 1 as needsReview (DEC-010)', () => {
      // Ancestor container has opacity: 0.6 affecting both the text and its local background
      const issue = evaluateTextContrast(
        {
          selector: 'div.translucent-card > p.card-text',
          element: 'p',
          textSnippet: 'Text inside translucent card container',
          fontSizePx: 16,
          fontWeight: 400,
          color: '#000000',
          backgroundColor: '#ffffff',
          hasAncestorGroupOpacity: true,
          boundingBox: { x: 10, y: 10, width: 200, height: 40 },
        },
        url,
        viewport
      );

      expect(issue.status).toBe('needsReview');
      expect(issue.exception).toContain('Ancestor group opacity review required');
      expect(issue.exception).toContain('CSS opacity < 1');
      expect(issue.title).toContain('Text inside translucent ancestor requires review');
      expect(issue.priorityRationale).toContain('Subtree group opacity affects perceived contrast');
    });
  });
});
