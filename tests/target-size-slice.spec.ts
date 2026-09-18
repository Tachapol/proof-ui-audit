import { test, expect } from '@playwright/test';

test.describe('Phase 1: Target Size Vertical Slice', () => {
  test('executes end-to-end target size audit on local fixture and persists designer decision', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // 2. Select fixture and trigger audit
    await page.selectOption('#fixture-select', 'target-size-demo');
    const runBtn = page.locator('#run-audit-button');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // 3. Wait for audit summary to appear
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 4. Verify candidate failure card rendered
    const failCard = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(failCard).toBeVisible();
    await expect(failCard.locator('text=Candidate Issue')).toBeVisible();

    // 5. Expand technical evidence
    const expandBtn = failCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(failCard.locator('text=Grouping Fingerprint:')).toBeVisible();
    await expect(failCard.locator('text=WCAG 2.2 SC 2.5.8 Target Size (Minimum)')).toBeVisible();

    // 6. Record designer decision (Reprioritize with reason)
    const reprioritizeBtn = failCard.locator('button', { hasText: 'Reprioritize' });
    await reprioritizeBtn.click();

    const reasonInput = failCard.locator('input[placeholder*="Explain the UX rationale"]');
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill('High-traffic action on mobile: verified candidate issue.');

    const saveDecisionBtn = failCard.locator('button', { hasText: 'Save Decision' });
    await saveDecisionBtn.click();

    // 7. Verify inline save confirmation
    await expect(failCard.locator('text=Decision saved to audit log')).toBeVisible();

    // 8. Reload verification for persisted decisions (Item A.8)
    await page.reload();
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 15000 });
    const reloadedCard = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(reloadedCard).toBeVisible();
    await expect(reloadedCard.locator('.decision-badge')).toHaveText('Decision: reprioritize');
    await expect(reloadedCard.locator('text=High-traffic action on mobile: verified candidate issue.')).toBeVisible();
  });
});
