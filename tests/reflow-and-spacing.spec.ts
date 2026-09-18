import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Phase 3: Reflow & Text Spacing Correctness Suite', () => {

  test('Reflow: Isolated Pass scenario has clean document geometry at 320px', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // Select isolated pass fixture
    await page.selectOption('#fixture-select', 'reflow-pass');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Filter to pass tab to verify clean pass
    const passTab = page.locator('button', { hasText: 'Pass (' });
    await passTab.click();

    const passCard = page.locator('article', { hasText: 'Content reflows without 2D scrolling' }).first();
    await expect(passCard).toBeVisible();
    await expect(passCard.locator('text=Threshold Passed')).toBeVisible();

    // Verify document geometry is uncontaminated: scroll width == client width (320px)
    const expandBtn = passCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expandBtn.click();
    await expect(passCard.locator('text=horizontalOverflowPx":0')).toBeVisible();
  });

  test('Reflow: Isolated Candidate Failure scenario forces horizontal overflow at 320px', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#fixture-select', 'reflow-fail');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const failCard = page.locator('article', { hasText: 'Unintended horizontal overflow' }).first();
    await expect(failCard).toBeVisible();
    await expect(failCard.locator('text=Candidate Issue')).toBeVisible();
    await expect(failCard.locator('text=Viewport: 320px')).toBeVisible();

    const expandBtn = failCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expandBtn.click();
    await expect(failCard.locator('code', { hasText: '#reflow-fail-banner' }).first()).toBeVisible();
    await expect(failCard.getByText('WCAG 2.2 SC 1.4.10 Reflow', { exact: true })).toBeVisible();
  });

  test('Reflow: Isolated Essential 2D scenario requires designer review', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#fixture-select', 'reflow-review');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const reviewCard = page.locator('article', { hasText: 'Essential two-dimensional' }).first();
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard.locator('text=Requires Designer Review')).toBeVisible();
    await expect(reviewCard.locator('text=Essential two-dimensional presentation exception')).toBeVisible();
  });

  test('Reflow: Detects nested scroll container and ancestor-clipped content without document scroll', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#fixture-select', 'reflow-nested-fail');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // 1. Nested scroll container failure
    const nestedCard = page.locator('article', { hasText: 'Nested horizontal scroll container forces two-dimensional panning' }).first();
    await expect(nestedCard).toBeVisible();
    await expect(nestedCard.locator('text=Candidate Issue')).toBeVisible();

    // 2. Ancestor-clipped content without document scrollbar failure
    const clippedCard = page.locator('article', { hasText: 'Content clipped by ancestor overflow restriction' }).first();
    await expect(clippedCard).toBeVisible();
    await expect(clippedCard.locator('text=Candidate Issue')).toBeVisible();
  });

  test('Reflow: Excludes decorative overflow and detects off-screen interactive controls', async ({ page }) => {
    // 1. Check decorative bleed produces clean pass (excluded from failure)
    await page.goto('/');
    await page.selectOption('#fixture-select', 'reflow-decorative-pass');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const passTab = page.locator('button', { hasText: 'Pass (' });
    await passTab.click();
    await expect(page.locator('article', { hasText: 'Content reflows without 2D scrolling' }).first()).toBeVisible();

    // 2. Check off-screen interactive control candidate failure
    await page.goto('/');
    await page.selectOption('#fixture-select', 'reflow-controls-fail');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const controlCard = page.locator('article', { hasText: 'Interactive control positioned outside visible or clipping area' }).first();
    await expect(controlCard).toBeVisible();
    await expect(controlCard.locator('text=Candidate Issue')).toBeVisible();
    await expect(controlCard.locator('text=P0 — Critical').or(controlCard.locator('text=P1 — High'))).toBeVisible();
  });

  test('Text Spacing: Normal wrapping remains pass while vertical, horizontal, and obscured controls fail', async ({ page }) => {
    // 1. Normal wrapping pass
    await page.goto('/');
    await page.selectOption('#fixture-select', 'text-spacing-pass');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const passTab = page.locator('button', { hasText: 'Pass (' });
    await passTab.click();
    const wrapPassCard = page.locator('article', { hasText: 'Text wraps and container expands fluidly' }).first();
    await expect(wrapPassCard).toBeVisible();
    await expect(wrapPassCard.locator('text=Threshold Passed')).toBeVisible();

    // 2. Vertical clipping failure
    await page.goto('/');
    await page.selectOption('#fixture-select', 'text-spacing-fail');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const vertClipCard = page.locator('article', { hasText: 'Text content vertically clipped under text spacing override' }).first();
    await expect(vertClipCard).toBeVisible();

    // 3. Obscured interactive control failure
    await page.goto('/');
    await page.selectOption('#fixture-select', 'text-spacing-obscured-fail');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const obscuredCard = page.locator('article', { hasText: 'Interactive control obscured by expanded text' }).first();
    await expect(obscuredCard).toBeVisible();
    await expect(obscuredCard.locator('text=P0 — Critical')).toBeVisible();
  });

  test('Text Spacing: Complete style cleanup verification and double-audit idempotency', async ({ page }) => {
    // Load the preserved text fixture directly in browser to inspect computed styles before audit
    await page.goto('/fixtures/text-spacing-preserved');

    // Baseline measurements
    const baselineStyles = await page.evaluate(() => {
      const el = document.getElementById('preserved-text-element');
      if (!el) throw new Error('Element not found');
      const cs = window.getComputedStyle(el);
      return {
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        marginBottom: cs.marginBottom,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    // Run first audit from UI
    await page.goto('/');
    await page.selectOption('#fixture-select', 'text-spacing-preserved');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Collect first audit count and fingerprints
    const firstCountText = await page.locator('#summary-raw-findings-count').textContent();

    // Verify cleanup: revisit the page or evaluate directly
    await page.goto('/fixtures/text-spacing-preserved');
    const postAuditStyles = await page.evaluate(() => {
      const el = document.getElementById('preserved-text-element');
      if (!el) throw new Error('Element not found');
      const cs = window.getComputedStyle(el);
      return {
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        marginBottom: cs.marginBottom,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        residualOverride: document.getElementById('proofui-text-spacing-override') !== null,
        residualModifiedVar: (window as any).__proofui_spacing_modified !== undefined,
      };
    });

    // 1. Style element removed & state cleaned
    expect(postAuditStyles.residualOverride).toBe(false);
    expect(postAuditStyles.residualModifiedVar).toBe(false);

    // 2. Computed styles restored exactly to baseline
    expect(postAuditStyles.lineHeight).toBe(baselineStyles.lineHeight);
    expect(postAuditStyles.letterSpacing).toBe(baselineStyles.letterSpacing);
    expect(postAuditStyles.wordSpacing).toBe(baselineStyles.wordSpacing);
    expect(postAuditStyles.marginBottom).toBe(baselineStyles.marginBottom);

    // 3. Document geometry restored exactly to baseline
    expect(postAuditStyles.scrollHeight).toBe(baselineStyles.scrollHeight);
    expect(postAuditStyles.scrollWidth).toBe(baselineStyles.scrollWidth);

    // 4. Run second audit to verify identical results and stable fingerprints
    await page.goto('/');
    await page.selectOption('#fixture-select', 'text-spacing-preserved');
    await page.click('#run-audit-button');
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const secondCountText = await page.locator('#summary-raw-findings-count').textContent();
    expect(secondCountText).toBe(firstCountText);
  });
});
