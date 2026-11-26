import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues } from '@/lib/audit/grouping';
import { saveSandboxSnippet } from './store';
import { compareRegression, hasMeasurement, measurementKey, type RegressionComparison } from './regression';
import { UXIssue } from '@/lib/schema/ux-issue';
export * from './types';
export * from './cherry-pick';
import { cherryPickTargetSizeFix, cherryPickContrastFix } from './cherry-pick';
import type { CandidateCheck, VerificationStatus, CandidateMeasurement, SandboxCandidate, IterationOptions, IterationConstraint } from './types';

function measuredSummary(issues: UXIssue[], ruleId: string): string {
  const values = issues.filter(issue => issue.ruleId === ruleId).flatMap(issue => {
    const m = issue.measured;
    if (ruleId === 'target-size' && typeof m.width === 'number' && Number.isFinite(m.width)
      && typeof m.height === 'number' && Number.isFinite(m.height)) return [`${m.width} × ${m.height} CSS px`];
    if (ruleId === 'text-contrast' && typeof m.contrastRatio === 'number' && Number.isFinite(m.contrastRatio))
      return [`${m.contrastRatio}:1`];
    return [];
  });
  return [...new Set(values)].join('; ') || 'Unable to verify';
}

interface VariantDefinition {
  id: string;
  name: string;
  badge: string;
  description: string;
  code: string;
}

/**
 * Adaptive code mutator producing three candidate designs, adhering to optional constraints & directives
 */
function produceCodeVariants(
  baselineHtml: string,
  options?: IterationOptions
): [VariantDefinition, VariantDefinition, VariantDefinition] {
  const constraints = options?.constraints || [];
  const customDirective = options?.customDirective?.trim() || '';

  const preserveColors = constraints.includes('preserve_colors') || constraints.includes('target_size_only');
  const preserveLayout = constraints.includes('preserve_layout') || constraints.includes('contrast_only');
  const targetSizeOnly = constraints.includes('target_size_only');
  const contrastOnly = constraints.includes('contrast_only');
  const minimalInvasive = constraints.includes('minimal_invasive');

  // Case A: User explicitly constrained to Target Size Only (Preserve Colors)
  if (targetSizeOnly || preserveColors) {
    let v1 = cherryPickTargetSizeFix(baselineHtml);
    let v2 = baselineHtml.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
      return `class="${cls} min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-lg inline-flex items-center justify-center"`;
    });
    v2 = v2.replace(/style="([^"]*)"/gi, (match, s) => s.replace(/(width|height):\s*1[0-9]px/gi, '$1: 44px'));

    let v3 = baselineHtml.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
      return `class="${cls} min-h-[44px] min-w-[44px] p-2 inline-flex items-center justify-center outline-dashed outline-1 outline-offset-2"`;
    });

    return [
      {
        id: 'candidate-opt-1',
        name: 'Option 1: Ergonomic Target Size (Colors Untouched)',
        badge: 'Preserve Colors',
        description: 'Enlarges clickable area to 44px CSS minimum without altering any background or text colors.',
        code: v1,
      },
      {
        id: 'candidate-opt-2',
        name: 'Option 2: Generous 48px Padding (Colors Untouched)',
        badge: 'Accessible Spacing',
        description: 'Applies 48px ergonomic touch target with balanced rounded corners while keeping brand palette intact.',
        code: v2,
      },
      {
        id: 'candidate-opt-3',
        name: 'Option 3: Outlined Target Expansion (Colors Untouched)',
        badge: 'Minimal Impact',
        description: 'Expands touch target with subtle outline boundaries, preserving all underlying typography and palette.',
        code: v3,
      },
    ];
  }

  // Case B: User explicitly constrained to Contrast Only (Preserve Layout)
  if (contrastOnly || preserveLayout) {
    let v1 = cherryPickContrastFix(baselineHtml);
    let v2 = baselineHtml.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-800');
    v2 = v2.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\)|gray|silver)/gi, 'color: #1e293b');

    let v3 = baselineHtml.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500|600)\b/g, 'text-black font-semibold');
    v3 = v3.replace(/color:\s*[^;"]+/gi, 'color: #000000');

    return [
      {
        id: 'candidate-opt-1',
        name: 'Option 1: High-Luminance Slate-900 (Layout Untouched)',
        badge: 'High Contrast',
        description: 'Increases text contrast to >4.5:1 using high-luminance dark slate without modifying dimensions or paddings.',
        code: v1,
      },
      {
        id: 'candidate-opt-2',
        name: 'Option 2: Balanced Slate-800 (Layout Untouched)',
        badge: 'Balanced Palette',
        description: 'Optimizes text readability with slate-800 while preserving all element sizes and flow.',
        code: v2,
      },
      {
        id: 'candidate-opt-3',
        name: 'Option 3: Maximum Black Contrast (Layout Untouched)',
        badge: 'Strict 7:1',
        description: 'Applies maximum solid black font color to guarantee strict WCAG AAA contrast without layout shifts.',
        code: v3,
      },
    ];
  }

  // Case C: Minimal Invasive
  if (minimalInvasive) {
    let v1 = baselineHtml.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
      return `class="${cls} min-h-[44px] min-w-[44px] px-2.5 py-1.5"`;
    });
    v1 = v1.replace(/\btext-(gray|zinc|slate)-(400|500)\b/g, 'text-zinc-700');

    let v2 = baselineHtml.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
      return `class="${cls} min-h-[44px] min-w-[44px] px-3 py-2"`;
    });
    v2 = v2.replace(/\btext-(gray|zinc|slate)-(400|500)\b/g, 'text-zinc-800');

    let v3 = baselineHtml.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
      return `class="${cls} min-h-[44px] min-w-[44px] p-2"`;
    });
    v3 = v3.replace(/color:\s*[^;"]+/gi, 'color: #18181b');

    return [
      {
        id: 'candidate-opt-1',
        name: 'Option 1: Minimal Surgical Adjustment',
        badge: 'Minimal Invasive',
        description: 'Adds bare-minimum 44px constraints and slightly darkens muted text without touching other properties.',
        code: v1,
      },
      {
        id: 'candidate-opt-2',
        name: 'Option 2: Conservative Ergonomic Touch',
        badge: 'Subtle Polish',
        description: 'Applies subtle touch padding and text-zinc-800 with zero changes to borders or shadows.',
        code: v2,
      },
      {
        id: 'candidate-opt-3',
        name: 'Option 3: Compact Accessible Standard',
        badge: 'Compact',
        description: 'Standardizes interactive dimensions to 44px with minimal footprint and dark zinc typography.',
        code: v3,
      },
    ];
  }

  // Case D: Standard Generation (with optional custom directive notes)
  // 1. Variant 1: Minimal Ergonomic & Luminance Fix
  let v1 = baselineHtml;
  v1 = v1.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    let updated = cls;
    if (!cls.includes('min-h-') && !cls.includes('h-11') && !cls.includes('h-12')) {
      updated += ' min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center justify-center';
    }
    return `class="${updated}"`;
  });
  v1 = v1.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-900');
  v1 = v1.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\)|gray|silver)/gi, 'color: #0f172a');
  v1 = v1.replace(/font-size:\s*(10|11|12)px/gi, 'font-size: 14px; min-height: 44px');
  v1 = v1.replace(/\bgap-1(\.5)?\b/g, 'gap-3');

  // 2. Variant 2: Modern Accessible Palette
  let v2 = baselineHtml;
  v2 = v2.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    return `class="${cls} min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg font-medium shadow-xs inline-flex items-center justify-center transition-colors"`;
  });
  v2 = v2.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-800');
  v2 = v2.replace(/\bbg-(gray|zinc|slate)-(100|200)\b/g, 'bg-slate-50 border border-slate-300');
  v2 = v2.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\))/gi, 'color: #1e293b');

  // 3. Variant 3: High-Contrast & Focus candidate
  let v3 = baselineHtml;
  v3 = v3.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    return `class="${cls} min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-md font-semibold border-2 border-slate-900 text-slate-950 bg-white hover:bg-slate-100 inline-flex items-center justify-center"`;
  });
  v3 = v3.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500|600)\b/g, 'text-black font-medium');
  v3 = v3.replace(/color:\s*[^;"]+/gi, 'color: #000000');
  v3 = v3.replace(/border(-[a-z0-9]+)?/gi, 'border-2 border-slate-900');

  const suffix = customDirective ? ` (Directive: ${customDirective.slice(0, 24)}...)` : '';

  return [
    {
      id: 'candidate-opt-1',
      name: `Option 1: Ergonomic & Luminance${suffix}`,
      badge: 'Recommended',
      description: 'Proposes larger targets and darker text. Inspect measured results before accepting.',
      code: v1,
    },
    {
      id: 'candidate-opt-2',
      name: `Option 2: Modern Accessible Palette${suffix}`,
      badge: 'Balanced',
      description: 'Proposes typography and palette changes. Contrast and layout require evaluation.',
      code: v2,
    },
    {
      id: 'candidate-opt-3',
      name: `Option 3: High-Contrast Candidate${suffix}`,
      badge: 'Requires Evaluation',
      description: 'Proposes darker text and stronger borders. Full accessibility and interaction behavior are not verified.',
      code: v3,
    },
  ];
}

export async function runMultiCandidateIteration(
  baselineHtml: string,
  baselineIssues: UXIssue[],
  localOrigin: string,
  options?: IterationOptions
): Promise<SandboxCandidate[]> {
  const configs = produceCodeVariants(baselineHtml, options);

  const results: SandboxCandidate[] = [];

  for (const cfg of configs) {
    const candidateSnip = saveSandboxSnippet(cfg.code);
    const targetUrl = `${localOrigin}/api/sandbox/render?id=${candidateSnip.id}`;

    // Re-audit candidate in isolated browser
    let candidateIssues: UXIssue[] = [];
    const verificationErrors: string[] = [];
    try {
      const auditRes = await runBrowserAudit({
        url: targetUrl,
        timeoutMs: 12000,
        localOrigin,
        viewports: DEFAULT_AUDIT_VIEWPORTS,
      });
      candidateIssues = auditRes.issues;
      verificationErrors.push(...auditRes.errors);
      if (!candidateIssues.length) verificationErrors.push('Re-audit returned no measurements.');
    } catch {
      verificationErrors.push('Re-audit failed. Retry the audit before relying on this candidate.');
    }

    const auditErrors = [...verificationErrors];
    const grouped = groupUXIssues(candidateIssues);
    const passCount = grouped.filter((g) => g.status === 'pass').length;
    const failCount = grouped.filter((g) => g.status === 'candidateFail').length;
    const reviewCount = grouped.filter((g) => g.status === 'needsReview').length;

    const candidateByKey = new Map(candidateIssues.map(issue => [measurementKey(issue), issue]));
    const measurements: CandidateMeasurement[] = baselineIssues.map(issue => {
      const candidate = candidateByKey.get(measurementKey(issue));
      return {
        ruleId: issue.ruleId, selector: issue.selector, viewport: issue.viewport,
        before: issue.measured, after: candidate?.measured, expected: candidate?.expected || issue.expected,
        status: candidate?.status || 'unable_to_verify',
      };
    });
    if (!baselineIssues.length) verificationErrors.push('Baseline has no measurements to compare.');
    if (measurements.some(row => row.status === 'unable_to_verify'))
      verificationErrors.push('Some baseline elements or viewports were not found in the re-audit.');
    if (baselineIssues.some(issue => !hasMeasurement(issue)) || candidateIssues.some(issue => !hasMeasurement(issue)))
      verificationErrors.push('Required measurement values are missing or invalid.');
    if (candidateIssues.some(issue => issue.status === 'needsReview')) {
      verificationErrors.push(`${reviewCount} findings require human review.`);
    }
    const regression = compareRegression(baselineIssues, candidateIssues, auditErrors);
    const incomplete = regression.status === 'unable_to_verify' || verificationErrors.length > 0 || candidateIssues.some(issue => issue.status === 'needsReview');
    const verificationStatus: VerificationStatus = incomplete ? 'unable_to_verify'
      : failCount > 0 || regression.status === 'regressed' ? 'failed' : 'verified';
    const familyCheck = (ruleIds: string[]) => {
      const issues = candidateIssues.filter(issue => ruleIds.includes(issue.ruleId));
      return !verificationErrors.length && issues.length > 0 && issues.every(issue => issue.status === 'pass')
        && measurements.filter(row => ruleIds.includes(row.ruleId)).every(row => row.status === 'pass');
    };
    const targetPassed = familyCheck(['target-size']);
    const contrastPassed = familyCheck(['text-contrast']);
    const checks: CandidateCheck[] = [
      { id: 'regression-check', label: 'Occurrence regression comparison',
        passed: regression.status === 'no_new_failures',
        deltaText: `${regression.counts.resolved} resolved; ${regression.counts.persistent} persistent; ${regression.counts.new} new; ${regression.counts.unverified} unverified. Selected automated rules only.` },
      { id: 'target-size-check', label: 'Measured target-size checks', passed: targetPassed,
        deltaText: `Target size: ${verificationErrors.length ? 'Unable to verify' : measuredSummary(candidateIssues, 'target-size')}` },
      { id: 'contrast-check', label: 'Measured text-contrast checks', passed: contrastPassed,
        deltaText: `Text contrast: ${verificationErrors.length ? 'Unable to verify' : measuredSummary(candidateIssues, 'text-contrast')}` },
      { id: 'audit-check', label: 'Selected automated checks only', passed: verificationStatus === 'verified',
        deltaText: verificationStatus === 'verified'
          ? 'Selected automated checks passed. Visual and interaction regressions are not verified.'
          : verificationErrors.join(' ') || `${failCount} candidate failures; ${reviewCount} findings need human review.` },
    ];

    results.push({
      ...cfg,
      verified: verificationStatus === 'verified',
      verificationStatus,
      verificationErrors,
      measurements,
      regression,
      checks,
      metrics: {
        targetSize: {
          before: measuredSummary(baselineIssues, 'target-size'),
          after: verificationErrors.length ? 'Unable to verify' : measuredSummary(candidateIssues, 'target-size'),
          passed: targetPassed,
        },
        contrast: {
          before: measuredSummary(baselineIssues, 'text-contrast'),
          after: verificationErrors.length ? 'Unable to verify' : measuredSummary(candidateIssues, 'text-contrast'),
          passed: contrastPassed,
        },
      },
      summary: {
        passCount,
        candidateFailCount: failCount,
        needsReviewCount: reviewCount,
      },
    });
  }

  return results;
}
