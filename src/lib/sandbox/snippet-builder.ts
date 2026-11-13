/**
 * Generates an isolated, sandboxed HTML + Tailwind CSS component from an audited UX finding
 */
export function createSandboxSnippetFromIssue(issue: {
  selector?: string;
  element?: string;
  title?: string;
  description?: string;
  accessibleName?: string;
  ruleId?: string;
  wcagCriterion?: string;
  measured?: Record<string, any>;
  expected?: Record<string, any>;
}): string {
  const element = (issue.element || 'button').toLowerCase();
  const label = issue.accessibleName || issue.title || 'Interactive Target';
  const ruleId = issue.ruleId || '';
  const measured = issue.measured || {};
  const expected = issue.expected || {};

  // 1. Target Size Finding (SC 2.5.8)
  if (ruleId === 'target-size' || (measured.width !== undefined && Number(measured.width) < 24)) {
    const width = Math.round(Number(measured.width) || 18);
    const height = Math.round(Number(measured.height) || 18);
    const isLink = element === 'a';

    return `<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-zinc-200 space-y-4">
  <div class="space-y-1.5">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-rose-500"></span>
      <h3 class="text-sm font-semibold text-zinc-900">${escapeHtml(issue.title || 'Action Component')}</h3>
    </div>
    <p class="text-xs text-zinc-500 leading-relaxed">${escapeHtml(issue.description || 'Target size is below the 24×24px minimum touch threshold.')}</p>
  </div>

  <div class="pt-3 border-t border-zinc-100 flex items-center justify-between">
    <span class="text-xs text-zinc-400 font-medium">Element Action</span>
    <!-- Fails WCAG 2.2 SC 2.5.8 Target Size: Measured ${width}×${height}px (requires ≥ 24×24px) -->
    <${element} class="btn bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-1 rounded inline-flex items-center justify-center font-medium" style="width: ${width}px; height: ${height}px;">
      ${escapeHtml(label.slice(0, 30))}
    </${element}>
  </div>
</div>`;
  }

  // 2. Color Contrast Finding (SC 1.4.3 / 1.4.11)
  if (ruleId.includes('contrast') || measured.contrastRatio !== undefined) {
    const textColor = (measured.color as string) || (measured.textColor as string) || '#94a3b8';
    const bgColor = (measured.backgroundColor as string) || '#ffffff';
    const ratio = measured.contrastRatio ? Number(measured.contrastRatio).toFixed(2) : '2.10';
    const minRatio = expected.minRatio ? String(expected.minRatio) : '4.5';

    return `<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-zinc-200 space-y-4">
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-zinc-900">${escapeHtml(issue.title || 'Text Content')}</h3>
      <span class="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
        ${ratio}:1 (Fails AA)
      </span>
    </div>

    <!-- Fails WCAG 2.2 SC 1.4.3: Contrast ratio is ${ratio}:1 (requires ≥ ${minRatio}:1) -->
    <${element} class="text-xs leading-relaxed" style="color: ${textColor}; background-color: ${bgColor};">
      ${escapeHtml(label || 'This sample text does not provide adequate color contrast against its background.')}
    </${element}>
  </div>

  <div class="pt-3 border-t border-zinc-100 flex items-center justify-between">
    <span class="text-xs text-zinc-400">Section details</span>
    <button class="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors">
      Continue
    </button>
  </div>
</div>`;
  }

  // 3. Fallback / Generic Finding
  return `<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-zinc-200 space-y-4">
  <div class="space-y-2">
    <h3 class="text-sm font-semibold text-zinc-900">${escapeHtml(issue.title || 'UI Finding')}</h3>
    <p class="text-xs text-zinc-500">${escapeHtml(issue.description || 'Accessibility issue detected on this element.')}</p>
  </div>

  <div class="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
    <${element} class="text-xs text-zinc-700">
      ${escapeHtml(label)}
    </${element}>
  </div>

  <div class="pt-2 border-t border-zinc-100 flex justify-end">
    <button class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700">
      Submit
    </button>
  </div>
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

