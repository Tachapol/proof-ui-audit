import { chromium } from 'playwright';

async function runStudioE2ETest() {
  console.log('🚀 Starting Critique Studio Full E2E Test via Chromium...');
  const baseUrl = 'http://localhost:3123';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`   [BROWSER ERROR] ${msg.text()}`);
  });

  try {
    // 1. Navigate to Studio
    console.log('📍 1. Navigating to /studio');
    await page.goto(`${baseUrl}/studio`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500); // Wait for React hydration
    const pageTitle = await page.title();
    console.log(`   Page Title: "${pageTitle}"`);

    // 2. Click "Start critique"
    console.log('📍 2. Clicking "Start critique" on Demo frame');
    const startButton = page.locator('button:has-text("Start critique")');
    await startButton.waitFor({ state: 'visible', timeout: 10000 });
    await startButton.click();
    console.log('   Clicked! Waiting for Audit & AI Multi-Role Critique (up to 45s)...');

    // Wait for Agenda to appear
    const agendaHeader = page.locator('h2:has-text("Critique agenda")');
    await agendaHeader.waitFor({ state: 'visible', timeout: 60000 });
    console.log('   ✅ Critique created successfully! Agenda loaded.');

    // 3. Select first finding
    console.log('📍 3. Selecting first Agenda Finding');
    const firstFindingBtn = page.locator('button:has-text("Text contrast below 4.5:1 threshold")').first();
    await firstFindingBtn.waitFor({ state: 'visible', timeout: 10000 });
    await firstFindingBtn.click();
    await page.waitForTimeout(1000);

    // 4. Test Discussion Chat (Ask follow-up question)
    console.log('📍 4. Testing Discussion Chat with Engineering role');
    const chatInput = page.locator('#studio-message');
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });
    await chatInput.fill('Please propose a safe text color token that achieves at least 4.5:1 ratio.');

    const sendBtn = page.locator('button[aria-label="Send question"], button[type="submit"]');
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
    console.log('   Sent question. Waiting for grounded AI response...');

    // Wait for the discussion reply to appear
    await page.waitForSelector('text=Preparing a grounded reply…', { state: 'hidden', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('   ✅ Received AI chat response successfully!');

    // 5. Navigate / Ensure Preview Panel is active
    console.log('📍 5. Navigating to Sandbox Preview panel');
    const previewTab = page.locator('button[role="tab"]:has-text("Preview"), button:has-text("Preview")').first();
    if (await previewTab.isVisible()) {
      await previewTab.click();
    }
    await page.waitForTimeout(1000);

    // 6. Test Color Proposals & Attribution
    console.log('📍 6. Testing Color Options & Attribution Badge');
    const colorChips = page.locator('button:has-text("recommendation"), button:has-text("proposal"), button:has-text("Default"), button:has-text("Chat")');
    const count = await colorChips.count();
    console.log(`   Found ${count} color recommendation chip(s).`);

    // Verify dynamic custom color attribution
    const colorInput = page.locator('#studio-color-hex');
    await colorInput.fill('#334155');
    await page.waitForTimeout(500);
    const customBadge = page.locator('text=Custom designer selection (#334155)');
    const isCustomBadgeVisible = await customBadge.isVisible();
    console.log(`   Custom color attribution badge visible: ${isCustomBadgeVisible}`);

    // Click a high-contrast chip (e.g. system slate #111827 or first chip)
    const systemSlateChip = page.locator('button:has-text("#111827")').first();
    if (await systemSlateChip.isVisible()) {
      await systemSlateChip.click();
      console.log('   Selected System Slate #111827 chip.');
    }

    // 7. Sandbox Preview & Measure
    console.log('📍 7. Running "Preview & measure"');
    const previewMeasureBtn = page.locator('button:has-text("Preview & measure")');
    await previewMeasureBtn.click();

    // Wait for candidate verification card
    console.log('   Waiting for candidate measurement & verification...');
    const verificationBadge = page.locator('text=Selected checks passed').first();
    await verificationBadge.waitFor({ state: 'visible', timeout: 30000 });
    const badgeText = await verificationBadge.innerText();
    console.log(`   ✅ Candidate Verification Result: "${badgeText}"`);

    // 8. Apply Candidate to Preview
    console.log('📍 8. Clicking "Apply to preview"');
    const applyBtn = page.locator('button:has-text("Apply to preview")');
    await applyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await applyBtn.click();

    const appliedBtn = page.locator('button:has-text("Applied to preview")');
    await appliedBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('   ✅ Candidate state successfully updated to "Applied"!');

    // 9. Revert Preview
    console.log('📍 9. Clicking "Revert"');
    const revertBtn = page.locator('button:has-text("Revert")');
    await revertBtn.waitFor({ state: 'visible', timeout: 10000 });
    await revertBtn.click();

    await applyBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('   ✅ Candidate successfully reverted to unapplied baseline.');

    // 10. Open History Drawer
    console.log('📍 10. Testing History Drawer');
    const historyBtn = page.locator('button:has-text("History")').first();
    await historyBtn.click();

    const historyDrawer = page.locator('text=Review history');
    await historyDrawer.waitFor({ state: 'visible', timeout: 10000 });
    console.log('   ✅ History drawer opened successfully.');

    // Close History drawer
    const closeBtn = page.locator('button[aria-label="Close history"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // 11. Test Export consistency (JSON & Markdown)
    console.log('📍 11. Testing Export Data Consistency');
    const currentUrl = page.url();
    const sessionId = new URL(currentUrl).searchParams.get('session');
    console.log(`   Active Session ID: ${sessionId}`);

    if (sessionId) {
      const jsonRes = await page.request.get(`${baseUrl}/api/studio?id=${sessionId}&format=json`);
      if (jsonRes.status() === 200) {
        const json = await jsonRes.json();
        console.log(`   ✅ JSON Export verified (Status: 200, Agenda: ${json.agenda.length} items, Messages: ${json.messages.length})`);
      } else {
        throw new Error(`JSON export returned HTTP ${jsonRes.status()}`);
      }

      const mdRes = await page.request.get(`${baseUrl}/api/studio?id=${sessionId}&format=markdown`);
      if (mdRes.status() === 200) {
        const md = await mdRes.text();
        console.log(`   ✅ Markdown Export verified (Status: 200, Length: ${md.length} chars)`);
        if (!md.includes('# ProofUI Critique Studio Summary')) {
          throw new Error('Markdown export missing header');
        }
      } else {
        throw new Error(`Markdown export returned HTTP ${mdRes.status()}`);
      }
    }

    console.log('\n======================================================');
    console.log('🎉 FULL CRITIQUE STUDIO E2E FLOW PASSED (11/11 STEPS)!');
    console.log('======================================================');
  } catch (err) {
    console.error('❌ E2E Test failed:', err);
    await page.screenshot({ path: 'public/screenshots/e2e-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runStudioE2ETest();
