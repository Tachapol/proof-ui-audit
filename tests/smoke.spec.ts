import { test, expect } from '@playwright/test';

test.describe('ProofUI PoC Smoke Test', () => {
  test('homepage renders heading and fixture suite list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await expect(page.locator('#fixture-select')).toBeVisible();
  });

  test('fixture route loads successfully', async ({ page }) => {
    await page.goto('/fixtures/target-size-demo');
    await expect(page.locator('h1')).toHaveText('Target Size Test Suite');
  });
});
