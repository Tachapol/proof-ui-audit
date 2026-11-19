import { describe, it, expect } from 'vitest';
import { evaluateTouchTargetSpacing, evaluateHeadingHierarchy, rectangleGap, unavailablePilotMetric } from '../pilot-metrics';
import type { PilotSnapshot, PointerTarget, HeadingNode } from '../pilot-extraction';
import { groupUXIssues, calculateAuditSummary, computeIssueFingerprint, normalizeTouchTargetGroups } from '../grouping';
import { AuditRunSchema, type AuditRun, type BoundingBox } from '@/lib/schema/ux-issue';
import { PilotMetricResultSchema, PilotScopeSchema } from '@/lib/schema/pilot-metric';
import { buildNormalizedReport } from '@/lib/report/report-builder';
import { generateJsonReport } from '@/lib/report/json-export';
import { generateMarkdownReport } from '@/lib/report/markdown-export';
import { extractEvidenceMetrics, validateRuleEvidence } from '@/lib/schema/evidence';
import { getDefaultRecommendation } from '../recommendation';

const viewport = { width: 375, height: 812 };
const url = 'https://example.com/pilot';
const target = (selector: string, x = 0, y = 0): PointerTarget => ({ selector, element: 'button', accessibleName: selector, actionId: selector, boundingBox: { x, y, width: 24, height: 24 } });
const heading = (level: number | null, domIndex: number): HeadingNode => ({ ...target(`#heading-${domIndex}`), element: 'h2', level, domIndex, rawAriaLevel: level === null ? null : String(level), source: 'aria' });
const snapshot = (overrides: Partial<PilotSnapshot> = {}): PilotSnapshot => ({ scopeSelector: '#ui', targets: [], headings: [], limitations: [], ...overrides });

describe('Touch Target Spacing v1.0.0', () => {
  it.each([[8, 'pass'], [7.999, 'needsReview'], [0, 'needsReview'], [12, 'pass']] as const)('uses the unrounded gap %s, outcome %s', (gap, outcome) => {
    const { result, issues } = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b', 24 + gap)] }), url, viewport);
    expect(result).toMatchObject({ executionStatus: 'completed', applicability: 'applicable', outcome, unit: 'CSS px', metricVersion: '1.0.0' });
    expect(result.measurements[0].distance).toBeCloseTo(gap, 10);
    expect(issues.every(issue => issue.status === outcome)).toBe(true);
    expect(issues.some(issue => issue.status === 'candidateFail')).toBe(false);
    expect(issues[0].expected).not.toHaveProperty('hasSpacingAlternative');
  });
  it('measures diagonal rectangle edges using Euclidean distance', () => {
    const a = target('#a').boundingBox;
    expect(rectangleGap(a, { ...a, x: 27, y: 28 })).toEqual({ distance: 5, overlap: false, overlapArea: 0 });
  });
  it('distinguishes boundary contact from overlap and preserves distinct identical boxes', () => {
    const a = target('#a').boundingBox;
    expect(rectangleGap(a, { ...a, x: 24 })).toMatchObject({ distance: 0, overlap: false });
    expect(rectangleGap(a, { ...a, x: 20 })).toMatchObject({ distance: 0, overlap: true, overlapArea: 96 });
    const result = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b')] }), url, viewport);
    expect(result.result.measurements[0]).toMatchObject({ distance: 0, overlap: true, nearestTarget: { selector: '#b' } });
  });
  it('selects the nearest target rather than the next DOM element', () => {
    const { result } = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#far', 200), target('#near', 28)] }), url, viewport);
    expect(result.measurements[0]).toMatchObject({ distance: 4, nearestTarget: { selector: '#near' } });
  });
  it('prefers actual overlap when nearest distances tie at zero, and excludes shared actions', () => {
    const { result } = evaluateTouchTargetSpacing(snapshot({ targets: [target('#parent'), target('#a-contact', 24), target('#z-overlap', 20)] }), url, viewport);
    expect(result.measurements[0]).toMatchObject({ nearestTarget: { selector: '#z-overlap' }, overlap: true });
    const shared = evaluateTouchTargetSpacing(snapshot({ targets: [target('#action'), { ...target('#alias'), actionId: '#action' }] }), url, viewport);
    expect(shared.result).toMatchObject({ applicability: 'not_applicable', outcome: null });
  });
  it.each([{ targets: [] }, { targets: [target('#only')] }])('does not treat unavailable spacing as zero or a pass', ({ targets }) => {
    const { result, issues } = evaluateTouchTargetSpacing(snapshot({ targets }), url, viewport);
    expect(result).toMatchObject({ executionStatus: 'skipped', applicability: 'not_applicable', outcome: null });
    expect(issues).toHaveLength(0);
    if (targets.length) expect(result.measurements[0]).toMatchObject({ nearestTarget: null, distance: null, overlap: null });
  });
  it('retains missing geometry as partial and never claims a clean pass', () => {
    const missing = { ...target('#missing'), boundingBox: null as unknown as BoundingBox };
    const { result, issues } = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b', 40), missing] }), url, viewport);
    expect(result).toMatchObject({ executionStatus: 'partial', applicability: 'applicable', outcome: null });
    expect(result.measurements[2]).toMatchObject({ distance: null, geometryValid: false });
    expect(issues.every(issue => issue.status === 'needsReview')).toBe(true);
  });
});

describe('Heading Hierarchy v1.0.0', () => {
  it('warns only on deeper skipped levels, preserving DOM order', () => {
    const { result, issues } = evaluateHeadingHierarchy(snapshot({ headings: [heading(2, 0), heading(4, 1), heading(2, 2), heading(3, 3), heading(3, 4)] }), url, viewport);
    expect(result.outcome).toBe('needsReview');
    expect(issues.map(issue => issue.status)).toEqual(['needsReview', 'pass', 'pass', 'pass']);
    expect(result.measurements.map(row => row.domIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(result.measurements[0].outcome).toBeNull();
  });
  it('supports a declared component parent, without requiring a component h1', () => {
    const input = snapshot({ parentHeadingLevel: 2, headings: [heading(3, 0), heading(4, 1)] });
    expect(evaluateHeadingHierarchy(input, url, viewport).result.outcome).toBe('pass');
    expect(evaluateHeadingHierarchy({ ...input, parentHeadingLevel: 1 }, url, viewport).issues[0].status).toBe('needsReview');
  });
  it('retains invalid ARIA levels and does not bridge an unknown heading', () => {
    const { result, issues } = evaluateHeadingHierarchy(snapshot({ headings: [heading(2, 0), heading(null, 1), heading(4, 2), heading(2, 3)] }), url, viewport);
    expect(result).toMatchObject({ executionStatus: 'partial', outcome: null });
    expect(result.measurements[1].level).toBeNull();
    expect(result.measurements[2].previousHeading).toBeNull();
    expect(issues.map(issue => issue.status)).toEqual(['pass']);
  });
  it('distinguishes no headings from an unknown outer boundary and invalid parent context', () => {
    expect(evaluateHeadingHierarchy(snapshot(), url, viewport).result).toMatchObject({ executionStatus: 'skipped', applicability: 'not_applicable', outcome: null });
    expect(evaluateHeadingHierarchy(snapshot({ headings: [heading(3, 0)] }), url, viewport).result).toMatchObject({ executionStatus: 'skipped', applicability: 'unknown', outcome: null });
    expect(evaluateHeadingHierarchy(snapshot({ invalidParentContext: 'oops', headings: [heading(2, 0)] }), url, viewport).result.executionStatus).toBe('partial');
  });
});

describe('Pilot metric pipeline contracts', () => {
  it('validates scope configuration and keeps execution/applicability independent', () => {
    expect(PilotScopeSchema.safeParse({ selector: '#component', parentHeadingLevel: 2 }).success).toBe(true);
    expect(PilotScopeSchema.safeParse({ selector: '#component', parentHeadingLevel: 0 }).success).toBe(false);
    for (const status of ['skipped', 'error'] as const) {
      const result = unavailablePilotMetric('heading-hierarchy', url, viewport, status, 'No measurement');
      expect(PilotMetricResultSchema.parse(result)).toMatchObject({ executionStatus: status, applicability: 'unknown', outcome: null });
    }
    for (const evaluate of [evaluateTouchTargetSpacing, evaluateHeadingHierarchy]) {
      expect(evaluate(snapshot({ scopeError: 'Missing scope', scopeSelector: null }), url, viewport).result.executionStatus).toBe('skipped');
      expect(evaluate(snapshot({ scopeError: 'Invalid selector' }), url, viewport).result.executionStatus).toBe('error');
    }
  });
  it('groups reproducibly, keeps the metric separate from Target Size, and exports evidence without losing nulls', () => {
    const spacing = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b', 28)] }), url, viewport);
    const headingResult = evaluateHeadingHierarchy(snapshot({ headings: [heading(2, 0), heading(4, 1)] }), url, viewport);
    const singleton = evaluateTouchTargetSpacing(snapshot({ targets: [target('#only')] }), url, viewport);
    const rawIssues = [...spacing.issues, ...headingResult.issues];
    const groupedIssues = groupUXIssues([...rawIssues, ...rawIssues.map(issue => ({ ...issue, id: `${issue.id}-copy`, viewport: { width: 1440, height: 900 } }))]);
    expect(groupedIssues).toHaveLength(2);
    expect(groupedIssues.map(group => group.occurrences.length)).toEqual([4, 2]);
    expect(computeIssueFingerprint(spacing.issues[0])).toBe(computeIssueFingerprint(spacing.issues[1]));
    expect(computeIssueFingerprint(spacing.issues[0])).not.toEqual(computeIssueFingerprint({ ...spacing.issues[0], ruleId: 'target-size' }));
    expect(computeIssueFingerprint({ ...spacing.issues[0], selector: '#A' })).not.toEqual(computeIssueFingerprint({ ...spacing.issues[0], selector: '#a' }));
    const run: AuditRun = {
      id: 'pilot-unit', targetUrl: url, timestamp: new Date().toISOString(), viewports: [viewport],
      rawIssues, groupedIssues, summary: calculateAuditSummary(rawIssues, groupedIssues),
      metricResults: [spacing.result, headingResult.result, singleton.result],
    };
    const report = buildNormalizedReport(AuditRunSchema.parse(run));
    const json = JSON.parse(generateJsonReport(report));
    expect(json.audit.metricResults[2].measurements[0].distance).toBeNull();
    expect(json.groupedIssues[0].metric).toMatchObject({ metricVersion: '1.0.0', unit: 'CSS px', basis: 'project-advisory' });
    expect(json.rawOccurrences[0].measured.nearestTarget.selector).toBe('#b');
    expect(json.groupedIssues[0].occurrences[0].metric.executionStatus).toBe('completed');
    expect(json.groupedIssues[0].touchSpacing).toMatchObject({
      summary: '4 CSS px across 2 viewports',
      byViewport: [{ distance: 4, needsReview: true }, { distance: 4, needsReview: true }],
    });
    const markdown = generateMarkdownReport(report);
    expect(markdown).toContain('## Pilot Metric Evidence');
    expect(markdown).toContain('"distance": null');
    expect(markdown).toContain('no automatic WCAG failure');
    for (const issue of rawIssues) {
      expect(validateRuleEvidence(issue.ruleId, issue.measured).valid).toBe(true);
      expect(extractEvidenceMetrics(issue.ruleId, issue.measured).length).toBeGreaterThan(0);
      expect(getDefaultRecommendation(issue)).not.toContain('allowable exception');
    }
  });

  it('keeps a shared control’s other neighbor separate and retains mixed viewport evidence and legacy review', () => {
    const desktop = { width: 1440, height: 900 };
    const mobileIssues = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b', 28)] }), url, viewport).issues;
    const desktopIssues = evaluateTouchTargetSpacing(snapshot({ targets: [target('#a'), target('#b', 40), target('#c', -25)] }), url, desktop).issues;
    const rawIssues = [...mobileIssues, ...desktopIssues];
    const grouped = groupUXIssues(rawIssues);
    expect(grouped.map(group => [group.representative.title, group.status, group.hasMixedStatus, group.rawOccurrencesCount])).toEqual([
      ['#a ↔ #b', 'needsReview', true, 3],
      ['#c ↔ #a', 'needsReview', false, 2],
    ]);

    const timestamp = '2026-11-20T00:00:00.000Z';
    const legacyGroups = mobileIssues.map((issue, index) => ({
      ...grouped[0], fingerprint: `legacy-${index}`, representative: issue, occurrences: [issue], rawOccurrencesCount: 1,
      decisionHistory: index === 1 ? [{ id: 'old-review', action: 'review_disposition' as const, timestamp, newDisposition: 'confirmed_issue' as const }] : [
        { id: 'earlier-review', action: 'review_disposition' as const, timestamp: '2026-11-19T00:00:00.000Z', newDisposition: 'false_positive' as const },
        { id: 'later-adjustment', action: 'reprioritize' as const, timestamp: '2026-11-21T00:00:00.000Z', newDisposition: 'false_positive' as const },
      ],
      reviewDisposition: index === 1 ? 'confirmed_issue' as const : 'false_positive' as const,
      reviewReason: index === 1 ? 'Saved before grouping changed' : undefined,
    }));
    const run: AuditRun = { id: 'legacy-pair', targetUrl: url, timestamp, viewports: [viewport], rawIssues: mobileIssues,
      groupedIssues: legacyGroups, summary: calculateAuditSummary(mobileIssues, legacyGroups) };
    const normalized = normalizeTouchTargetGroups(run);
    expect(normalized.rawIssues).toBe(run.rawIssues);
    expect(normalized.summary).toMatchObject({ totalRawFindings: 2, totalGroupedIssues: 1, needsReviewCount: 1 });
    expect(normalized.groupedIssues[0]).toMatchObject({
      fingerprint: grouped[0].fingerprint, reviewDisposition: 'confirmed_issue', reviewReason: 'Saved before grouping changed',
      decisionHistory: [{ id: 'earlier-review' }, { id: 'old-review' }, { id: 'later-adjustment' }],
    });
    expect(normalizeTouchTargetGroups(normalized)).toBe(normalized);
  });
});
