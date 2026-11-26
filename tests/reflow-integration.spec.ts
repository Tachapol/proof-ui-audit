import { test, expect } from '@playwright/test';
import { extractReflowMeasurement } from '../src/lib/audit/reflow-extraction';
import { evaluateReflow } from '../src/lib/audit/rules/reflow';

const viewport = { width: 320, height: 640 };
test.use({ viewport });

test('Chromium extracts clean and rigid layouts from fixture UI, excluding fixture chrome', async ({ page }) => {
  for (const [fixture, status] of [['reflow-pass', 'pass'], ['reflow-fail', 'candidateFail'], ['pilot-ui-05', 'candidateFail'], ['pilot-ui-06', 'pass']] as const) {
    await page.goto(`/fixtures/${fixture}`);
    const measurement = await page.evaluate(extractReflowMeasurement, { viewport });
    const issues = evaluateReflow(measurement, page.url());
    expect(measurement.scopeSelector).toBe('#fixture-content');
    expect(issues.some(issue => issue.status === status)).toBe(true);
    if (status === 'pass') expect(issues.every(issue => issue.status === 'pass')).toBe(true);
    expect(issues.every(issue => issue.measured.metricVersion === '1.1.0' && issue.measured.unit === 'CSS px')).toBe(true);
  }
});

test('Chromium detects nested scrolling, ancestor clipping and off-screen controls', async ({ page }) => {
  await page.goto('/fixtures/reflow-nested-fail');
  const measurement = await page.evaluate(extractReflowMeasurement, { viewport });
  expect(measurement.nestedScrollContainers?.some(item => item.selector === '#nested-scroll-container' && item.overflowPx > 1)).toBe(true);
  expect(measurement.ancestorClippedElements?.some(item => item.selector === '#clipped-child-content' && item.ancestorSelector === '#ancestor-clip-box')).toBe(true);
  expect(evaluateReflow(measurement, page.url()).filter(issue => issue.status === 'candidateFail').length).toBeGreaterThanOrEqual(2);
  await page.goto('/fixtures/reflow-controls-fail');
  const controls = await page.evaluate(extractReflowMeasurement, { viewport });
  expect(controls.clippedControls?.some(item => item.selector === '#offscreen-submit-btn')).toBe(true);
});

test('Chromium keeps essential 2D candidates as review and excludes contained decoration', async ({ page }) => {
  for (const fixture of ['reflow-review', 'pilot-ui-12']) {
    await page.goto(`/fixtures/${fixture}`);
    const issues = evaluateReflow(await page.evaluate(extractReflowMeasurement, { viewport }), page.url());
    expect(issues.some(issue => issue.status === 'needsReview' && issue.measured.isEssential2D)).toBe(true);
    expect(issues.some(issue => issue.status === 'candidateFail')).toBe(false);
  }
  await page.goto('/fixtures/reflow-decorative-pass');
  const measurement = await page.evaluate(extractReflowMeasurement, { viewport });
  expect(measurement.decorativeElementsExcludedCount).toBeGreaterThan(0);
  expect(evaluateReflow(measurement, page.url()).every(issue => issue.status === 'pass')).toBe(true);
});

test('Reflow scope errors never become clean passes and fixture header overflow is outside scope', async ({ page }) => {
  await page.setContent('<header style="width:900px">Fixture chrome</header><main id="fixture-content"><p>Fluid UI</p></main>');
  const measurement = await page.evaluate(extractReflowMeasurement, { viewport });
  expect(measurement.rawDocumentScrollWidth).toBeGreaterThan(320);
  expect(evaluateReflow(measurement, page.url()).every(issue => issue.status === 'pass')).toBe(true);
  await expect(page.evaluate(extractReflowMeasurement, { viewport, selector: '#missing' })).rejects.toThrow('exactly one');
});

test('Audit API measures Reflow at 320px and persists it through evidence UI and exports', async ({ page, request }) => {
  test.setTimeout(180000);
  const response = await request.post('/api/audit', { data: { target: 'fixture://pilot-ui-05' } });
  expect(response.ok(), await response.text()).toBe(true);
  const { run } = await response.json();
  expect(run.viewports.map((value: { width: number }) => value.width)).toEqual([1440, 375, 320]);
  const reflow = run.rawIssues.filter((issue: { ruleId: string }) => issue.ruleId === 'reflow');
  expect(reflow.length).toBeGreaterThan(0);
  expect(reflow.every((issue: { viewport: { width: number } }) => issue.viewport.width === 320)).toBe(true);
  expect(reflow.some((issue: { status: string }) => issue.status === 'candidateFail')).toBe(true);
  const exported = await (await request.get(`/api/export?runId=${run.id}&format=json`)).json();
  expect(exported.groupedIssues.some((issue: { ruleId: string; measured: { scopeSelector: string } }) => issue.ruleId === 'reflow' && issue.measured.scopeSelector === '#fixture-content')).toBe(true);
  const markdown = await (await request.get(`/api/export?runId=${run.id}&format=markdown`)).text();
  expect(markdown).toContain('rawHorizontalOverflowPx');
  await page.goto(`/?runId=${run.id}`);
  await expect(page.getByRole('heading', { name: /Unintended horizontal overflow at 320px/ })).toBeVisible();
});

test('Pilot text-spacing cases emit actual baseline and override measurements', async ({ request }) => {
  test.setTimeout(180000);
  for (const number of ['07', '08']) {
    const response = await request.post('/api/audit', { data: { target: `fixture://pilot-ui-${number}` } });
    expect(response.ok(), await response.text()).toBe(true);
    const { run } = await response.json();
    const spacing = run.rawIssues.filter((issue: { ruleId: string; selector: string }) => issue.ruleId === 'text-spacing' && issue.selector === '#delivery-details');
    expect(spacing).toHaveLength(3);
    expect(spacing.every((issue: { measured: Record<string, unknown> }) => typeof issue.measured.baselineHeight === 'number' && typeof issue.measured.candidateHeight === 'number')).toBe(true);
  }
});
