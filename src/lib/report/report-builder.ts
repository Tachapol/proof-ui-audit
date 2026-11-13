import { AuditRun, effectiveReviewDisposition } from '@/lib/schema/ux-issue';
import {
  ReportModel,
  ReportModelSchema,
  ReportGroupedIssue,
  ReportOccurrence,
  sanitizePath,
} from './report-schema';

export const STANDARD_DISCLAIMERS = [
  'Only five selected WCAG-informed criteria were tested (Text Contrast, Non-text Contrast, Target Size, Reflow, Text Spacing).',
  'Automated results do not establish complete WCAG conformance.',
  "'candidateFail' is an automated candidate issue and requires human verification.",
  "'needsReview' requires human interpretation and design context validation.",
  'P0–P3 is a project heuristic and not a severity scale defined by WCAG.',
  'AI-generated explanations and recommendations are advisory decision-support only.',
  'The UX/UI designer retains authority and makes the final decision on all items.',
];

export const KNOWN_LIMITATIONS = [
  'Automated testing is conducted across designated viewports: 1440px (desktop) and 375px (mobile).',
  'Dynamic interactive animations, single-page application route transitions, and authenticated states are excluded from automated auditing.',
  'Text and elements over complex canvas, dynamic video, or multi-layered CSS blend modes require manual designer review.',
];

export function buildNormalizedReport(run: AuditRun, exportTimestamp?: string): ReportModel {
  // Count priorities across grouped issues
  const priorityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const group of run.groupedIssues) {
    if (group.currentPriority in priorityCounts) {
      priorityCounts[group.currentPriority]++;
    }
  }

  const rawOccurrences: ReportOccurrence[] = (run.rawIssues || []).map((finding) => ({
    id: finding.id,
    ruleId: finding.ruleId,
    wcagCriterion: finding.wcagCriterion,
    status: finding.status,
    title: finding.title,
    description: finding.description,
    viewport: finding.viewport,
    selector: finding.selector,
    element: finding.element,
    role: finding.role,
    accessibleName: finding.accessibleName,
    measured: finding.measured || {},
    expected: finding.expected || {},
    boundingBox: finding.boundingBox,
    screenshotPath: sanitizePath(finding.screenshotPath),
    exception: finding.exception,
  }));

  const groupedIssues: ReportGroupedIssue[] = run.groupedIssues.map((group) => {
    const rep = group.representative;
    const occurrences: ReportOccurrence[] = (group.occurrences || []).map((occ) => ({
      id: occ.id,
      ruleId: occ.ruleId,
      wcagCriterion: occ.wcagCriterion,
      status: occ.status,
      title: occ.title,
      description: occ.description,
      viewport: occ.viewport,
      selector: occ.selector,
      element: occ.element,
      role: occ.role,
      accessibleName: occ.accessibleName,
      measured: occ.measured || {},
      expected: occ.expected || {},
      boundingBox: occ.boundingBox,
      screenshotPath: sanitizePath(occ.screenshotPath),
      exception: occ.exception,
    }));

    // Deduplicate viewports
    const viewportMap = new Map<string, { width: number; height: number }>();
    for (const occ of occurrences) {
      const key = `${occ.viewport.width}x${occ.viewport.height}`;
      if (!viewportMap.has(key)) {
        viewportMap.set(key, occ.viewport);
      }
    }
    const viewports = Array.from(viewportMap.values());

    return {
      fingerprint: group.fingerprint,
      ruleId: rep.ruleId,
      wcagCriterion: rep.wcagCriterion,
      status: group.status,
      title: rep.title,
      description: rep.description,
      currentPriority: group.currentPriority,
      initialPriority: group.initialPriority || rep.initialPriority,
      priorityRationale: rep.priorityRationale,
      occurrenceCount: group.rawOccurrencesCount || occurrences.length,
      viewports: viewports.length > 0 ? viewports : [rep.viewport],
      selector: rep.selector,
      element: rep.element,
      role: rep.role,
      accessibleName: rep.accessibleName,
      measured: rep.measured || {},
      expected: rep.expected || {},
      boundingBox: rep.boundingBox,
      screenshotPath: sanitizePath(rep.screenshotPath),
      exception: rep.exception,
      // AI
      aiExplanation: group.aiExplanation,
      aiRecommendation: group.aiRecommendation,
      aiExplanationResult: group.aiExplanationResult,
      aiGenerationHistory: group.aiGenerationHistory,
      // Designer
      reviewDisposition: effectiveReviewDisposition(group),
      reviewReason: group.reviewReason || (group.designerDecision === 'accept' || group.designerDecision === 'reject' ? group.designerReason : undefined),
      reviewer: group.reviewer,
      reviewedAt: group.reviewedAt,
      designerDecision: group.designerDecision,
      designerReason: group.designerReason,
      editedRecommendation: group.editedRecommendation,
      decisionHistory: group.decisionHistory,
      // Remediation / Iteration Proof
      iterationComparison: group.iterationComparison
        ? {
            overrideId: group.iterationComparison.overrideId,
            overrideName: group.iterationComparison.overrideName,
            candidateId: group.iterationComparison.candidateId,
            candidateName: group.iterationComparison.candidateName,
            appliedCss: group.iterationComparison.appliedCss,
            candidateCode: group.iterationComparison.candidateCode,
            viewport: group.iterationComparison.viewport,
            targetSelector: group.iterationComparison.targetSelector,
            baselineMeasurement: group.iterationComparison.baselineMeasurement || {},
            baselineStatus: group.iterationComparison.baselineStatus,
            baselineScreenshotPath: sanitizePath(group.iterationComparison.baselineScreenshotPath),
            candidateMeasurement: group.iterationComparison.candidateMeasurement || {},
            candidateStatus: group.iterationComparison.candidateStatus,
            candidateScreenshotPath: sanitizePath(group.iterationComparison.candidateScreenshotPath),
            expectedThreshold: group.iterationComparison.expectedThreshold,
            measurementDelta: group.iterationComparison.measurementDelta,
            regressionResult: group.iterationComparison.regressionResult,
            verificationStatus: group.iterationComparison.verificationStatus,
            verificationErrors: group.iterationComparison.verificationErrors,
            regressionCounts: group.iterationComparison.regressionCounts,
            plainLanguageSummary: group.iterationComparison.plainLanguageSummary,
            approvalTimestamp: group.iterationComparison.approvalTimestamp,
            approvalReason: group.iterationComparison.approvalReason,
            finalDesignerDecision: group.iterationComparison.finalDesignerDecision,
            finalDesignerReason: group.iterationComparison.finalDesignerReason,
            finalDecisionTimestamp: group.iterationComparison.finalDecisionTimestamp,
            eventHistory: group.iterationComparison.eventHistory,
          }
        : undefined,
      // Underlying occurrences
      occurrences,
    };
  });

  const rawFindingCount = rawOccurrences.length;
  const groupedIssueCount = groupedIssues.length;

  const candidateFailCount = groupedIssues.filter((g) => g.status === 'candidateFail').length;
  const needsReviewCount = groupedIssues.filter((g) => g.status === 'needsReview').length;
  const passCount = groupedIssues.filter((g) => g.status === 'pass').length;

  const iteratedIssues = groupedIssues.filter((g) => g.iterationComparison !== undefined);
  const remediationSummary =
    iteratedIssues.length > 0
      ? {
          totalIterated: iteratedIssues.length,
          verifiedCount: iteratedIssues.filter(
            (g) =>
              g.iterationComparison?.verificationStatus === 'verified' ||
              g.iterationComparison?.regressionResult === 'improved' ||
              g.iterationComparison?.regressionResult === 'no_new_failures'
          ).length,
          regressedCount: iteratedIssues.filter(
            (g) =>
              g.iterationComparison?.verificationStatus === 'failed' ||
              g.iterationComparison?.regressionResult === 'regressed'
          ).length,
          unableToVerifyCount: iteratedIssues.filter(
            (g) =>
              g.iterationComparison?.verificationStatus === 'unable_to_verify' ||
              g.iterationComparison?.regressionResult === 'unable_to_verify'
          ).length,
        }
      : undefined;

  const model: ReportModel = {
    schemaVersion: '1.0.0',
    exportTimestamp: exportTimestamp || new Date().toISOString(),
    audit: {
      runId: run.id,
      timestamp: run.timestamp,
      targetUrl: run.targetUrl,
      fixtureId: run.fixtureId,
      productContext: run.productContext,
      viewports: run.viewports,
    },
    summary: {
      rawFindingCount,
      groupedIssueCount,
      passCount,
      candidateFailCount,
      needsReviewCount,
      priorityCounts,
      remediationSummary,
    },
    disclaimers: run.fixtureId === 'mvp-contrast-demo' ? ['This MVP report covers Text Contrast only for four controlled cases; other criteria are not included.', ...STANDARD_DISCLAIMERS.slice(1)] : STANDARD_DISCLAIMERS,
    limitations: run.fixtureId === 'mvp-contrast-demo' ? ['MVP viewport: 375 × 667 CSS px. Designer acceptance does not apply a CSS patch or verify a fix.', ...KNOWN_LIMITATIONS.slice(1)] : KNOWN_LIMITATIONS,
    groupedIssues,
    rawOccurrences,
  };

  return ReportModelSchema.parse(model);
}
