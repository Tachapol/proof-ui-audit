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
        return (
          !el.getAttribute('name') &&
          !el.id &&
          !el.getAttribute('autocomplete') &&
          !el.getAttribute('placeholder') &&
          !el.getAttribute('aria-label')
        );
      });
      result['form-input-semantics'] = {
        id: 'form-input-semantics',
        status: inputs.length === 0 ? 'notApplicable' : weakInputs.length > 0 ? 'fail' : 'pass',
        measuredSummary: inputs.length === 0
          ? 'N/A (0 form fields found)'
          : weakInputs.length > 0
            ? `${weakInputs.length} form field(s) missing type or identifier`
            : `Checked ${inputs.length} form field(s)`,
        affectedCount: weakInputs.length,
        samples: weakInputs.slice(0, 4).map(sel),
        recommendation: weakInputs.length > 0 ? 'Specify explicit type and name, id, placeholder, or aria-label on form inputs.' : 'Form input semantics are valid.',
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

      // 18. active-state-indicator (Nielsen H1: Visibility of System Status)
      const navs = Array.from(document.querySelectorAll('nav, [role="navigation"]')).filter(isVisible);
      const navLinks = navs.flatMap((n) => Array.from(n.querySelectorAll('a, button')).filter(isVisible));
      const hasActiveNav = navLinks.some(
        (el) =>
          el.hasAttribute('aria-current') ||
          el.classList.contains('active') ||
          el.classList.contains('current') ||
          el.classList.contains('selected')
      );
      result['active-state-indicator'] = {
        id: 'active-state-indicator',
        status: navLinks.length < 2 ? 'notApplicable' : hasActiveNav ? 'pass' : 'fail',
        measuredSummary:
          navLinks.length < 2
            ? 'N/A (no multi-item navigation found)'
            : hasActiveNav
              ? 'Active navigation state indicated'
              : 'Navigation links lack aria-current or active state',
        affectedCount: navLinks.length >= 2 && !hasActiveNav ? 1 : 0,
        samples: navLinks.length >= 2 && !hasActiveNav ? [sel(navs[0])] : [],
        recommendation: hasActiveNav
          ? 'Navigation state is visible.'
          : 'Mark the active navigation item with aria-current="page" or an active style.',
      };

      // 19. ergonomic-target-advisory (Apple HIG 44px / Material 3 48px)
      const below44 = interactiveEls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      });
      result['ergonomic-target-advisory'] = {
        id: 'ergonomic-target-advisory',
        status: interactiveEls.length === 0 ? 'notApplicable' : below44.length > 0 ? 'needsReview' : 'pass',
        measuredSummary:
          interactiveEls.length === 0
            ? 'N/A (0 interactive targets)'
            : below44.length > 0
              ? `${below44.length} target(s) below 44×44px ergonomic advisory`
              : `All ${interactiveEls.length} targets meet 44×44px advisory`,
        affectedCount: below44.length,
        samples: below44.slice(0, 4).map(sel),
        recommendation:
          below44.length > 0
            ? 'Consider expanding primary touch targets toward 44×44px (Apple HIG) / 48×48px (Material 3).'
            : 'Ergonomic touch targets satisfied.',
      };

      // 20. modal-dismiss-affordance (Nielsen H3: User Control & Freedom)
      const modals = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open], .modal')).filter(isVisible);
      const undismissable = modals.filter((m) => {
        const btns = Array.from(m.querySelectorAll('button, [role="button"], a'));
        return !btns.some((b) => /close|cancel|dismiss|×|✕|esc/i.test(`${b.textContent || ''} ${b.getAttribute('aria-label') || ''}`));
      });
      result['modal-dismiss-affordance'] = {
        id: 'modal-dismiss-affordance',
        status: modals.length === 0 ? 'notApplicable' : undismissable.length > 0 ? 'fail' : 'pass',
        measuredSummary:
          modals.length === 0
            ? 'N/A (no visible dialogs/modals)'
            : undismissable.length > 0
              ? `${undismissable.length} dialog(s) missing visible close/cancel button`
              : 'All visible dialogs have dismiss controls',
        affectedCount: undismissable.length,
        samples: undismissable.slice(0, 4).map(sel),
        recommendation: 'Provide an explicit Close or Cancel button inside every modal dialog.',
      };

      // 21. placeholder-not-sole-label (Nielsen H6: Recognition Rather Than Recall)
      const placeholderOnly = inputs.filter((el) => {
        const hasPh = Boolean((el.getAttribute('placeholder') || '').trim());
        if (!hasPh) return false;
        const id = el.id;
        const hasForLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        const hasWrappedLabel = Boolean(el.closest('label'));
        const hasAria = Boolean((el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '').trim());
        return !hasForLabel && !hasWrappedLabel && !hasAria;
      });
      result['placeholder-not-sole-label'] = {
        id: 'placeholder-not-sole-label',
        status: inputs.length === 0 ? 'notApplicable' : placeholderOnly.length > 0 ? 'fail' : 'pass',
        measuredSummary:
          inputs.length === 0
            ? 'N/A (0 form fields found)'
            : placeholderOnly.length > 0
              ? `${placeholderOnly.length} field(s) rely on placeholder without persistent label`
              : 'All form fields have persistent labels',
        affectedCount: placeholderOnly.length,
        samples: placeholderOnly.slice(0, 4).map(sel),
        recommendation: 'Pair each input with a visible <label> or aria-label so context stays visible while typing.',
      };

      // 22. form-required-clarity (Nielsen H5: Error Prevention)
      const requiredFields = inputs.filter((el) => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true');
      const unclearRequired = requiredFields.filter((el) => {
        const id = el.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : el.closest('label');
        const labelText = label?.textContent || '';
        return !/\*|required/i.test(labelText) && el.getAttribute('aria-required') !== 'true';
      });
      result['form-required-clarity'] = {
        id: 'form-required-clarity',
        status: requiredFields.length === 0 ? 'notApplicable' : unclearRequired.length > 0 ? 'fail' : 'pass',
        measuredSummary:
          requiredFields.length === 0
            ? 'N/A (0 required fields)'
            : unclearRequired.length > 0
              ? `${unclearRequired.length} required field(s) lack clear visual or ARIA indicator`
              : `All ${requiredFields.length} required field(s) clearly marked`,
        affectedCount: unclearRequired.length,
        samples: unclearRequired.slice(0, 4).map(sel),
        recommendation: 'Mark required fields clearly with * in the label or aria-required="true".',
      };

      // 23. nav-item-count (Apple HIG: Navigation Simplicity)
      const topNavLinks = navs.length > 0 ? Array.from(navs[0].querySelectorAll('a, button')).filter(isVisible) : [];
      result['nav-item-count'] = {
        id: 'nav-item-count',
        status: navs.length === 0 ? 'notApplicable' : topNavLinks.length > 8 ? 'needsReview' : 'pass',
        measuredSummary:
          navs.length === 0
            ? 'N/A (no <nav> found)'
            : `${topNavLinks.length} top-level navigation item(s)`,
        affectedCount: topNavLinks.length > 8 ? topNavLinks.length : 0,
        samples: topNavLinks.length > 8 ? [sel(navs[0])] : [],
        recommendation: topNavLinks.length > 8 ? 'Keep primary navigation concise (≤ 8 items) to reduce cognitive load.' : 'Navigation item count is concise.',
      };

      // 24. card-surface-separation (Material Design 3: Surface Elevation)
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const cards = Array.from(document.querySelectorAll('article, .card, [class*="card"]')).filter(isVisible);
      const flatCards = cards.filter((c) => {
        const s = window.getComputedStyle(c);
        const hasBorder = s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0;
        const hasShadow = s.boxShadow !== 'none' && s.boxShadow.trim() !== '';
        const diffBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== bodyBg;
        return !hasBorder && !hasShadow && !diffBg;
      });
      result['card-surface-separation'] = {
        id: 'card-surface-separation',
        status: cards.length === 0 ? 'notApplicable' : flatCards.length > 0 ? 'needsReview' : 'pass',
        measuredSummary:
          cards.length === 0
            ? 'N/A (0 card containers found)'
            : flatCards.length > 0
              ? `${flatCards.length} card(s) lack border, shadow, or surface contrast`
              : `All ${cards.length} card(s) visually separated`,
        affectedCount: flatCards.length,
        samples: flatCards.slice(0, 4).map(sel),
        recommendation: 'Use subtle border, shadow, or surface tonal contrast to separate cards from the background.',
      };

      // 25. input-border-contrast (Material Design 3: Input Affordance)
      const borderlessInputs = inputs.filter((el) => {
        const s = window.getComputedStyle(el);
        const hasBorder = s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0;
        const parentBg = el.parentElement ? window.getComputedStyle(el.parentElement).backgroundColor : '';
        const diffBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== parentBg;
        return !hasBorder && !diffBg;
      });
      result['input-border-contrast'] = {
        id: 'input-border-contrast',
        status: inputs.length === 0 ? 'notApplicable' : borderlessInputs.length > 0 ? 'fail' : 'pass',
        measuredSummary:
          inputs.length === 0
            ? 'N/A (0 form fields found)'
            : borderlessInputs.length > 0
              ? `${borderlessInputs.length} input(s) lack visible border or fill contrast`
              : `All ${inputs.length} input(s) have clear boundaries`,
        affectedCount: borderlessInputs.length,
        samples: borderlessInputs.slice(0, 4).map(sel),
        recommendation: 'Give inputs a clear border or contrasting background fill.',
      };

      // 26. heading-body-scale (Apple HIG: Visual Hierarchy)
      const primaryHeading = Array.from(document.querySelectorAll('h1, h2')).find(isVisible);
      const primaryBody = Array.from(document.querySelectorAll('p')).find((p) => isVisible(p) && (p.textContent || '').trim().length > 20);
      let scaleRatio = 0;
      if (primaryHeading && primaryBody) {
        const hSize = parseFloat(window.getComputedStyle(primaryHeading).fontSize);
        const pSize = parseFloat(window.getComputedStyle(primaryBody).fontSize);
        if (pSize > 0) scaleRatio = hSize / pSize;
      }
      result['heading-body-scale'] = {
        id: 'heading-body-scale',
        status: !primaryHeading || !primaryBody ? 'notApplicable' : scaleRatio < 1.25 ? 'fail' : 'pass',
        measuredSummary:
          !primaryHeading || !primaryBody
            ? 'N/A (heading or body paragraph not found)'
            : scaleRatio < 1.25
              ? `Heading-to-body ratio is ${scaleRatio.toFixed(2)}× (below 1.25× hierarchy)`
              : `Heading-to-body scale is ${scaleRatio.toFixed(2)}×`,
        affectedCount: primaryHeading && primaryBody && scaleRatio < 1.25 ? 1 : 0,
        samples: primaryHeading && primaryBody && scaleRatio < 1.25 ? [sel(primaryHeading)] : [],
        recommendation: 'Ensure primary headings are at least 1.25× larger than body text for clear visual hierarchy.',
      };

      // 27. content-density-spacing (Nielsen H8: Aesthetic & Minimalist Design)
      const paragraphs = Array.from(document.querySelectorAll('p')).filter((p) => isVisible(p) && (p.textContent || '').trim().length > 20);
      const crampedParagraphs = paragraphs.filter((p) => {
        const s = window.getComputedStyle(p);
        return parseFloat(s.marginTop) + parseFloat(s.marginBottom) < 4;
      });
      result['content-density-spacing'] = {
        id: 'content-density-spacing',
        status: paragraphs.length < 2 ? 'notApplicable' : crampedParagraphs.length > 0 ? 'needsReview' : 'pass',
        measuredSummary:
          paragraphs.length < 2
            ? 'N/A (fewer than 2 body paragraphs)'
            : crampedParagraphs.length > 0
              ? `${crampedParagraphs.length} paragraph(s) have minimal vertical spacing`
              : 'Paragraph spacing provides comfortable breathing room',
        affectedCount: crampedParagraphs.length,
        samples: crampedParagraphs.slice(0, 4).map(sel),
        recommendation: 'Add vertical spacing between paragraphs to avoid dense walls of text.',
      };

      // 28. button-consistency (Nielsen H4: Consistency & Standards)
      const visibleButtons = Array.from(document.querySelectorAll('button, .btn')).filter(isVisible);
      const buttonHeights = new Set(visibleButtons.map((b) => Math.round(b.getBoundingClientRect().height / 4) * 4));
      result['button-consistency'] = {
        id: 'button-consistency',
        status: visibleButtons.length < 2 ? 'notApplicable' : buttonHeights.size > 3 ? 'needsReview' : 'pass',
        measuredSummary:
          visibleButtons.length < 2
            ? 'N/A (fewer than 2 buttons)'
            : `${buttonHeights.size} distinct button height group(s) across ${visibleButtons.length} buttons`,
        affectedCount: buttonHeights.size > 3 ? buttonHeights.size : 0,
        samples: buttonHeights.size > 3 ? visibleButtons.slice(0, 4).map(sel) : [],
        recommendation: 'Standardize button heights across the interface for visual consistency.',
      };

      // 29. container-padding-breathing (Material Design 3: Surface & Spacing)
      const paddedContainers = cards.filter((c) => {
        const s = window.getComputedStyle(c);
        return Math.min(parseFloat(s.paddingTop), parseFloat(s.paddingLeft), parseFloat(s.paddingRight)) < 8;
      });
      result['container-padding-breathing'] = {
        id: 'container-padding-breathing',
        status: cards.length === 0 ? 'notApplicable' : paddedContainers.length > 0 ? 'fail' : 'pass',
        measuredSummary:
          cards.length === 0
            ? 'N/A (0 card containers found)'
            : paddedContainers.length > 0
              ? `${paddedContainers.length} card(s) have < 8px inner padding`
              : `All ${cards.length} card(s) have adequate padding`,
        affectedCount: paddedContainers.length,
        samples: paddedContainers.slice(0, 4).map(sel),
        recommendation: 'Apply at least 12–16px padding inside card containers.',
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
