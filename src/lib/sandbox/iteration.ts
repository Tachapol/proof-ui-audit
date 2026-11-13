import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues } from '@/lib/audit/grouping';
import { saveSandboxSnippet } from './store';
import { compareRegression, hasMeasurement, measurementKey, type RegressionComparison } from './regression';
import { UXIssue } from '@/lib/schema/ux-issue';
export * from './types';
import type { CandidateCheck, VerificationStatus, CandidateMeasurement, SandboxCandidate } from './types';

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

/**
 * Template-based code mutator producing three candidate designs for evaluation
 */
function produceCodeVariants(baselineHtml: string): {
  variant1: string;
  variant2: string;
  variant3: string;
} {
  // 1. Variant 1: Minimal Ergonomic & Luminance Fix (Preserves original styling, fixes touch targets and text contrast)
  let v1 = baselineHtml;
  // Fix touch targets: add min-h-[44px] and adequate padding to interactive buttons/inputs
  v1 = v1.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    let updated = cls;
    if (!cls.includes('min-h-') && !cls.includes('h-11') && !cls.includes('h-12')) {
      updated += ' min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center justify-center';
    }
    return `class="${updated}"`;
  });
  // Replace low-contrast gray/muted text
  v1 = v1.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-900');
  v1 = v1.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\)|gray|silver)/gi, 'color: #0f172a');
  v1 = v1.replace(/font-size:\s*(10|11|12)px/gi, 'font-size: 14px; min-height: 44px');

  // 2. Variant 2: Modern Accessible Palette (Balanced typography and accessible brand tokens)
  let v2 = baselineHtml;
  v2 = v2.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    return `class="${cls} min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg font-medium shadow-xs inline-flex items-center justify-center transition-colors"`;
  });
  v2 = v2.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500)\b/g, 'text-slate-800');
  v2 = v2.replace(/\bbg-(gray|zinc|slate)-(100|200)\b/g, 'bg-slate-50 border border-slate-300');
  v2 = v2.replace(/color:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\))/gi, 'color: #1e293b');

  // 3. Variant 3: High-Contrast & Focus candidate (requires measurement)
  let v3 = baselineHtml;
  v3 = v3.replace(/class="([^"]*button[^"]*|[^"]*btn[^"]*)"/gi, (match, cls) => {
    return `class="${cls} min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-md font-semibold border-2 border-slate-900 text-slate-950 bg-white hover:bg-slate-100 inline-flex items-center justify-center"`;
  });
  v3 = v3.replace(/\btext-(gray|zinc|slate|neutral)-(300|400|500|600)\b/g, 'text-black font-medium');
  v3 = v3.replace(/color:\s*[^;"]+/gi, 'color: #000000');
  v3 = v3.replace(/border(-[a-z0-9]+)?/gi, 'border-2 border-slate-900');

  return { variant1: v1, variant2: v2, variant3: v3 };
}

export async function runMultiCandidateIteration(
  baselineHtml: string,
  baselineIssues: UXIssue[],
  localOrigin: string
): Promise<SandboxCandidate[]> {
  const { variant1, variant2, variant3 } = produceCodeVariants(baselineHtml);

  const configs = [
    {
      id: 'candidate-opt-1',
      name: 'Option 1: Ergonomic & Luminance',
      badge: 'Recommended',
      description: 'Proposes larger targets and darker text. Inspect measured results before accepting.',
      code: variant1,
    },
    {
      id: 'candidate-opt-2',
      name: 'Option 2: Modern Accessible Palette',
      badge: 'Balanced',
      description: 'Proposes typography and palette changes. Contrast and layout require evaluation.',
      code: variant2,
    },
    {
      id: 'candidate-opt-3',
      name: 'Option 3: High-Contrast Candidate',
      badge: 'Requires Evaluation',
      description: 'Proposes darker text and stronger borders. Full accessibility and interaction behavior are not verified.',
      code: variant3,
    },
  ];

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
