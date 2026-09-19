import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PROOFUI_BASE_URL || 'http://localhost:3123';
const outputDir = path.resolve('artifacts/phase-7/final');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();

await page.goto(baseUrl);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(outputDir, 'empty-state-1440.png'), fullPage: false });

await page.selectOption('#fixture-select', 'target-size-demo');
await page.click('#run-audit-button');
await page.getByText('Audit Result Summary').waitFor({ timeout: 60_000 });

for (const width of [320, 375, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: width < 600 ? 812 : 1000 });
  await page.waitForTimeout(100);
  await page.locator('#audit-results').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outputDir, `completed-${width}.png`), fullPage: false });
}

await page.setViewportSize({ width: 320, height: 812 });
const firstIssue = page.locator('article').filter({
  has: page.getByRole('heading', { name: /^Interactive target below 24×24 CSS px/ }),
}).first();
await firstIssue.evaluate((element) => { element.scrollIntoView({ block: 'start' }); });
await page.screenshot({ path: path.join(outputDir, 'issue-card-320.png'), fullPage: false });

await page.setViewportSize({ width: 1440, height: 1000 });
await firstIssue.locator('button[id^="launch-iteration-btn-"]').click();
await firstIssue.getByText('Result: [IMPROVED]').waitFor({ timeout: 60_000 });
const comparison = firstIssue.locator('.iteration-proof-slot > div');
await comparison.scrollIntoViewIfNeeded();
await comparison.locator('img').last().waitFor();
await page.waitForFunction(() => Array.from(document.querySelectorAll('.iteration-proof-slot img')).every((image) => image.complete && image.naturalWidth > 0));
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
await comparison.screenshot({ path: path.join(outputDir, 'comparison-desktop-1440.png') });

// The stacked comparison is taller than a typical mobile viewport. Use a tall
// mobile-width canvas so Playwright does not stitch a locator screenshot under
// the sticky application bar, which would obscure the section heading.
await page.setViewportSize({ width: 375, height: 1280 });
await comparison.scrollIntoViewIfNeeded();
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
await comparison.screenshot({ path: path.join(outputDir, 'comparison-mobile-375.png') });

const statePage = await context.newPage();
await statePage.goto(baseUrl);
await statePage.route('**/api/audit', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Visual capture delay completed.' }) });
});
await statePage.setViewportSize({ width: 1024, height: 760 });
await statePage.click('#run-audit-button');
await statePage.getByTestId('state-loading').waitFor();
await statePage.screenshot({ path: path.join(outputDir, 'audit-progress-1024.png'), fullPage: false });
await statePage.close();

const errorPage = await context.newPage();
await errorPage.setViewportSize({ width: 375, height: 812 });
await errorPage.goto(baseUrl);
await errorPage.getByRole('tab', { name: 'Public URL' }).click();
await errorPage.locator('#custom-url-input').fill('http://127.0.0.1/private');
await errorPage.locator('#run-audit-button').click();
await errorPage.locator('#audit-target-error').waitFor();
await errorPage.screenshot({ path: path.join(outputDir, 'error-state-375.png'), fullPage: false });

await browser.close();
console.log(outputDir);
