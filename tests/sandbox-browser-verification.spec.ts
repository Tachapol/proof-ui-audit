import { test, expect } from '@playwright/test';

test.describe('Sandbox Real Browser Verification: 4 Core Scenarios', () => {
  test.setTimeout(90000);

  test('Case 1: Resolved — fixes touch target & contrast with true measured evidence and Selected checks passed badge', async ({ page }) => {
    const auditPromise = page.waitForResponse(resp => resp.url().includes('/api/sandbox/audit') && resp.status() === 200);
    await page.goto('/sandbox');
    await auditPromise;

    // 1. Textarea editor should contain initial snippet and iframe preview renders
    await expect(page.locator('textarea')).toHaveValue(/Course Registration/);
    const frame = page.frameLocator('iframe[title="Component Sandbox Preview"]');
    await expect(frame.locator('text=Course Registration')).toBeVisible({ timeout: 15000 });

    // 2. Initial audit should complete and show failures
    await expect(page.locator('text=Failures').first()).toBeVisible({ timeout: 20000 });

    // 3. Click Auto-Iterate to generate multi-candidate proposals
    const iterateBtn = page.locator('button:has-text("Auto-Iterate")');
    await expect(iterateBtn).toBeEnabled();
    await iterateBtn.click();

    // 4. Wait for candidates to be rendered
    const candidateOpt1 = page.locator('[data-testid="candidate-card-candidate-opt-1"]');
    await expect(candidateOpt1).toBeVisible({ timeout: 30000 });

    // Verify Candidate 1 has passed badge
    await expect(candidateOpt1.locator('span[title^="Verified for selected automated checks"]')).toBeVisible();

    // Verify candidate checks list contains verified rules
    await expect(candidateOpt1.locator('text=Target size:')).toBeVisible();
    await expect(candidateOpt1.locator('text=Text contrast:')).toBeVisible();

    // Verify Measured Evidence accordion can be toggled and contains real units
    const evidenceDetails = candidateOpt1.locator('details:has-text("Measured Evidence")');
    await expect(evidenceDetails).toBeVisible();
    await evidenceDetails.locator('summary').click();
    await expect(evidenceDetails.locator('text=Rule: target-size').first()).toBeVisible();

    // Verify Accept Candidate applies to editor and re-audits cleanly
    const acceptBtn = candidateOpt1.locator('button:has-text("Accept & Apply to Editor")');
    await acceptBtn.click();

    // Textarea editor should now contain min-h-[44px]
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue(/min-h-\[44px\]/);

    // 5. Verify Export JSON and Markdown buttons exist and link to export endpoints
    const exportJsonLink = page.locator('a:has-text("JSON Report")');
    await expect(exportJsonLink).toBeVisible();
    const jsonHref = await exportJsonLink.getAttribute('href');
    expect(jsonHref).toContain('/api/export?runId=');

    const exportMdLink = page.locator('a:has-text("Markdown Report")');
    await expect(exportMdLink).toBeVisible();
    const mdHref = await exportMdLink.getAttribute('href');
    expect(mdHref).toContain('&format=markdown');
  });

  test('Case 2: Regressed — shows Checks failed and regression evidence when new failure introduced', async ({ page }) => {
    // Intercept /api/sandbox/iterate to deliver a candidate with regressed findings
    await page.route('/api/sandbox/iterate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          candidates: [
            {
              id: 'candidate-regressed',
              name: 'Option Regressed: Breaking Layout',
              badge: 'Regressed Candidate',
              description: 'Fixes baseline target size but introduces low contrast regression.',
              code: '<button class="min-h-[44px] text-gray-300">Regressed</button>',
              verified: false,
              verificationStatus: 'failed',
              verificationErrors: [],
              measurements: [
                {
                  ruleId: 'target-size',
                  selector: 'button.btn',
                  viewport: { width: 1440, height: 900 },
                  before: { width: 18, height: 18 },
                  after: { width: 44, height: 44 },
                  expected: { minWidth: 24, minHeight: 24 },
                  status: 'pass',
                },
              ],
              regression: {
                status: 'regressed',
                scope: 'Automated rules compared across identical selector and viewport occurrences.',
                counts: { resolved: 1, persistent: 0, new: 1, unverified: 0 },
                findings: [
                  {
                    key: 'text-contrast::button::1440',
                    change: 'new',
                    reason: 'Issue was absent in the baseline but failed in this candidate.',
                    before: undefined,
                    after: {
                      id: 'new-issue-1',
                      ruleId: 'text-contrast',
                      wcagCriterion: '1.4.3',
                      status: 'candidateFail',
                      title: 'New low contrast text',
                      description: 'Text contrast fell below 4.5:1',
                      url: 'http://localhost:3123',
                      viewport: { width: 1440, height: 900 },
                      selector: 'button.min-h-\\[44px\\]',
                      element: 'button',
                      measured: { contrastRatio: 2.1 },
                      expected: { minRatio: 4.5 },
                      initialPriority: 'P2',
                      priorityRationale: 'Heuristic',
                    },
                  },
                ],
              },
              checks: [
                { id: 'reg', label: 'Regression check', passed: false, deltaText: '1 resolved; 1 new failure' },
              ],
              metrics: {
                targetSize: { before: '18 × 18 CSS px', after: '44 × 44 CSS px', passed: true },
                contrast: { before: '4.8:1', after: '2.1:1', passed: false },
              },
              summary: { passCount: 1, candidateFailCount: 1, needsReviewCount: 0 },
            },
          ],
        }),
      });
    });

    await page.goto('/sandbox');
    await expect(page.locator('text=Failures').first()).toBeVisible({ timeout: 20000 });

    const iterateBtn = page.locator('button:has-text("Auto-Iterate")');
    await iterateBtn.click();

    // Should render Option Regressed with "Checks failed" badge (NOT Selected checks passed!)
    const candCard = page.locator('[data-testid="candidate-card-candidate-regressed"]');
    await expect(candCard).toBeVisible();
    await expect(candCard.locator('span[title="Checks failed"]')).toBeVisible();
    await expect(candCard.locator('span[title^="Verified for selected automated checks"]')).not.toBeVisible();

    // Regression details should be available and show regressed
    const regressionSummary = candCard.locator('summary:has-text("Regression evidence: regressed")');
    await expect(regressionSummary).toBeVisible();
    await regressionSummary.click();
    await expect(candCard.locator('strong:has-text("new: text-contrast")')).toBeVisible();

    // Scorecard footer should display Checks failed
    const scorecardStatus = page.locator('[data-testid="remediation-status-value"]');
    await expect(scorecardStatus).toHaveText('Checks failed');
  });

  test('Case 3: Unable to verify — browser audit failure or empty output raises clear error callout', async ({ page }) => {
    await page.route('/api/sandbox/iterate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          candidates: [
            {
              id: 'candidate-error',
              name: 'Option Error: Audit Timed Out',
              badge: 'Unverified Candidate',
              description: 'Re-audit failed in isolated browser environment.',
              code: '<button>Error</button>',
              verified: false,
              verificationStatus: 'unable_to_verify',
              verificationErrors: [
                'Re-audit failed. Retry the audit before relying on this candidate.',
                'Re-audit returned no measurements.',
              ],
              measurements: [],
              regression: {
                status: 'unable_to_verify',
                scope: 'Automated rules compared across identical selector and viewport occurrences.',
                counts: { resolved: 0, persistent: 0, new: 0, unverified: 1 },
                findings: [],
              },
              checks: [
                { id: 'audit-check', label: 'Selected automated checks', passed: false, deltaText: 'Re-audit failed.' },
              ],
              metrics: {
                targetSize: { before: '20 × 20 CSS px', after: 'Unable to verify', passed: false },
                contrast: { before: '3.67:1', after: 'Unable to verify', passed: false },
              },
              summary: { passCount: 0, candidateFailCount: 0, needsReviewCount: 0 },
            },
          ],
        }),
      });
    });

    await page.goto('/sandbox');
    await expect(page.locator('text=Failures').first()).toBeVisible({ timeout: 20000 });

    const iterateBtn = page.locator('button:has-text("Auto-Iterate")');
    await iterateBtn.click();

    const candCard = page.locator('[data-testid="candidate-card-candidate-error"]');
    await expect(candCard).toBeVisible();

    // Must show "Unable to verify" badge
    await expect(candCard.locator('span[title^="Unable to verify"]')).toBeVisible();
    await expect(candCard.locator('span[title^="Verified for selected automated checks"]')).not.toBeVisible();

    // Must show explicit verification warning callout
    await expect(candCard.locator('text=ตรวจสอบไม่ได้ / Verification Incomplete:')).toBeVisible();
    await expect(candCard.locator('li:has-text("Re-audit failed. Retry the audit before relying on this candidate.")')).toBeVisible();

    // Scorecard footer should display "Unable to verify"
    const scorecardStatus = page.locator('[data-testid="remediation-status-value"]');
    await expect(scorecardStatus).toHaveText('Unable to verify');
  });

  test('Case 4: Element missing — when baseline element is removed or selector changed, never claim verified', async ({ page }) => {
    await page.route('/api/sandbox/iterate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          candidates: [
            {
              id: 'candidate-missing-el',
              name: 'Option Deleted: Element Disappeared',
              badge: 'Missing Element',
              description: 'Target button was completely deleted from component HTML.',
              code: '<div>No button here</div>',
              verified: false,
              verificationStatus: 'unable_to_verify',
              verificationErrors: [
                'Some baseline elements or viewports were not found in the re-audit.',
              ],
              measurements: [
                {
                  ruleId: 'target-size',
                  selector: 'button.btn-deleted',
                  viewport: { width: 1440, height: 900 },
                  before: { width: 16, height: 16 },
                  after: undefined,
                  expected: { minWidth: 24, minHeight: 24 },
                  status: 'unable_to_verify',
                },
              ],
              regression: {
                status: 'unable_to_verify',
                scope: 'Automated rules compared across identical selector and viewport occurrences.',
                counts: { resolved: 0, persistent: 0, new: 0, unverified: 1 },
                findings: [],
              },
              checks: [
                { id: 'target-check', label: 'Measured target-size checks', passed: false, deltaText: 'Target size: Unable to verify' },
              ],
              metrics: {
                targetSize: { before: '16 × 16 CSS px', after: 'Unable to verify', passed: false },
                contrast: { before: '2.4:1', after: 'Unable to verify', passed: false },
              },
              summary: { passCount: 0, candidateFailCount: 0, needsReviewCount: 0 },
            },
          ],
        }),
      });
    });

    await page.goto('/sandbox');
    await expect(page.locator('text=Failures').first()).toBeVisible({ timeout: 20000 });

    const iterateBtn = page.locator('button:has-text("Auto-Iterate")');
    await iterateBtn.click();

    const candCard = page.locator('[data-testid="candidate-card-candidate-missing-el"]');
    await expect(candCard).toBeVisible();

    // Must show Unable to verify, NOT verified
    await expect(candCard.locator('span[title^="Unable to verify"]')).toBeVisible();
    await expect(candCard.locator('span[title^="Verified for selected automated checks"]')).not.toBeVisible();

    // Must display error explanation
    await expect(candCard.locator('li:has-text("Some baseline elements or viewports were not found in the re-audit.")')).toBeVisible();

    // Measured evidence should indicate Unable to verify for the missing element
    const evidenceDetails = candCard.locator('details:has-text("Measured Evidence")');
    await evidenceDetails.locator('summary').click();
    await expect(evidenceDetails.locator('text=⚠️ Unable to verify')).toBeVisible();
  });
});
