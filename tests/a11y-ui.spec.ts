import { expect, test } from '@playwright/test';
import { makeUiAuditRun } from './ui-fixtures';

test.describe('Phase 7: application states and keyboard accessibility', () => {
  test('first-run state, skip link, drawer focus trap, Escape, and focus return', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByTestId('state-empty')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const trigger = page.getByRole('button', { name: 'Open navigation drawer' });
    await trigger.click();
    const drawer = page.locator('#primary-navigation');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('button', { name: 'Close navigation drawer' }).last()).toBeFocused();
    await expect(page.locator('.workspace-content')).toHaveAttribute('inert');

    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.recent-run, .rail-link').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(trigger).toBeFocused();
  });

  test('invalid and blocked URLs preserve input and focus the blocking field', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Public URL' }).click();
    const input = page.locator('#custom-url-input');
    await input.fill('not-a-url');
    await page.locator('#run-audit-button').click();
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#audit-target-error')).toContainText('complete URL');
    await expect(input).toHaveValue('not-a-url');

    await input.fill('http://127.0.0.1/private');
    await page.locator('#run-audit-button').click();
    await expect(input).toBeFocused();
    await expect(page.locator('#audit-target-error')).toContainText('Private, internal, localhost');
    await expect(input).toHaveValue('http://127.0.0.1/private');
  });

  test('announces running, partial, completed, and failed audit states', async ({ page }) => {
    let mode: 'partial' | 'failed' = 'partial';
    await page.route('**/api/audit', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (mode === 'failed') {
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Navigation timed out safely.' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun(), partialErrors: ['Desktop screenshot unavailable'] }) });
      }
    });
    await page.goto('/');
    await page.locator('#run-audit-button').click();
    await expect(page.getByTestId('state-loading')).toContainText(/Audit (queued|running)/);
    await expect(page.getByTestId('state-partial')).toBeVisible();
    await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Partial results' }).first()).toBeVisible();

    mode = 'failed';
    await page.locator('#run-audit-button').click();
    await expect(page.getByTestId('state-error')).toContainText('Navigation timed out safely.');
    await expect(page.locator('.audit-status')).toContainText('Audit failed');
  });

  test('preserves a designer draft on save failure and exposes status text', async ({ page }) => {
    await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun() }) }));
    await page.route('**/api/decisions', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Decision store unavailable.' }) }));
    await page.goto('/');
    await page.locator('#run-audit-button').click();
    const card = page.locator('article').first();
    await card.getByRole('button', { name: 'Reject (False Positive)' }).click();
    const reason = card.locator('input[id^="reason-input-"]');
    await reason.fill('Keep this rationale after the simulated save failure.');
    await card.getByRole('button', { name: 'Save Decision' }).click();
    await expect(card.getByRole('alert')).toContainText('Decision store unavailable.');
    await expect(reason).toHaveValue('Keep this rationale after the simulated save failure.');
  });

  test('reports export completion and failure without relying on color alone', async ({ page }) => {
    await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun() }) }));
    await page.route('**/api/export?*', (route) => {
      if (route.request().url().includes('format=json')) return route.fulfill({ status: 500, body: 'failed' });
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/markdown', 'content-disposition': 'attachment; filename="proofui-audit-run-phase7-ui.md"' }, body: '# report' });
    });
    await page.goto('/');
    await page.locator('#run-audit-button').click();
    await page.locator('#export-json-btn').click();
    await expect(page.locator('.export-status')).toContainText('could not prepare');
    const download = page.waitForEvent('download');
    await page.locator('#export-markdown-btn').click();
    await download;
    await expect(page.locator('.export-status')).toContainText('downloaded');
  });

  test('visible focus and reduced-motion behavior remain available in an issue card', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun() }) }));
    await page.goto('/');
    await page.locator('#run-audit-button').click();
    const explanation = page.locator('button[data-testid^="explain-btn-"]');
    await explanation.focus();
    await expect(explanation).toBeFocused();
    const outline = await explanation.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
    const duration = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.className = 'spin';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).animationDuration;
      probe.remove();
      return value;
    });
    expect(['0.01ms', '1e-05s', '0s']).toContain(duration);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Accept Issue' })).toBeFocused();
  });

  test('renders every isolated preview regression status as explicit text', async ({ page }) => {
    const results = ['improved', 'unchanged', 'regressed', 'unable_to_verify'] as const;
    let responseRun = makeUiAuditRun();
    await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: responseRun }) }));
    for (const result of results) {
      const run = makeUiAuditRun();
      (run.groupedIssues[0] as typeof run.groupedIssues[number] & { iterationComparison?: Record<string, unknown> }).iterationComparison = {
        overrideId: 'increase-target-size', overrideName: 'Increase target size', appliedCss: 'min-width:24px;min-height:24px', fixtureId: 'target-size-demo', viewport: { width: 375, height: 812 }, targetSelector: '#long-target',
        baselineMeasurement: { width: 16, height: 16 }, baselineStatus: 'candidateFail',
        candidateMeasurement: { width: 24, height: 24 }, candidateStatus: result === 'regressed' ? 'candidateFail' : 'pass',
        expectedThreshold: { minWidth: 24, minHeight: 24 }, measurementDelta: { width: 8, height: 8 }, regressionResult: result,
        plainLanguageSummary: `The isolated preview is ${result.replaceAll('_', ' ')}.`, approvalTimestamp: '2026-09-19T02:10:00.000Z', eventHistory: [],
      };
      responseRun = run;
      await page.goto('/');
      await page.locator('#run-audit-button').click();
      await expect(page.getByText(`Result: [${result.toUpperCase()}]`)).toBeVisible();
    }
  });
});
