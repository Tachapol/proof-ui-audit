import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import { TargetMeasurement, evaluateTargetSize, checkSpacingAlternative } from './rules/target-size';
import { TextContrastMeasurement, evaluateTextContrast } from './rules/text-contrast';
import { NonTextContrastMeasurement, evaluateNonTextContrast } from './rules/non-text-contrast';
import { evaluateReflow } from './rules/reflow';
import { evaluateTextSpacing } from './rules/text-spacing';
import { compositeLayers, blendColors, applyElementOpacity, parseColor } from './color-math';
import { isPrivateOrReservedIP } from './url-validator';
import { UXIssue, Viewport } from '@/lib/schema/ux-issue';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'public/screenshots');

export interface AuditOptions {
  url: string;
  viewports?: Viewport[];
  timeoutMs?: number;
  captureScreenshots?: boolean;
}

export const DEFAULT_AUDIT_VIEWPORTS: Viewport[] = [
  { width: 375, height: 667 },   // Mobile
  { width: 1440, height: 900 },  // Desktop
  { width: 320, height: 667 },   // Reflow & Small Viewport (Item A.4)
];

async function ensureScreenshotDir() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

export async function runBrowserAudit(options: AuditOptions): Promise<{ issues: UXIssue[]; errors: string[] }> {
  await ensureScreenshotDir();
  const issues: UXIssue[] = [];
  const errors: string[] = [];
  const viewports = options.viewports || DEFAULT_AUDIT_VIEWPORTS;
  const timeout = options.timeoutMs || 25000;

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const viewport of viewports) {
      let context: BrowserContext | null = null;
      let page: Page | null = null;

      try {
        context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });

        page = await context.newPage();
        page.setDefaultTimeout(timeout);

        // Redirect-aware & Network SSRF protection (Item A.2, A.3)
        let ssrfViolation: string | null = null;

        // Route interception to block private/internal requests & redirects
        await page.route('**', (route) => {
          const reqUrl = route.request().url();
          try {
            const parsed = new URL(reqUrl);
            const host = parsed.hostname.toLowerCase();

            // Allow local fixture endpoints if navigated from test server
            const isFixtureRequest =
              (host === 'localhost' || host === '127.0.0.1') &&
              (parsed.pathname.startsWith('/fixtures/') || parsed.pathname.startsWith('/_next/'));

            if (!isFixtureRequest) {
              if (host === 'localhost' || host.endsWith('.localhost') || isPrivateOrReservedIP(host)) {
                ssrfViolation = `Blocked SSRF target: ${host}`;
                return route.abort('blockedbyclient');
              }
            }
          } catch {
            return route.abort('blockedbyclient');
          }
          route.continue();
        });

        page.on('response', (res) => {
          const status = res.status();
          if (status >= 300 && status < 400) {
            const location = res.headers()['location'];
            if (location) {
              try {
                const targetUrl = new URL(location, res.url());
                const targetHost = targetUrl.hostname.toLowerCase();
                const isFixtureLocation =
                  (targetHost === 'localhost' || targetHost === '127.0.0.1') &&
                  targetUrl.pathname.startsWith('/fixtures/');

                if (!isFixtureLocation) {
                  if (targetHost === 'localhost' || targetHost.endsWith('.localhost') || isPrivateOrReservedIP(targetHost)) {
                    ssrfViolation = `Redirected to disallowed private address: ${targetHost}`;
                  }
                }
              } catch {
                // ignore URL parse errors
              }
            }
          }
        });

        const response = await page.goto(options.url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });

        if (ssrfViolation) {
          errors.push(`Blocked navigation: ${ssrfViolation} on ${viewport.width}px.`);
          continue;
        }

        if (!response || !response.ok()) {
          errors.push(`Failed to load ${options.url} at ${viewport.width}px (HTTP ${response?.status() || 'No response'})`);
          continue;
        }

        await page.waitForTimeout(300);

        // Helper to capture screenshots safely
        const captureIssueScreenshot = async (issue: UXIssue) => {
          if (issue.status === 'pass' || options.captureScreenshots === false || !issue.boundingBox) return;
          try {
            const filename = `issue-${viewport.width}-${issue.id}.png`;
            const filepath = path.join(SCREENSHOTS_DIR, filename);
            const clip = {
              x: Math.max(0, issue.boundingBox.x - 12),
              y: Math.max(0, issue.boundingBox.y - 12),
              width: Math.min(viewport.width, issue.boundingBox.width + 24),
              height: Math.min(viewport.height, issue.boundingBox.height + 24),
            };
            if (clip.width > 0 && clip.height > 0) {
              await page!.screenshot({ path: filepath, clip });
              issue.screenshotPath = `/screenshots/${filename}`;
            }
          } catch {
            // non-fatal screenshot error
          }
        };

        // 1. Measure Target Size candidates
        const rawTargets: TargetMeasurement[] = await page.evaluate(() => {
          const interactiveSelectors = [
            'button',
            'a[href]',
            'input[type="button"]',
            'input[type="submit"]',
            'input[type="reset"]',
            '[role="button"]',
            '[role="link"]',
            'summary',
          ];

          const elements = Array.from(document.querySelectorAll(interactiveSelectors.join(', ')));
          const measurements: any[] = [];

          function getSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            let path = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
              if (classes) path += `.${classes}`;
            }
            return path;
          }

          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (
              rect.width === 0 ||
              rect.height === 0 ||
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              parseFloat(style.opacity || '1') === 0 ||
              el.closest('[aria-hidden="true"]')
            ) {
              continue;
            }

            const isInline =
              style.display === 'inline' ||
              (el.parentElement ? window.getComputedStyle(el.parentElement).display === 'inline' : false);

            measurements.push({
              selector: getSelector(el),
              element: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || el.tagName.toLowerCase(),
              accessibleName: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 50),
              width: rect.width,
              height: rect.height,
              x: rect.x,
              y: rect.y,
              isInline,
            });
          }

          return measurements;
        });

        // Compute spacing alternative geometry in Node using full verified checkSpacingAlternative
        const targetBoxes = rawTargets.map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height }));
        for (const raw of rawTargets) {
          const hasSufficientSpacing = checkSpacingAlternative(
            { x: raw.x, y: raw.y, width: raw.width, height: raw.height },
            targetBoxes
          );
          const issue = evaluateTargetSize({ ...raw, hasSufficientSpacing }, options.url, viewport);
          await captureIssueScreenshot(issue);
          issues.push(issue);
        }

        // 2. Measure Text Contrast candidates with full ancestor compositing
        const rawTexts = await page.evaluate(() => {
          const textElements = Array.from(
            document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, label, a, button, summary, [role="heading"]')
          );
          const results: any[] = [];

          function getSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            let path = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
              if (classes) path += `.${classes}`;
            }
            return path;
          }

          for (const node of textElements) {
            const el = node as HTMLElement;
            const style = window.getComputedStyle(el);

            // Exclusion of hidden or zero-size elements
            const rect = el.getBoundingClientRect();
            if (
              rect.width === 0 ||
              rect.height === 0 ||
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.visibility === 'collapse' ||
              parseFloat(style.opacity || '1') === 0 ||
              el.closest('[aria-hidden="true"]')
            ) {
              continue;
            }

            // Deduplication: if element has child element nodes that contain text,
            // only evaluate direct text nodes so nested inline elements don't produce duplicates.
            let directText = '';
            const childNodes = Array.from(el.childNodes);
            const hasChildElements = childNodes.some((n) => n.nodeType === Node.ELEMENT_NODE);

            if (hasChildElements) {
              directText = childNodes
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.textContent || '')
                .join('')
                .trim();
            } else {
              directText = (el.textContent || '').trim();
            }

            // Skip empty or trivial whitespace
            if (!directText || directText.length < 2) continue;

            // Collect ancestor background layers, opacities, and complex background indicators
            const bgLayers: string[] = [];
            const ancestorOpacities: number[] = [parseFloat(style.opacity || '1') || 1];
            let hasComplex = false;
            let complexReason: string | undefined = undefined;

            let curr: HTMLElement | null = el;
            while (curr && curr !== document.documentElement) {
              const currStyle = window.getComputedStyle(curr);

              if (curr.getAttribute('data-complex-bg') === 'true') {
                hasComplex = true;
                complexReason = 'Element flagged with data-complex-bg';
              }

              if (currStyle.backgroundImage && currStyle.backgroundImage !== 'none') {
                hasComplex = true;
                complexReason = `CSS background-image: ${currStyle.backgroundImage.slice(0, 50)}`;
              }

              if (currStyle.backdropFilter && currStyle.backdropFilter !== 'none') {
                hasComplex = true;
                complexReason = 'CSS backdrop-filter applied';
              }

              if (currStyle.filter && currStyle.filter !== 'none') {
                hasComplex = true;
                complexReason = 'CSS filter applied';
              }

              if (currStyle.mixBlendMode && currStyle.mixBlendMode !== 'normal') {
                hasComplex = true;
                complexReason = `CSS mix-blend-mode: ${currStyle.mixBlendMode}`;
              }

              const bg = currStyle.backgroundColor;
              if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                bgLayers.push(bg);
              }

              if (curr !== el) {
                const op = parseFloat(currStyle.opacity || '1');
                if (!isNaN(op)) ancestorOpacities.push(op);
              }

              curr = curr.parentElement;
            }

            // Also check documentElement / html background
            if (document.documentElement) {
              const rootStyle = window.getComputedStyle(document.documentElement);
              const rootBg = rootStyle.backgroundColor;
              if (rootBg && rootBg !== 'transparent' && rootBg !== 'rgba(0, 0, 0, 0)') {
                bgLayers.push(rootBg);
              }
            }

            results.push({
              selector: getSelector(el),
              element: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || undefined,
              accessibleName: el.getAttribute('aria-label') || undefined,
              textSnippet: directText.slice(0, 60),
              fontSizePx: parseFloat(style.fontSize || '16'),
              fontWeight: style.fontWeight || '400',
              color: style.color,
              ancestorOpacities,
              bgLayers,
              hasComplex,
              complexReason,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            });
          }

          return results;
        });

        for (const raw of rawTexts) {
          // Total combined ancestor opacity
          const totalOpacity = raw.ancestorOpacities.reduce((a: number, b: number) => a * b, 1);

          // Composite background layers from top to bottom
          const { color: blendedBg, isOpaque } = compositeLayers(raw.bgLayers);

          let hasUnresolvedTransparency = false;
          let unresolvedReason: string | undefined = undefined;
          let effectiveBgStr = '#ffffff';
          let effectiveFgStr = raw.color;

          if (!isOpaque) {
            hasUnresolvedTransparency = true;
            unresolvedReason =
              'Effective background reaches document root with alpha < 1 without an opaque ancestor surface.';
          } else {
            effectiveBgStr = `rgba(${blendedBg.r}, ${blendedBg.g}, ${blendedBg.b}, ${blendedBg.a})`;

            // If foreground has alpha or totalOpacity < 1, composite it over the resolved opaque background
            const parsedFg = parseColor(raw.color);
            if (parsedFg) {
              const fgWithOpacity = applyElementOpacity(parsedFg, totalOpacity);
              if (fgWithOpacity.a < 0.999) {
                const blendedFg = blendColors(fgWithOpacity, blendedBg);
                effectiveFgStr = `rgb(${blendedFg.r}, ${blendedFg.g}, ${blendedFg.b})`;
              }
            }
          }

          const hasAncestorGroupOpacity = raw.ancestorOpacities.some((op: number) => op < 0.999);

          const measurement: TextContrastMeasurement = {
            selector: raw.selector,
            element: raw.element,
            role: raw.role,
            accessibleName: raw.accessibleName,
            textSnippet: raw.textSnippet,
            fontSizePx: raw.fontSizePx,
            fontWeight: raw.fontWeight,
            color: effectiveFgStr,
            backgroundColor: effectiveBgStr,
            hasComplexBackground: raw.hasComplex,
            hasUnresolvedTransparency,
            hasAncestorGroupOpacity,
            unresolvedReason: raw.complexReason || unresolvedReason,
            boundingBox: raw.boundingBox,
          };

          const issue = evaluateTextContrast(measurement, options.url, viewport);
          await captureIssueScreenshot(issue);
          issues.push(issue);
        }

        // 3. Measure Non-text Contrast candidates
        const rawNonText = await page.evaluate(() => {
          const components = Array.from(
            document.querySelectorAll(
              '[data-nontext-component="true"], [data-nontext-uncertain="true"], input, select, textarea, button[disabled]'
            )
          );
          const results: any[] = [];

          function getSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            return el.tagName.toLowerCase();
          }

          for (const node of components) {
            const el = node as HTMLElement;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;

            const style = window.getComputedStyle(el);
            const isUncertain = el.getAttribute('data-nontext-uncertain') === 'true';
            const isExplicitNonText = el.getAttribute('data-nontext-component') === 'true';
            const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

            // Extract border color or outline color
            const borderColor = style.borderColor || '#cbd5e1';

            // If not explicit and not disabled form control, ignore
            if (!isExplicitNonText && !isUncertain && !isDisabled) {
              continue;
            }

            results.push({
              selector: getSelector(el),
              element: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || el.tagName.toLowerCase(),
              accessibleName: el.getAttribute('aria-label') || el.id || 'Component Boundary',
              componentType: isUncertain ? ('graphical-object' as const) : ('ui-component-border' as const),
              indicatorColor: borderColor,
              adjacentColor: '#ffffff',
              isInactiveOrDisabled: isDisabled,
              isStateMeaningUncertain: isUncertain,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            });
          }

          return results;
        });

        for (const raw of rawNonText) {
          const issue = evaluateNonTextContrast(raw, options.url, viewport);
          await captureIssueScreenshot(issue);
          issues.push(issue);
        }

        // 4. Measure Reflow candidates (executed specifically on 320px viewport)
        if (viewport.width === 320) {
          const reflowData = await page.evaluate(() => {
            const docEl = document.documentElement;
            const scrollW = docEl.scrollWidth;
            const clientW = docEl.clientWidth;
            const overflow = Math.max(0, scrollW - clientW);

            function isDecorative(el: Element): boolean {
              if (
                el.getAttribute('aria-hidden') === 'true' ||
                el.getAttribute('role') === 'presentation' ||
                el.getAttribute('role') === 'none' ||
                el.getAttribute('data-decorative') === 'true' ||
                el.closest('[data-decorative="true"]') !== null
              ) {
                return true;
              }
              if (el.tagName.toLowerCase() === 'svg' && !el.getAttribute('aria-label') && !el.textContent?.trim()) {
                return true;
              }
              return false;
            }

            function getSelector(el: Element): string {
              if (el.id) return `#${el.id}`;
              let sel = el.tagName.toLowerCase();
              if (el.className && typeof el.className === 'string') {
                const cls = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
                if (cls) sel += `.${cls}`;
              }
              return sel;
            }

            const allEls = Array.from(document.querySelectorAll('body *'));
            const offenders: any[] = [];
            let decorativeExcludedCount = 0;

            // 1. Document-level horizontal overflow offenders
            for (const el of allEls) {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);

              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                rect.width === 0 ||
                rect.height === 0
              ) {
                continue;
              }

              if (isDecorative(el)) {
                if (rect.right > clientW + 1.0) decorativeExcludedCount++;
                continue;
              }

              if (rect.right > clientW + 1.0) {
                const isEssential =
                  el.getAttribute('data-essential-2d') === 'true' ||
                  el.tagName.toLowerCase() === 'table' ||
                  el.getAttribute('role') === 'table' ||
                  el.closest('[data-essential-2d="true"]') !== null;

                offenders.push({
                  elementNode: el,
                  selector: getSelector(el),
                  element: el.tagName.toLowerCase(),
                  role: el.getAttribute('role') || undefined,
                  accessibleName: el.getAttribute('aria-label') || undefined,
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  computedStyles: {
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                    position: style.position,
                    display: style.display,
                    width: style.width,
                    maxWidth: style.maxWidth,
                  },
                  isEssential2D: isEssential,
                });
              }
            }

            // Prioritize explicit ID first so designated component IDs are chosen over anonymous wrappers or leaf text nodes
            const prioritizedOffenders = offenders.slice().sort((a, b) => {
              const aId = a.selector.startsWith('#') ? 1 : 0;
              const bId = b.selector.startsWith('#') ? 1 : 0;
              if (bId !== aId) return bId - aId;
              if (a.elementNode.contains(b.elementNode)) return 1;
              if (b.elementNode.contains(a.elementNode)) return -1;
              const aRight = a.boundingBox.x + a.boundingBox.width;
              const bRight = b.boundingBox.x + b.boundingBox.width;
              return bRight - aRight;
            });

            // 2. Nested horizontal scroll containers
            const nestedContainers: any[] = [];
            for (const el of allEls) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || isDecorative(el)) continue;

              const isScrollX = style.overflowX === 'scroll' || style.overflowX === 'auto';
              if (isScrollX && el.scrollWidth > el.clientWidth + 1.0) {
                const rect = el.getBoundingClientRect();
                const isEssential =
                  el.getAttribute('data-essential-2d') === 'true' ||
                  el.tagName.toLowerCase() === 'table' ||
                  el.getAttribute('role') === 'table' ||
                  el.closest('[data-essential-2d="true"]') !== null ||
                  el.querySelector('table, [role="table"], [data-essential-2d="true"], canvas, video') !== null;

                nestedContainers.push({
                  selector: getSelector(el),
                  element: el.tagName.toLowerCase(),
                  role: el.getAttribute('role') || undefined,
                  accessibleName: el.getAttribute('aria-label') || undefined,
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  overflowPx: Math.round(el.scrollWidth - el.clientWidth),
                  isEssential2D: isEssential,
                  computedStyles: {
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                    position: style.position,
                    display: style.display,
                  },
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                });
              }
            }

            // 3. Significant content clipped by ancestor (overflow that does not increase document.scrollWidth)
            const ancestorClipped: any[] = [];
            for (const el of allEls) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || isDecorative(el)) continue;

              const isClippedX = style.overflowX === 'hidden' || style.overflowX === 'clip';
              if (isClippedX && el.scrollWidth > el.clientWidth + 1.0) {
                const rect = el.getBoundingClientRect();
                const child = Array.from(el.children).find(
                  (c) => !isDecorative(c) && (c.scrollWidth > el.clientWidth || c.getBoundingClientRect().right > rect.right + 1.0)
                );
                // Exclude if all overflowing children are decorative
                if (!child) continue;

                const targetSel = getSelector(child);
                const deficit = Math.round(el.scrollWidth - el.clientWidth);

                ancestorClipped.push({
                  selector: targetSel,
                  ancestorSelector: getSelector(el),
                  element: child.tagName.toLowerCase(),
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  clipDeficitPx: deficit,
                  computedStyles: {
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                  },
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                });
              }
            }

            // 4. Interactive controls positioned outside visible or clipping area
            const clippedControls: any[] = [];
            const interactiveEls = Array.from(
              document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')
            );
            for (const ctrl of interactiveEls) {
              const rect = ctrl.getBoundingClientRect();
              const style = window.getComputedStyle(ctrl);
              if (style.display === 'none' || style.visibility === 'hidden' || isDecorative(ctrl)) continue;

              if (rect.right > clientW + 1.0 || rect.left < -1.0) {
                const deficit = Math.max(0, rect.right - clientW, -rect.left);
                clippedControls.push({
                  selector: getSelector(ctrl),
                  element: ctrl.tagName.toLowerCase(),
                  role: ctrl.getAttribute('role') || ctrl.tagName.toLowerCase(),
                  accessibleName: ctrl.getAttribute('aria-label') || (ctrl.textContent || '').trim().slice(0, 30) || undefined,
                  violation: 'outside-viewport',
                  clipDeficitPx: Math.round(deficit),
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                });
                continue;
              }

              let parent = ctrl.parentElement;
              while (parent && parent !== document.body) {
                const pStyle = window.getComputedStyle(parent);
                if (pStyle.overflowX === 'hidden' || pStyle.overflowX === 'clip' || pStyle.overflow === 'hidden') {
                  const pRect = parent.getBoundingClientRect();
                  if (rect.right > pRect.right + 1.0 || rect.left < pRect.left - 1.0 || rect.bottom > pRect.bottom + 1.0) {
                    const deficit = Math.max(0, rect.right - pRect.right, pRect.left - rect.left, rect.bottom - pRect.bottom);
                    clippedControls.push({
                      selector: getSelector(ctrl),
                      element: ctrl.tagName.toLowerCase(),
                      role: ctrl.getAttribute('role') || ctrl.tagName.toLowerCase(),
                      accessibleName: ctrl.getAttribute('aria-label') || (ctrl.textContent || '').trim().slice(0, 30) || undefined,
                      violation: 'outside-clipping-ancestor',
                      clipDeficitPx: Math.round(deficit),
                      boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    });
                    break;
                  }
                }
                parent = parent.parentElement;
              }
            }

            return {
              scrollWidth: scrollW,
              clientWidth: clientW,
              horizontalOverflowPx: overflow,
              hasDocumentHorizontalScroll: overflow > 1.0,
              overflowingElements: prioritizedOffenders.map(({ elementNode, ...rest }: any) => rest),
              nestedScrollContainers: nestedContainers,
              ancestorClippedElements: ancestorClipped,
              clippedControls,
              decorativeElementsExcludedCount: decorativeExcludedCount,
            };
          });

          const reflowIssues = evaluateReflow(
            {
              viewport: { width: viewport.width, height: viewport.height },
              ...reflowData,
            },
            options.url
          );

          for (const issue of reflowIssues) {
            await captureIssueScreenshot(issue);
            issues.push(issue);
          }
        }

        // 5. Measure Text Spacing candidates (capture baseline, apply minimum-preserving override, capture candidate, restore)
        try {
          const baselineData = await page.evaluate(() => {
            const targets = Array.from(
              document.querySelectorAll(
                '[data-text-spacing-target="true"], [data-spacing-ambiguous="true"], [data-text-spacing-pass="true"]'
              )
            );
            const list: any[] = [];

            function getSelector(el: Element): string {
              if (el.id) return `#${el.id}`;
              return el.tagName.toLowerCase();
            }

            const docEl = document.documentElement;
            const docScrollW = docEl.scrollWidth;
            const docClientW = docEl.clientWidth;

            for (const el of targets) {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const isClipped =
                (style.overflow === 'hidden' || style.overflowY === 'hidden' || style.overflowY === 'clip') &&
                el.scrollHeight > el.clientHeight + 1.0;
              const isHorizClipped =
                (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowX === 'clip') &&
                el.scrollWidth > el.clientWidth + 1.0;

              // Also find adjacent controls that might get obscured
              const nextEl = el.nextElementSibling as HTMLElement | null;
              const hasAdjacentControl =
                nextEl &&
                (nextEl.tagName.toLowerCase() === 'button' ||
                  nextEl.getAttribute('role') === 'button' ||
                  nextEl.hasAttribute('data-spacing-control'));

              list.push({
                selector: getSelector(el),
                element: el.tagName.toLowerCase(),
                role: el.getAttribute('role') || undefined,
                accessibleName: el.getAttribute('aria-label') || el.id || undefined,
                textSnippet: (el.textContent || '').trim().slice(0, 60),
                isAmbiguous: el.getAttribute('data-spacing-ambiguous') === 'true',
                adjacentControlSelector: hasAdjacentControl ? getSelector(nextEl) : undefined,
                adjacentControlRect: hasAdjacentControl ? nextEl.getBoundingClientRect() : undefined,
                docScrollW,
                docClientW,
                state: {
                  width: rect.width,
                  height: rect.height,
                  scrollHeight: el.scrollHeight,
                  clientHeight: el.clientHeight,
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  isClipped,
                  isHorizontalClipped: isHorizClipped,
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                },
              });
            }

            return list;
          });

          if (baselineData.length > 0) {
            // Apply minimum-preserving text spacing styles
            await page.evaluate(() => {
              const modified: any[] = [];
              const elements = Array.from(document.querySelectorAll('body *'));

              for (const el of elements) {
                if (!(el instanceof HTMLElement)) continue;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;

                const fs = parseFloat(style.fontSize) || 16;
                let lh = parseFloat(style.lineHeight);
                if (isNaN(lh)) lh = fs * 1.2;
                let ls = parseFloat(style.letterSpacing);
                if (isNaN(ls)) ls = 0;
                let ws = parseFloat(style.wordSpacing);
                if (isNaN(ws)) ws = 0;
                let mb = parseFloat(style.marginBottom);
                if (isNaN(mb)) mb = 0;

                const reqLh = 1.5 * fs;
                const reqLs = 0.12 * fs;
                const reqWs = 0.16 * fs;
                const reqMb = 2.0 * fs;

                const origCss = el.style.cssText;
                let changed = false;

                // Minimum-preserving rule: only set if current is below required minimum!
                if (lh < reqLh - 0.05) {
                  el.style.setProperty('line-height', '1.5', 'important');
                  changed = true;
                }
                if (ls < reqLs - 0.05) {
                  el.style.setProperty('letter-spacing', '0.12em', 'important');
                  changed = true;
                }
                if (ws < reqWs - 0.05) {
                  el.style.setProperty('word-spacing', '0.16em', 'important');
                  changed = true;
                }
                if (el.tagName.toLowerCase() === 'p' && mb < reqMb - 0.05) {
                  el.style.setProperty('margin-bottom', '2em', 'important');
                  changed = true;
                }

                if (changed) {
                  modified.push({ el, originalCss: origCss });
                }
              }
              (window as any).__proofui_spacing_modified = modified;
            });

            // Brief wait for style re-layout
            await page.waitForTimeout(100);

            const candidateData = await page.evaluate(() => {
              const targets = Array.from(
                document.querySelectorAll(
                  '[data-text-spacing-target="true"], [data-spacing-ambiguous="true"], [data-text-spacing-pass="true"]'
                )
              );
              const list: any[] = [];

              function getSelector(el: Element): string {
                if (el.id) return `#${el.id}`;
                return el.tagName.toLowerCase();
              }

              const docEl = document.documentElement;
              const docScrollW = docEl.scrollWidth;
              const docClientW = docEl.clientWidth;

              for (const el of targets) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const isClipped =
                  (style.overflow === 'hidden' || style.overflowY === 'hidden' || style.overflowY === 'clip') &&
                  el.scrollHeight > el.clientHeight + 1.0;
                const isHorizClipped =
                  (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowX === 'clip') &&
                  el.scrollWidth > el.clientWidth + 1.0;

                // Check bounding box escape: child bleeding outside visible container
                let isEscaped = false;
                if (style.overflow === 'visible' || (!style.overflowX && !style.overflowY)) {
                  for (const child of Array.from(el.children)) {
                    const cRect = child.getBoundingClientRect();
                    if (cRect.bottom > rect.bottom + 1.0 || cRect.right > rect.right + 1.0) {
                      isEscaped = true;
                      break;
                    }
                  }
                }

                // Check obscured adjacent control
                const nextEl = el.nextElementSibling as HTMLElement | null;
                let isControlObscured = false;
                if (nextEl && (nextEl.tagName.toLowerCase() === 'button' || nextEl.getAttribute('role') === 'button' || nextEl.hasAttribute('data-spacing-control'))) {
                  const nextRect = nextEl.getBoundingClientRect();
                  // Check intersection between el and nextEl
                  const overlapX = Math.max(0, Math.min(rect.right, nextRect.right) - Math.max(rect.left, nextRect.left));
                  const overlapY = Math.max(0, Math.min(rect.bottom, nextRect.bottom) - Math.max(rect.top, nextRect.top));
                  if (overlapX > 0 && overlapY > 0) {
                    isControlObscured = true;
                  }
                }

                list.push({
                  selector: getSelector(el),
                  docScrollW,
                  docClientW,
                  isControlObscured,
                  state: {
                    width: rect.width,
                    height: rect.height,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    isClipped,
                    isHorizontalClipped: isHorizClipped,
                    isBoundingBoxEscaped: isEscaped,
                    boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  },
                });
              }

              return list;
            });

            // Match and evaluate each candidate
            for (const base of baselineData) {
              const cand = candidateData.find((c) => c.selector === base.selector);
              if (!cand) continue;

              const isNewDocOverflow =
                base.docScrollW <= base.docClientW + 1.0 &&
                cand.docScrollW > cand.docClientW + 1.0;

              const issue = evaluateTextSpacing(
                {
                  selector: base.selector,
                  element: base.element,
                  role: base.role,
                  accessibleName: base.accessibleName,
                  textSnippet: base.textSnippet,
                  baseline: base.state,
                  candidate: cand.state,
                  isAmbiguousOverlap: base.isAmbiguous,
                  hasTextOverlap: base.isAmbiguous,
                  isControlObscured: cand.isControlObscured,
                  isNewDocumentOverflow: isNewDocOverflow,
                  obscuredControlSelector: base.adjacentControlSelector,
                },
                options.url,
                viewport
              );

              await captureIssueScreenshot(issue);
              issues.push(issue);
            }
          }
        } finally {
          // Guaranteed complete restoration: reset modified styles & clear state
          await page.evaluate(() => {
            const modified = (window as any).__proofui_spacing_modified || [];
            for (const item of modified) {
              item.el.style.cssText = item.originalCss;
            }
            delete (window as any).__proofui_spacing_modified;
            document.getElementById('proofui-text-spacing-override')?.remove();
          }).catch(() => {});
        }
      } catch (err: any) {
        errors.push(`Error auditing ${options.url} at ${viewport.width}px: ${err.message}`);
      } finally {
        // Safe browser resource cleanup on success and failure (Item A.7)
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
      }
    }
  } catch (err: any) {
    errors.push(`Browser launch failure: ${err.message}`);
  } finally {
    // Browser instance cleanup on success and failure (Item A.7)
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return { issues, errors };
}
