import { z } from 'zod';
import type { AuditRun } from '@/lib/schema/ux-issue';
import { ViewportSchema } from '@/lib/schema/ux-issue';

export const PILOT_SUITE_VERSION = 'seven-metrics-pilot-v1';
export const PILOT_RULE_IDS = ['text-contrast', 'non-text-contrast', 'target-size', 'reflow', 'text-spacing', 'touch-target-spacing', 'heading-hierarchy'] as const;
export const PILOT_VIEWPORTS = [{ width: 320, height: 640 }, { width: 375, height: 812 }, { width: 1440, height: 900 }];
export const PILOT_CASES = [
  ...Array.from({ length: 12 }, (_, i) => ({ caseId: `pilot-ui-${String(i + 1).padStart(2, '0')}`, audience: 'participant' as const })),
  { caseId: 'pilot-metrics-heading', audience: 'investigator_control' as const },
  { caseId: 'pilot-metrics-context', audience: 'investigator_control' as const },
];

const ExpectedStatus = z.enum(['pass', 'candidateFail', 'needsReview', 'not_applicable']);
export const PilotAnnotationRowSchema = z.object({
  id: z.string().min(1), caseId: z.string().min(1), ruleId: z.enum(PILOT_RULE_IDS), viewport: ViewportSchema,
  // null selector means a whole-metric assessment, not a machine-prefilled finding.
  selector: z.string().min(1).nullable(),
  expectedStatus: ExpectedStatus.nullable(), reviewerId: z.string().min(1).nullable(),
  rationale: z.string().min(1).nullable(), reviewedAt: z.string().datetime().nullable(),
  adjudicatedBy: z.string().min(1).nullable(),
});
export type PilotAnnotationRow = z.infer<typeof PilotAnnotationRowSchema>;
export const PilotAnnotationsSchema = z.object({
  schemaVersion: z.literal('1.0.0'), suiteVersion: z.literal(PILOT_SUITE_VERSION),
  sourceDigest: z.string().min(1), evidenceDigest: z.string().min(1),
  provenance: z.enum(['unfilled_template', 'human_expert']),
  reviewMode: z.literal('blind_before_system_reveal'),
  experts: z.array(z.object({ id: z.string().min(1), role: z.string().min(1), qualification: z.string().min(1) })),
  // Mark true only after independent full-UI inspection, including unflagged issues.
  inventoryComplete: z.boolean(),
  rows: z.array(PilotAnnotationRowSchema),
}).superRefine((annotations, context) => {
  const ids = new Set<string>();
  for (const [index, row] of annotations.rows.entries()) {
    if (ids.has(row.id)) context.addIssue({ code: 'custom', path: ['rows', index, 'id'], message: 'Duplicate annotation ID.' });
    ids.add(row.id);
    if ((row.ruleId === 'touch-target-spacing' || row.ruleId === 'heading-hierarchy') && row.expectedStatus === 'candidateFail') {
      context.addIssue({ code: 'custom', path: ['rows', index, 'expectedStatus'], message: 'Pilot advisories cannot be annotated as automatic WCAG candidate failures; use needsReview.' });
    }
  }
});
export type PilotAnnotations = z.infer<typeof PilotAnnotationsSchema>;
export interface PilotRun { caseId: string; run: AuditRun }

export function createPilotAnnotationTemplate(sourceDigest: string, evidenceDigest: string): PilotAnnotations {
  return {
    schemaVersion: '1.0.0', suiteVersion: PILOT_SUITE_VERSION, sourceDigest, evidenceDigest,
    provenance: 'unfilled_template', reviewMode: 'blind_before_system_reveal', experts: [], inventoryComplete: false,
    rows: PILOT_CASES.flatMap(({ caseId }) => PILOT_RULE_IDS.flatMap(ruleId =>
      (ruleId === 'reflow' ? PILOT_VIEWPORTS.filter(viewport => viewport.width === 320) : PILOT_VIEWPORTS).map(viewport => ({
        id: `${caseId}-${ruleId}-${viewport.width}`, caseId, ruleId, viewport,
        selector: null, expectedStatus: null, reviewerId: null, rationale: null, reviewedAt: null, adjudicatedBy: null,
      })))),
  };
}

const sameViewport = (a: { width: number; height: number }, b: { width: number; height: number }) => a.width === b.width && a.height === b.height;
const severity = { pass: 0, needsReview: 1, candidateFail: 2 };
export function comparePilotAnnotations(input: {
  annotations?: unknown; runs: PilotRun[]; sourceDigest: string; evidenceDigest: string;
}) {
  const blockers: string[] = [];
  const coverage = PILOT_RULE_IDS.map(ruleId => ({ ruleId, measuredOccurrences: input.runs.reduce((sum, item) => sum + item.run.rawIssues.filter(issue => issue.ruleId === ruleId).length, 0) }));
  for (const item of coverage) if (!item.measuredOccurrences) blockers.push(`No browser measurements for ${item.ruleId}.`);
  for (const { caseId } of PILOT_CASES) {
    const item = input.runs.find(item => item.caseId === caseId);
    if (!item) { blockers.push(`Missing evidence for ${caseId}.`); continue; }
    if (item.run.auditWarnings?.length) blockers.push(`Audit warnings require resolution for ${caseId}.`);
    for (const viewport of PILOT_VIEWPORTS) if (!item.run.viewports.some(value => sameViewport(value, viewport))) blockers.push(`Missing ${viewport.width}×${viewport.height} for ${caseId}.`);
    for (const metricId of ['touch-target-spacing', 'heading-hierarchy']) {
      for (const viewport of PILOT_VIEWPORTS) if (!item.run.metricResults?.some(metric => metric.metricId === metricId && sameViewport(metric.viewport, viewport))) {
        blockers.push(`Missing lifecycle evidence: ${caseId}/${metricId}/${viewport.width}.`);
      }
    }
    for (const metric of item.run.metricResults || []) {
      if (metric.executionStatus === 'error' || metric.executionStatus === 'partial') blockers.push(`${caseId}/${metric.metricId}/${metric.viewport.width}: ${metric.executionStatus}.`);
    }
  }
  const parsed = PilotAnnotationsSchema.safeParse(input.annotations);
  if (!parsed.success) {
    blockers.push(input.annotations ? 'Expert annotation schema is invalid.' : 'Human expert annotations have not been supplied.');
    return { freezeEligible: false, expertValidationStatus: 'pending' as const, coverage, comparisons: [], unreviewedFindings: [], statusAgreementRate: null, recall: null, blockers };
  }
  const annotations = parsed.data;
  if (annotations.sourceDigest !== input.sourceDigest || annotations.evidenceDigest !== input.evidenceDigest) blockers.push('Annotations do not match this source/evidence snapshot.');
  if (annotations.provenance !== 'human_expert' || !annotations.experts.length) blockers.push('Annotations are an unfilled template, not supplied human expert judgments.');
  if (!annotations.inventoryComplete) blockers.push('Independent full-UI inventory, including unflagged findings, is not confirmed.');
  const experts = new Set(annotations.experts.map(expert => expert.id));
  const completed = annotations.rows.filter(row => row.expectedStatus !== null && row.rationale && row.reviewedAt
    && row.reviewerId && experts.has(row.reviewerId) && row.adjudicatedBy && experts.has(row.adjudicatedBy));
  if (completed.length !== annotations.rows.length) blockers.push(`${annotations.rows.length - completed.length} annotation rows are unreviewed or unadjudicated.`);
  const required = createPilotAnnotationTemplate(input.sourceDigest, input.evidenceDigest).rows;
  for (const row of required) {
    if (!completed.some(value => value.caseId === row.caseId && value.ruleId === row.ruleId && sameViewport(value.viewport, row.viewport) && value.selector === null)) {
      blockers.push(`Missing whole-metric expert assessment: ${row.id}.`);
    }
  }
  const comparisons = completed.map(row => {
    const record = input.runs.find(item => item.caseId === row.caseId);
    if (!record) return { annotationId: row.id, expected: row.expectedStatus, observed: 'missing_evidence', agrees: false };
    const measured = record.run.rawIssues.filter(issue => issue.ruleId === row.ruleId && sameViewport(issue.viewport, row.viewport) && (row.selector === null || issue.selector === row.selector));
    const observed = measured.length ? [...measured].sort((a, b) => severity[b.status] - severity[a.status])[0].status : 'not_observed';
    // A human N/A decision can establish applicability for legacy rules which do
    // not emit an applicability record; absence alone never becomes a pass.
    const agrees = row.expectedStatus === 'not_applicable' ? measured.length === 0 : observed === row.expectedStatus;
    return { annotationId: row.id, expected: row.expectedStatus, observed, agrees };
  });
  const mismatches = comparisons.filter(row => !row.agrees);
  if (mismatches.length) blockers.push(`${mismatches.length} expert/system disagreements require resolution.`);
  const unreviewedFindings = input.runs.flatMap(({ caseId, run }) => run.rawIssues.filter(issue => issue.status !== 'pass'
    && !completed.some(row => row.caseId === caseId && row.ruleId === issue.ruleId && row.selector === issue.selector && sameViewport(row.viewport, issue.viewport)))
    .map(issue => ({ caseId, ruleId: issue.ruleId, selector: issue.selector, viewport: issue.viewport, status: issue.status })));
  if (unreviewedFindings.length) blockers.push(`${unreviewedFindings.length} non-passing occurrences lack element-specific expert annotations.`);
  return {
    freezeEligible: blockers.length === 0, expertValidationStatus: blockers.length ? 'incomplete' as const : 'validated' as const,
    coverage, comparisons, unreviewedFindings,
    statusAgreementRate: comparisons.length ? comparisons.filter(row => row.agrees).length / comparisons.length : null,
    // No recall or expert-consensus claim is inferred from machine-selected findings.
    recall: null, blockers,
  };
}
