import { describe, it, expect } from 'vitest';
import { createPilotAnnotationTemplate, comparePilotAnnotations, PILOT_CASES, PILOT_VIEWPORTS, PILOT_RULE_IDS, PilotAnnotationsSchema, type PilotRun } from '../pilot-validation';
import type { UXIssue } from '@/lib/schema/ux-issue';
import { groupUXIssues, calculateAuditSummary } from '@/lib/audit/grouping';
import { unavailablePilotMetric } from '@/lib/audit/pilot-metrics';

function synthetic() {
  const annotations = createPilotAnnotationTemplate('source-test', 'evidence-test');
  annotations.provenance = 'human_expert';
  annotations.inventoryComplete = true;
  annotations.experts = [{ id: 'synthetic-reviewer', role: 'test-only', qualification: 'Synthetic unit test; not a real expert annotation' }];
  for (const row of annotations.rows) Object.assign(row, { expectedStatus: 'pass', reviewerId: 'synthetic-reviewer', rationale: 'Synthetic test assessment', reviewedAt: '2026-11-17T00:00:00.000Z', adjudicatedBy: 'synthetic-reviewer' });
  const runs: PilotRun[] = PILOT_CASES.map(({ caseId }) => {
    const rawIssues: UXIssue[] = annotations.rows.filter(row => row.caseId === caseId).map(row => ({
      id: row.id, ruleId: row.ruleId, status: 'pass', selector: '#synthetic', element: 'div',
      wcagCriterion: 'Synthetic test', title: 'Synthetic pass', description: 'Test data only', url: `fixture://${caseId}`, viewport: row.viewport,
      measured: {}, expected: {}, initialPriority: 'P3', priorityRationale: 'Synthetic',
    }));
    const groupedIssues = groupUXIssues(rawIssues);
    return { caseId, run: { id: caseId, targetUrl: `fixture://${caseId}`, timestamp: '2026-11-17T00:00:00.000Z', viewports: PILOT_VIEWPORTS,
      metricResults: (['touch-target-spacing', 'heading-hierarchy'] as const).flatMap(metricId => PILOT_VIEWPORTS.map(viewport => ({
        ...unavailablePilotMetric(metricId, `fixture://${caseId}`, viewport, 'skipped', 'Synthetic'), executionStatus: 'completed' as const, applicability: 'applicable' as const, outcome: 'pass' as const,
      }))),
      rawIssues, groupedIssues, summary: calculateAuditSummary(rawIssues, groupedIssues) } };
  });
  return { annotations, runs, sourceDigest: 'source-test', evidenceDigest: 'evidence-test' };
}

describe('Pilot expert validation and freeze eligibility', () => {
  it('generates unfilled blind templates for all seven metrics without machine-filled judgments', () => {
    const template = createPilotAnnotationTemplate('source', 'evidence');
    expect(new Set(template.rows.map(row => row.ruleId)).size).toBe(7);
    expect(template.rows.every(row => row.expectedStatus === null && row.reviewerId === null)).toBe(true);
    expect(template.rows.filter(row => row.ruleId === 'reflow').every(row => row.viewport.width === 320)).toBe(true);
    expect(template.provenance).toBe('unfilled_template');
    expect(template.experts).toEqual([]);
  });
  it('does not mistake missing annotations or preset fixture expectations for expert evidence', () => {
    const input = synthetic();
    expect(comparePilotAnnotations({ ...input, annotations: undefined })).toMatchObject({ freezeEligible: false, expertValidationStatus: 'pending', statusAgreementRate: null, recall: null });
    expect(comparePilotAnnotations({ ...input, annotations: { expectedGroundTruth: { expectedStatus: 'pass' } } }).freezeEligible).toBe(false);
    expect(comparePilotAnnotations({ ...input, annotations: createPilotAnnotationTemplate(input.sourceDigest, input.evidenceDigest) }).freezeEligible).toBe(false);
  });
  it('allows eligibility only for bound, complete, adjudicated assessments', () => {
    expect(comparePilotAnnotations(synthetic())).toMatchObject({ freezeEligible: true, expertValidationStatus: 'validated', statusAgreementRate: 1, recall: null });
  });
  it('rejects stale sources, incomplete inventory, unknown reviewers and missing metric coverage', () => {
    const stale = synthetic(); stale.annotations.sourceDigest = 'other';
    expect(comparePilotAnnotations(stale).freezeEligible).toBe(false);
    const inventory = synthetic(); inventory.annotations.inventoryComplete = false;
    expect(comparePilotAnnotations(inventory).freezeEligible).toBe(false);
    const reviewer = synthetic(); reviewer.annotations.rows[0].reviewerId = 'unknown';
    expect(comparePilotAnnotations(reviewer).freezeEligible).toBe(false);
    const coverage = synthetic();
    for (const { run } of coverage.runs) run.rawIssues = run.rawIssues.filter(issue => issue.ruleId !== 'reflow');
    expect(comparePilotAnnotations(coverage).blockers).toContain('No browser measurements for reflow.');
  });
  it('blocks disagreement and reports actual machine findings absent from expert element annotations', () => {
    const input = synthetic();
    input.runs[0].run.rawIssues[0].status = 'candidateFail';
    const result = comparePilotAnnotations(input);
    expect(result.freezeEligible).toBe(false);
    expect(result.comparisons.some(row => !row.agrees)).toBe(true);
    expect(result.unreviewedFindings).toHaveLength(1);
  });
  it('blocks missing viewport evidence, audit errors, partial pilot metrics and missing required assessments', () => {
    const input = synthetic();
    input.runs[0].run.viewports = [PILOT_VIEWPORTS[0]];
    input.runs[1].run.auditWarnings = ['Simulated browser error'];
    input.runs[2].run.metricResults![0].executionStatus = 'partial';
    input.annotations.rows = input.annotations.rows.slice(1);
    expect(comparePilotAnnotations(input).freezeEligible).toBe(false);
  });
  it('keeps project advisories separate from WCAG failure labels', () => {
    const input = synthetic();
    const row = input.annotations.rows.find(row => row.ruleId === 'touch-target-spacing')!;
    row.expectedStatus = 'candidateFail';
    expect(PilotAnnotationsSchema.safeParse(input.annotations).success).toBe(false);
    expect(PILOT_RULE_IDS).not.toContain('accessible-name-coverage');
  });
  it('rejects duplicate annotation identifiers', () => {
    const input = synthetic(); input.annotations.rows.push(input.annotations.rows[0]);
    expect(PilotAnnotationsSchema.safeParse(input.annotations).success).toBe(false);
  });
});
