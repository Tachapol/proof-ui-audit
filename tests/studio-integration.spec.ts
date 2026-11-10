import { test, expect } from '@playwright/test';

test.describe('Critique Studio Integration & Summary Export', () => {
  test('homepage provides direct link to Critique Studio with audit runId', async ({ page }) => {
    await page.goto('/');

    // Select fixture and run audit
    const fixtureSelect = page.locator('#fixture-select');
    await fixtureSelect.selectOption('target-size-demo');
    await page.locator('#run-audit-button').click();

    // Wait for audit results
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Verify "Critique in Studio" button is present and links to /studio?runId=...
    const studioLink = page.locator('a', { hasText: 'Critique in Studio' }).first();
    await expect(studioLink).toBeVisible();
    const href = await studioLink.getAttribute('href');
    expect(href).toMatch(/^\/studio\?runId=/);
  });

  test('Critique Studio workspace provides Copy Summary and Download Markdown actions', async ({ page }) => {
    const issue = {
      id: 'issue-export-test',
      ruleId: 'text-contrast',
      wcagCriterion: '1.4.3',
      status: 'candidateFail',
      title: 'Normal text contrast below 4.5:1',
      description: 'Measured contrast',
      url: 'http://localhost:3123/fixtures/mvp-contrast-demo',
      viewport: { width: 375, height: 667 },
      selector: '#normal-fail',
      element: 'p',
      measured: { contrastRatio: 2.32, color: '#aaaaaa', backgroundColor: '#ffffff' },
      expected: { minRatio: 4.5 },
      initialPriority: 'P1',
      priorityRationale: 'Project heuristic',
    };

    const run = {
      id: 'run-export-test',
      fixtureId: 'mvp-contrast-demo',
      targetUrl: issue.url,
      timestamp: new Date().toISOString(),
      viewports: [issue.viewport],
      rawIssues: [issue],
      groupedIssues: [
        {
          fingerprint: 'fp-export',
          representative: issue,
          status: 'candidateFail',
          occurrences: [issue],
          rawOccurrencesCount: 1,
          currentPriority: 'P1',
          initialPriority: 'P1',
          decisionHistory: [],
        },
      ],
      summary: { totalRawFindings: 1, totalGroupedIssues: 1, passCount: 0, candidateFailCount: 1, needsReviewCount: 0 },
    };

    const session = {
      id: 'studio-export-test',
      version: 1,
      createdAt: new Date().toISOString(),
      model: 'gpt-6-luna',
      runs: [run],
      roles: ['ux', 'product', 'engineering'],
      agenda: [
        {
          id: 'item-export-test',
          runId: run.id,
          fingerprint: 'fp-export',
          title: issue.title,
          status: 'candidateFail',
          notes: [
            {
              role: 'ux',
              comment: 'The text contrast is insufficient for low-vision users.',
              recommendation: 'Increase foreground contrast to at least 4.5:1.',
              tradeoff: 'May adjust existing brand palette lightness.',
            },
          ],
        },
      ],
      roleSummaries: { ux: 'Focus on readable text contrast.' },
      leadSummary: 'Synthesizing recommendations for normal text contrast.',
      roleErrors: {},
      messages: [],
      candidates: {},
    };

    await page.route('**/api/studio*', async (route) => {
      const url = route.request().url();
      if (url.includes('format=markdown')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/markdown; charset=utf-8',
          headers: {
            'Content-Disposition': 'attachment; filename="proofui-studio-test.md"',
          },
          body: '# ProofUI Critique Studio Summary\n\n- **Session ID**: studio-export-test\n\n## 🧭 Lead Coordinator Summary\nSynthesizing recommendations.',
        });
      } else {
        await route.fulfill({ json: { session, sessions: [] } });
      }
    });

    await page.goto('/studio?session=studio-export-test');
    await expect(page.getByRole('heading', { name: 'Critique agenda', exact: true })).toBeVisible();

    // Verify Copy Summary button exists
    const copyBtn = page.getByRole('button', { name: 'Copy Summary', exact: true });
    await expect(copyBtn).toBeVisible();

    // Verify Report download button exists
    const downloadBtn = page.locator('a[download]', { hasText: 'Report' });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toHaveAttribute('href', '/api/studio?id=studio-export-test&format=markdown');
  });
});

