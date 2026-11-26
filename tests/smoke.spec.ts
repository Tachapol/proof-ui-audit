import { test, expect } from '@playwright/test';

test.describe('ProofUI PoC Smoke Test', () => {
  test('homepage renders heading and fixture suite list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await expect(page.locator('#fixture-select')).toBeAttached();
  });

  test('advanced debug fixtures follow Product Context and show the disclosure state', async ({ page }) => {
    await page.goto('/');
    const advanced = page.locator('.product-context-fields + details > summary')
      .filter({ hasText: 'Developer & Algorithm Debug Fixtures' });
    const chevron = advanced.locator('svg.lucide-chevron-right');
    const debugFixtures = page.locator('#fixture-select');
    await expect(advanced).toBeVisible();
    await expect(debugFixtures).toBeHidden();
    await expect(chevron).toHaveCSS('transform', 'none');

    await advanced.press('Enter');
    await expect(debugFixtures).toBeVisible();
    await expect(chevron).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');

    await debugFixtures.selectOption('target-size-demo');
    await expect(page.getByTitle(/Preview of Target Size Test Suite/)).toHaveAttribute('src', '/fixtures/target-size-demo');
    await expect(debugFixtures).toBeVisible();

    await advanced.press('Enter');
    await expect(debugFixtures).toBeHidden();
    await expect(chevron).toHaveCSS('transform', 'none');
  });

  test('fixture route loads successfully', async ({ page }) => {
    await page.goto('/fixtures/target-size-demo');
    await expect(page.locator('h1')).toHaveText('Target Size Test Suite');
  });
});
