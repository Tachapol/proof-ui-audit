import { describe, it, expect } from 'vitest';
import {
  createPilotExperimentPackage,
  exportPilotQuestionnaireMarkdown,
  PILOT_BENCHMARK_CASES,
} from '../pilot-suite';

describe('Pilot Benchmark Package & Reproducibility Bundle', () => {
  it('contains clear defect, valid exception, and ambiguous review benchmark cases', () => {
    const categories = PILOT_BENCHMARK_CASES.map(c => c.category);
    expect(categories).toContain('clear_defect');
    expect(categories).toContain('valid_exception');
    expect(categories).toContain('ambiguous_review');
  });

  it('creates a complete pilot reproducibility bundle with commit SHA and model details', () => {
    const pkg = createPilotExperimentPackage({
      gitCommitSha: 'fb066cf',
      browserEngine: 'Chromium 130.0.6723.58',
      modelId: 'gemini-2.5-flash',
      promptVersion: 'cpe-v1.2',
    });

    expect(pkg.metadata.gitCommitSha).toBe('fb066cf');
    expect(pkg.metadata.engineVersion).toBe('1.0.0');
    expect(pkg.metadata.browserEngine).toContain('Chromium');
    expect(pkg.metadata.evaluatedViewports).toHaveLength(3);
    expect(pkg.cases).toHaveLength(3);
  });

  it('exports a two-phase questionnaire in Markdown containing all pilot cases', () => {
    const pkg = createPilotExperimentPackage({ gitCommitSha: 'fb066cf' });
    const md = exportPilotQuestionnaireMarkdown(pkg);

    expect(md).toContain('ProofUI UX Expert Evaluation Protocol (Two-Phase Blind)');
    expect(md).toContain('**Commit SHA**: `fb066cf`');
    expect(md).toContain('Primary Action Button Undersized');
    expect(md).toContain('Hero Section Large Title Exemption');
    expect(md).toContain('Financial Comparison Table');
  });
});
