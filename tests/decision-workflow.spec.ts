import { test, expect } from '@playwright/test';

test.describe('Phase 4: Complete Grouping & Review Workflow Verification', () => {
  test('executes 15-step decision workflow, verifies occurrences, immutability, reload, and responsiveness', async ({ page }) => {
    test.setTimeout(90000);

    // Step 1: Run an audit containing grouped duplicates
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await page.waitForLoadState('networkidle');

    await page.selectOption('#fixture-select', 'occurrence-demo');
    await page.click('#run-audit-button');

    // Wait for audit summary
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const tagCard = page.locator('article', { hasText: 'Candidate spacing offset exception' }).first();
    await expect(tagCard).toBeVisible();

    const occurrenceBadge = tagCard.locator('.occurrence-badge');
    await expect(occurrenceBadge).toBeVisible();
    await expect(occurrenceBadge).toContainText('occurrences');

    // Step 2: Expand raw occurrences using the keyboard
    const inspectBtn = tagCard.locator('button[id^="inspect-occurrences-btn"]');
    await expect(inspectBtn).toBeVisible();
    await inspectBtn.focus();
    await page.keyboard.press('Enter');

    const occPanel = tagCard.locator('div[id^="occurrence-panel"]');
    await expect(occPanel).toBeVisible();
    await expect(inspectBtn).toHaveAttribute('aria-expanded', 'true');

    // Step 3: Verify every required occurrence field
    const occCards = occPanel.locator('div[data-occurrence-id]');
    const count = await occCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      const card = occCards.nth(i);
      // Viewport
      await expect(card.locator('text=Viewport:')).toBeVisible();
      // Selector
      await expect(card.locator('text=Selector:')).toBeVisible();
      await expect(card.locator('code', { hasText: 'button.repeat-tag-btn' })).toBeVisible();
      // Status
      await expect(card.locator('text=Occurrence #').first()).toBeVisible();
      // Measured values
      await expect(card.locator('text=Measured:')).toBeVisible();
      // Expected values
      await expect(card.locator('text=Expected:')).toBeVisible();
      // Bounding box
      await expect(card.locator('text=Bounding Box:')).toBeVisible();
      // Screenshot or explicit fallback
      const hasImg = await card.locator('img').count();
      if (hasImg > 0) {
        await expect(card.locator('img')).toHaveAttribute('alt', /Visual evidence screenshot for occurrence/);
      } else {
        await expect(card.locator('text=No visual screenshot available')).toBeVisible();
      }
      // Occurrence ID
      await expect(card.locator('text=Occurrence ID:')).toBeVisible();
    }

    // Collapse section using the keyboard
    await inspectBtn.focus();
    await page.keyboard.press('Enter');
    await expect(inspectBtn).toHaveAttribute('aria-expanded', 'false');

    const saveBtn = tagCard.locator('button[id^="save-decision-btn"]');
    const reasonInput = tagCard.locator('input[id^="reason-input"]');

    // Step 4: Accept
    const acceptBtn = tagCard.locator('button', { hasText: 'Accept Issue' });
    await acceptBtn.click();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(tagCard.locator('text=Decision saved to audit log')).toBeVisible();
    await expect(tagCard.locator('.decision-badge')).toHaveText('Decision: accept');

    // Step 5: Reject later with a reason
    const rejectBtn = tagCard.locator('button', { hasText: 'Reject (False Positive)' });
    await rejectBtn.click();
    // Verify reason validation (< 3 chars disabled)
    await expect(saveBtn).toBeDisabled();
    await reasonInput.fill('Valid rejection: Desktop chip has sufficient surrounding tap clearance.');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(tagCard.locator('text=Decision saved to audit log')).toBeVisible();
    await expect(tagCard.locator('.decision-badge')).toHaveText('Decision: reject');

    // Step 6: Edit the recommendation with changed content and a reason
    const editBtn = tagCard.locator('button', { hasText: 'Edit Scope' });
    await editBtn.click();
    const customRecTextarea = tagCard.locator('textarea[id^="custom-rec"]');
    await expect(customRecTextarea).toBeVisible();
    await customRecTextarea.fill('Custom Recommendation: Use CSS ::after pseudo-element to expand touch target.');
    await reasonInput.fill('Visual designers approved expanding pseudo-element target.');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(tagCard.locator('text=Decision saved to audit log')).toBeVisible();
    await expect(tagCard.locator('.decision-badge')).toHaveText('Decision: edit');
    await expect(tagCard.locator('p', { hasText: 'Use CSS ::after pseudo-element' }).first()).toBeVisible();

    // Step 7: Reprioritize to a different priority with a reason
    const reprioritizeBtn = tagCard.locator('button', { hasText: 'Reprioritize' });
    await reprioritizeBtn.click();
    const prioritySelect = tagCard.locator('select[id^="priority-select"]');
    await prioritySelect.selectOption('P0');
    await reasonInput.fill('Elevated to P0 blocker after QA validation.');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(tagCard.locator('text=Decision saved to audit log')).toBeVisible();
    await expect(tagCard.locator('.decision-badge')).toHaveText('Decision: reprioritize');
    await expect(tagCard.getByText('P0 — Critical', { exact: true })).toBeVisible();

    // Step 8: Reload
    await page.reload();
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Step 9: Verify final effective decision and priority after reload
    const reloadedTagCard = page.locator('article', { hasText: 'Candidate spacing offset exception' }).first();
    await expect(reloadedTagCard).toBeVisible();
    await expect(reloadedTagCard.locator('.decision-badge')).toHaveText('Decision: reprioritize');
    await expect(reloadedTagCard.getByText('P0 — Critical', { exact: true })).toBeVisible();

    // Step 10: Verify all four earlier events remain in chronological history
    const logBtn = reloadedTagCard.locator('button[id^="decision-history-btn"]');
    await expect(logBtn).toBeVisible();
    await expect(logBtn).toContainText('4 events');
    await logBtn.click();

    const logPanel = reloadedTagCard.locator('div[id^="decision-history-panel"]');
    await expect(logPanel).toBeVisible();
    await expect(logPanel.locator('text=Accepted')).toBeVisible();
    await expect(logPanel.locator('text=Rejected (False Positive)')).toBeVisible();
    await expect(logPanel.locator('text=Scope Edited')).toBeVisible();
    await expect(logPanel.locator('text=Reprioritized')).toBeVisible();

    // Step 11: Verify original and edited recommendations both remain available
    await expect(reloadedTagCard.locator('text=Designer Custom Recommendation')).toBeVisible();
    await expect(reloadedTagCard.locator('p', { hasText: 'Use CSS ::after pseudo-element' }).first()).toBeVisible();

    const originalDetails = reloadedTagCard.locator('details');
    await expect(originalDetails).toBeVisible();
    await originalDetails.locator('summary').click();
    await expect(originalDetails.locator('p')).toBeVisible();

    // Step 12: Trigger a failed save via network failure and verify unsaved draft content remains
    await page.route('**/api/decisions', (route) =>
      route.fulfill({ status: 500, json: { success: false, error: 'Simulated persistence failure' } })
    );

    const editBtnReloaded = reloadedTagCard.locator('button', { hasText: 'Edit Scope' });
    await editBtnReloaded.click();
    const customRecReloaded = reloadedTagCard.locator('textarea[id^="custom-rec"]');
    const reasonInputReloaded = reloadedTagCard.locator('input[id^="reason-input"]');
    const saveBtnReloaded = reloadedTagCard.locator('button[id^="save-decision-btn"]');

    const draftText = 'New unsaved draft proposal for touch target';
    const draftReason = 'Rationale explaining the proposed draft update';
    await customRecReloaded.fill(draftText);
    await reasonInputReloaded.fill(draftReason);

    await expect(saveBtnReloaded).toBeEnabled();
    await saveBtnReloaded.click();

    // Verify error feedback is displayed
    await expect(reloadedTagCard.locator('text=Simulated persistence failure')).toBeVisible();

    // Step 13: Verify unsaved draft content remains intact in the form fields
    expect(await customRecReloaded.inputValue()).toBe(draftText);
    expect(await reasonInputReloaded.inputValue()).toBe(draftReason);

    await page.unroute('**/api/decisions');

    // Step 14: Verify visible keyboard focus
    await customRecReloaded.focus();
    const isFocused = await customRecReloaded.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Step 15: Verify layout at 320px and 375px without horizontal page scrolling
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const scrollWidth375 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth375 = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth375).toBeLessThanOrEqual(clientWidth375);

    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(300);
    const scrollWidth320 = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth320 = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth320).toBeLessThanOrEqual(clientWidth320);
  });
});
