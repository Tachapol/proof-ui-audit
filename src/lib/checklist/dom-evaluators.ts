import { chromium } from '@playwright/test';
import { runBrowserAudit } from '@/lib/audit/browser';
import { saveSandboxSnippet } from '@/lib/sandbox/store';
import { isPrivateOrReservedIP } from '@/lib/audit/url-validator';
import { buildChecklistSummary, type DomCheckFinding } from './aggregator';
import type { ChecklistSummary } from './types';

function resolveTarget(input: { html?: string; url?: string; localOrigin: string }): {
  targetUrl: string;
  html: string;
} {
  if (input.html && input.html.trim().length > 0) {
    const snip = saveSandboxSnippet(input.html);
    return {
      targetUrl: `${input.localOrigin}/api/sandbox/render?id=${snip.id}`,
      html: input.html,
    };
  }
  if (!input.url) {
    throw new Error('Either html or url must be provided.');
  }
  return { targetUrl: input.url, html: '' };
}

/**
 * Evaluates the 17 additional deterministic UX/UI checklist metrics in a real Playwright browser.
 */
export async function evaluateDomChecklistMetrics(
  targetUrl: string,
  localOrigin: string
): Promise<{
  findings: Record<string, DomCheckFinding>;
  pageHtml: string;
  reflow320: { docScrollW: number; overflowing: string[] };
}> {
  const parsed = new URL(targetUrl);
  const localOriginUrl = new URL(localOrigin);
  if (parsed.origin !== localOriginUrl.origin && isPrivateOrReservedIP(parsed.hostname)) {
    throw new Error(`Blocked private/reserved host: ${parsed.hostname}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      await page.goto(targetUrl, { waitUntil: 'load', timeout: 15000 });
    });

    const pageHtml = await page.content();

    const findings = await page.evaluate((): Record<string, DomCheckFinding> => {
      const sel = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        const cls = typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        return `${tag}${cls}`;
      };

      const isVisible = (el: Element): boolean => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const result: Record<string, DomCheckFinding> = {};

      // 1. interactive-cursor
      const interactiveEls = Array.from(document.querySelectorAll('a[href], button, [role="button"], summary')).filter(isVisible);
      const badCursor = interactiveEls.filter((el) => {
        if ((el as HTMLButtonElement).disabled) return false;
        const c = window.getComputedStyle(el).cursor;
        return c !== 'pointer';
      });
      result['interactive-cursor'] = {
        id: 'interactive-cursor',
        status: badCursor.length > 0 ? 'fail' : 'pass',
        measuredSummary: badCursor.length > 0 ? `${badCursor.length} interactive element(s) lack cursor: pointer` : `All ${interactiveEls.length} interactive elements use pointer cursor`,
        affectedCount: badCursor.length,
        samples: badCursor.slice(0, 4).map(sel),
        recommendation: badCursor.length > 0 ? 'Add cursor: pointer to clickable buttons and links.' : 'Cursor affordance is consistent.',
      };

      // 2. valid-interactive-actions
      const links = Array.from(document.querySelectorAll('a')).filter(isVisible);
      const deadLinks = links.filter((a) => {
        const href = (a.getAttribute('href') || '').trim();
        if (href === '' || href === '#') return true;
        if (href.startsWith('#')) {
          const targetId = href.slice(1);
          return !document.getElementById(targetId) && !document.querySelector(`[name="${CSS.escape(targetId)}"]`);
        }
        return false;
      });
      const unverifiedButtons = Array.from(document.querySelectorAll('button')).filter((btn) => {
        if (!isVisible(btn) || (btn as HTMLButtonElement).disabled) return false;
        const type = (btn.getAttribute('type') || '').toLowerCase();
        const inForm = Boolean(btn.closest('form'));
        const hasInlineHandler = btn.hasAttribute('onclick');
        return !hasInlineHandler && !(inForm && (type === 'submit' || type === ''));
      });
      result['valid-interactive-actions'] = {
        id: 'valid-interactive-actions',
        status: deadLinks.length > 0 ? 'fail' : unverifiedButtons.length > 0 ? 'needsReview' : 'pass',
        measuredSummary: deadLinks.length > 0
          ? `${deadLinks.length} broken/placeholder link(s) (href="#" or missing fragment target)`
          : unverifiedButtons.length > 0
            ? `${links.length} link(s) valid; ${unverifiedButtons.length} button(s) require runtime handler verification`
            : `Checked ${links.length} link(s); all targets exist`,
        affectedCount: deadLinks.length > 0 ? deadLinks.length : unverifiedButtons.length,
        samples: (deadLinks.length > 0 ? deadLinks : unverifiedButtons).slice(0, 4).map(sel),
        recommendation: deadLinks.length > 0
          ? 'Ensure every <a href="#..."> points to an existing element ID or real route.'
          : unverifiedButtons.length > 0
            ? 'Verify JS click handlers or form bindings for interactive buttons.'
            : 'All links and actions have valid targets.',
      };

      // 3. interactive-label
      const labelTargets = Array.from(document.querySelectorAll('a, button, input:not([type="hidden"]), select, textarea, [role="button"]')).filter(isVisible);
      const unlabeled = labelTargets.filter((el) => {
        const aria = (el.getAttribute('aria-label') || '').trim();
        const ariaBy = (el.getAttribute('aria-labelledby') || '').trim();
        const title = (el.getAttribute('title') || '').trim();
        const text = (el.textContent || '').trim();
        if (aria || ariaBy || title || text) return false;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          const id = el.id;
          if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return false;
          if (el.closest('label')) return false;
          const ph = (el.getAttribute('placeholder') || '').trim();
          return !ph;
        }
        return true;
      });
      result['interactive-label'] = {
        id: 'interactive-label',
        status: unlabeled.length > 0 ? 'fail' : 'pass',
        measuredSummary: unlabeled.length > 0 ? `${unlabeled.length} control(s) missing accessible name/label` : `All ${labelTargets.length} controls have labels`,
        affectedCount: unlabeled.length,
        samples: unlabeled.slice(0, 4).map(sel),
        recommendation: unlabeled.length > 0 ? 'Add visible text, <label for="...">, or aria-label to every button, link, and input.' : 'All controls have accessible names.',
      };

      // 4. focus-visible (check stylesheets for outline: none/0 without focus-visible replacement)
      let suppressesOutline = false;
      let hasFocusVisibleRule = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const text = rule.cssText || '';
            if (text.includes(':focus') && (text.includes('outline: none') || text.includes('outline: 0'))) {
              suppressesOutline = true;
            }
            if (text.includes(':focus-visible') && (text.includes('outline') || text.includes('box-shadow'))) {
              hasFocusVisibleRule = true;
            }
          }
        } catch {
          // Ignore cross-origin stylesheet restrictions
        }
      }
      const inlineOutlineNone = interactiveEls.filter((el) => {
        const st = el.getAttribute('style') || '';
        return /outline:\s*(none|0)/i.test(st);
      });
      const focusFailed = inlineOutlineNone.length > 0 || (suppressesOutline && !hasFocusVisibleRule);
      result['focus-visible'] = {
        id: 'focus-visible',
        status: focusFailed ? 'fail' : 'pass',
        measuredSummary: focusFailed ? 'Focus outline suppressed without :focus-visible replacement' : 'Keyboard focus indicators preserved',
        affectedCount: focusFailed ? Math.max(1, inlineOutlineNone.length) : 0,
        samples: inlineOutlineNone.slice(0, 4).map(sel),
        recommendation: focusFailed ? 'Add visible :focus-visible { outline: 2px solid ...; outline-offset: 2px; } styles.' : 'Focus indicators are intact.',
      };

      // 5. tab-order-sanity
      const positiveTab = Array.from(document.querySelectorAll('[tabindex]')).filter((el) => {
        const v = Number(el.getAttribute('tabindex'));
        return Number.isFinite(v) && v > 0;
      });
      const hiddenFocusable = Array.from(document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input')).filter(isVisible);
      const tabIssues = [...positiveTab, ...hiddenFocusable];
      result['tab-order-sanity'] = {
        id: 'tab-order-sanity',
        status: tabIssues.length > 0 ? 'fail' : 'pass',
        measuredSummary: tabIssues.length > 0 ? `${tabIssues.length} element(s) with positive tabindex or focusable inside aria-hidden` : 'Natural DOM tab order preserved',
        affectedCount: tabIssues.length,
        samples: tabIssues.slice(0, 4).map(sel),
        recommendation: tabIssues.length > 0 ? 'Remove positive tabindex (>0) and avoid placing focusable controls inside aria-hidden="true".' : 'Tab order is clean.',
      };

      // 6. image-alt
      const imgs = Array.from(document.querySelectorAll('img'));
      const missingAlt = imgs.filter((img) => !img.hasAttribute('alt'));
      result['image-alt'] = {
        id: 'image-alt',
        status: imgs.length === 0 ? 'notApplicable' : missingAlt.length > 0 ? 'fail' : 'pass',
        measuredSummary: imgs.length === 0
          ? 'N/A (0 <img> elements found)'
          : missingAlt.length > 0
            ? `${missingAlt.length} of ${imgs.length} <img> missing alt attribute`
            : `All ${imgs.length} <img> have alt attributes`,
        affectedCount: missingAlt.length,
        samples: missingAlt.slice(0, 4).map(sel),
        recommendation: missingAlt.length > 0 ? 'Add descriptive alt="..." to informative images or alt="" for decorative images.' : 'All images have alt attributes.',
      };

      // 7. landmark-structure
      const hasMain = Boolean(document.querySelector('main, [role="main"]'));
      const hasNavOrHeader = Boolean(document.querySelector('nav, header, [role="navigation"], [role="banner"]'));
      const landmarkOk = hasMain && hasNavOrHeader;
      result['landmark-structure'] = {
        id: 'landmark-structure',
        status: landmarkOk ? 'pass' : hasMain || hasNavOrHeader ? 'needsReview' : 'fail',
        measuredSummary: `main: ${hasMain ? 'yes' : 'no'}, header/nav: ${hasNavOrHeader ? 'yes' : 'no'}`,
        affectedCount: (hasMain ? 0 : 1) + (hasNavOrHeader ? 0 : 1),
        samples: [!hasMain ? 'missing <main>' : '', !hasNavOrHeader ? 'missing <header>/<nav>' : ''].filter(Boolean),
        recommendation: landmarkOk ? 'Semantic landmarks present.' : 'Wrap primary content in <main> and navigation/header in <header> or <nav>.',
      };

      // 8. form-input-semantics
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')).filter(isVisible);
      const weakInputs = inputs.filter((el) => {
        if (el.tagName === 'INPUT' && !el.getAttribute('type')) return true;
        return !el.getAttribute('name') && !el.id && !el.getAttribute('autocomplete');
      });
      result['form-input-semantics'] = {
        id: 'form-input-semantics',
        status: inputs.length === 0 ? 'notApplicable' : weakInputs.length > 0 ? 'fail' : 'pass',
        measuredSummary: inputs.length === 0
          ? 'N/A (0 form fields found)'
          : weakInputs.length > 0
            ? `${weakInputs.length} form field(s) missing type or name/id`
            : `Checked ${inputs.length} form field(s)`,
        affectedCount: weakInputs.length,
        samples: weakInputs.slice(0, 4).map(sel),
        recommendation: weakInputs.length > 0 ? 'Specify explicit type, name, and id/autocomplete attributes on form inputs.' : 'Form input semantics are valid.',
      };

      // 9. document-metadata
      const hasLang = Boolean((document.documentElement.getAttribute('lang') || '').trim());
      const hasTitle = Boolean((document.title || '').trim());
      const metaOk = hasLang && hasTitle;
      result['document-metadata'] = {
        id: 'document-metadata',
        status: metaOk ? 'pass' : 'fail',
        measuredSummary: `lang: ${hasLang ? document.documentElement.lang : 'missing'}, title: ${hasTitle ? 'present' : 'missing'}`,
        affectedCount: (hasLang ? 0 : 1) + (hasTitle ? 0 : 1),
        samples: [!hasLang ? '<html lang>' : '', !hasTitle ? '<title>' : ''].filter(Boolean),
        recommendation: metaOk ? 'Document language and title are set.' : 'Set <html lang="en"> (or appropriate language) and a descriptive <title>.',
      };

      // 10. link-distinguishability
      const inlineLinks = Array.from(document.querySelectorAll('p a, li a')).filter(isVisible);
      const subtleLinks = inlineLinks.filter((a) => {
        const s = window.getComputedStyle(a);
        const parentS = a.parentElement ? window.getComputedStyle(a.parentElement) : null;
        const hasUnderline = s.textDecorationLine.includes('underline') || s.borderBottomStyle !== 'none';
        const sameColor = parentS ? s.color === parentS.color : false;
        return !hasUnderline && sameColor;
      });
      result['link-distinguishability'] = {
        id: 'link-distinguishability',
        status: inlineLinks.length === 0 ? 'notApplicable' : subtleLinks.length > 0 ? 'fail' : 'pass',
        measuredSummary: inlineLinks.length === 0
          ? 'N/A (0 inline text links found)'
          : subtleLinks.length > 0
            ? `${subtleLinks.length} inline link(s) indistinguishable from surrounding text`
            : `Checked ${inlineLinks.length} inline link(s)`,
        affectedCount: subtleLinks.length,
        samples: subtleLinks.slice(0, 4).map(sel),
        recommendation: subtleLinks.length > 0 ? 'Add text-decoration: underline or a distinct link color to inline text links.' : 'Inline links are distinguishable.',
      };

      // 11. status-not-color-only
      const statusEls = Array.from(document.querySelectorAll('[role="alert"], [role="status"], .badge, .alert, .status')).filter(isVisible);
      const emptyStatus = statusEls.filter((el) => (el.textContent || '').trim().length === 0 && !el.getAttribute('aria-label'));
      result['status-not-color-only'] = {
        id: 'status-not-color-only',
        status: statusEls.length === 0 ? 'notApplicable' : emptyStatus.length > 0 ? 'fail' : 'pass',
        measuredSummary: statusEls.length === 0
          ? 'N/A (0 status/badge elements found)'
          : emptyStatus.length > 0
            ? `${emptyStatus.length} status indicator(s) rely on color without text/label`
            : `Checked ${statusEls.length} status indicator(s)`,
        affectedCount: emptyStatus.length,
        samples: emptyStatus.slice(0, 4).map(sel),
        recommendation: emptyStatus.length > 0 ? 'Include visible status text or aria-label alongside status colors.' : 'Status indicators include non-color cues.',
      };

      // 12. min-font-size
      const textEls = Array.from(document.querySelectorAll('p, span, a, button, li, td, label')).filter((el) => {
        return isVisible(el) && (el.textContent || '').trim().length > 0;
      });
      const tinyText = textEls.filter((el) => parseFloat(window.getComputedStyle(el).fontSize) < 12);
      result['min-font-size'] = {
        id: 'min-font-size',
        status: tinyText.length > 0 ? 'fail' : 'pass',
        measuredSummary: tinyText.length > 0 ? `${tinyText.length} text element(s) smaller than 12px` : `All ${textEls.length} text elements ≥ 12px`,
        affectedCount: tinyText.length,
        samples: tinyText.slice(0, 4).map(sel),
        recommendation: tinyText.length > 0 ? 'Increase font-size to at least 14px for body text and 12px for captions/labels.' : 'Font sizes are readable.',
      };

      // 13. line-height-measure
      const bodyParagraphs = Array.from(document.querySelectorAll('p, li')).filter((el) => {
        return isVisible(el) && (el.textContent || '').trim().length > 30;
      });
      const tightLineHeight = bodyParagraphs.filter((el) => {
        const s = window.getComputedStyle(el);
        const fs = parseFloat(s.fontSize);
        const lh = s.lineHeight === 'normal' ? fs * 1.2 : parseFloat(s.lineHeight);
        return fs > 0 && lh / fs < 1.3;
      });
      result['line-height-measure'] = {
        id: 'line-height-measure',
        status: bodyParagraphs.length === 0 ? 'notApplicable' : tightLineHeight.length > 0 ? 'fail' : 'pass',
        measuredSummary: bodyParagraphs.length === 0
          ? 'N/A (0 body paragraphs >30 chars found)'
          : tightLineHeight.length > 0
            ? `${tightLineHeight.length} paragraph(s) with tight line-height (< 1.3)`
            : `Checked ${bodyParagraphs.length} paragraph(s)`,
        affectedCount: tightLineHeight.length,
        samples: tightLineHeight.slice(0, 4).map(sel),
        recommendation: tightLineHeight.length > 0 ? 'Set line-height to at least 1.4–1.5 on body paragraphs for readability.' : 'Line height is comfortable.',
      };

      // 14. font-consistency
      const families = new Set<string>();
      for (const el of textEls.slice(0, 100)) {
        const fam = window.getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
        if (fam) families.add(fam);
      }
      const tooManyFonts = families.size > 3;
      result['font-consistency'] = {
        id: 'font-consistency',
        status: tooManyFonts ? 'needsReview' : 'pass',
        measuredSummary: `${families.size} primary font family/families detected`,
        affectedCount: tooManyFonts ? families.size : 0,
        samples: Array.from(families).slice(0, 4),
        recommendation: tooManyFonts ? 'Consolidate typography to 1–2 primary font families.' : 'Font usage is consistent.',
      };

      // 15. visual-overlap (check sibling cards/buttons for unintended bounding-box overlap)
      const checkBoxes = Array.from(document.querySelectorAll('button, a, p, h1, h2, h3, input')).filter(isVisible);
      let overlaps = 0;
      const overlapSamples: string[] = [];
      for (let i = 0; i < Math.min(checkBoxes.length, 60); i++) {
        const a = checkBoxes[i];
        const ra = a.getBoundingClientRect();
        for (let j = i + 1; j < Math.min(checkBoxes.length, 60); j++) {
          const b = checkBoxes[j];
          if (a.contains(b) || b.contains(a)) continue;
          const rb = b.getBoundingClientRect();
          const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
          const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
          if (ix > 4 && iy > 4) {
            overlaps++;
            if (overlapSamples.length < 4) overlapSamples.push(`${sel(a)} ↔ ${sel(b)}`);
          }
        }
      }
      result['visual-overlap'] = {
        id: 'visual-overlap',
        status: overlaps > 0 ? 'fail' : 'pass',
        measuredSummary: overlaps > 0 ? `${overlaps} overlapping element pair(s) detected` : 'No overlapping elements detected',
        affectedCount: overlaps,
        samples: overlapSamples,
        recommendation: overlaps > 0 ? 'Add spacing/gap or fix positioning so elements do not overlap.' : 'No visual collisions.',
      };

      // 16. broken-media
      const brokenImgs = imgs.filter((img) => !img.complete || img.naturalWidth === 0);
      const visibleSvgs = Array.from(document.querySelectorAll('svg')).filter((svg) => {
        return window.getComputedStyle(svg).display !== 'none';
      });
      const zeroSvgs = visibleSvgs.filter((svg) => {
        const r = svg.getBoundingClientRect();
        return r.width === 0 || r.height === 0;
      });
      const totalMedia = imgs.length + visibleSvgs.length;
      const brokenCount = brokenImgs.length + zeroSvgs.length;
      result['broken-media'] = {
        id: 'broken-media',
        status: totalMedia === 0 ? 'notApplicable' : brokenCount > 0 ? 'fail' : 'pass',
        measuredSummary: totalMedia === 0
          ? 'N/A (0 images or SVGs found)'
          : brokenCount > 0
            ? `${brokenCount} broken image(s) or 0×0 SVG(s)`
            : `All ${totalMedia} image/SVG element(s) rendered cleanly`,
        affectedCount: brokenCount,
        samples: [...brokenImgs, ...zeroSvgs].slice(0, 4).map(sel),
        recommendation: brokenCount > 0 ? 'Fix broken image URLs or give SVGs explicit width/height.' : 'Media elements rendered properly.',
      };

      // 17. overflow-clipping
      const clipped = Array.from(document.querySelectorAll('div, section, article, button, p')).filter((el) => {
        if (!isVisible(el)) return false;
        const s = window.getComputedStyle(el);
        if (s.overflowX !== 'hidden' && s.overflowY !== 'hidden' && s.overflow !== 'hidden') return false;
        return el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4;
      });
      result['overflow-clipping'] = {
        id: 'overflow-clipping',
        status: clipped.length > 0 ? 'fail' : 'pass',
        measuredSummary: clipped.length > 0 ? `${clipped.length} container(s) clipping content with overflow: hidden` : 'No unintended overflow clipping',
        affectedCount: clipped.length,
        samples: clipped.slice(0, 4).map(sel),
        recommendation: clipped.length > 0 ? 'Remove fixed height/width or replace overflow: hidden with responsive sizing.' : 'No clipped containers.',
      };

      return result;
    });

    // Live keyboard Tab verification for focus-visible
    const tabSamples: Array<{ selector: string; hasIndicator: boolean }> = [];
    for (let t = 0; t < 3; t++) {
      await page.keyboard.press('Tab');
      const activeCheck = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        const s = window.getComputedStyle(el);
        const outlineOk = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadowOk = s.boxShadow !== 'none' && s.boxShadow.trim() !== '';
        const selector = el.id ? `#${el.id}` : el.tagName.toLowerCase();
        return { selector, hasIndicator: outlineOk || shadowOk };
      });
      if (activeCheck) tabSamples.push(activeCheck);
    }

    if (tabSamples.length === 0) {
      findings['focus-visible'] = {
        id: 'focus-visible',
        status: 'needsReview',
        measuredSummary: 'Tab navigation did not focus any interactive element; manual keyboard check required',
        affectedCount: 0,
        samples: [],
        recommendation: 'Verify keyboard Tab order and :focus-visible indicators manually.',
      };
    } else {
      const missingFocus = tabSamples.filter((s) => !s.hasIndicator);
      if (missingFocus.length > 0) {
        findings['focus-visible'] = {
          id: 'focus-visible',
          status: 'fail',
          measuredSummary: `${missingFocus.length}/${tabSamples.length} Tab-focused element(s) lack visible outline or box-shadow`,
          affectedCount: missingFocus.length,
          samples: missingFocus.map((s) => s.selector),
          recommendation: 'Add visible :focus-visible { outline: 2px solid ...; outline-offset: 2px; } styles.',
        };
      } else if (findings['focus-visible']?.status === 'pass') {
        findings['focus-visible'] = {
          ...findings['focus-visible'],
          measuredSummary: `Verified ${tabSamples.length} Tab-focused element(s) with visible indicator`,
        };
      }
    }

    // Collect exact 320px overflowing selectors so reflow feedback is actionable for the LLM
    await page.setViewportSize({ width: 320, height: 640 });
    const reflow320 = await page.evaluate(() => {
      const docScrollW = document.documentElement.scrollWidth;
      const overflowing: string[] = [];
      for (const el of Array.from(document.querySelectorAll('header, nav, section, div, form, table, ul'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > 322 || el.scrollWidth > 322) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
            : '';
          const label = `${tag}${id}${cls} (${Math.round(Math.max(r.right, el.scrollWidth))}px)`;
          if (!overflowing.includes(label)) overflowing.push(label);
          if (overflowing.length >= 6) break;
        }
      }
      return { docScrollW, overflowing };
    });

    return { findings, pageHtml, reflow320 };
  } finally {
    await browser.close();
  }
}

/**
 * Runs the full 24-metric UX/UI checklist audit on either raw HTML or a URL.
 */
export async function runFullChecklistAudit(input: {
  html?: string;
  url?: string;
  localOrigin: string;
}): Promise<{ summary: ChecklistSummary; html: string }> {
  const { targetUrl, html } = resolveTarget(input);

  const [auditRes, domRes] = await Promise.all([
    runBrowserAudit({
      url: targetUrl,
      localOrigin: input.localOrigin,
      viewports: [
        { width: 1280, height: 800 },
        { width: 320, height: 640 },
      ],
      enablePilotMetrics: true,
      captureScreenshots: false,
      captureIssueScreenshots: false,
      timeoutMs: 15000,
    }),
    evaluateDomChecklistMetrics(targetUrl, input.localOrigin),
  ]);

  const summary = buildChecklistSummary(auditRes.issues, domRes.findings);
  const reflowItem = summary.items.find((i) => i.id === 'reflow');
  if (reflowItem && reflowItem.status === 'fail' && domRes.reflow320.overflowing.length > 0) {
    reflowItem.samples = [
      `document.scrollWidth=${domRes.reflow320.docScrollW}px at 320px`,
      ...domRes.reflow320.overflowing,
    ];
    reflowItem.rawSelectors = domRes.reflow320.overflowing.map((s) => s.split(' (')[0]);
  }
  return { summary, html: html || domRes.pageHtml };
}
