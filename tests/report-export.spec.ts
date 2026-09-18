import { test, expect } from '@playwright/test';
import fs from 'fs/promises';

test.describe('Phase 6A: Report Export (JSON & Markdown)', () => {
  test('generates, downloads, and validates consistent JSON and Markdown reports with keyboard & 320px responsiveness', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Run audit on target-size fixture
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await page.waitForLoadState('networkidle');

    await page.selectOption('#fixture-select', 'target-size-demo');
    await page.click('#run-audit-button');

    // Wait for audit completion
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();

    // 2. Record a designer decision on the first card
    const acceptBtn = firstCard.locator('button', { hasText: 'Accept Issue' });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    const saveBtn = firstCard.locator('button[id^="save-decision-btn"]');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Confirm acceptance badge
    await expect(firstCard.locator('.decision-badge')).toHaveText('Decision: accept');

    // 3. Request AI/fallback explanation
    const explainBtn = firstCard.locator('button[id^="explain-btn-"]');
    await expect(explainBtn).toBeVisible();
    await explainBtn.click();

    // Confirm guidance appears (provenance badge)
    await expect(firstCard.locator('[data-testid^="provenance-badge-"]').first()).toBeVisible({ timeout: 15000 });

    // 4. Download JSON report
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.click('#export-json-btn');
    const jsonDownload = await jsonDownloadPromise;

    expect(jsonDownload.suggestedFilename()).toMatch(/^proofui-audit-.*\.json$/);
    const jsonPath = await jsonDownload.path();
    expect(jsonPath).toBeTruthy();
    const jsonRaw = await fs.readFile(jsonPath!, 'utf-8');
    const jsonReport = JSON.parse(jsonRaw);

    // Verify JSON contents
    expect(jsonReport.schemaVersion).toBe('1.0.0');
    expect(jsonReport.audit.runId).toBeTruthy();
    expect(jsonReport.summary.groupedIssueCount).toBeGreaterThan(0);
    expect(jsonReport.disclaimers.length).toBeGreaterThan(0);
    expect(jsonReport.limitations.length).toBeGreaterThan(0);

    // Ensure zero leakage of developer machine paths
    expect(jsonRaw).not.toContain('/Users/');
    expect(jsonRaw).not.toContain('/home/');
    expect(jsonRaw).not.toContain('C:\\');

    // Verify that the recorded decision and AI guidance are in the JSON
    const acceptedGroup = jsonReport.groupedIssues.find((g: any) => g.designerDecision === 'accept');
    expect(acceptedGroup).toBeDefined();
    expect(acceptedGroup.aiExplanationResult).toBeDefined();

    // 5. Download Markdown report
    const mdDownloadPromise = page.waitForEvent('download');
    await page.click('#export-markdown-btn');
    const mdDownload = await mdDownloadPromise;

    expect(mdDownload.suggestedFilename()).toMatch(/^proofui-audit-.*\.md$/);
    const mdPath = await mdDownload.path();
    expect(mdPath).toBeTruthy();
    const mdContent = await fs.readFile(mdPath!, 'utf-8');

    // Verify Markdown structure and consistency with JSON
    expect(mdContent).toContain('# ProofUI UX/UI Audit Report');
    expect(mdContent).toContain('## Audit Metadata');
    expect(mdContent).toContain(jsonReport.audit.runId);
    expect(mdContent).toContain('## Scope and Disclaimers');
    expect(mdContent).toContain('## Summary Counts');
    expect(mdContent).toContain(`Total Raw Occurrences | ${jsonReport.summary.rawFindingCount}`);
    expect(mdContent).toContain(`Unique Grouped Issues | ${jsonReport.summary.groupedIssueCount}`);
    expect(mdContent).toContain('## Designer Decisions');
    expect(mdContent).toContain('`accept`');
    expect(mdContent).toContain('## AI / Fallback Provenance');
    expect(mdContent).toContain('## Known Limitations');

    // Ensure no raw developer paths
    expect(mdContent).not.toContain('/Users/');

    // 6. Responsive and keyboard accessibility check at 320px
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(300);

    // Verify no page-level horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify export buttons are visible and accessible at 320px
    const exportJsonBtn = page.locator('#export-json-btn');
    const exportMdBtn = page.locator('#export-markdown-btn');
    await expect(exportJsonBtn).toBeVisible();
    await expect(exportMdBtn).toBeVisible();

    // Verify minimum touch target size (44px)
    const jsonBox = await exportJsonBtn.boundingBox();
    const mdBox = await exportMdBtn.boundingBox();
    expect(jsonBox?.height).toBeGreaterThanOrEqual(44);
    expect(mdBox?.height).toBeGreaterThanOrEqual(44);

    // Focus via keyboard
    await exportJsonBtn.focus();
    await expect(exportJsonBtn).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(exportMdBtn).toBeFocused();
  });
});
