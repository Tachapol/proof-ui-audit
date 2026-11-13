import { z } from 'zod';
import { Priority, PrioritySchema } from '@/lib/schema/ux-issue';

// ==========================================
// 1. Expert Evaluation Dimension Schemas
// ==========================================

export const DetectionRatingSchema = z.enum([
  'true_positive',    // Finding represents a genuine UX/accessibility barrier
  'false_positive',   // Finding is incorrect or an inapplicable technical artifact
  'ambiguous_review', // Finding is an edge case legitimately requiring human nuance
]);
export type DetectionRating = z.infer<typeof DetectionRatingSchema>;

export const PriorityAgreementSchema = z.enum([
  'strongly_agree',    // Automated priority exactly matches expert UX triage
  'agree',             // Minor difference, acceptable for production triage
  'neutral',           // Borderline priority
  'disagree',          // Automated priority is noticeably too high or too low
  'strongly_disagree', // Automated priority is critically misleading (e.g. blocker marked low)
]);
export type PriorityAgreement = z.infer<typeof PriorityAgreementSchema>;

export const ExpertIssueEvaluationSchema = z.object({
  id: z.string().min(1),
  expertId: z.string().min(1),
  expertName: z.string().min(1),
  timestamp: z.string().datetime(),
  issueFingerprint: z.string().min(1),
  ruleId: z.string().min(1),

  // Dimension 1: Automated Detection Accuracy
  detectionRating: DetectionRatingSchema,
  detectionConfidence: z.number().int().min(1).max(5), // 1 to 5 Likert scale
  detectionComments: z.string().optional(),

  // Dimension 2: Priority Engine Ranking Alignment
  automatedPriority: PrioritySchema,
  priorityAgreement: PriorityAgreementSchema,
  expertSuggestedPriority: PrioritySchema,
  priorityRationaleComments: z.string().optional(),

  // Dimension 3: Remediation & Before/After Proposal Quality
  remediationUsabilityScore: z.number().int().min(1).max(5).optional(), // 1 (Harmful) to 5 (Optimal)
  aestheticPreservationScore: z.number().int().min(1).max(5).optional(), // 1 (Broken design) to 5 (Preserved)
  remediationComments: z.string().optional(),
});
export type ExpertIssueEvaluation = z.infer<typeof ExpertIssueEvaluationSchema>;

export const ExpertSessionRubricSchema = z.object({
  sessionId: z.string().min(1),
  expertId: z.string().min(1),
  expertRole: z.enum(['ux_designer', 'accessibility_specialist', 'frontend_engineer', 'product_manager']),
  evaluatedRunId: z.string().min(1),
  engineVersion: z.string().default('1.0.0'),
  createdAt: z.string().datetime(),
  evaluations: z.array(ExpertIssueEvaluationSchema),
  overallFeedback: z.string().optional(),
});
export type ExpertSessionRubric = z.infer<typeof ExpertSessionRubricSchema>;

// ==========================================
// 2. Research Validation Metrics Calculators
// ==========================================

export interface ResearchValidationSummary {
  totalEvaluations: number;
  detectionAccuracyRate: number;      // % true positives
  priorityAgreementRate: number;     // % strongly_agree + agree
  averagePriorityDelta: number;      // Numeric difference between expert and automated priority
  averageRemediationScore?: number;  // Out of 5
  priorityDivergenceBreakdown: {
    overEstimatedCount: number;      // Automated priority was higher than expert
    underEstimatedCount: number;     // Automated priority was lower than expert
    exactMatchCount: number;
  };
}

const PRIORITY_NUMERIC: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

/**
 * Calculates aggregate research agreement metrics from a collection of expert evaluations.
 */
export function calculateResearchValidationMetrics(
  evaluations: ExpertIssueEvaluation[]
): ResearchValidationSummary {
  if (!evaluations.length) {
    return {
      totalEvaluations: 0,
      detectionAccuracyRate: 0,
      priorityAgreementRate: 0,
      averagePriorityDelta: 0,
      priorityDivergenceBreakdown: {
        overEstimatedCount: 0,
        underEstimatedCount: 0,
        exactMatchCount: 0,
      },
    };
  }

  let truePositives = 0;
  let priorityAgreed = 0;
  let totalDelta = 0;
  let overEstimated = 0;
  let underEstimated = 0;
  let exactMatch = 0;
  let remediationSum = 0;
  let remediationCount = 0;

  for (const ev of evaluations) {
    if (ev.detectionRating === 'true_positive') {
      truePositives++;
    }

    if (ev.priorityAgreement === 'strongly_agree' || ev.priorityAgreement === 'agree') {
      priorityAgreed++;
    }

    const autoRank = PRIORITY_NUMERIC[ev.automatedPriority];
    const expertRank = PRIORITY_NUMERIC[ev.expertSuggestedPriority];
    const diff = autoRank - expertRank; // negative means auto was higher priority (P0=0 vs P1=1: 0 - 1 = -1)

    totalDelta += Math.abs(diff);

    if (autoRank < expertRank) {
      overEstimated++; // e.g. auto said P0 (0), expert said P2 (2)
    } else if (autoRank > expertRank) {
      underEstimated++; // e.g. auto said P2 (2), expert said P0 (0)
    } else {
      exactMatch++;
    }

    if (ev.remediationUsabilityScore) {
      remediationSum += ev.remediationUsabilityScore;
      remediationCount++;
    }
  }

  return {
    totalEvaluations: evaluations.length,
    detectionAccuracyRate: Math.round((truePositives / evaluations.length) * 1000) / 10,
    priorityAgreementRate: Math.round((priorityAgreed / evaluations.length) * 1000) / 10,
    averagePriorityDelta: Math.round((totalDelta / evaluations.length) * 100) / 100,
    averageRemediationScore: remediationCount > 0 ? Math.round((remediationSum / remediationCount) * 10) / 10 : undefined,
    priorityDivergenceBreakdown: {
      overEstimatedCount: overEstimated,
      underEstimatedCount: underEstimated,
      exactMatchCount: exactMatch,
    },
  };
}

/**
 * Generates an empty research evaluation questionnaire template in Markdown for an audit run.
 */
export function generateExpertEvaluationQuestionnaireMarkdown(params: {
  runId: string;
  targetUrl: string;
  groupedIssues: Array<{
    fingerprint: string;
    ruleId: string;
    title: string;
    status: string;
    currentPriority: Priority;
    measuredSummary: string;
  }>;
}): string {
  const { runId, targetUrl, groupedIssues } = params;

  let md = `# ProofUI UX Expert Evaluation Protocol\n\n`;
  md += `**Target URL/Fixture**: \`${targetUrl}\`\n`;
  md += `**Audit Run ID**: \`${runId}\`\n`;
  md += `**Engine Version**: \`1.0.0\`\n`;
  md += `**Date**: \`${new Date().toISOString().slice(0, 10)}\`\n\n`;

  md += `## Evaluation Instructions\n`;
  md += `Please evaluate each automated finding along three research dimensions:\n`;
  md += `1. **Detection Accuracy**: Is this a genuine user barrier (True Positive) or a false alert?\n`;
  md += `2. **Priority Appropriateness**: Does the heuristic priority (P0–P3) align with real UX impact?\n`;
  md += `3. **Remediation Viability**: Does the proposed candidate fix maintain brand and visual balance?\n\n`;
  md += `---\n\n`;

  groupedIssues.forEach((issue, idx) => {
    md += `### Issue ${idx + 1}: ${issue.title}\n`;
    md += `- **Fingerprint**: \`${issue.fingerprint}\`\n`;
    md += `- **Rule**: \`${issue.ruleId}\`\n`;
    md += `- **Status**: \`${issue.status}\`\n`;
    md += `- **Automated Priority**: **${issue.currentPriority}**\n`;
    md += `- **Measurements**: ${issue.measuredSummary}\n\n`;

    md += `#### Expert Ratings\n`;
    md += `- [ ] **Detection Validity**: [ ] True Positive (1)  [ ] False Positive (0)  [ ] Ambiguous / Review (?)\n`;
    md += `- [ ] **Priority Agreement**: [ ] Strongly Agree  [ ] Agree  [ ] Disagree  [ ] Strongly Disagree\n`;
    md += `- **Expert Suggested Priority**: [ ] P0  [ ] P1  [ ] P2  [ ] P3\n`;
    md += `- **Remediation Usability (1–5)**: _____\n`;
    md += `- **Comments / UX Rationale**: __________________________________________________\n\n`;
    md += `---\n\n`;
  });

  return md;
}
