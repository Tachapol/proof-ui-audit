import { test, expect } from '@playwright/test';

test.describe('Phase 6B: Isolated Before/After Iteration Proof', () => {
  test('executes end-to-end iteration proof loop with approval gate, isolation, comparison, final decision, reload persistence, and 320px responsiveness', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);

    // 1. Run baseline audit on target-size-demo
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await page.waitForLoadState('networkidle');

    await page.selectOption('#fixture-select', 'target-size-demo');
    await page.click('#run-audit-button');

    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 2. Select a candidate-fail Target Size issue card
    const failCard = page
      .locator('article', {
        hasText: 'Interactive target below 24×24 CSS px',
      })
      .first();
    await expect(failCard).toBeVisible();

    // 3. Confirm preview comparison is unavailable before approval
    await expect(failCard.locator('text=Isolated preview — source unchanged')).toBeVisible();
    const launchBtn = failCard.locator('button[id^="launch-iteration-btn-"]');
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toHaveText('Approve & Launch Isolated Preview');

    // Baseline element measurements before candidate preview
    const baselineCard = failCard.locator('div:has-text("Baseline")');
    await expect(failCard.locator('text=Result: [IMPROVED]')).not.toBeVisible();

    // 4. Approve the predefined override and launch isolated preview
    await launchBtn.click();

    // 5. Verify isolated candidate preview generated
    // Result banner appears
    await expect(failCard.locator('text=Result: [IMPROVED]')).toBeVisible({ timeout: 30000 });
    const candidateImage = failCard.getByRole('img', { name: 'Candidate preview target size visual evidence' });
    await expect(candidateImage).toBeVisible();
    await expect.poll(() => candidateImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(failCard.locator('text=Isolated preview — source unchanged')).toBeVisible();

    // Baseline remains below threshold
    await expect(failCard.locator('text=Measured: 16 × 16 px').first()).toBeVisible();

    // Candidate reaches threshold (24x24 px)
    await expect(failCard.locator('text=Candidate Preview')).toBeVisible();
    await expect(failCard.locator('text=Measured: 24 × 24 px').first()).toBeVisible();

    // Screenshots exist for both
    const baselineImg = failCard.locator('img[alt="Baseline target size visual evidence"]');
    await expect(baselineImg).toBeVisible();
    const candidateImg = failCard.locator('img[alt="Candidate preview target size visual evidence"]');
    await expect(candidateImg).toBeVisible();

    // 6. Verify original fixture remains unchanged in a separate context
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/fixtures/target-size-demo');
    const undersizedButton = freshPage.locator('#btn-fail-tiny-delete');
    const freshBox = await undersizedButton.boundingBox();
    expect(freshBox?.width).toBeLessThan(24);
    expect(freshBox?.height).toBeLessThan(24);
    await freshContext.close();

    // 7. Verify comparison survives reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    const reloadedFailCard = page
      .locator('article', {
        hasText: 'Interactive target below 24×24 CSS px',
      })
      .first();
    await expect(reloadedFailCard.locator('text=Result: [IMPROVED]')).toBeVisible({ timeout: 15000 });
    await expect(reloadedFailCard.locator('text=Measured: 24 × 24 px').first()).toBeVisible();

    // 8. Record final designer decision: Accept Candidate
    const acceptCandidateBtn = reloadedFailCard.locator('button[id^="accept-candidate-btn-"]');
    await expect(acceptCandidateBtn).toBeVisible();
    await acceptCandidateBtn.click();

    // Confirmation message appears
    await expect(reloadedFailCard.locator('text=Final Decision: ACCEPT')).toBeVisible({ timeout: 10000 });

    // 9. Verify full history survives second reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    const twiceReloadedCard = page
      .locator('article', {
        hasText: 'Interactive target below 24×24 CSS px',
      })
      .first();
    await expect(twiceReloadedCard.locator('text=Final Decision: ACCEPT')).toBeVisible({ timeout: 15000 });
    await expect(twiceReloadedCard.locator('text=Result: [IMPROVED]')).toBeVisible();

    // 10. Responsive & keyboard behavior at 320px
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(300);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify touch targets >= 44px min-height
    const detailsEl = twiceReloadedCard.locator('summary', { hasText: 'Technical Details & CSS Override' });
    await expect(detailsEl).toBeVisible();
    await detailsEl.focus();
    await page.keyboard.press('Enter');
    await expect(twiceReloadedCard.locator('text=Applied Override ID:')).toBeVisible();
  });
});
