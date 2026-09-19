import { expect, test } from '@playwright/test';
import { makeUiAuditRun } from './ui-fixtures';

const widths = [320, 375, 768, 1024, 1440];

test.describe('Phase 7: responsive containment', () => {
  for (const width of widths) {
    test(`${width}px layout contains long URL, selector, controls, and evidence`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 812 : 900 });
      await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun() }) }));
      await page.goto('/');
      await page.locator('#run-audit-button').click();
      await expect(page.locator('article').first()).toBeVisible();
      await expect(page.getByText('Screenshot unavailable').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      await page.getByRole('button', { name: 'Expand Technical Evidence' }).click();
      const selector = page.locator('.technical-evidence code').first();
      await expect(selector).toBeVisible();
      const contained = await selector.evaluate((element) => element.getBoundingClientRect().right <= document.documentElement.clientWidth + 1);
      expect(contained).toBe(true);
      if (width >= 1024) await expect(page.locator('.navigation-rail')).toBeInViewport();
    });
  }

  test('application styling does not change the intentional undersized fixture control', async ({ page }) => {
    await page.goto('/fixtures/target-size-demo');
    const box = await page.locator('#btn-fail-tiny-delete').boundingBox();
    expect(box?.width).toBeLessThan(24);
    expect(box?.height).toBeLessThan(24);
  });

  test('remains operable with 200% root text and in a 768px landscape viewport', async ({ page }) => {
    await page.route('**/api/audit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, run: makeUiAuditRun() }) }));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expect(page.locator('#run-audit-button')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.setViewportSize({ width: 768, height: 420 });
    await page.locator('#run-audit-button').click();
    await expect(page.locator('article').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
});
