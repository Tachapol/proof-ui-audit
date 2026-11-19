import { test, expect } from '@playwright/test';
import { makeUiAuditRun } from './ui-fixtures';

test.describe('Audit Run Result Ordering & New Audit Toggle', () => {
  test('opening a link with runId shows run results header first and hides setup form until New audit is clicked', async ({ page }) => {
    const run = makeUiAuditRun({
      id: 'run-ui-01-order-test',
      fixtureId: 'pilot-ui-01',
      summary: {
        totalRawFindings: 34,
        totalGroupedIssues: 12,
        passCount: 9,
        candidateFailCount: 1,
        needsReviewCount: 2,
      },
    });
    const candidate = run.groupedIssues[0];
    const groups = Array.from({ length: 11 }, (_, index) => {
      const status = index < 9 ? 'pass' : 'needsReview';
      const representative = {
        ...candidate.representative,
        id: `check-${index}`,
        selector: `#check-${index}`,
        status,
      };
      return { ...candidate, fingerprint: `check-${index}`, status, representative, occurrences: [representative] };
    });
    run.groupedIssues = [...groups, candidate];

    await page.route('**/api/audit', route => route.fulfill({ json: { success: true, runs: [] } }));
    await page.route('**/api/audit?*', route => {
      return route.fulfill({ json: { success: true, run } });
    });

    await page.goto(`/?runId=${run.id}`);

    // Verify run header banner is visible at the top with exact title and counts
    const banner = page.locator('#audit-run-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('heading', { level: 2 })).toHaveText('UI-01 · Audit completed');
    const failCount = banner.getByRole('button', { name: 'Candidate fail (1)', exact: true });
    const reviewCount = banner.getByRole('button', { name: 'Needs review (2)', exact: true });
    const passCount = banner.getByRole('button', { name: 'Pass (9)', exact: true });
    await expect(failCount).toBeVisible();
    await expect(reviewCount).toBeVisible();
    await expect(passCount).toBeVisible();
    await page.keyboard.press('Tab');
    for (const pill of [failCount, reviewCount, passCount]) {
      await expect(pill).toHaveCSS('height', '44px');
      await expect(pill).toHaveCSS('padding-inline-start', '12px');
      await pill.focus();
      await expect(pill).not.toHaveCSS('box-shadow', 'none');
    }
    const history = page.getByRole('region', { name: 'Recent Audit Runs' });
    await expect(history.getByRole('link')).toHaveAttribute('aria-current', 'page');
    await expect(history.getByRole('link')).toHaveAttribute('href', `/?runId=${run.id}`);
    await expect(history.getByText('No saved audit runs yet.')).toHaveCount(0);

    // Verify the setup form is hidden by default when opening with runId
    const setupSection = page.locator('#audit-setup-section');
    await expect(setupSection).toBeHidden();

    // Verify audit results section is immediately visible
    const resultsSection = page.locator('#audit-results');
    await expect(resultsSection).toBeVisible();
    await expect(resultsSection.locator('h3[id^="review-"], summary').filter({
      hasText: /^(Candidate fail \(1\)|Needs review \(2\)|Passed checks \(9\))$/,
    })).toHaveText(['Candidate fail (1)', 'Needs review (2)', 'Passed checks (9)']);
    const passCard = page.locator('#issue-card-check-0');
    await expect(passCard).toBeHidden();
    await reviewCount.press('Enter');
    await expect(resultsSection.getByRole('heading', { name: 'Needs review (2)', exact: true })).toBeFocused();
    await expect(resultsSection.getByRole('heading', { name: 'Candidate fail (1)', exact: true })).toHaveCount(0);
    await failCount.click();
    await expect(resultsSection.getByRole('heading', { name: 'Candidate fail (1)', exact: true })).toBeFocused();
    await expect(resultsSection.getByRole('heading', { name: 'Needs review (2)', exact: true })).toHaveCount(0);
    await passCount.press('Enter');
    await expect(resultsSection.locator('#passed-checks > summary')).toBeFocused();
    await expect(passCard).toBeVisible();

    // Click 'New audit' button to reveal the setup form
    const newAuditBtn = banner.locator('#new-audit-button');
    await expect(newAuditBtn).toHaveText('New audit');
    await newAuditBtn.click();

    // Now setup form should be visible
    await expect(setupSection).toBeVisible();
    await expect(page.locator('#fixture-select')).toBeAttached();
    await expect(newAuditBtn).toHaveText('Hide setup form');

    await page.getByRole('button', { name: 'Close setup modal' }).click();
    await expect(setupSection).toBeHidden();
    await expect(newAuditBtn).toHaveText('New audit');
  });

  test('opening homepage without runId displays setup form directly', async ({ page }) => {
    await page.goto('/');

    // When there is no runId, no banner is shown
    await expect(page.locator('#audit-run-banner')).toHaveCount(0);

    // Setup form is visible directly
    const setupSection = page.locator('#audit-setup-section');
    await expect(setupSection).toBeVisible();
    await expect(setupSection).not.toHaveClass(/hidden/);
  });

  test('a pass-only run opens its measured evidence from the banner', async ({ page }) => {
    const run = makeUiAuditRun({
      id: 'run-ui-06-all-passed',
      fixtureId: 'pilot-ui-06',
      summary: { totalRawFindings: 10, totalGroupedIssues: 10, passCount: 10, candidateFailCount: 0, needsReviewCount: 0 },
    });
    const group = run.groupedIssues[0];
    run.groupedIssues = Array.from({ length: 10 }, (_, index) => ({
      ...group,
      fingerprint: `passed-check-${index}`,
      status: 'pass',
      representative: { ...group.representative, id: `passed-${index}`, selector: `#passed-${index}`, status: 'pass' },
      occurrences: [{ ...group.representative, id: `passed-${index}`, selector: `#passed-${index}`, status: 'pass' }],
    }));
    await page.route('**/api/audit', route => route.fulfill({ json: { success: true, runs: [] } }));
    await page.route('**/api/audit?*', route => route.fulfill({ json: { success: true, run } }));
    await page.goto(`/?runId=${run.id}`);

    const banner = page.locator('#audit-run-banner');
    await expect(banner.getByRole('heading', { name: 'UI-06 · Audit completed' })).toBeVisible();
    await expect(page.getByText(/Audit completed/)).toHaveCount(1);
    await expect(banner.getByText('Candidate fail (0)', { exact: true })).toBeVisible();
    await expect(banner.getByText('Needs review (0)', { exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: /^(Candidate fail|Needs review) \(0\)$/ })).toHaveCount(0);

    const results = page.getByRole('region', { name: 'Audit evidence' });
    await expect(results.getByText('10 grouped results', { exact: true })).toBeVisible();
    await expect(results.getByText('All 10 grouped results passed.', { exact: true })).toBeVisible();
    await expect(results.getByRole('group', { name: 'Filter audit issues by status' })).toHaveCount(0);
    await expect(page.locator('a[href^="/studio"]')).toHaveCount(1);

    const viewPassed = banner.getByRole('button', { name: 'Pass (10)', exact: true });
    const summary = results.locator('#passed-checks > summary');
    const firstCheck = results.locator('#issue-card-passed-check-0');
    await expect(firstCheck).toBeHidden();
    await viewPassed.press('Enter');
    await expect(summary).toBeFocused();
    await expect(firstCheck).toBeVisible();
    await summary.press('Enter');
    await expect(firstCheck).toBeHidden();
    await viewPassed.click();
    await expect(firstCheck).toBeVisible();
  });

  test('warns when measurements cannot be saved, then lists a confirmed run only once', async ({ page }) => {
    const unsaved = makeUiAuditRun({ id: 'run-unsaved', fixtureId: 'pilot-ui-01' });
    const saved = { ...unsaved, id: 'run-saved-after-retry' };
    let savedOnServer = false;
    await page.route('**/api/audit', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { success: true, runs: savedOnServer ? [saved] : [] } });
      }
      if (savedOnServer) return route.fulfill({ json: { success: true, saved: true, run: saved } });
      return route.fulfill({ status: 500, json: { success: false, saved: false, run: unsaved } });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const history = page.getByRole('region', { name: 'Recent Audit Runs' });
    const runAudit = page.locator('#run-audit-button');
    await expect(history.getByText('No saved audit runs yet.')).toBeVisible();

    await runAudit.click();
    await expect(history.getByText('Unsaved run', { exact: true })).toBeVisible();
    await expect(history.getByText('No saved audit runs yet.')).toHaveCount(0);
    await expect(history.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Audit evidence', exact: true })).toBeVisible();
    const banner = page.locator('#audit-run-banner');
    await expect(banner.getByText('Pass (0)', { exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Pass (0)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accept Issue', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open in Critique Studio', exact: true })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('runId')).toBe(false);

    savedOnServer = true;
    await page.getByRole('button', { name: 'New audit', exact: true }).click();
    await runAudit.click();
    await expect(history.getByText('Unsaved run', { exact: true })).toHaveCount(0);
    await expect(history.getByRole('link')).toHaveCount(1);
    await expect(history.getByRole('link')).toHaveAttribute('href', `/?runId=${saved.id}`);
    await expect(history.getByRole('link')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/runId=run-saved-after-retry/);
  });
});
