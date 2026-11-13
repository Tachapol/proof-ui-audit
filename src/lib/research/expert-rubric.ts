import { z } from 'zod';
import { Priority, PrioritySchema, ViewportSchema } from '@/lib/schema/ux-issue';

// ==========================================
// 1. Experiment Reproducibility Metadata
// ==========================================

export const ExperimentMetadataSchema = z.object({
  experimentId: z.string().min(1),
  gitCommitSha: z.string().min(7),
  engineVersion: z.string().default('1.0.0'),
  modelId: z.string().min(1),             // e.g., 'gemini-1.5-pro' | 'cpe-template-fallback'
  promptVersion: z.string().min(1),       // e.g., 'cpe-v1.2-grounded'
  browserEngine: z.string().min(1),       // e.g., 'Chromium 130.0.6723.58 (Official Build)'
  evaluatedViewports: z.array(ViewportSchema),
  fixtureSuiteId: z.string().min(1),      // e.g., 'pilot-wcag22-benchmark-v1'
  timestamp: z.string().datetime(),
  environmentNotes: z.string().optional(),
});
export type ExperimentMetadata = z.infer<typeof ExperimentMetadataSchema>;

// ==========================================
// 2. Expert Weighting Configuration (AHP/Consensus Model)
// ==========================================

export const ExpertWeightingConfigSchema = z.object({
  version: z.string().default('AHP-Consensus-1.0.0'),
  deficitMagnitudeWeight: z.number().min(0).max(1).default(0.50),   // Weight of physical/computational deficit
  elementCriticalityWeight: z.number().min(0).max(1).default(0.30), // Weight of button/link/interactive role
  audienceContextWeight: z.number().min(0).max(1).default(0.20),    // Weight of vulnerable/sensitive cohort
  notes: z.string().optional(),
});
export type ExpertWeightingConfig = z.infer<typeof ExpertWeightingConfigSchema>;

export const DEFAULT_EXPERT_WEIGHTS: ExpertWeightingConfig = {
  version: 'AHP-Consensus-1.0.0',
  deficitMagnitudeWeight: 0.50,
  elementCriticalityWeight: 0.30,
  audienceContextWeight: 0.20,
  notes: 'Baseline weights derived from expert consensus on WCAG 2.2 touch and vision barriers.',
};

/**
 * Calculates a composite severity score (0–100) using expert consensus weights.
 */
export function calculateWeightedSeverityScore(
  scores: {
    deficitScore: number;     // 0–100
    criticalityScore: number; // 0–100
    audienceScore: number;    // 0–100
  },
  weights: ExpertWeightingConfig = DEFAULT_EXPERT_WEIGHTS
): number {
  const composite =
    scores.deficitScore * weights.deficitMagnitudeWeight +
    scores.criticalityScore * weights.elementCriticalityWeight +
    scores.audienceScore * weights.audienceContextWeight;

  return Math.min(100, Math.max(0, Math.round(composite)));
}

// ==========================================
// 3. Two-Phase Blind Evaluation Rubric
// ==========================================

export const DetectionRatingSchema = z.enum([
  'true_positive',    // Finding represents a genuine UX/accessibility barrier
  'false_positive',   // Finding is incorrect or an inapplicable technical artifact
  'ambiguous_review', // Finding is an edge case legitimately requiring human nuance
]);
export type DetectionRating = z.infer<typeof DetectionRatingSchema>;

export const PriorityAgreementSchema = z.enum([
  'strongly_agree',    // Automated priority matches expert UX triage
  'agree',             // Acceptable for production triage
  'neutral',           // Borderline priority
  'disagree',          // Noticeably too high or too low
  'strongly_disagree', // Critically misleading
]);
export type PriorityAgreement = z.infer<typeof PriorityAgreementSchema>;

/**
 * Two-Phase Evaluation for an individual finding to mitigate anchoring bias:
 * Phase 1 (Blind): Expert evaluates the UI finding independently BEFORE seeing automated priority or AI text.
 * Phase 2 (Assisted): System reveals its automated priority and AI critique for alignment rating.
 */
export const ExpertIssueEvaluationSchema = z.object({
  id: z.string().min(1),
  expertId: z.string().min(1),
  expertName: z.string().min(1),
  timestamp: z.string().datetime(),
  issueFingerprint: z.string().min(1),
  ruleId: z.string().min(1),

  // Phase 1: Unassisted / Blind Assessment (Anti-Anchoring)
  phase1_blind: z.object({
    isGenuineDefect: z.boolean(),                 // Independent true/false defect decision
    independentPriority: PrioritySchema,          // Expert's independent priority before seeing system output
    independentRationale: z.string().optional(),
    detectionConfidence: z.number().int().min(1).max(5), // 1 to 5 Likert scale
  }),

  // Phase 2: Assisted System Comparison (Revealed System Output)
  phase2_assisted: z.object({
    automatedPriority: PrioritySchema,            // Revealed machine priority
    priorityAgreement: PriorityAgreementSchema,
    detectionRating: DetectionRatingSchema,       // Post-reveal classification: TP vs FP
    aiCritiqueHelpfulnessScore: z.number().int().min(1).max(5).optional(), // 1 to 5 Likert scale
    remediationUsabilityScore: z.number().int().min(1).max(5).optional(),  // 1 (Harmful) to 5 (Optimal)
    aestheticPreservationScore: z.number().int().min(1).max(5).optional(), // 1 (Broken) to 5 (Preserved)
    expertComments: z.string().optional(),
  }),
});
export type ExpertIssueEvaluation = z.infer<typeof ExpertIssueEvaluationSchema>;

export const ExpertSessionRubricSchema = z.object({
  sessionId: z.string().min(1),
  expertId: z.string().min(1),
  expertRole: z.enum(['ux_designer', 'accessibility_specialist', 'frontend_engineer', 'product_manager']),
  metadata: ExperimentMetadataSchema,
  evaluations: z.array(ExpertIssueEvaluationSchema),
  overallFeedback: z.string().optional(),
});
export type ExpertSessionRubric = z.infer<typeof ExpertSessionRubricSchema>;

// ==========================================
// 4. Research Validation Metrics Calculators
// ==========================================

export interface ResearchValidationSummary {
  totalEvaluations: number;
  /**
   * Precision = TP / (TP + FP).
   * Note on Research Limitation: This evaluates flagged issues only (Precision).
   * Recall cannot be determined until ground-truth annotations of missed defects (False Negatives)
   * are collected in full UI audits.
   */
  detectionPrecisionRate: number;     // % Precision: TP / (TP + FP)
  priorityAgreementRate: number;      // % strongly_agree + agree
  blindPriorityMatchRate: number;     // % exact match between Blind Expert Priority and Machine Priority
  averagePriorityDelta: number;       // Numeric absolute difference between expert and automated priority
  averageAiHelpfulnessScore?: number; // Out of 5
  averageRemediationScore?: number;   // Out of 5
  priorityDivergenceBreakdown: {
    overEstimatedCount: number;       // Automated priority was higher than expert
    underEstimatedCount: number;      // Automated priority was lower than expert
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
      detectionPrecisionRate: 0,
      priorityAgreementRate: 0,
      blindPriorityMatchRate: 0,
      averagePriorityDelta: 0,
      priorityDivergenceBreakdown: {
        overEstimatedCount: 0,
        underEstimatedCount: 0,
        exactMatchCount: 0,
      },
    };
  }

  let truePositives = 0;
  let falsePositives = 0;
  let priorityAgreed = 0;
  let blindMatches = 0;
  let totalDelta = 0;
  let overEstimated = 0;
  let underEstimated = 0;
  let exactMatch = 0;

  let helpfulnessSum = 0;
  let helpfulnessCount = 0;
  let remediationSum = 0;
  let remediationCount = 0;

  for (const ev of evaluations) {
    const isTP = ev.phase2_assisted.detectionRating === 'true_positive';
    const isFP = ev.phase2_assisted.detectionRating === 'false_positive';
    if (isTP) truePositives++;
    if (isFP) falsePositives++;

    if (ev.phase2_assisted.priorityAgreement === 'strongly_agree' || ev.phase2_assisted.priorityAgreement === 'agree') {
      priorityAgreed++;
    }

    if (ev.phase1_blind.independentPriority === ev.phase2_assisted.automatedPriority) {
      blindMatches++;
    }

    const autoRank = PRIORITY_NUMERIC[ev.phase2_assisted.automatedPriority];
    const expertRank = PRIORITY_NUMERIC[ev.phase1_blind.independentPriority];
    const diff = autoRank - expertRank;

    totalDelta += Math.abs(diff);

    if (autoRank < expertRank) {
      overEstimated++; // e.g. auto was P0 (0) while expert blind was P2 (2)
    } else if (autoRank > expertRank) {
      underEstimated++; // e.g. auto was P2 (2) while expert blind was P0 (0)
    } else {
      exactMatch++;
    }

    if (ev.phase2_assisted.aiCritiqueHelpfulnessScore) {
      helpfulnessSum += ev.phase2_assisted.aiCritiqueHelpfulnessScore;
      helpfulnessCount++;
    }

    if (ev.phase2_assisted.remediationUsabilityScore) {
      remediationSum += ev.phase2_assisted.remediationUsabilityScore;
      remediationCount++;
    }
  }

  const evaluatedFindingsCount = truePositives + falsePositives;
  const precision = evaluatedFindingsCount > 0
    ? Math.round((truePositives / evaluatedFindingsCount) * 1000) / 10
    : 0;

  return {
    totalEvaluations: evaluations.length,
    detectionPrecisionRate: precision,
    priorityAgreementRate: Math.round((priorityAgreed / evaluations.length) * 1000) / 10,
    blindPriorityMatchRate: Math.round((blindMatches / evaluations.length) * 1000) / 10,
    averagePriorityDelta: Math.round((totalDelta / evaluations.length) * 100) / 100,
    averageAiHelpfulnessScore: helpfulnessCount > 0 ? Math.round((helpfulnessSum / helpfulnessCount) * 10) / 10 : undefined,
    averageRemediationScore: remediationCount > 0 ? Math.round((remediationSum / remediationCount) * 10) / 10 : undefined,
    priorityDivergenceBreakdown: {
      overEstimatedCount: overEstimated,
      underEstimatedCount: underEstimated,
      exactMatchCount: exactMatch,
    },
  };
}

/**
 * Generates an empty research evaluation questionnaire template in Markdown with Two-Phase Blind instructions.
 */
export function generateExpertEvaluationQuestionnaireMarkdown(params: {
  runId: string;
  targetUrl: string;
  gitCommitSha?: string;
  groupedIssues: Array<{
    fingerprint: string;
    ruleId: string;
    title: string;
    status: string;
    currentPriority: Priority;
    measuredSummary: string;
  }>;
}): string {
  const { runId, targetUrl, gitCommitSha = 'HEAD', groupedIssues } = params;

  let md = `# ProofUI UX Expert Evaluation Protocol (Two-Phase Blind)\n\n`;
  md += `**Target URL/Fixture**: \`${targetUrl}\`\n`;
  md += `**Audit Run ID**: \`${runId}\`\n`;
  md += `**Commit SHA**: \`${gitCommitSha}\`\n`;
  md += `**Engine Version**: \`1.0.0\`\n`;
  md += `**Protocol Version**: \`Two-Phase Blind v1.0.0\`\n`;
  md += `**Date**: \`${new Date().toISOString().slice(0, 10)}\`\n\n`;

  md += `## Evaluation Protocol Instructions\n`;
  md += `To prevent anchoring bias, this evaluation proceeds in two distinct steps:\n`;
  md += `1. **Phase 1 (Blind)**: Review the UI element snippet and visual context. Assign your independent severity without viewing the system's priority.\n`;
  md += `2. **Phase 2 (Assisted Comparison)**: Reveal the automated heuristic priority and AI suggestion. Rate the agreement, precision (True/False Positive), and candidate fix.\n\n`;
  md += `---\n\n`;

  groupedIssues.forEach((issue, idx) => {
    md += `### Issue ${idx + 1}: ${issue.title}\n`;
    md += `- **Fingerprint**: \`${issue.fingerprint}\`\n`;
    md += `- **Rule**: \`${issue.ruleId}\`\n`;
    md += `- **Status**: \`${issue.status}\`\n`;
    md += `- **Measurements**: ${issue.measuredSummary}\n\n`;

    md += `#### Step 1: Phase 1 — Blind Evaluation (Do not look at automated priority)\n`;
    md += `- **Is Genuine Defect?**: [ ] Yes  [ ] No (False alert)  [ ] Ambiguous / Review\n`;
    md += `- **Independent Expert Priority**: [ ] P0 (Blocker)  [ ] P1 (High)  [ ] P2 (Medium)  [ ] P3 (Low)\n`;
    md += `- **Independent UX Rationale**: __________________________________________________\n\n`;

    md += `#### Step 2: Phase 2 — System Comparison (Revealed Priority: **${issue.currentPriority}**)\n`;
    md += `- **Classification**: [ ] True Positive (Genuine)  [ ] False Positive (Inapplicable)  [ ] Ambiguous\n`;
    md += `- **Priority Agreement**: [ ] Strongly Agree  [ ] Agree  [ ] Neutral  [ ] Disagree  [ ] Strongly Disagree\n`;
    md += `- **AI Critique Helpfulness (1–5)**: _____\n`;
    md += `- **Remediation Usability (1–5)**: _____\n`;
    md += `- **Expert Feedback**: __________________________________________________\n\n`;
    md += `---\n\n`;
  });

  return md;
}
