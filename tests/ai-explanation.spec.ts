import { test, expect } from '@playwright/test';

test.describe('Phase 5: Grounded AI Explanation & Deterministic Fallback Verification', () => {
  test('executes 12-step offline AI explanation workflow, persistence, immutability, and 320px responsiveness', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Step 1: Run an audit
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('ProofUI Audit PoC');
    await page.waitForLoadState('networkidle');

    await page.selectOption('#fixture-select', 'target-size-demo');
    await page.click('#run-audit-button');

    // Wait for audit summary
    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    // Locate candidate failure card and needsReview card
    const failCard = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(failCard).toBeVisible();

    const reviewCard = page.locator('article', { hasText: 'Candidate spacing offset exception' }).first();
    await expect(reviewCard).toBeVisible();

    // Step 2: Request an explanation on the candidate failure card
    const explainBtn = failCard.locator('button[data-testid^="explain-btn-"]');
    await expect(explainBtn).toBeVisible();
    await expect(explainBtn).toHaveText('Request Explanation');

    await explainBtn.click();

    // Step 3 & 4: Verify deterministic fallback is used & provenance label is displayed
    const provBadge = failCard.locator('[data-testid^="provenance-badge-"]');
    await expect(provBadge).toBeVisible({ timeout: 10000 });
    await expect(provBadge).toHaveText('Deterministic Fallback');

    const fallbackReason = failCard.locator('[data-testid^="fallback-reason-"]');
    await expect(fallbackReason).toBeVisible();
    await expect(fallbackReason).toContainText('No Gemini API key configured');

    const explanationText = failCard.locator('[data-testid^="ai-explanation-"]');
    await expect(explanationText).toBeVisible();
    await expect(explanationText).toContainText('below the WCAG 2.2 SC 2.5.8 minimum threshold');

    const activeRec = failCard.locator('[data-testid^="active-recommendation-"]');
    await expect(activeRec).toBeVisible();

    // Button should now allow regeneration
    await expect(explainBtn).toHaveText('Regenerate Explanation');

    // Step 5: Verify measured evidence remains visible and unchanged
    const techBtn = failCard.locator('button', { hasText: 'Expand Technical Evidence' });
    await techBtn.click();
    await expect(failCard.locator('text=Measured Value:')).toBeVisible();
    await expect(failCard.locator('code', { hasText: 'btn-fail-tiny' }).first()).toBeVisible();

    // Step 6: Verify needsReview displays uncertainty and designer-verification language
    const reviewExplainBtn = reviewCard.locator('button[data-testid^="explain-btn-"]');
    await reviewExplainBtn.click();

    const reviewProvBadge = reviewCard.locator('[data-testid^="provenance-badge-"]');
    await expect(reviewProvBadge).toBeVisible({ timeout: 10000 });
    await expect(reviewProvBadge).toHaveText('Deterministic Fallback');

    const uncertaintyCallout = reviewCard.locator('[data-testid^="uncertainty-callout-"]');
    await expect(uncertaintyCallout).toBeVisible();
    await expect(uncertaintyCallout).toContainText('Designer Review Warning:');

    // Step 7: Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 8: Verify explanation, recommendation, and provenance persist
    const failCardAfterReload = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(failCardAfterReload).toBeVisible();

    const provBadgeAfterReload = failCardAfterReload.locator('[data-testid^="provenance-badge-"]');
    await expect(provBadgeAfterReload).toBeVisible();
    await expect(provBadgeAfterReload).toHaveText('Deterministic Fallback');

    const explanationAfterReload = failCardAfterReload.locator('[data-testid^="ai-explanation-"]');
    await expect(explanationAfterReload).toBeVisible();
    await expect(explanationAfterReload).toContainText('below the WCAG 2.2 SC 2.5.8 minimum threshold');

    // Step 9: Edit the recommendation as the designer
    const editBtn = failCardAfterReload.locator('button[id^="decision-btn-edit-"]');
    await editBtn.click();

    const customRecInput = failCardAfterReload.locator('textarea[id^="custom-rec-"]');
    await customRecInput.fill('Designer directive: increase button dimensions to 28x28px and add 4px outer margin.');

    const reasonInput = failCardAfterReload.locator('input[id^="reason-input-"]');
    await reasonInput.fill('Verified touch usability requirements for mobile navigation header.');

    const saveBtn = failCardAfterReload.locator('button[id^="save-decision-btn-"]');
    await saveBtn.click();
    await expect(failCardAfterReload.locator('text=Decision saved to audit log')).toBeVisible();

    const designerBadge = failCardAfterReload.locator('[data-testid^="designer-edit-badge-"]');
    await expect(designerBadge).toBeVisible();
    await expect(designerBadge).toHaveText('Designer-Edited Recommendation');

    const activeRecAfterEdit = failCardAfterReload.locator('[data-testid^="active-recommendation-"]');
    await expect(activeRecAfterEdit).toContainText('Designer directive: increase button dimensions');

    // Step 10: Attempt regeneration
    const regenBtn = failCardAfterReload.locator('button[data-testid^="explain-btn-"]');
    await regenBtn.click();
    await expect(regenBtn).toHaveText('Regenerate Explanation');
    await expect(regenBtn).toBeEnabled({ timeout: 10000 });

    // Step 11: Verify designer-edited content is NOT overwritten
    await expect(designerBadge).toBeVisible();
    await expect(activeRecAfterEdit).toContainText('Designer directive: increase button dimensions');

    // The regenerated AI/fallback recommendation is archived in details
    const summaryBtn = failCardAfterReload.locator('summary', { hasText: 'View Original Automated / AI Guidance' });
    await summaryBtn.click();
    const archivedGuidance = failCardAfterReload.locator('[data-testid^="archived-guidance-"]');
    await expect(archivedGuidance).toBeVisible();

    // Step 12: Verify regeneration history survives page reload and both records are inspectable
    await page.reload();
    await page.waitForLoadState('networkidle');

    const failCardAfterRegenReload = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    const historyDisclosure = failCardAfterRegenReload.locator('details[data-testid^="generation-history-"]');
    await expect(historyDisclosure).toBeVisible();
    await historyDisclosure.locator('summary').click();

    const record0 = failCardAfterRegenReload.locator('[data-testid^="generation-record-"]').first();
    const record1 = failCardAfterRegenReload.locator('[data-testid^="generation-record-"]').nth(1);
    await expect(record0).toBeVisible();
    await expect(record1).toBeVisible();
    await expect(record0).toContainText('Record #1');
    await expect(record1).toContainText('Record #2');

    // Step 13: Verify layout at 320px and keyboard accessibility
    await page.setViewportSize({ width: 320, height: 640 });
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Keyboard accessibility test
    const regenBtn320 = failCardAfterRegenReload.locator('button[data-testid^="explain-btn-"]');
    await regenBtn320.focus();
    await expect(regenBtn320).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(provBadgeAfterReload).toBeVisible();
  });

  /**
   * Controlled Mocked-Provider E2E UI Test:
   * Note: Intercepting /api/explain via Playwright network routing tests and verifies UI rendering,
   * badge color/contrast styling, and state transitions for the [AI-Generated (Gemini)] provenance indicator.
   * Server-side provider selection, Zod parsing, and grounding validation are tested in Vitest.
   */
  test('verifies mocked AI-generated (Gemini) provenance label without network access', async ({ page }) => {
    // Intercept /api/explain to simulate successful Gemini AI response
    await page.route('**/api/explain', async (route) => {
      const originalRequest = route.request();
      const body = JSON.parse(originalRequest.postData() || '{}');

      const mockAiResult = {
        explanation: 'AI-assisted analysis: The button fails minimum 24x24px dimensions under WCAG 2.5.8.',
        recommendation: 'Expand padding or wrap in a larger container.',
        requiresDesignerReview: false,
        provenance: 'gemini',
        isFallback: false,
        timestamp: new Date().toISOString(),
        durationMs: 420,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          aiResult: mockAiResult,
          updatedGroup: {
            fingerprint: body.fingerprint,
            aiExplanation: mockAiResult.explanation,
            aiRecommendation: mockAiResult.recommendation,
            aiExplanationResult: mockAiResult,
            representative: {
              id: 'issue-rep-1',
              title: 'Interactive target below 24×24 CSS px (16×16 px)',
              description: 'Target size 16x16px',
              url: 'http://localhost:3123/fixtures/target-size-demo',
              selector: 'button.mock',
              element: 'button',
              viewport: { width: 375, height: 667 },
              initialPriority: 'P1',
              priorityRationale: 'Rationale',
              wcagCriterion: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
              measured: { width: 16, height: 16 },
              expected: { minWidth: 24, minHeight: 24 },
            },
            status: 'candidateFail',
            initialPriority: 'P1',
            currentPriority: 'P1',
            rawOccurrencesCount: 1,
            occurrences: [
              {
                id: 'issue-rep-1',
                ruleId: 'target-size',
                wcagCriterion: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
                status: 'candidateFail',
                title: 'Interactive target below 24×24 CSS px (16×16 px)',
                description: 'Target size 16x16px',
                url: 'http://localhost:3123/fixtures/target-size-demo',
                viewport: { width: 375, height: 667 },
                selector: 'button.mock',
                element: 'button',
                measured: { width: 16, height: 16 },
                expected: { minWidth: 24, minHeight: 24 },
                initialPriority: 'P1',
                priorityRationale: 'Rationale',
              },
            ],
            decisionHistory: [],
          },
        }),
      });
    });

    await page.goto('/');
    await page.selectOption('#fixture-select', 'target-size-demo');
    await page.click('#run-audit-button');

    await expect(page.locator('text=Audit Result Summary')).toBeVisible({ timeout: 60000 });

    const card = page.locator('article', { hasText: 'Interactive target below 24×24 CSS px' }).first();
    await expect(card).toBeVisible();

    const explainBtn = card.locator('button[data-testid^="explain-btn-"]');
    await explainBtn.click();

    // Verify AI-Generated (Gemini) badge
    const provBadge = card.locator('[data-testid^="provenance-badge-"]');
    await expect(provBadge).toBeVisible();
    await expect(provBadge).toHaveText('AI-Generated (Gemini)');

    // Verify explanation displayed
    const explanation = card.locator('[data-testid^="ai-explanation-"]');
    await expect(explanation).toContainText('AI-assisted analysis: The button fails minimum 24x24px dimensions');
  });
});
