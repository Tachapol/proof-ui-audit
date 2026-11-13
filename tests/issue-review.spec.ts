import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeUiAuditRun } from './ui-fixtures';

test('issue review persists four dispositions and exports evidence without changing measurements', async ({ page, request }) => {
  const run = makeUiAuditRun({ id: `e2e-issue-review-${Date.now()}` });
  const file = path.resolve('.proofui-data/runs', `${run.id}.json`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(run));
  try {
    await page.goto(`/?runId=${run.id}`);
    const form = page.getByRole('form', { name: 'Issue review', exact: true });
    await expect(form).toBeVisible();
    const save = form.getByRole('button', { name: 'Save issue review', exact: true });
    await expect(save).toBeDisabled();
    await form.getByLabel('Reviewer / risk approver (self-reported)').fill('E2E design reviewer');
    await form.getByLabel('Review rationale').fill('Reviewed evidence and documented decision');
    for (const [value, label] of [
      ['confirmed_issue', 'Confirmed Issue'], ['false_positive', 'False Positive'],
      ['needs_review', 'Needs Review'], ['accepted_risk', 'Accepted Risk'],
    ]) {
      await form.getByLabel('Review status', { exact: true }).selectOption(value);
      await save.click();
      await expect(form.getByRole('status')).toHaveText('Issue review saved.');
      await expect(form.getByText(`Current review: ${label}`, { exact: true })).toBeVisible();
    }
    await page.reload();
    await expect(form.getByText('Current review: Accepted Risk', { exact: true })).toBeVisible();
    await expect(form.getByLabel('Reviewer / risk approver (self-reported)')).toHaveValue('E2E design reviewer');
    const jsonResponse = await request.get(`/api/export?runId=${run.id}&format=json`);
    expect(jsonResponse.ok()).toBe(true);
    const report = await jsonResponse.json();
    expect(report.groupedIssues[0]).toMatchObject({ reviewDisposition: 'accepted_risk', reviewer: 'E2E design reviewer', status: 'candidateFail' });
    expect(report.groupedIssues[0].measured).toEqual(run.groupedIssues[0].representative.measured);
    expect(report.groupedIssues[0].decisionHistory.map((event: { newDisposition: string }) => event.newDisposition)).toEqual(['confirmed_issue', 'false_positive', 'needs_review', 'accepted_risk']);
    const markdown = await request.get(`/api/export?runId=${run.id}&format=markdown`);
    expect(await markdown.text()).toContain('**Review Status**: accepted_risk');
    await page.getByRole('button', { name: /Decision Audit Log/ }).click();
    await expect(page.getByText('Reviewer (self-reported): E2E design reviewer').first()).toBeVisible();
    // A failed save must retain the current saved state and the editable draft.
    await page.route('**/api/decisions', route => route.fulfill({ status: 500, json: { success: false, error: 'Controlled save failure' } }));
    await form.getByLabel('Review status', { exact: true }).selectOption('needs_review');
    await form.getByLabel('Review rationale').fill('Unsaved review rationale');
    await save.click();
    await expect(form.getByRole('alert')).toHaveText('Controlled save failure');
    await expect(form.getByLabel('Review rationale')).toHaveValue('Unsaved review rationale');
    await expect(form.getByText('Current review: Accepted Risk', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await fs.unlink(file).catch(() => undefined);
  }
});
