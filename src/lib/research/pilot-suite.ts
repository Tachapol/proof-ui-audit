import { ExperimentMetadata, generateExpertEvaluationQuestionnaireMarkdown } from './expert-rubric';
import { Priority } from '@/lib/schema/ux-issue';

export interface PilotBenchmarkCase {
  caseId: string;
  name: string;
  category: 'clear_defect' | 'valid_exception' | 'ambiguous_review';
  ruleId: string;
  wcagCriterion: string;
  expectedGroundTruth: {
    isGenuineDefect: boolean;
    expectedStatus: 'pass' | 'candidateFail' | 'needsReview';
    consensusPriority: Priority;
    rationale: string;
  };
  sampleHtmlSnippet: string;
  selector: string;
}

export const PILOT_BENCHMARK_CASES: PilotBenchmarkCase[] = [
  // 1. Clear Defect Case: Critical Touch Target & Contrast Failure
  {
    caseId: 'pilot-case-1-clear-defect',
    name: 'Primary Action Button Undersized & Low Luminance',
    category: 'clear_defect',
    ruleId: 'target-size',
    wcagCriterion: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
    expectedGroundTruth: {
      isGenuineDefect: true,
      expectedStatus: 'candidateFail',
      consensusPriority: 'P1',
      rationale: 'Primary checkout button is 18×18 px with adjacent interactive element; high risk of mis-taps on touchscreens.',
    },
    sampleHtmlSnippet: `<div class="p-4 bg-white"><button id="checkout-action-btn" class="bg-blue-600 text-white" style="width:18px;height:18px;padding:0;">✓</button></div>`,
    selector: '#checkout-action-btn',
  },

  // 2. Valid Exception Case: Large Text 3:1 Contrast Exemption
  {
    caseId: 'pilot-case-2-valid-exception',
    name: 'Hero Section Large Title Exemption',
    category: 'valid_exception',
    ruleId: 'text-contrast',
    wcagCriterion: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum)',
    expectedGroundTruth: {
      isGenuineDefect: false,
      expectedStatus: 'pass',
      consensusPriority: 'P3',
      rationale: 'Bold title at 26px requires only 3:1 contrast ratio under SC 1.4.3 large text exemption; measured ratio is 3.2:1.',
    },
    sampleHtmlSnippet: `<div class="p-6 bg-slate-100"><h1 id="hero-title" class="text-2xl font-bold text-slate-500">Course Catalog</h1></div>`,
    selector: '#hero-title',
  },

  // 3. Ambiguous Review Case: Essential Two-Dimensional Data Table Reflow
  {
    caseId: 'pilot-case-3-ambiguous-review',
    name: 'Financial Comparison Table Requiring Two-Dimensional Pan',
    category: 'ambiguous_review',
    ruleId: 'reflow',
    wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
    expectedGroundTruth: {
      isGenuineDefect: false,
      expectedStatus: 'needsReview',
      consensusPriority: 'P3',
      rationale: 'Table has horizontal scroll at 320px; human inspection is required to verify whether two-dimensional spatial layout is essential.',
    },
    sampleHtmlSnippet: `<div class="overflow-x-auto"><table id="data-comparison-table" class="min-w-[480px]"><tr><th>Metric</th><th>2025</th><th>2026</th></tr></table></div>`,
    selector: '#data-comparison-table',
  },
];

export interface PilotExperimentPackage {
  metadata: ExperimentMetadata;
  cases: PilotBenchmarkCase[];
  protocolVersion: string;
  instructions: {
    phase1_blind: string;
    phase2_assisted: string;
  };
}

export function createPilotExperimentPackage(params: {
  gitCommitSha: string;
  browserEngine?: string;
  modelId?: string;
  promptVersion?: string;
}): PilotExperimentPackage {
  const metadata: ExperimentMetadata = {
    experimentId: `pilot-exp-${Date.now()}`,
    gitCommitSha: params.gitCommitSha,
    engineVersion: '1.0.0',
    modelId: params.modelId || 'gemini-2.5-flash-grounded',
    promptVersion: params.promptVersion || 'cpe-v1.2-blind',
    browserEngine: params.browserEngine || 'Chromium 130.0 (Playwright)',
    evaluatedViewports: [
      { width: 320, height: 640 },
      { width: 375, height: 812 },
      { width: 1440, height: 900 },
    ],
    fixtureSuiteId: 'proofui-pilot-benchmark-v1',
    timestamp: new Date().toISOString(),
    environmentNotes: 'Deterministic pilot package containing clear defect, valid exception, and ambiguous review cases.',
  };

  return {
    metadata,
    cases: PILOT_BENCHMARK_CASES,
    protocolVersion: 'Two-Phase Blind Evaluation Protocol v1.0.0',
    instructions: {
      phase1_blind: 'Review each case in isolation based on code and screenshot. State whether it is a genuine defect and assign severity without system assistance.',
      phase2_assisted: 'Reveal ProofUI automated priority and AI explanation. Rate alignment (Precision), critique helpfulness, and remediation quality.',
    },
  };
}

export function exportPilotQuestionnaireMarkdown(pkg: PilotExperimentPackage): string {
  const dummyGrouped = pkg.cases.map(c => ({
    fingerprint: `${c.ruleId}::${c.selector}`,
    ruleId: c.ruleId,
    title: c.name,
    status: c.expectedGroundTruth.expectedStatus,
    currentPriority: c.expectedGroundTruth.consensusPriority,
    measuredSummary: c.expectedGroundTruth.rationale,
  }));

  return generateExpertEvaluationQuestionnaireMarkdown({
    runId: pkg.metadata.experimentId,
    targetUrl: `fixture://${pkg.metadata.fixtureSuiteId}`,
    gitCommitSha: pkg.metadata.gitCommitSha,
    groupedIssues: dummyGrouped,
  });
}
