import { test, expect } from '@playwright/test';

test.describe('Visual Canvas Overlay Feature', () => {
  test('renders visual canvas with interactive pins and updates inspector on click', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate to home
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // 2. Select target-size-demo fixture and run audit
    const fixtureSelect = page.locator('#fixture-select');
    await fixtureSelect.selectOption('target-size-demo');
    const runButton = page.locator('#run-audit-button');
    await runButton.click();

    // 3. Wait for audit completion
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 4. Verify Visual Canvas Overlay component is visible
    const canvasComponent = page.locator('.visual-canvas-component');
    await expect(canvasComponent).toBeVisible();

    // Check canvas toolbar elements
    await expect(canvasComponent.locator('.canvas-badge')).toContainText('Visual Canvas Overlay');
    await expect(canvasComponent.locator('.canvas-pins-counter')).toBeVisible();

    // Viewport pills exist
    const mobilePill = canvasComponent.locator('.viewport-pill', { hasText: '375px Mobile' });
    const desktopPill = canvasComponent.locator('.viewport-pill', { hasText: '1440px Desktop' });
    const reflowPill = canvasComponent.locator('.viewport-pill', { hasText: '320px Reflow' });
    await expect(mobilePill).toBeVisible();
    await expect(desktopPill).toBeVisible();
    await expect(reflowPill).toBeVisible();

    // 5. Verify live iframe and interactive pins
    const canvasIframe = canvasComponent.locator('iframe.canvas-iframe');
    await expect(canvasIframe).toBeVisible();
    await expect(canvasIframe).toHaveAttribute('src', '/fixtures/target-size-demo');

    // Pins should be rendered
    const pins = canvasComponent.locator('.canvas-pin-marker');
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThan(0);

    // 6. Test clicking a pin to inspect
    const firstPin = pins.first();
    await firstPin.click({ force: true });

    // Inspector drawer should display active pin and title
    const inspector = canvasComponent.locator('.canvas-inspector-drawer');
    await expect(inspector).toBeVisible();
    await expect(inspector.locator('.inspector-pin-badge')).toContainText('Pin #1');
    await expect(inspector.locator('.comparison-eyebrow')).toHaveText('Visual Spec Comparison');

    // Visual spec comparison cards
    await expect(inspector.locator('.card-before')).toBeVisible();
    await expect(inspector.locator('.card-after')).toBeVisible();
    await expect(inspector.locator('.card-before .spec-metric')).toContainText('Measured:');
    await expect(inspector.locator('.card-after .spec-metric')).toContainText('Recommended:');

    // Quick designer actions
    const acceptBtn = inspector.locator('.btn-accept');
    const rejectBtn = inspector.locator('.btn-reject');
    const copyCssBtn = inspector.locator('.btn-copy', { hasText: 'Copy CSS Fix' });

    await expect(acceptBtn).toBeVisible();
    await expect(rejectBtn).toBeVisible();
    await expect(copyCssBtn).toBeVisible();

    // 7. Test closing the pop-up box
    const closeBtn = inspector.locator('.stepper-btn.close-btn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(inspector).not.toBeVisible();

    // Re-open by clicking a pin again
    await firstPin.click({ force: true });
    await expect(inspector).toBeVisible();

    // 8. Test Full Page Canvas toggle
    const fullPageBtn = canvasComponent.locator('.btn-fullpage');
    await expect(fullPageBtn).toBeVisible();
    await fullPageBtn.click();
    await expect(canvasComponent).toHaveClass(/is-fullpage/);

    // Exit full page mode
    await fullPageBtn.click();
    await expect(canvasComponent).not.toHaveClass(/is-fullpage/);

    // 9. Test switching viewport to 1440px Desktop
    await desktopPill.click();
    await expect(desktopPill).toHaveClass(/is-active/);
    await expect(canvasComponent.locator('.browser-viewport-tag')).toContainText('1440');

    // Switch to 320px Reflow
    await reflowPill.click();
    await expect(reflowPill).toHaveClass(/is-active/);
    await expect(canvasComponent.locator('.browser-viewport-tag')).toContainText('320');
  });
});
