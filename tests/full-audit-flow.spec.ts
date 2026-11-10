import { test, expect } from '@playwright/test';
import fs from 'fs/promises';

test.describe('Phase 8: Complete End-to-End Audit Flow (TEST-24)', () => {
  test('exercises the full pipeline: fixture audit → evidence → AI fallback → decision → export → iteration proof → persistence → responsive', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);

    // =========================================================================
    // STEP 1: Load homepage — verify title, skip link, landmarks
    // =========================================================================
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');

    // Skip link exists
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // Semantic landmarks
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('nav')).toBeTruthy();

    // =========================================================================
    // STEP 2: Select fixture and run audit
    // =========================================================================
    const fixtureSelect = page.locator('#fixture-select');
    await expect(fixtureSelect).toBeVisible();
    await fixtureSelect.selectOption('target-size-demo');

    const runButton = page.locator('#run-audit-button');
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // =========================================================================
    // STEP 3: Wait for completed audit — verify summary, grouped issues
    // =========================================================================
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Summary strip shows counts
    const summarySection = page.locator('.audit-summary');
    await expect(summarySection).toBeVisible();
    await expect(summarySection.locator('dt', { hasText: 'Raw findings' })).toBeVisible();
    await expect(summarySection.locator('dt', { hasText: 'Grouped issues' })).toBeVisible();
    await expect(summarySection.locator('dt', { hasText: 'Pass' })).toBeVisible();
    await expect(summarySection.locator('dt', { hasText: 'Candidate fail' })).toBeVisible();
    await expect(summarySection.locator('dt', { hasText: 'Needs review' })).toBeVisible();

    // P0-P3 heuristic disclaimer
    await expect(summarySection.locator('text=P0–P3 is a project heuristic')).toBeVisible();

    // Target URL is visible
    await expect(summarySection.locator('text=target-size-demo').first()).toBeVisible();

    // =========================================================================
    // STEP 4: Verify all 3 statuses are represented
    // =========================================================================
    const candidateFailCard = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(candidateFailCard).toBeVisible();
    await expect(candidateFailCard.locator('text=Candidate Issue')).toBeVisible();

    const needsReviewCard = page.locator('article', { hasText: 'Candidate spacing offset exception' }).first();
    await expect(needsReviewCard).toBeVisible();
    await expect(needsReviewCard.locator('text=Requires Designer Review')).toBeVisible();

    // Filter to pass status to verify pass cards exist
    const passFilterBtn = page.locator('.filter-bar button', { hasText: 'Pass' });
    await passFilterBtn.click();
    await expect(passFilterBtn).toHaveAttribute('aria-pressed', 'true');
    const passCards = page.locator('article');
    const passCount = await passCards.count();
    expect(passCount).toBeGreaterThan(0);
    await expect(passCards.first().locator('text=Threshold Passed')).toBeVisible();

    // Return to 'All' filter
    const allFilterBtn = page.locator('.filter-bar button', { hasText: 'All' });
    await allFilterBtn.click();

    // =========================================================================
    // STEP 5: Verify issue card hierarchy on candidateFail card
    // =========================================================================
    // (1) Plain-language title
    await expect(candidateFailCard.locator('h3').first()).toBeVisible();

    // (2) Status and initial priority
    await expect(candidateFailCard.locator('text=Candidate Issue')).toBeVisible();

    // (3) Screenshot evidence (or explicit fallback)
    const hasScreenshot = await candidateFailCard.locator('img[alt^="Rendered evidence"]').count();
    const hasScreenshotFallback = await candidateFailCard.locator('text=Screenshot unavailable').count();
    expect(hasScreenshot + hasScreenshotFallback).toBeGreaterThan(0);

    // (6) Designer decision controls — Accept, Reject, Edit, Reprioritize
    await expect(candidateFailCard.locator('button', { hasText: 'Accept Issue' })).toBeVisible();
    await expect(candidateFailCard.locator('button', { hasText: 'Reject (False Positive)' })).toBeVisible();
    await expect(candidateFailCard.locator('button', { hasText: 'Edit Scope' })).toBeVisible();
    await expect(candidateFailCard.locator('button', { hasText: 'Reprioritize' })).toBeVisible();

    // (7) Technical evidence collapsed by default
    const techExpandBtn = candidateFailCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await expect(techExpandBtn).toBeVisible();
    await expect(candidateFailCard.locator('text=Grouping Fingerprint:')).not.toBeVisible();

    // Expand and verify technical details
    await techExpandBtn.click();
    await expect(candidateFailCard.locator('text=Grouping Fingerprint:')).toBeVisible();
    await expect(candidateFailCard.locator('text=WCAG 2.2 SC 2.5.8 Target Size (Minimum)')).toBeVisible();
    await expect(candidateFailCard.locator('text=Measured Value:')).toBeVisible();
    await expect(candidateFailCard.locator('text=Expected Threshold:')).toBeVisible();

    // Collapse it back
    await candidateFailCard.locator('button', { hasText: 'Hide Technical Evidence' }).click();
    await expect(candidateFailCard.locator('text=Grouping Fingerprint:')).not.toBeVisible();

    // =========================================================================
    // STEP 6: Request AI/fallback explanation
    // =========================================================================
    const explainBtn = candidateFailCard.locator('button[data-testid^="explain-btn-"]');
    await expect(explainBtn).toBeVisible();
    await expect(explainBtn).toHaveText('Request Explanation');
    await explainBtn.click();

    // Verify provenance badge (deterministic fallback or live AI)
    const provBadge = candidateFailCard.locator('[data-testid^="provenance-badge-"]');
    await expect(provBadge).toBeVisible({ timeout: 10000 });
    await expect(provBadge).toHaveText(/Deterministic Fallback|AI-Generated/);

    const isFallback = (await provBadge.textContent())?.includes('Deterministic Fallback');
    if (isFallback) {
      const fallbackReason = candidateFailCard.locator('[data-testid^="fallback-reason-"]');
      await expect(fallbackReason).toBeVisible();
      await expect(fallbackReason).toContainText('No Gemini API key configured');
    }

    // Explanation and recommendation content present
    const explanation = candidateFailCard.locator('[data-testid^="ai-explanation-"]');
    await expect(explanation).toBeVisible();
    await expect(explanation).toContainText(/24.*24|2\.5\.8|minimum/);

    const recommendation = candidateFailCard.locator('[data-testid^="active-recommendation-"]');
    await expect(recommendation).toBeVisible();

    // Button now shows Regenerate
    await expect(explainBtn).toHaveText('Regenerate Explanation');

    // =========================================================================
    // STEP 7: Record a designer decision (Accept) with inline feedback
    // =========================================================================
    const acceptBtn = candidateFailCard.locator('button', { hasText: 'Accept Issue' });
    await acceptBtn.click();

    const saveBtn = candidateFailCard.locator('button[id^="save-decision-btn"]');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Inline confirmation
    await expect(candidateFailCard.locator('text=Decision saved to audit log')).toBeVisible();
    await expect(candidateFailCard.locator('.decision-badge')).toHaveText('Decision: accept');

    // =========================================================================
    // STEP 8: Export JSON report
    // =========================================================================
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.click('#export-json-btn');
    const jsonDownload = await jsonDownloadPromise;

    expect(jsonDownload.suggestedFilename()).toMatch(/^proofui-audit-.*\.json$/);
    const jsonPath = await jsonDownload.path();
    expect(jsonPath).toBeTruthy();

    const jsonRaw = await fs.readFile(jsonPath!, 'utf-8');
    const jsonReport = JSON.parse(jsonRaw);

    // Schema and structure
    expect(jsonReport.schemaVersion).toBe('1.0.0');
    expect(jsonReport.audit.runId).toBeTruthy();
    expect(jsonReport.summary.groupedIssueCount).toBeGreaterThan(0);
    expect(jsonReport.summary.rawFindingCount).toBeGreaterThan(0);

    // Disclaimers and limitations present
    expect(jsonReport.disclaimers.length).toBeGreaterThan(0);
    expect(jsonReport.limitations.length).toBeGreaterThan(0);

    // No leaked developer machine paths
    expect(jsonRaw).not.toContain('/Users/');
    expect(jsonRaw).not.toContain('/home/');
    expect(jsonRaw).not.toContain('C:\\');

    // Accepted decision is in the export
    const acceptedGroup = jsonReport.groupedIssues.find((g: any) => g.designerDecision === 'accept');
    expect(acceptedGroup).toBeDefined();

    // AI/fallback explanation is in the export
    expect(acceptedGroup.aiExplanationResult).toBeDefined();
    expect(['fallback', 'cpe', 'gemini']).toContain(acceptedGroup.aiExplanationResult.provenance);

    // =========================================================================
    // STEP 9: Export Markdown report — verify consistency with JSON
    // =========================================================================
    const mdDownloadPromise = page.waitForEvent('download');
    await page.click('#export-markdown-btn');
    const mdDownload = await mdDownloadPromise;

    expect(mdDownload.suggestedFilename()).toMatch(/^proofui-audit-.*\.md$/);
    const mdPath = await mdDownload.path();
    expect(mdPath).toBeTruthy();

    const mdContent = await fs.readFile(mdPath!, 'utf-8');

    // Core sections present
    expect(mdContent).toContain('# ProofUI UX/UI Audit Report');
    expect(mdContent).toContain('## Audit Metadata');
    expect(mdContent).toContain(jsonReport.audit.runId);
    expect(mdContent).toContain('## Scope and Disclaimers');
    expect(mdContent).toContain('## Summary Counts');
    expect(mdContent).toContain('## Known Limitations');

    // Numeric consistency between JSON and Markdown
    expect(mdContent).toContain(`Total Raw Occurrences | ${jsonReport.summary.rawFindingCount}`);
    expect(mdContent).toContain(`Unique Grouped Issues | ${jsonReport.summary.groupedIssueCount}`);

    // Decision reflected in Markdown
    expect(mdContent).toContain('## Designer Decisions');
    expect(mdContent).toContain('`accept`');

    // AI provenance section
    expect(mdContent).toContain('## AI / Fallback Provenance');

    // No leaked paths
    expect(mdContent).not.toContain('/Users/');

    // =========================================================================
    // STEP 10: Verify iteration proof on candidate-fail card
    // =========================================================================
    // Locate the iteration proof section
    await expect(candidateFailCard.locator('text=Isolated preview — source unchanged')).toBeVisible();
    const launchBtn = candidateFailCard.locator('button[id^="launch-iteration-btn-"]');
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toHaveText('Approve & Launch Isolated Preview');

    // Launch preview
    await launchBtn.click();

    // Result banner should appear
    await expect(candidateFailCard.locator('text=Result: [IMPROVED]')).toBeVisible({ timeout: 30000 });

    // Candidate screenshot loaded
    const candidateImg = candidateFailCard.getByRole('img', { name: 'Candidate preview target size visual evidence' });
    await expect(candidateImg).toBeVisible();
    await expect.poll(() => candidateImg.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Baseline measurement still visible
    await expect(candidateFailCard.locator('text=Measured: 16 × 16 px').first()).toBeVisible();

    // Candidate measurement
    await expect(candidateFailCard.locator('text=Candidate Preview')).toBeVisible();
    await expect(candidateFailCard.locator('text=Measured: 24 × 24 px').first()).toBeVisible();

    // =========================================================================
    // STEP 11: Page reload — verify persistence of all state
    // =========================================================================
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Audit results persist
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 15000 });

    // Decision persists
    const reloadedCard = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(reloadedCard).toBeVisible();
    await expect(reloadedCard.locator('.decision-badge')).toHaveText('Decision: accept');

    // Explanation persists
    const reloadedProvBadge = reloadedCard.locator('[data-testid^="provenance-badge-"]');
    await expect(reloadedProvBadge).toBeVisible();
    await expect(reloadedProvBadge).toHaveText(/Deterministic Fallback|AI-Generated/);

    // Iteration proof comparison persists
    await expect(reloadedCard.locator('text=Result: [IMPROVED]')).toBeVisible();

    // Verify original fixture source is unmodified
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/fixtures/target-size-demo');
    const undersizedButton = freshPage.locator('#btn-fail-tiny-delete');
    const freshBox = await undersizedButton.boundingBox();
    expect(freshBox?.width).toBeLessThan(24);
    expect(freshBox?.height).toBeLessThan(24);
    await freshContext.close();

    // =========================================================================
    // STEP 12: Responsive check at 320px — no horizontal overflow
    // =========================================================================
    await page.setViewportSize({ width: 320, height: 600 });
    await page.waitForTimeout(300);

    const hasOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow320).toBe(false);

    // Primary controls are visible and accessible at 320px
    const exportJsonBtn320 = page.locator('#export-json-btn');
    await expect(exportJsonBtn320).toBeVisible();
    const jsonBox = await exportJsonBtn320.boundingBox();
    expect(jsonBox?.height).toBeGreaterThanOrEqual(44);

    // =========================================================================
    // STEP 13: Verify no excluded features in the UI
    // =========================================================================
    const pageContent = await page.content();

    // No drag-and-drop editor (EXCL-01)
    expect(pageContent).not.toContain('drag-and-drop');
    expect(pageContent).not.toContain('draggable="true"');

    // No Monaco editor (EXCL-02)
    expect(pageContent).not.toContain('monaco-editor');

    // No Figma integration (EXCL-03)
    expect(pageContent).not.toContain('figma.com');

    // No telemetry/heatmap references (EXCL-06)
    expect(pageContent).not.toContain('heatmap');
    expect(pageContent).not.toContain('click-tracking');

    // No UX quality score (EXCL-07)
    expect(pageContent.toLowerCase()).not.toContain('ux quality score');
    expect(pageContent.toLowerCase()).not.toContain('ux score');

    // No analytics dashboard (EXCL-13)
    expect(pageContent.toLowerCase()).not.toContain('analytics dashboard');
  });
});
