export function makeUiAuditRun(overrides: Record<string, unknown> = {}) {
  const selector = '#content > main > section[data-purpose="an-intentionally-very-long-selector-value-for-responsive-containment"] > button:nth-child(12)';
  const issue = {
    id: 'ui-issue-1',
    ruleId: 'text-contrast',
    wcagCriterion: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum)',
    status: 'candidateFail',
    title: 'Text contrast below the required threshold',
    description: 'The measured contrast ratio is 2.84:1 against an expected minimum of 4.5:1.',
    url: 'https://example.com/a/very/long/path/that/must/remain/contained/inside/the/review/layout?with=a-long-query-value',
    viewport: { width: 375, height: 812 },
    selector,
    element: 'button',
    role: 'button',
    accessibleName: 'Continue to the next step with an intentionally long accessible name',
    measured: { contrastRatio: 2.84, foreground: '#777777', background: '#ffffff' },
    expected: { minContrastRatio: 4.5 },
    boundingBox: { x: 24, y: 180, width: 210, height: 44 },
    initialPriority: 'P1',
    priorityRationale: 'Frequently used control with deterministic threshold evidence.',
  };
  return {
    id: 'run-phase7-ui',
    targetUrl: issue.url,
    timestamp: '2026-09-19T02:00:00.000Z',
    viewports: [{ width: 320, height: 640 }, { width: 375, height: 812 }, { width: 1440, height: 900 }],
    rawIssues: [issue],
    groupedIssues: [{
      fingerprint: `text-contrast::${selector}::contrastRatio=2.84::expected=4.5`,
      representative: issue,
      rawOccurrencesCount: 1,
      occurrences: [issue],
      status: 'candidateFail',
      initialPriority: 'P1',
      currentPriority: 'P1',
      decisionHistory: [],
    }],
    summary: { totalRawFindings: 1, totalGroupedIssues: 1, passCount: 0, candidateFailCount: 1, needsReviewCount: 0 },
    ...overrides,
  };
}
