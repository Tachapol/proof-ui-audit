import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Phase 3: Reflow & Text Spacing Integration Test', () => {
  test('audits Reflow fixture at 320px across pass, candidateFail, and essential 2D review cases', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // 1. Select Reflow fixture and trigger audit
    await page.selectOption('#fixture-select', 'reflow-demo');
    const runBtn = page.locator('#run-audit-button');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // 2. Wait for audit summary
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 3. Verify unintended horizontal overflow candidate failure at 320px
    const failCard = page.locator('article', { hasText: 'Unintended horizontal overflow' }).first();
    await expect(failCard).toBeVisible();
    await expect(failCard.locator('text=Candidate Issue')).toBeVisible();
    await expect(failCard.locator('text=Viewport: 320px')).toBeVisible();

    // Verify screenshot on disk
    const screenshotImg = failCard.locator('img');
    await expect(screenshotImg).toBeVisible();
    const src = await screenshotImg.getAttribute('src');
    expect(src).toBeTruthy();
    if (src) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', src))).toBe(true);
    }

    // Expand technical evidence and verify 320px measurements
    const expandBtn = failCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expandBtn.click();
    await expect(failCard.getByText('WCAG 2.2 SC 1.4.10 Reflow', { exact: true })).toBeVisible();
    await expect(failCard.locator('text=Grouping Fingerprint:')).toBeVisible();
    await expect(failCard.locator('text=horizontalOverflowPx')).toBeVisible();

    // 4. Verify essential 2D layout requires review (table)
    const reviewCard = page.locator('article', { hasText: 'Essential two-dimensional layout requires review' }).first();
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard.locator('text=Requires Designer Review')).toBeVisible();
    await expect(reviewCard.locator('text=Essential two-dimensional presentation exception')).toBeVisible();
  });

  test('audits Text Spacing fixture, applies overrides, records clipping, and restores styles', async ({ page }) => {
    await page.goto('/');

    // 1. Select Text Spacing fixture and trigger audit
    await page.selectOption('#fixture-select', 'text-spacing-demo');
    const runBtn = page.locator('#run-audit-button');
    await runBtn.click();

    // 2. Wait for audit summary
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 3. Verify deterministically clipped content candidate failure
    const clippedCard = page.locator('article', { hasText: 'Text content clipped under text spacing override' }).first();
    await expect(clippedCard).toBeVisible();
    await expect(clippedCard.locator('text=Candidate Issue')).toBeVisible();

    // Expand technical evidence to check baseline vs candidate measurements
    const expandBtn = clippedCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expandBtn.click();
    await expect(clippedCard.getByText('WCAG 2.2 SC 1.4.12 Text Spacing', { exact: true })).toBeVisible();
    await expect(clippedCard.locator('text=clipDeficitPx').first()).toBeVisible();
    await expect(clippedCard.locator('text=candidateScrollHeight')).toBeVisible();

    // 4. Verify ambiguous overlap review card
    const overlapReviewCard = page.locator('article', { hasText: 'Text expansion collision requires review' }).first();
    await expect(overlapReviewCard).toBeVisible();
    await expect(overlapReviewCard.locator('text=Requires Designer Review')).toBeVisible();

    // 5. Verify that page styles are fully restored (no residual override style tag in DOM)
    const residualOverride = await page.evaluate(() => {
      return document.getElementById('proofui-text-spacing-override') !== null;
    });
    expect(residualOverride).toBe(false);
  });
});
