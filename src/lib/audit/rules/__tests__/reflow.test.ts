import { describe, it, expect } from 'vitest';
import { evaluateReflow, HORIZONTAL_OVERFLOW_TOLERANCE_PX } from '../reflow';

describe('Reflow Rule (WCAG 2.2 SC 1.4.10)', () => {
  const url = 'http://localhost:3123/fixtures/reflow-demo';
  const viewport320 = { width: 320, height: 667 };

  describe('Clean Reflow Pass (TEST-09)', () => {
    it('evaluates single-column layout without horizontal scroll as pass', () => {
      const issues = evaluateReflow(
        {
          viewport: viewport320,
          scrollWidth: 320,
          clientWidth: 320,
          horizontalOverflowPx: 0,
          hasDocumentHorizontalScroll: false,
          overflowingElements: [],
        },
        url
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].status).toBe('pass');
      expect(issues[0].ruleId).toBe('reflow');
      expect(issues[0].title).toContain('without 2D scrolling');
      expect(issues[0].priorityRationale).toContain('Project Heuristic P3 (Not WCAG Severity)');
    });

    it('tolerates subpixel rounding differences <= 1.0px as pass', () => {
      // Exactly at the 1.0px tolerance boundary
      const issuesAtBoundary = evaluateReflow(
        {
          viewport: viewport320,
          scrollWidth: 321.0,
          clientWidth: 320.0,
          horizontalOverflowPx: 1.0,
          hasDocumentHorizontalScroll: false,
          overflowingElements: [],
        },
        url
      );

      expect(issuesAtBoundary).toHaveLength(1);
      expect(issuesAtBoundary[0].status).toBe('pass');
    });
  });

  describe('Unintended Horizontal Overflow Candidate Fail (TEST-10)', () => {
    it('evaluates overflow immediately exceeding 1.0px tolerance (1.1px) as candidateFail', () => {
      const issuesJustOver = evaluateReflow(
        {
          viewport: viewport320,
          scrollWidth: 321.1,
          clientWidth: 320.0,
          horizontalOverflowPx: 1.1,
          hasDocumentHorizontalScroll: true,
          overflowingElements: [
            {
              selector: 'div.slightly-wide-box',
              element: 'div',
              boundingBox: { x: 0, y: 100, width: 321.1, height: 50 },
              computedStyles: {
                overflowX: 'visible',
                overflowY: 'visible',
                position: 'static',
                display: 'block',
                width: '321.1px',
              },
            },
          ],
        },
        url
      );

      expect(issuesJustOver).toHaveLength(1);
      expect(issuesJustOver[0].status).toBe('candidateFail');
      expect(issuesJustOver[0].initialPriority).toBe('P2');
    });

    it('evaluates severe horizontal overflow (>50px) as P1 candidateFail', () => {
      const issuesSevere = evaluateReflow(
        {
          viewport: viewport320,
          scrollWidth: 420,
          clientWidth: 320,
          horizontalOverflowPx: 100,
          hasDocumentHorizontalScroll: true,
          overflowingElements: [
            {
              selector: 'div.fixed-wide-banner',
              element: 'div',
              boundingBox: { x: 0, y: 50, width: 420, height: 120 },
              computedStyles: {
                overflowX: 'visible',
                overflowY: 'visible',
                position: 'static',
                display: 'block',
                width: '420px',
              },
            },
          ],
        },
        url
      );

      expect(issuesSevere).toHaveLength(1);
      expect(issuesSevere[0].status).toBe('candidateFail');
      expect(issuesSevere[0].initialPriority).toBe('P1');
      expect(issuesSevere[0].measured.horizontalOverflowPx).toBe(100);
      expect(issuesSevere[0].priorityRationale).toContain('Project Heuristic P1 (Not WCAG Severity)');
      expect(issuesSevere[0].description).toContain('div.fixed-wide-banner');
    });
  });

  describe('Essential 2D Layout Exception Review (TEST-11)', () => {
    it('evaluates data table or map overflow as needsReview with essential exception', () => {
      const issuesEssential = evaluateReflow(
        {
          viewport: viewport320,
          scrollWidth: 500,
          clientWidth: 320,
          horizontalOverflowPx: 180,
          hasDocumentHorizontalScroll: true,
          overflowingElements: [
            {
              selector: 'table#financial-report-table',
              element: 'table',
              role: 'table',
              accessibleName: 'Quarterly Financials',
              boundingBox: { x: 10, y: 200, width: 480, height: 300 },
              computedStyles: {
                overflowX: 'visible',
                overflowY: 'visible',
                position: 'static',
                display: 'table',
                width: '480px',
              },
              isEssential2D: true,
            },
          ],
        },
        url
      );

      expect(issuesEssential).toHaveLength(1);
      expect(issuesEssential[0].status).toBe('needsReview');
      expect(issuesEssential[0].title).toContain('Essential two-dimensional layout requires review');
      expect(issuesEssential[0].exception).toContain('Essential two-dimensional presentation exception');
      expect(issuesEssential[0].priorityRationale).toContain('Designer review required to confirm');
    });
  });
});
