import { describe, it, expect } from 'vitest';
import {
  calculateResearchValidationMetrics,
  generateExpertEvaluationQuestionnaireMarkdown,
  calculateWeightedSeverityScore,
  DEFAULT_EXPERT_WEIGHTS,
  ExpertIssueEvaluation,
  ExpertIssueEvaluationSchema,
} from '../expert-rubric';

describe('Expert Rubric & Two-Phase Blind Research Protocol', () => {
  it('validates a schema-conforming two-phase expert issue evaluation', () => {
    const evaluation: ExpertIssueEvaluation = {
      id: 'eval-1',
      expertId: 'exp-01',
      expertName: 'Dr. Jane Doe, Accessibility Lead',
      timestamp: new Date().toISOString(),
      issueFingerprint: 'target-size::button#submit::18x18',
      ruleId: 'target-size',
      phase1_blind: {
        isGenuineDefect: true,
        independentPriority: 'P1',
        independentRationale: 'Button is definitely below minimum touch target on mobile.',
        detectionConfidence: 5,
      },
      phase2_assisted: {
        automatedPriority: 'P1',
        priorityAgreement: 'strongly_agree',
        detectionRating: 'true_positive',
        aiCritiqueHelpfulnessScore: 4,
        remediationUsabilityScore: 5,
        aestheticPreservationScore: 4,
        expertComments: 'Machine heuristic P1 matches expert UX triage perfectly.',
      },
    };

    const res = ExpertIssueEvaluationSchema.safeParse(evaluation);
    expect(res.success).toBe(true);
  });

  it('calculates precision (TP/(TP+FP)) and priority agreement across expert reviews', () => {
    const evaluations: ExpertIssueEvaluation[] = [
      {
        id: 'eval-1',
        expertId: 'exp-01',
        expertName: 'Expert 1',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-1',
        ruleId: 'target-size',
        phase1_blind: {
          isGenuineDefect: true,
          independentPriority: 'P1',
          detectionConfidence: 5,
        },
        phase2_assisted: {
          automatedPriority: 'P1',
          priorityAgreement: 'strongly_agree',
          detectionRating: 'true_positive',
          aiCritiqueHelpfulnessScore: 5,
          remediationUsabilityScore: 4,
        },
      },
      {
        id: 'eval-2',
        expertId: 'exp-01',
        expertName: 'Expert 1',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-2',
        ruleId: 'text-contrast',
        phase1_blind: {
          isGenuineDefect: true,
          independentPriority: 'P1', // Expert blind said P1
          detectionConfidence: 4,
        },
        phase2_assisted: {
          automatedPriority: 'P2', // System said P2
          priorityAgreement: 'disagree',
          detectionRating: 'true_positive',
          aiCritiqueHelpfulnessScore: 3,
          remediationUsabilityScore: 5,
        },
      },
      {
        id: 'eval-3',
        expertId: 'exp-02',
        expertName: 'Expert 2',
        timestamp: new Date().toISOString(),
        issueFingerprint: 'issue-3',
        ruleId: 'reflow',
        phase1_blind: {
          isGenuineDefect: false, // Expert blind recognized false alarm
          independentPriority: 'P3',
          detectionConfidence: 3,
        },
        phase2_assisted: {
          automatedPriority: 'P1',
          priorityAgreement: 'strongly_disagree',
          detectionRating: 'false_positive', // Marked as False Positive
          aiCritiqueHelpfulnessScore: 2,
          remediationUsabilityScore: 2,
        },
      },
    ];

    const metrics = calculateResearchValidationMetrics(evaluations);
    expect(metrics.totalEvaluations).toBe(3);
    // Precision = 2 TP / (2 TP + 1 FP) = 66.7%
    expect(metrics.detectionPrecisionRate).toBe(66.7);
    // 1 agree out of 3 = 33.3%
    expect(metrics.priorityAgreementRate).toBe(33.3);
    // Blind priority exact match = 1 out of 3 (33.3%)
    expect(metrics.blindPriorityMatchRate).toBe(33.3);
    expect(metrics.priorityDivergenceBreakdown.exactMatchCount).toBe(1);
    expect(metrics.priorityDivergenceBreakdown.underEstimatedCount).toBe(1); // auto P2 vs blind expert P1
    expect(metrics.priorityDivergenceBreakdown.overEstimatedCount).toBe(1);  // auto P1 vs blind expert P3
    expect(metrics.averageRemediationScore).toBe(3.7);
    expect(metrics.averageAiHelpfulnessScore).toBe(3.3);
  });

  it('calculates weighted severity score using expert weighting model', () => {
    const score = calculateWeightedSeverityScore({
      deficitScore: 80,     // 80 * 0.50 = 40
      criticalityScore: 90, // 90 * 0.30 = 27
      audienceScore: 70,    // 70 * 0.20 = 14
    }, DEFAULT_EXPERT_WEIGHTS);

    // 40 + 27 + 14 = 81
    expect(score).toBe(81);
  });

  it('generates a two-phase blind evaluation questionnaire in Markdown', () => {
    const md = generateExpertEvaluationQuestionnaireMarkdown({
      runId: 'run-test-123',
      targetUrl: 'http://localhost:3123/fixtures/target-size-demo',
      gitCommitSha: 'fb066cf',
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

    expect(md).toContain('Two-Phase Blind');
    expect(md).toContain('**Engine Version**: `1.0.0`');
    expect(md).toContain('**Commit SHA**: `fb066cf`');
    expect(md).toContain('Phase 1 — Blind Evaluation');
    expect(md).toContain('Phase 2 — System Comparison');
  });
});
