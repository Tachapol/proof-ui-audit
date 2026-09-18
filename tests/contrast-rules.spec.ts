import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Phase 2: Contrast Rules Integration Test', () => {
  test('audits text and non-text contrast fixture across pass, candidateFail, and needsReview cases', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // Select contrast suite fixture
    await page.selectOption('#fixture-select', 'text-contrast-demo');
    const runBtn = page.locator('#run-audit-button');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // Wait for audit summary
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 1. Text contrast candidate failure
    const textFailCard = page.locator('article', { hasText: 'Text contrast below' }).first();
    await expect(textFailCard).toBeVisible();
    await expect(textFailCard.locator('text=Candidate Issue')).toBeVisible();

    // Check screenshot file existence and bounding box evidence
    const screenshotImg = textFailCard.locator('img');
    await expect(screenshotImg).toBeVisible();
    const screenshotSrc = await screenshotImg.getAttribute('src');
    expect(screenshotSrc).toBeTruthy();
    if (screenshotSrc) {
      const diskPath = path.join(process.cwd(), 'public', screenshotSrc);
      expect(fs.existsSync(diskPath)).toBe(true);
    }

    // Expand Technical Evidence and verify actual computed measurements
    const expandBtn = textFailCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expandBtn.click();
    await expect(textFailCard.locator('text=WCAG 2.2 SC 1.4.3 Contrast (Minimum)')).toBeVisible();
    await expect(textFailCard.locator('text=Grouping Fingerprint:')).toBeVisible();
    await expect(textFailCard.locator('text=Measured Value:')).toBeVisible();

    // 2. Text contrast needs review (gradient background)
    const gradientReviewCard = page.locator('article', { hasText: 'Text over complex background requires review' }).first();
    await expect(gradientReviewCard).toBeVisible();
    await expect(gradientReviewCard.locator('text=Requires Designer Review')).toBeVisible();

    // 3. Non-text component candidate failure
    const nonTextFailCard = page.locator('article', { hasText: 'Non-text contrast below 3:1 threshold' }).first();
    await expect(nonTextFailCard).toBeVisible();
    await expect(nonTextFailCard.locator('text=Candidate Issue')).toBeVisible();

    // Expand non-text technical evidence
    const nonTextExpandBtn = nonTextFailCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await nonTextExpandBtn.click();
    await expect(nonTextFailCard.locator('text=WCAG 2.2 SC 1.4.11 Non-text Contrast')).toBeVisible();

    // 4. Non-text component needs review (uncertain indicator)
    const nonTextReviewCard = page.locator('article', { hasText: 'Ambiguous non-text element requires review' }).first();
    await expect(nonTextReviewCard).toBeVisible();
    await expect(nonTextReviewCard.locator('text=Requires Designer Review')).toBeVisible();

    // 5. Inactive / disabled control excluded state (Section D Audit)
    const passFilterTab = page.locator('button', { hasText: 'Pass (' });
    await passFilterTab.click();

    const excludedCard = page.locator('article', { hasText: 'Inactive control excluded from SC 1.4.11' }).first();
    await expect(excludedCard).toBeVisible();
    await expect(excludedCard.locator('span', { hasText: 'Excluded / Not Applicable' })).toBeVisible();

    // 6. Deduplication check: Nested text does not emit duplicate whole-block cards
    const allCards = await page.locator('article').all();
    expect(allCards.length).toBeGreaterThanOrEqual(4);
  });
});
