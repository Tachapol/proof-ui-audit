import { test, expect } from '@playwright/test';
import { extractPilotFromPage } from '../src/lib/audit/pilot-browser';
import { evaluateTouchTargetSpacing, evaluateHeadingHierarchy } from '../src/lib/audit/pilot-metrics';
import { runBrowserAudit } from '../src/lib/audit/browser';
import type { PilotMetricResult } from '../src/lib/schema/pilot-metric';
import { makeUiAuditRun } from './ui-fixtures';

const viewport = { width: 375, height: 812 };
test.use({ viewport });

test('UI-01 Pilot summaries read as findings and disclose viewport measurements on demand', async ({ page }) => {
  const metrics: PilotMetricResult[] = [];
  await page.goto('/fixtures/pilot-ui-01', { waitUntil: 'domcontentloaded' });
  for (const size of [{ width: 320, height: 640 }, viewport, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const snapshot = await extractPilotFromPage(page);
    metrics.push(evaluateTouchTargetSpacing(snapshot, page.url(), size).result);
    metrics.push(evaluateHeadingHierarchy(snapshot, page.url(), size).result);
  }
  await page.setViewportSize(viewport);
  await page.route('**/api/audit?*', route => {
    const runId = new URL(route.request().url()).searchParams.get('id');
    const metricResults = runId === 'pilot-partial-summary'
      ? metrics.map((metric, i) => i === 0 ? { ...metric, executionStatus: 'partial', outcome: null, measurements: [] } : metric)
      : metrics;
    return route.fulfill({ json: { success: true, run: makeUiAuditRun({ id: runId, fixtureId: 'pilot-ui-01', metricResults }) } });
  });
  await page.goto('/?runId=pilot-readable-summary', { waitUntil: 'domcontentloaded' });
  const evidence = page.getByRole('region', { name: 'Pilot metric evidence' });
  const spacing = evidence.locator('[data-metric-id="touch-target-spacing"]');
  const heading = evidence.locator('[data-metric-id="heading-hierarchy"]');
  await expect(spacing.getByText(/“Continue” button and “Email address” input sit edge to edge \(0 CSS px gap\) across all 3 tested viewports/)).toBeVisible();
  await expect(heading.getByText('Not assessed', { exact: true })).toBeVisible();
  await expect(spacing.getByRole('heading', { name: '320×640 viewport' })).toBeHidden();
  await spacing.getByText('View details by viewport (3)', { exact: true }).click();
  const section = spacing.locator('section').filter({ has: page.getByRole('heading', { name: '320×640 viewport' }) });
  await expect(section.getByText(/sit edge to edge/)).toHaveCount(1);
  await expect(section.locator('pre')).toBeHidden();
  await section.getByText('Raw metric evidence (3)', { exact: true }).click();
  await expect(section.locator('pre')).toContainText('"distance": 0');

  await page.goto('/?runId=pilot-partial-summary', { waitUntil: 'domcontentloaded' });
  await expect(spacing.getByText(/0 CSS px gap\) in 2 of 3 tested viewports/)).toBeVisible();
  await expect(spacing.getByText('Coverage is limited in 1 of 3 tested viewports.')).toBeVisible();
});

test('Chromium measures boundary, close, contact and overlapping pointer pairs inside the UI only', async ({ page, browser }) => {
  await page.goto('/fixtures/pilot-metrics-spacing');
  const snapshot = await extractPilotFromPage(page);
  const { result, issues } = evaluateTouchTargetSpacing(snapshot, page.url(), viewport);
  expect(result.executionStatus).toBe('completed');
  const row = (selector: string) => result.measurements.find(row => (row.target as { selector: string }).selector === selector)!;
  expect(row('#boundary-a')).toMatchObject({ distance: 8, overlap: false, outcome: 'pass', nearestTarget: { selector: '#boundary-b' } });
  expect(row('#close-a')).toMatchObject({ distance: 7.5, outcome: 'needsReview' });
  expect(row('#overlap-a')).toMatchObject({ distance: 0, overlap: true, overlapArea: 256, outcome: 'needsReview' });
  expect(row('#contact-a')).toMatchObject({ distance: 0, overlap: false });
  expect(issues.every(issue => issue.status !== 'candidateFail')).toBe(true);
  expect(snapshot.targets).toHaveLength(8);
  console.log(`Pilot metrics verified in Chromium ${browser.version()} at ${viewport.width}×${viewport.height}`);
  for (const size of [{ width: 320, height: 640 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const atSize = evaluateTouchTargetSpacing(await extractPilotFromPage(page), page.url(), size).result;
    expect(atSize.executionStatus).toBe('completed');
    expect(atSize.measurements.find(row => (row.target as { selector: string }).selector === '#boundary-a')).toMatchObject({ distance: 8, overlap: false });
    expect(atSize.measurements.find(row => (row.target as { selector: string }).selector === '#overlap-a')).toMatchObject({ distance: 0, overlap: true });
    console.log(`Pilot geometry also verified at ${size.width}×${size.height}`);
  }
});

test('Chromium excludes hidden/disabled/inert/closed-state actions and collapses nested same-action wrappers', async ({ page }) => {
  await page.goto('/fixtures/pilot-metrics-exceptions');
  const snapshot = await extractPilotFromPage(page);
  expect(snapshot.targets.map(target => target.selector).sort()).toEqual(['#nested-action', '#other-action', '#disclosure'].sort());
  const { result } = evaluateTouchTargetSpacing(snapshot, page.url(), viewport);
  expect(result.measurements[0]).toMatchObject({ distance: 16, nearestTarget: { selector: '#other-action' } });
  // Opening the disclosure creates a different measured state; it is not mixed with the closed snapshot.
  await page.locator('#disclosure').click();
  expect((await extractPilotFromPage(page)).targets.map(target => target.selector)).toContain('#closed-action');
});

test('Chromium discovers direct pointer listeners and preserves separate nested actions', async ({ page }) => {
  await page.setContent(`<header><h1>Fixture header</h1><button>Outside action</button></header>
    <main data-audit-scope><div id="parent" role="button" data-audit-action-id="parent" style="width:80px;height:80px">
      <span id="separate" role="button" data-audit-action-id="child" style="display:block;width:32px;height:32px">Separate</span></div>
    <div id="listener" style="width:32px;height:32px">Custom action</div>
    <div id="removed" style="width:32px;height:32px">Removed listener</div></main>`);
  await page.evaluate(() => {
    const action = () => undefined;
    document.querySelector('#listener')!.addEventListener('pointerdown', action);
    document.querySelector('#removed')!.addEventListener('click', action);
    document.querySelector('#removed')!.removeEventListener('click', action);
  });
  const snapshot = await extractPilotFromPage(page);
  expect(snapshot.targets.map(target => target.selector)).toEqual(['#parent', '#separate', '#listener']);
  const { result } = evaluateTouchTargetSpacing(snapshot, page.url(), viewport);
  expect(result.measurements[0]).toMatchObject({ distance: 0, overlap: true, nearestTarget: { selector: '#separate' } });
});

test('Chromium excludes same-action label/control pairs and accepts integer ARIA levels beyond h6', async ({ page }) => {
  await page.setContent(`<main data-audit-scope data-audit-parent-heading-level="6">
    <label id="label" for="input">Email</label><input id="input">
    <label id="nested-label"><input id="nested-input">Choice</label>
    <div role="heading" aria-level="7">Extended level</div>
    <div role="heading" aria-level="8">Next level</div>
    <div role="heading" aria-level="2.5">Invalid fraction</div>
    </main>`);
  const snapshot = await extractPilotFromPage(page);
  expect(snapshot.headings.map(heading => heading.level)).toEqual([7, 8, null]);
  expect(snapshot.targets.map(target => target.selector)).toContain('#nested-label');
  expect(snapshot.targets.map(target => target.selector)).not.toContain('#nested-input');
  const evaluated = evaluateTouchTargetSpacing(snapshot, page.url(), viewport);
  expect(evaluated.result.measurements.find(row => (row.target as { selector: string }).selector === '#label')!.nearestTarget).not.toMatchObject({ selector: '#input' });
});

test('Chromium reads headings in DOM order despite CSS order and does not import the fixture h1', async ({ page }) => {
  await page.goto('/fixtures/pilot-metrics-heading');
  const snapshot = await extractPilotFromPage(page);
  expect(snapshot.headings.map(heading => heading.level)).toEqual([2, 4, 2, 3, 3]);
  expect(snapshot.headings[0].selector).toBe('#heading-start');
  const { result, issues } = evaluateHeadingHierarchy(snapshot, page.url(), viewport);
  expect(result.executionStatus).toBe('completed');
  expect(result.measurements[0]).toMatchObject({ previousHeading: null, outcome: null });
  expect(issues.filter(issue => issue.status === 'needsReview').map(issue => issue.selector)).toEqual(['#heading-skip']);
});

test('Chromium supports component parent context and preserves invalid or missing ARIA levels as partial', async ({ page }) => {
  await page.goto('/fixtures/pilot-metrics-context');
  const snapshot = await extractPilotFromPage(page);
  expect(evaluateHeadingHierarchy(snapshot, page.url(), viewport).result).toMatchObject({ parentHeadingLevel: 2, outcome: 'pass' });
  const overridden = await extractPilotFromPage(page, { selector: '#fixture-content', parentHeadingLevel: 1 });
  expect(evaluateHeadingHierarchy(overridden, page.url(), viewport).issues[0].status).toBe('needsReview');
  await page.goto('/fixtures/pilot-metrics-invalid');
  const invalid = await extractPilotFromPage(page);
  expect(invalid.headings.map(heading => heading.level)).toEqual([2, null, null, null, 4, 2]);
  const evaluated = evaluateHeadingHierarchy(invalid, page.url(), viewport);
  expect(evaluated.result).toMatchObject({ executionStatus: 'partial', outcome: null });
  expect(evaluated.issues.some(issue => issue.status === 'needsReview')).toBe(false);
  await page.setContent('<div id="sandbox-root"><section data-audit-scope data-audit-parent-heading-level="2"><h3>Component</h3></section></div>');
  const component = await extractPilotFromPage(page);
  expect(component.scopeSelector).toBe('[data-audit-scope]');
  expect(evaluateHeadingHierarchy(component, page.url(), viewport).result).toMatchObject({ outcome: 'pass', rawParentHeadingLevel: '2' });
  await page.locator('[data-audit-scope]').evaluate(el => el.setAttribute('data-audit-parent-heading-level', 'unknown'));
  const unknown = await extractPilotFromPage(page);
  expect(evaluateHeadingHierarchy(unknown, page.url(), viewport).result).toMatchObject({ executionStatus: 'partial', rawParentHeadingLevel: 'unknown', outcome: null });
});

test('Chromium retains null for a single target and distinguishes missing, ambiguous and invalid scopes', async ({ page }) => {
  await page.goto('/fixtures/pilot-metrics-single');
  const snapshot = await extractPilotFromPage(page);
  expect(evaluateTouchTargetSpacing(snapshot, page.url(), viewport).result).toMatchObject({
    executionStatus: 'skipped', applicability: 'not_applicable', outcome: null,
    measurements: [{ distance: null, nearestTarget: null, overlap: null }],
  });
  await page.goto('/fixtures/pilot-metrics-empty');
  const empty = await extractPilotFromPage(page);
  expect(evaluateHeadingHierarchy(empty, page.url(), viewport).result.applicability).toBe('not_applicable');
  await page.setContent('<main>No designated UI root</main>');
  const missing = await extractPilotFromPage(page);
  expect(evaluateTouchTargetSpacing(missing, page.url(), viewport).result).toMatchObject({ executionStatus: 'skipped', applicability: 'unknown', outcome: null });
  expect((await extractPilotFromPage(page, { selector: '[' })).scopeError).toContain('Invalid');
  await page.setContent('<section data-audit-scope>A</section><section data-audit-scope>B</section>');
  const ambiguous = await extractPilotFromPage(page);
  expect(evaluateHeadingHierarchy(ambiguous, page.url(), viewport).result.executionStatus).toBe('error');
});

test('Chromium exposes incomplete pointer discovery without treating it as a pass', async ({ page }) => {
  await page.setContent(`<main data-audit-scope><button>A</button><button>B</button>${'<span>x</span>'.repeat(1001)}</main>`);
  const snapshot = await extractPilotFromPage(page);
  expect(evaluateTouchTargetSpacing(snapshot, page.url(), viewport).result.executionStatus).toBe('partial');
});

test('browser navigation errors preserve metric error states and invalid API scope is rejected', async ({ request }) => {
  const audit = await runBrowserAudit({ url: 'http://localhost:3123/fixtures/missing-pilot-fixture', localOrigin: 'http://localhost:3123', captureScreenshots: false, viewports: [viewport] });
  expect(audit.errors.length).toBeGreaterThan(0);
  expect(audit.metricResults).toHaveLength(2);
  expect(audit.metricResults.every(metric => metric.executionStatus === 'error' && metric.applicability === 'unknown' && metric.outcome === null)).toBe(true);
  const invalid = await request.post('/api/audit', { data: { target: 'fixture://pilot-metrics-context', pilotScope: { selector: '#fixture-content', parentHeadingLevel: 0 } } });
  expect(invalid.status()).toBe(400);
});

test('API audit → grouping → saved evidence UI → JSON/Markdown keeps advisory metadata', async ({ page, request }) => {
  test.setTimeout(180000);
  const response = await request.post('/api/audit', { data: { target: 'fixture://pilot-metrics-heading', autoDetectContext: false } });
  expect(response.ok(), await response.text()).toBe(true);
  const { run } = await response.json();
  const results = run.metricResults.filter((metric: { metricId: string }) => metric.metricId === 'heading-hierarchy');
  expect(results).toHaveLength(3);
  expect(results.every((metric: { outcome: string; executionStatus: string }) => metric.outcome === 'needsReview' && metric.executionStatus === 'completed')).toBe(true);
  const group = run.groupedIssues.find((issue: { representative: { selector: string; ruleId: string } }) => issue.representative.ruleId === 'heading-hierarchy' && issue.representative.selector === '#heading-skip');
  expect(group.status).toBe('needsReview');
  expect(group.occurrences).toHaveLength(3);
  await page.goto(`/?runId=${run.id}`);
  const evidence = page.getByRole('region', { name: 'Pilot metric evidence' });
  await expect(evidence).toBeVisible();
  const heading = evidence.locator('[data-metric-id="heading-hierarchy"]');
  await expect(heading.getByText(/follows H2 at H4, skipping a level across all 3 tested viewports/)).toBeVisible();
  await heading.getByText('View details by viewport (3)', { exact: true }).click();
  await expect(heading.getByText('Completed', { exact: true }).first()).toBeVisible();
  const json = await (await request.get(`/api/export?runId=${run.id}&format=json`)).json();
  expect(json.audit.metricResults).toEqual(run.metricResults);
  const exported = json.groupedIssues.find((issue: { ruleId: string; selector: string }) => issue.ruleId === 'heading-hierarchy' && issue.selector === '#heading-skip');
  expect(exported.metric).toMatchObject({ metricVersion: '1.0.0', unit: 'heading level', basis: 'project-advisory' });
  expect(exported.measured).toMatchObject({ level: 4, previousHeading: { level: 2 }, domIndex: 1 });
  const markdown = await (await request.get(`/api/export?runId=${run.id}&format=markdown`)).text();
  expect(markdown).toContain('## Pilot Metric Evidence');
  expect(markdown).toContain('"previousHeading"');
  expect(markdown).toContain('no automatic WCAG failure');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('API spacing audit preserves nearest target pairs independently of the Target Size spacing alternative', async ({ page, request }) => {
  test.setTimeout(180000);
  const response = await request.post('/api/audit', { data: { target: 'fixture://pilot-metrics-spacing' } });
  expect(response.ok(), await response.text()).toBe(true);
  const { run } = await response.json();
  const spacing = run.metricResults.filter((metric: { metricId: string }) => metric.metricId === 'touch-target-spacing');
  expect(spacing).toHaveLength(3);
  expect(spacing[0]).toMatchObject({ executionStatus: 'completed', outcome: 'needsReview', unit: 'CSS px', metricVersion: '1.0.0' });
  expect(spacing[0].measurements.find((row: { target: { selector: string } }) => row.target.selector === '#boundary-a')).toMatchObject({ distance: 8, overlap: false, nearestTarget: { selector: '#boundary-b' } });
  const metricIssues = run.rawIssues.filter((issue: { ruleId: string }) => issue.ruleId === 'touch-target-spacing');
  expect(metricIssues.length).toBeGreaterThan(0);
  expect(metricIssues.every((issue: { status: string }) => issue.status !== 'candidateFail')).toBe(true);
  const sizeIssue = run.rawIssues.find((issue: { ruleId: string; selector: string }) => issue.ruleId === 'target-size' && issue.selector === '#close-a');
  expect(sizeIssue.measured.width).toBe(32);
  expect(sizeIssue.measured).not.toHaveProperty('advisoryMinGap');
  const json = await (await request.get(`/api/export?runId=${run.id}&format=json`)).json();
  expect(json.audit.metricResults).toEqual(run.metricResults);
  const markdown = await (await request.get(`/api/export?runId=${run.id}&format=markdown`)).text();
  expect(markdown).toContain('"overlapArea": 256');
  await page.goto(`/?runId=${run.id}`);
  const evidence = page.getByRole('region', { name: 'Pilot metric evidence' }).locator('[data-metric-id="touch-target-spacing"]').first();
  await expect(evidence.getByText(/overlap \(0 CSS px edge gap\) across all 3 tested viewports/)).toBeVisible();
  await evidence.getByText('View details by viewport (3)', { exact: true }).click();
  const viewportEvidence = evidence.locator('section').filter({ has: page.getByRole('heading', { name: '320×640 viewport' }) });
  await expect(viewportEvidence.locator('pre')).toBeHidden();
  await viewportEvidence.getByText('Raw metric evidence (8)', { exact: true }).click();
  await expect(viewportEvidence.locator('pre')).toContainText('"distance": 8');
});
