import { test, expect } from '@playwright/test';
import { makeUiAuditRun } from './ui-fixtures';

test('Studio returns to the original audit, context, filter and review position after reload', async ({ page, request }) => {
  const run = makeUiAuditRun({
    id: 'run-return-navigation',
    productContext: { productGoal: 'Review checkout usability', brandKeywords: 'clear', themeColor: '#2563eb', targetAudience: 'Design reviewers', additionalContext: '' },
  });
  const session = {
    id: 'studio-return-navigation', version: 1, createdAt: run.timestamp,
    model: 'gpt-6-luna', runs: [run], roles: ['ux'], agenda: [],
    roleSummaries: {}, leadSummary: 'Review evidence', roleErrors: {}, messages: [], candidates: {},
  };
  await page.route('**/api/audit?*', route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: { success: true, run: { ...run, id } } });
  });
  await page.route('**/api/studio*', route => route.fulfill({ json: { session, sessions: [] } }));
  // Compile the Studio route before measuring scroll on the Audit page in dev.
  await request.get('/studio');
  await page.goto(`/?runId=${run.id}`);
  await expect(page.getByRole('heading', { name: 'Audit evidence', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Show candidate fail issues/ }).click();
  const fingerprint = run.groupedIssues[0].fingerprint;
  await page.evaluate(fp => document.getElementById(`issue-card-${fp}`)?.scrollIntoView(), fingerprint);
  const position = await page.evaluate(() => window.scrollY);
  expect(position).toBeGreaterThan(0);
  const summary = page.getByRole('region', { name: 'Audit Result Summary' });
  const studioLink = summary.getByRole('link', { name: 'Open in Critique Studio', exact: true });
  await expect(page.locator('a[href^="/studio"]')).toHaveCount(1);
  await expect(studioLink).toHaveAttribute('href', `/studio?runId=${run.id}`);
  // Activate without moving the viewport away from the issue under review.
  await studioLink.evaluate((link: HTMLAnchorElement) => link.click());
  await expect(page).toHaveURL(/studio\?session=.*runId=run-return-navigation/);
  await expect.poll(() => page.evaluate(id => JSON.parse(sessionStorage.getItem(`proofui_audit_review:${id}`) || 'null')?.scrollY, run.id)).toBeCloseTo(position, 0);
  await page.reload();
  const back = page.getByRole('link', { name: 'Back to Audit' });
  await expect(back).toHaveAttribute('href', `/?runId=${run.id}`);
  await back.click();
  await expect(page.getByRole('heading', { name: 'Audit evidence', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Show candidate fail issues/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
  await page.getByText('Product context used for this audit', { exact: true }).click();
  await expect(page.locator('#audit-results').getByText('Review checkout usability', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New audit', exact: true }).click();
  const setup = page.getByRole('dialog', { name: 'Configure new audit' });
  await expect(setup.getByRole('textbox', { name: 'Product Goal', exact: true })).toHaveValue('Review checkout usability');
  await setup.getByRole('button', { name: 'Close setup modal' }).click();
  // Another run must not inherit this run's filter.
  await page.goto('/?runId=run-other');
  await expect(page.getByRole('heading', { name: 'Audit evidence', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Show candidate fail issues/ })).toHaveAttribute('aria-pressed', 'false');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(studioLink).toBeVisible();
});

test('a saved Studio session links back to its audit without an incoming runId', async ({ page }) => {
  const run = makeUiAuditRun();
  await page.route('**/api/studio*', route => route.fulfill({ json: {
    sessions: [], session: {
      id: 'studio-saved', version: 1, createdAt: run.timestamp, model: 'gpt-6-luna',
      runs: [run], roles: ['ux'], agenda: [], roleSummaries: {}, leadSummary: '',
      roleErrors: {}, messages: [], candidates: {},
    },
  } }));
  await page.goto('/studio?session=studio-saved');
  await expect(page.getByRole('link', { name: 'Back to Audit' })).toHaveAttribute('href', `/?runId=${run.id}`);
});

test('passed checks stay out of the review queue and show read-only evidence in cards and Canvas', async ({ page }) => {
  const run = makeUiAuditRun({ id: 'run-passed-checks', fixtureId: 'target-size-demo' });
  const finding = run.groupedIssues[0];
  const viewport = { width: 1440, height: 900 };
  const measurement = {
    ...finding.representative, id: 'passed-check', title: 'Verified contrast measurement', status: 'pass',
    viewport, measured: { contrastRatio: 7 }, selector: '#passed-contrast',
  };
  const passed = { ...finding, fingerprint: 'passed-contrast', status: 'pass', representative: measurement, occurrences: [measurement] };
  await page.route('**/api/audit?*', route => {
    const onlyPassed = new URL(route.request().url()).searchParams.get('id') === 'run-only-passed';
    return route.fulfill({ json: { success: true, run: {
      ...run, groupedIssues: onlyPassed ? [passed] : [finding, passed],
      summary: { ...run.summary, passCount: 1, candidateFailCount: onlyPassed ? 0 : 1 },
      auditWarnings: onlyPassed ? ['Mobile measurement unavailable.'] : [],
    } } });
  });
  await page.goto('/?runId=run-passed-checks');
  const card = page.locator('#issue-card-passed-contrast');
  await expect(page.getByRole('button', { name: 'Show all review items, 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Accept Issue', exact: true })).toBeVisible();
  await expect(card).toBeHidden();
  await page.locator('summary', { hasText: /^Passed checks \(1\)$/ }).click();
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: /accept issue|reject|request explanation/i })).toHaveCount(0);
  await expect(card.getByRole('form', { name: 'Issue review' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Expand Technical Evidence' }).click();
  await expect(card.getByText('#passed-contrast', { exact: true })).toBeVisible();

  const canvas = page.locator('#visual-canvas-section');
  await canvas.getByRole('button', { name: 'Passed checks', exact: true }).click();
  await canvas.getByRole('button', { name: /Pin \d+: Verified contrast measurement/ }).click();
  const inspector = canvas.getByRole('complementary', { name: 'Issue Inspector' });
  await expect(inspector.getByText('Viewport 1440×900')).toBeVisible();
  await expect(inspector.getByText('#passed-contrast', { exact: true })).toBeVisible();
  await expect(inspector.getByRole('button', { name: /Confirm Issue|Dismiss|Leave for Review|Save Proposed Fix|Sandbox & Re-audit/ })).toHaveCount(0);

  await page.goto('/?runId=run-only-passed');
  await expect(page.getByRole('heading', { name: 'No items to review in the measured results' })).toBeVisible();
  await expect(page.getByText(/Mobile measurement unavailable/)).toBeVisible();
});

test('compact Canvas pins sit beside edge-to-edge evidence and work with the keyboard', async ({ page }) => {
  const run = makeUiAuditRun({ fixtureId: 'target-size-demo' });
  const issue = run.groupedIssues[0];
  const measure = { ...issue.representative, boundingBox: { ...issue.representative.boundingBox, x: 0 } };
  await page.route('**/api/audit?*', route => route.fulfill({ json: { success: true, run: {
    ...run, groupedIssues: [{ ...issue, representative: measure, occurrences: [measure] }],
  } } }));
  await page.goto(`/?runId=${run.id}`, { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('#visual-canvas-section');
  const pin = canvas.getByRole('button', { name: /Pin 1: Text contrast/ });
  await expect(pin.locator('.pin-number')).toHaveCSS('width', '16px');
  await expect(pin).toHaveCSS('width', '44px');
  await expect.poll(() => pin.evaluate(element => {
    const frame = element.closest('.canvas-viewport-inner')?.querySelector('iframe');
    return !!frame && element.getBoundingClientRect().left >= frame.getBoundingClientRect().left - 2;
  })).toBe(true);
  await pin.focus();
  await pin.press('Enter');
  await expect(canvas.getByRole('complementary', { name: 'Issue Inspector' })).toBeVisible();
});
