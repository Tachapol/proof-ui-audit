/**
 * Client-safe pure string transformation helpers for cherry-picking candidate fixes.
 * Must NOT import any server/node dependencies (e.g. Playwright, fs, etc.).
 */

/**
 * Applies only target-size fixes (min-h, min-w, padding) from candidate into baseline HTML
 */
export function cherryPickTargetSizeFix(baselineHtml: string): string {
  let res = baselineHtml;
  res = res.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    let updated = cls;
    if (!cls.includes('min-h-') && !cls.includes('h-11') && !cls.includes('h-12')) {
      updated += ' min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center justify-center';
    }
    return `class="${updated}"`;
  });
  res = res.replace(/style="([^"]*)"/gi, (match, styleContent) => {
    let updated = styleContent;
    if (/width:\s*1[0-9]px/i.test(updated) || /height:\s*1[0-9]px/i.test(updated)) {
      updated = updated.replace(/width:\s*1[0-9]px/gi, 'min-width: 44px; width: auto');
      updated = updated.replace(/height:\s*1[0-9]px/gi, 'min-height: 44px; height: auto');
      updated += '; padding: 8px 12px;';
    }
    return `style="${updated}"`;
  });
  return res;
}

/**
 * Applies only color/contrast fixes from candidate into baseline HTML
 */
export function cherryPickContrastFix(baselineHtml: string): string {
  let res = baselineHtml;
  res = res.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-900');
  res = res.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\)|gray|silver)/gi, 'color: #0f172a');
  return res;
}
