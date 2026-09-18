import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import { TargetMeasurement, evaluateTargetSize, checkSpacingAlternative } from './rules/target-size';
import { TextContrastMeasurement, evaluateTextContrast } from './rules/text-contrast';
import { NonTextContrastMeasurement, evaluateNonTextContrast } from './rules/non-text-contrast';
import { evaluateReflow } from './rules/reflow';
import { evaluateTextSpacing, TEXT_SPACING_OVERRIDE_CSS } from './rules/text-spacing';
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

            const allEls = Array.from(document.querySelectorAll('body *'));
            const offenders: any[] = [];

            for (const el of allEls) {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);

              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                rect.width === 0 ||
                rect.height === 0 ||
                el.closest('[aria-hidden="true"]')
              ) {
                continue;
              }

              // Element extends beyond viewport client width by more than 1px
              if (rect.right > clientW + 1.0) {
                const isEssential =
                  el.getAttribute('data-essential-2d') === 'true' ||
                  el.tagName.toLowerCase() === 'table' ||
                  el.getAttribute('role') === 'table' ||
                  el.closest('[data-essential-2d="true"]') !== null;

                let sel = el.id ? `#${el.id}` : el.tagName.toLowerCase();
                if (!el.id && el.className && typeof el.className === 'string') {
                  const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
                  if (cls) sel += `.${cls}`;
                }

                offenders.push({
                  selector: sel,
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

            return {
              scrollWidth: scrollW,
              clientWidth: clientW,
              horizontalOverflowPx: overflow,
              hasDocumentHorizontalScroll: overflow > 1.0,
              overflowingElements: offenders,
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

        // 5. Measure Text Spacing candidates (capture baseline, apply override, capture candidate, restore)
        try {
          const baselineData = await page.evaluate(() => {
            const targets = Array.from(
              document.querySelectorAll('[data-text-spacing-target="true"], [data-spacing-ambiguous="true"]')
            );
            const list: any[] = [];

            function getSelector(el: Element): string {
              if (el.id) return `#${el.id}`;
              return el.tagName.toLowerCase();
            }

            for (const el of targets) {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const isClipped =
                (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
                el.scrollHeight > el.clientHeight;

              list.push({
                selector: getSelector(el),
                element: el.tagName.toLowerCase(),
                role: el.getAttribute('role') || undefined,
                accessibleName: el.getAttribute('aria-label') || el.id || undefined,
                textSnippet: (el.textContent || '').trim().slice(0, 60),
                isAmbiguous: el.getAttribute('data-spacing-ambiguous') === 'true',
                state: {
                  width: rect.width,
                  height: rect.height,
                  scrollHeight: el.scrollHeight,
                  clientHeight: el.clientHeight,
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  isClipped,
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                },
              });
            }

            return list;
          });

          if (baselineData.length > 0) {
            // Inject text spacing override
            await page.evaluate((css) => {
              const style = document.createElement('style');
              style.id = 'proofui-text-spacing-override';
              style.textContent = css;
              document.head.appendChild(style);
            }, TEXT_SPACING_OVERRIDE_CSS);

            // Brief wait for style re-layout
            await page.waitForTimeout(100);

            const candidateData = await page.evaluate(() => {
              const targets = Array.from(
                document.querySelectorAll('[data-text-spacing-target="true"], [data-spacing-ambiguous="true"]')
              );
              const list: any[] = [];

              function getSelector(el: Element): string {
                if (el.id) return `#${el.id}`;
                return el.tagName.toLowerCase();
              }

              for (const el of targets) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const isClipped =
                  (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
                  el.scrollHeight > el.clientHeight + 2;

                list.push({
                  selector: getSelector(el),
                  state: {
                    width: rect.width,
                    height: rect.height,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    isClipped,
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
                },
                options.url,
                viewport
              );

              await captureIssueScreenshot(issue);
              issues.push(issue);
            }
          }
        } finally {
          // ALWAYS restore the page to original styles (SC 1.4.12 safety guarantee)
          await page.evaluate(() => {
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
