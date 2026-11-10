import { test, expect } from '@playwright/test';
import { makeUiAuditRun } from './ui-fixtures';

test('MVP automatically renders a newly returned CPE critique without reload', async ({ page }) => {
  const run = makeUiAuditRun({ id: 'run-mvp-ui-test', fixtureId: 'mvp-contrast-demo', targetUrl: 'http://localhost:3123/fixtures/mvp-contrast-demo' });
  const group = run.groupedIssues[0];
  const result = { id: 'cpe-ui-test', provenance: 'cpe', model: 'test-model', isFallback: false, explanation: 'Controlled CPE critique from measured evidence.', recommendation: 'Increase contrast, then measure again.', requiresDesignerReview: false, timestamp: new Date().toISOString() };
  await page.route('**/api/audit', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON().productContext).toMatchObject({ productGoal: 'Help students register for courses', themeColor: '#2563EB', targetAudience: 'University students on mobile' });
      await route.fulfill({ json: { success: true, run: { ...run, productContext: route.request().postDataJSON().productContext } } });
    }
    else await route.continue();
  });
  await page.route('**/api/explain', async route => {
    // Waiting for the initial card makes this catch stale prop/local state bugs.
    await expect(page.getByRole('article')).toBeVisible();
    await route.fulfill({ json: { success: true, aiResult: result, updatedGroup: { ...group, aiExplanationResult: result, aiExplanation: result.explanation, aiRecommendation: result.recommendation } } });
  });
  await page.goto('/');
  await page.click('#context-mode-manual');
  await page.getByLabel('Product Goal', { exact: true }).fill('Help students register for courses');
  await page.getByLabel('Theme Color', { exact: true }).fill('#2563EB');
  await page.getByLabel('Target Audience', { exact: true }).fill('University students on mobile');
  await page.selectOption('#fixture-select', 'mvp-contrast-demo');
  await page.locator('#run-audit-button').click();
  await expect(page.getByText('AI-Generated (CPE · test-model)', { exact: true })).toBeVisible();
  await expect(page.getByText(result.explanation, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Regenerate Explanation', exact: true })).toBeVisible();
  await expect(page.getByText('Step 3/3: Live LLM critique ready. Review the finding, record your decision, and export.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel('Theme Color', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
