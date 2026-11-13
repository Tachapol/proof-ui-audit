import { describe, it, expect } from 'vitest';
import {
  calculateResearchValidationMetrics,
  generateExpertEvaluationQuestionnaireMarkdown,
  ExpertIssueEvaluation,
  ExpertIssueEvaluationSchema,
} from '../expert-rubric';

describe('Expert Rubric & Research Validation Metrics', () => {
  it('validates a schema-conforming expert issue evaluation', () => {
    const evaluation: ExpertIssueEvaluation = {
      id: 'eval-1',
      expertId: 'exp-01',
      expertName: 'Dr. Jane Doe, Accessibility Lead',
      timestamp: new Date().toISOString(),
      issueFingerprint: 'target-size::button#submit::18x18',
      ruleId: 'target-size',
      detectionRating: 'true_positive',
      detectionConfidence: 5,
      detectionComments: 'Button is definitely below minimum touch target on mobile.',
      automatedPriority: 'P1',
      priorityAgreement: 'strongly_agree',
      expertSuggestedPriority: 'P1',
      remediationUsabilityScore: 5,
      aestheticPreservationScore: 4,
    };

    const res = ExpertIssueEvaluationSchema.safeParse(evaluation);
    expect(res.success).toBe(true);
  });

  it('calculates agreement and divergence statistics across expert reviews', () => {
    const evaluations: ExpertIssueEvaluation[] = [
      {
        id: 'eval-1',
        expertId: 'exp-01',
        expertName: 'Expert 1',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-1',
        ruleId: 'target-size',
        detectionRating: 'true_positive',
        detectionConfidence: 5,
        automatedPriority: 'P1',
        priorityAgreement: 'strongly_agree',
        expertSuggestedPriority: 'P1',
        remediationUsabilityScore: 4,
      },
      {
        id: 'eval-2',
        expertId: 'exp-01',
        expertName: 'Expert 1',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-2',
        ruleId: 'text-contrast',
        detectionRating: 'true_positive',
        detectionConfidence: 4,
        automatedPriority: 'P2',
        priorityAgreement: 'disagree',
        expertSuggestedPriority: 'P1', // Expert thought it was more critical
        remediationUsabilityScore: 5,
      },
      {
        id: 'eval-3',
        expertId: 'exp-02',
        expertName: 'Expert 2',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-3',
        ruleId: 'reflow',
        detectionRating: 'false_positive',
        detectionConfidence: 3,
        automatedPriority: 'P1',
        priorityAgreement: 'strongly_disagree',
        expertSuggestedPriority: 'P3', // False alert, should be P3
        remediationUsabilityScore: 2,
      },
    ];

    const metrics = calculateResearchValidationMetrics(evaluations);
    expect(metrics.totalEvaluations).toBe(3);
    // 2 true positives out of 3 = 66.7%
    expect(metrics.detectionAccuracyRate).toBe(66.7);
    // 1 agree out of 3 = 33.3%
    expect(metrics.priorityAgreementRate).toBe(33.3);
    expect(metrics.priorityDivergenceBreakdown.exactMatchCount).toBe(1);
    expect(metrics.priorityDivergenceBreakdown.underEstimatedCount).toBe(1); // auto P2 vs expert P1
    expect(metrics.priorityDivergenceBreakdown.overEstimatedCount).toBe(1);  // auto P1 vs expert P3
    expect(metrics.averageRemediationScore).toBe(3.7); // (4 + 5 + 2) / 3 = 3.67 -> 3.7
  });

  it('generates an evaluation questionnaire in Markdown with structured fields', () => {
    const md = generateExpertEvaluationQuestionnaireMarkdown({
      runId: 'run-test-123',
      targetUrl: 'http://localhost:3123/fixtures/target-size-demo',
      groupedIssues: [
        {
          fingerprint: 'target-size::#btn::18x18',
          ruleId: 'target-size',
          title: 'Interactive target below 24×24 CSS px',
          status: 'candidateFail',
          currentPriority: 'P1',
          measuredSummary: 'Measured 18 × 18 px vs min 24 × 24 px',
        },
      ],
    });

    expect(md).toContain('ProofUI UX Expert Evaluation Protocol');
    expect(md).toContain('**Engine Version**: `1.0.0`');
    expect(md).toContain('Interactive target below 24×24 CSS px');
    expect(md).toContain('Detection Validity');
    expect(md).toContain('Priority Agreement');
  });
});
