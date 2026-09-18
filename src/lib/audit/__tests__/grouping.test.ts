import { describe, it, expect } from 'vitest';
import { UXIssue } from '@/lib/schema/ux-issue';
import { computeIssueFingerprint, groupUXIssues, calculateAuditSummary } from '../grouping';

describe('Deterministic Grouping and Fingerprint Generation (TEST-14, TEST-15)', () => {
  const baseTargetSize: UXIssue = {
    id: 'issue-ts-1',
    ruleId: 'target-size',
    wcagCriterion: 'WCAG 2.2 SC 2.5.8',
    status: 'candidateFail',
    title: 'Target size below 24px',
    description: '18x18 px button',
    url: 'http://localhost:3123/fixtures/target-size-demo',
    viewport: { width: 375, height: 667 },
    selector: 'button.delete-btn',
    element: 'button',
    measured: { width: 18.2, height: 18.4 },
    expected: { minWidth: 24, minHeight: 24 },
    initialPriority: 'P2',
    priorityRationale: 'Target below 24px',
    boundingBox: { x: 10, y: 10, width: 18, height: 18 },
  };

  describe('Table-Driven Fingerprint Coverage Across All 5 Rule Families', () => {
    const tableCases = [
      // 1. Target Size
      {
        family: 'target-size',
        issue: {
          ...baseTargetSize,
          selector: 'button.icon-btn',
          measured: { width: 17.8, height: 18.2 },
        },
        expectedFp: 'target-size::button.icon-btn::18x18',
        equivalentIssue: {
          ...baseTargetSize,
          selector: '  button.icon-btn  ',
          measured: { width: 18.4, height: 17.6 },
        },
        materialDiffIssue: {
          ...baseTargetSize,
          selector: 'button.icon-btn',
          measured: { width: 12.0, height: 12.0 },
        },
        materialDiffExpectedFp: 'target-size::button.icon-btn::12x12',
      },
      // 2. Text Contrast
      {
        family: 'text-contrast',
        issue: {
          ...baseTargetSize,
          ruleId: 'text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.3',
          selector: 'p.muted-caption',
          measured: { contrastRatio: 2.44, fontSizePx: 14, fontWeight: 400 },
        },
        expectedFp: 'text-contrast::p.muted-caption::ratio-2.4',
        equivalentIssue: {
          ...baseTargetSize,
          ruleId: 'text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.3',
          selector: '  P.MUTED-CAPTION  ',
          measured: { contrastRatio: 2.39, fontSizePx: 14, fontWeight: 400 },
        },
        materialDiffIssue: {
          ...baseTargetSize,
          ruleId: 'text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.3',
          selector: 'p.muted-caption',
          measured: { contrastRatio: 1.82, fontSizePx: 14, fontWeight: 400 },
        },
        materialDiffExpectedFp: 'text-contrast::p.muted-caption::ratio-1.8',
      },
      // 3. Non-text Contrast
      {
        family: 'non-text-contrast',
        issue: {
          ...baseTargetSize,
          ruleId: 'non-text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.11',
          selector: 'input#agree-check',
          measured: { contrastRatio: 2.12 },
        },
        expectedFp: 'non-text-contrast::input#agree-check::ratio-2.1',
        equivalentIssue: {
          ...baseTargetSize,
          ruleId: 'non-text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.11',
          selector: 'input#agree-check',
          measured: { contrastRatio: 2.08 },
        },
        materialDiffIssue: {
          ...baseTargetSize,
          ruleId: 'non-text-contrast' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.11',
          selector: 'input#agree-check',
          measured: { contrastRatio: 1.41 },
        },
        materialDiffExpectedFp: 'non-text-contrast::input#agree-check::ratio-1.4',
      },
      // 4. Reflow
      {
        family: 'reflow',
        issue: {
          ...baseTargetSize,
          ruleId: 'reflow' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.10',
          selector: 'div.rigid-card',
          measured: { scrollWidth: 419.6, horizontalOverflowPx: 99.7 },
        },
        expectedFp: 'reflow::div.rigid-card::scroll-420-overflow-100',
        equivalentIssue: {
          ...baseTargetSize,
          ruleId: 'reflow' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.10',
          selector: 'div.rigid-card',
          measured: { scrollWidth: 420.2, horizontalOverflowPx: 100.1 },
        },
        materialDiffIssue: {
          ...baseTargetSize,
          ruleId: 'reflow' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.10',
          selector: 'div.rigid-card',
          measured: { scrollWidth: 500.0, horizontalOverflowPx: 180.0 },
        },
        materialDiffExpectedFp: 'reflow::div.rigid-card::scroll-500-overflow-180',
      },
      // 5. Text Spacing
      {
        family: 'text-spacing',
        issue: {
          ...baseTargetSize,
          ruleId: 'text-spacing' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.12',
          selector: 'div.clipped-panel',
          measured: { isClipped: true, clipDeficitPx: 32.4 },
        },
        expectedFp: 'text-spacing::div.clipped-panel::clipped-32',
        equivalentIssue: {
          ...baseTargetSize,
          ruleId: 'text-spacing' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.12',
          selector: '  div.clipped-panel  ',
          measured: { isClipped: true, clipDeficitPx: 31.8 },
        },
        materialDiffIssue: {
          ...baseTargetSize,
          ruleId: 'text-spacing' as const,
          wcagCriterion: 'WCAG 2.2 SC 1.4.12',
          selector: 'div.clipped-panel',
          measured: { isClipped: true, clipDeficitPx: 64.1 },
        },
        materialDiffExpectedFp: 'text-spacing::div.clipped-panel::clipped-64',
      },
    ];

    for (const testCase of tableCases) {
      it(`[${testCase.family}] verifies stable fingerprint, normalization, and material divergence`, () => {
        const fpMain = computeIssueFingerprint(testCase.issue);
        expect(fpMain).toBe(testCase.expectedFp);

        // Equivalent measurement normalizes to same fingerprint
        const fpEquiv = computeIssueFingerprint(testCase.equivalentIssue);
        expect(fpEquiv).toBe(testCase.expectedFp);

        // Material difference produces distinct fingerprint
        const fpDiff = computeIssueFingerprint(testCase.materialDiffIssue);
        expect(fpDiff).toBe(testCase.materialDiffExpectedFp);
        expect(fpDiff).not.toBe(fpMain);
      });
    }
  });

  it('differentiates on selector and rule even with identical measurement values', () => {
    const issueA = { ...baseTargetSize, selector: 'button.btn-a' };
    const issueB = { ...baseTargetSize, selector: 'button.btn-b' };
    const issueOtherRule: UXIssue = { ...baseTargetSize, ruleId: 'text-contrast' as const, measured: { contrastRatio: 3.0 } };

    expect(computeIssueFingerprint(issueA)).not.toBe(computeIssueFingerprint(issueB));
    expect(computeIssueFingerprint(issueA)).not.toBe(computeIssueFingerprint(issueOtherRule));
  });

  it('proves input-array-order independence and stable viewport sorting (TEST-14)', () => {
    const desktopOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-desktop',
      viewport: { width: 1440, height: 900 },
      measured: { width: 18, height: 18, order: 'desktop' },
      screenshotPath: '/screenshots/desktop.png',
    };
    const mobileOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-mobile',
      viewport: { width: 375, height: 667 },
      measured: { width: 18, height: 18, order: 'mobile' },
      screenshotPath: '/screenshots/mobile.png',
    };
    const reflowOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-reflow',
      viewport: { width: 320, height: 568 },
      measured: { width: 18, height: 18, order: 'reflow' },
    };

    // Shuffled order 1: desktop, reflow, mobile
    const grouped1 = groupUXIssues([desktopOcc, reflowOcc, mobileOcc]);
    // Shuffled order 2: reflow, mobile, desktop
    const grouped2 = groupUXIssues([reflowOcc, mobileOcc, desktopOcc]);

    expect(grouped1.length).toBe(1);
    expect(grouped2.length).toBe(1);

    // Both groups produce identical stable fingerprint
    expect(grouped1[0].fingerprint).toBe(grouped2[0].fingerprint);

    // Stable sorting is viewport ascending: 320px -> 375px -> 1440px regardless of input order
    expect(grouped1[0].occurrences.map((o) => o.viewport.width)).toEqual([320, 375, 1440]);
    expect(grouped2[0].occurrences.map((o) => o.viewport.width)).toEqual([320, 375, 1440]);

    // Raw measurements are completely preserved without loss
    expect(grouped1[0].occurrences[0].measured.order).toBe('reflow');
    expect(grouped1[0].occurrences[1].measured.order).toBe('mobile');
    expect(grouped1[0].occurrences[2].measured.order).toBe('desktop');
  });

  it('selects representative stably with visual evidence precedence and handles missing optional fields', () => {
    // 320px occurrence has no screenshot; 375px has screenshot; 1440px has screenshot
    const occNoScreenshot: UXIssue = {
      ...baseTargetSize,
      id: 'occ-no-screen',
      viewport: { width: 320, height: 568 },
      screenshotPath: undefined,
      boundingBox: undefined, // Missing optional bounding box
    };
    const occWithScreenshot: UXIssue = {
      ...baseTargetSize,
      id: 'occ-with-screen',
      viewport: { width: 375, height: 667 },
      screenshotPath: '/screenshots/issue-375.png',
      boundingBox: { x: 10, y: 10, width: 18, height: 18 },
    };

    const grouped = groupUXIssues([occNoScreenshot, occWithScreenshot]);
    expect(grouped.length).toBe(1);

    // Representative selected prefers occurrence with screenshot
    expect(grouped[0].representative.id).toBe('occ-with-screen');
    expect(grouped[0].representative.screenshotPath).toBe('/screenshots/issue-375.png');

    // Both raw occurrences remain accessible, including the one with missing bounding box
    expect(grouped[0].occurrences.length).toBe(2);
    expect(grouped[0].occurrences[0].boundingBox).toBeUndefined();
    expect(grouped[0].occurrences[1].boundingBox).toBeDefined();
  });

  it('handles long and unusual CSS selectors cleanly', () => {
    const longSelector =
      'div#app-container > section.main-content:nth-child(2) > div.card-wrapper[data-state="active"] > button.action-btn:disabled';
    const longIssue: UXIssue = {
      ...baseTargetSize,
      selector: longSelector,
    };

    const fp = computeIssueFingerprint(longIssue);
    expect(fp).toBe(`target-size::${longSelector}::18x18`);

    const grouped = groupUXIssues([longIssue, { ...longIssue, id: 'long-2' }]);
    expect(grouped.length).toBe(1);
    expect(grouped[0].rawOccurrencesCount).toBe(2);
  });

  it('enforces aggregate status ordering: candidateFail > needsReview > pass and flags hasMixedStatus', () => {
    const passOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-pass',
      status: 'pass',
      viewport: { width: 1440, height: 900 },
    };
    const reviewOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-review',
      status: 'needsReview',
      exception: 'Complex layout review',
      viewport: { width: 375, height: 667 },
    };
    const failOcc: UXIssue = {
      ...baseTargetSize,
      id: 'occ-fail',
      status: 'candidateFail',
      viewport: { width: 320, height: 568 },
    };

    // Case 1: Mixed pass and needsReview -> needsReview wins
    const groupReview = groupUXIssues([passOcc, reviewOcc])[0];
    expect(groupReview.status).toBe('needsReview');
    expect(groupReview.hasMixedStatus).toBe(true);

    // Case 2: Mixed needsReview and candidateFail -> candidateFail wins
    const groupFail = groupUXIssues([reviewOcc, failOcc])[0];
    expect(groupFail.status).toBe('candidateFail');
    expect(groupFail.hasMixedStatus).toBe(true);

    // Case 3: All pass -> pass with hasMixedStatus false
    const groupAllPass = groupUXIssues([passOcc, { ...passOcc, id: 'pass-2' }])[0];
    expect(groupAllPass.status).toBe('pass');
    expect(groupAllPass.hasMixedStatus).toBe(false);

    // Occurrences preserve individual statuses without contradiction being hidden
    expect(groupFail.occurrences.find((o) => o.status === 'needsReview')).toBeDefined();
    expect(groupFail.occurrences.find((o) => o.status === 'candidateFail')).toBeDefined();
  });

  it('calculates audit summary counts accurately across all categories', () => {
    const passIssue: UXIssue = { ...baseTargetSize, id: 'p1', status: 'pass' };
    const failIssue: UXIssue = { ...baseTargetSize, id: 'f1', status: 'candidateFail', selector: '#f1' };
    const reviewIssue: UXIssue = { ...baseTargetSize, id: 'r1', status: 'needsReview', selector: '#r1' };

    const grouped = groupUXIssues([passIssue, failIssue, reviewIssue]);
    const summary = calculateAuditSummary([passIssue, failIssue, reviewIssue], grouped);

    expect(summary.totalRawFindings).toBe(3);
    expect(summary.totalGroupedIssues).toBe(3);
    expect(summary.passCount).toBe(1);
    expect(summary.candidateFailCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);
  });
});
