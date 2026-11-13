import type { UXIssue } from '@/lib/schema/ux-issue';

export type FindingChange = 'resolved' | 'persistent' | 'new' | 'unverified';
export interface RegressionFinding {
  key: string;
  change: FindingChange;
  reason: string;
  before?: UXIssue;
  after?: UXIssue;
}
export interface RegressionComparison {
  status: 'regressed' | 'no_new_failures' | 'unable_to_verify';
  counts: Record<FindingChange, number>;
  findings: RegressionFinding[];
  scope: string;
}
export const measurementKey = (issue: UXIssue) => JSON.stringify([
  issue.ruleId, issue.selector, issue.viewport.width, issue.viewport.height,
]);
export function hasMeasurement(issue: UXIssue): boolean {
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (issue.ruleId === 'target-size') return finite(issue.measured.width) && finite(issue.measured.height);
  if (issue.ruleId.includes('contrast')) return finite(issue.measured.contrastRatio);
  return Object.keys(issue.measured).length > 0;
}

/** Compare occurrences, never total failure counts. Missing evidence is not a fix. */
export function compareRegression(before: UXIssue[], after: UXIssue[], auditErrors: string[] = []): RegressionComparison {
  const index = (issues: UXIssue[]) => {
    const map = new Map<string, UXIssue[]>();
    for (const issue of issues) {
      const key = measurementKey(issue);
      map.set(key, [...(map.get(key) || []), issue]);
    }
    return map;
  };
  const baseline = index(before), candidate = index(after);
  const findings: RegressionFinding[] = [];
  for (const key of new Set([...baseline.keys(), ...candidate.keys()])) {
    const previous = baseline.get(key) || [], next = candidate.get(key) || [];
    const b = previous[0], a = next[0];
    let change: FindingChange | undefined;
    let reason = '';
    if (auditErrors.length || previous.length > 1 || next.length > 1 || !a ||
        (b && !hasMeasurement(b)) || !hasMeasurement(a) || a.status === 'needsReview') {
      change = 'unverified';
      reason = auditErrors.length ? 'Audit incomplete; comparison cannot be confirmed.'
        : previous.length > 1 || next.length > 1 ? 'Ambiguous occurrence identity.'
        : !a ? 'Baseline occurrence was not measured again.'
        : a.status === 'needsReview' ? 'Candidate requires human review.' : 'Measurement evidence is missing or invalid.';
    } else if (a.status === 'candidateFail') {
      change = b?.status === 'candidateFail' ? 'persistent' : b?.status === 'needsReview' ? 'unverified' : 'new';
      reason = change === 'persistent' ? 'The same automated candidate failure remains.'
        : change === 'new' ? 'Candidate failure newly observed; confirm with designer review.'
        : 'Baseline was inconclusive; regression cannot be established.';
    } else if (b?.status === 'candidateFail') {
      change = 'resolved'; reason = 'The same occurrence now passes the selected automated rule.';
    } else if (b?.status === 'needsReview') {
      change = a?.status === 'pass' ? 'resolved' : 'unverified';
      reason = a?.status === 'pass'
        ? 'Baseline finding requiring review now definitively passes the selected automated rule.'
        : 'No conclusive baseline measurement for comparison.';
    } else if (!b) {
      change = 'unverified'; reason = 'No conclusive baseline measurement for comparison.';
    }
    if (change) findings.push({ key, change, reason, before: b, after: a });
  }
  const counts = { resolved: 0, persistent: 0, new: 0, unverified: 0 };
  for (const finding of findings) counts[finding.change]++;
  return {
    status: counts.new ? 'regressed' : auditErrors.length || !before.length || !after.length || counts.unverified ? 'unable_to_verify' : 'no_new_failures',
    counts, findings,
    scope: 'Selected automated rules matched by selector, rule and viewport. Visual and interaction regressions are not tested. Changed selectors require manual review.',
  };
}
