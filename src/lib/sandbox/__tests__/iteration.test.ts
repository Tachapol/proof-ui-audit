import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UXIssue } from '@/lib/schema/ux-issue';
import { runBrowserAudit } from '@/lib/audit/browser';
import { runMultiCandidateIteration } from '../iteration';

vi.mock('@/lib/audit/browser', () => ({
  runBrowserAudit: vi.fn(),
  DEFAULT_AUDIT_VIEWPORTS: [{ width: 375, height: 667 }],
}));
vi.mock('../store', () => ({ saveSandboxSnippet: () => ({ id: 'test-snippet' }) }));

function issue(overrides: Partial<UXIssue> = {}): UXIssue {
  return {
    id: 'target', ruleId: 'target-size', wcagCriterion: '2.5.8', status: 'candidateFail',
    title: 'Small target', description: 'Measured target', url: 'http://localhost:3123',
    viewport: { width: 375, height: 667 }, selector: '#target', element: 'button',
    measured: { width: 16, height: 19 }, expected: { minWidth: 24, minHeight: 24 },
    initialPriority: 'P1', priorityRationale: 'Project heuristic', ...overrides,
  };
}
function audit(issues: UXIssue[], errors: string[] = []) {
  vi.mocked(runBrowserAudit).mockResolvedValue({ issues, errors, pageScreenshots: [] });
}
const run = (baseline = [issue()]) => runMultiCandidateIteration('<button id="target">Test</button>', baseline, 'http://localhost:3123');

beforeEach(() => vi.resetAllMocks());
describe('Sandbox verification evidence', () => {
  it('does not verify a failed browser audit', async () => {
    vi.mocked(runBrowserAudit).mockRejectedValue(new Error('Browser unavailable'));
    for (const candidate of await run()) {
      expect(candidate.verificationStatus).toBe('unable_to_verify');
      expect(candidate.verified).toBe(false);
      expect(candidate.metrics.targetSize?.after).toBe('Unable to verify');
      expect(candidate.verificationErrors.length).toBeGreaterThan(0);
    }
  });
  it('does not treat an empty result as success', async () => {
    audit([]);
    expect((await run()).every(c => !c.verified && c.verificationStatus === 'unable_to_verify')).toBe(true);
  });
  it('preserves actual measurements and their selector, rule and viewport', async () => {
    audit([issue({ status: 'pass', measured: { width: 31, height: 28 } })]);
    const [candidate] = await run();
    expect(candidate.verificationStatus).toBe('verified');
    expect(candidate.metrics.targetSize).toEqual({ before: '16 × 19 CSS px', after: '31 × 28 CSS px', passed: true });
    expect(candidate.measurements[0]).toMatchObject({ selector: '#target', ruleId: 'target-size', viewport: { width: 375, height: 667 }, after: { width: 31, height: 28 } });
    expect(candidate.metrics.contrast?.after).toBe('Unable to verify');
    expect(candidate.checks.find(check => check.id === 'contrast-check')?.passed).toBe(false);
  });
  it('does not verify pass findings without required numeric evidence', async () => {
    audit([issue({ status: 'pass', measured: {} })]);
    expect((await run())[0].verificationStatus).toBe('unable_to_verify');
  });
  it('does not verify missing baseline elements', async () => {
    audit([issue({ selector: '#different', status: 'pass' })]);
    const [candidate] = await run();
    expect(candidate.verified).toBe(false);
    expect(candidate.measurements[0].status).toBe('unable_to_verify');
  });
  it('does not verify an incomplete viewport audit', async () => {
    audit([issue({ status: 'pass' })], ['Desktop viewport failed']);
    expect((await run())[0].verificationStatus).toBe('unable_to_verify');
  });
  it('requires human review for needsReview findings', async () => {
    audit([issue({ status: 'needsReview' })]);
    expect((await run())[0].verificationStatus).toBe('unable_to_verify');
  });
  it('does not verify a reduced failure count when failures remain', async () => {
    audit([issue()]);
    const [candidate] = await run([issue(), issue({ selector: '#second' })]);
    expect(candidate.verified).toBe(false);
  });
  it('rejects a candidate with new failures even when more old failures resolve', async () => {
    const baseline = [issue(), issue({ selector: '#second' }), issue({ selector: '#third', status: 'pass' })];
    audit([issue({ status: 'pass' }), issue({ selector: '#second', status: 'pass' }), issue({ selector: '#third' })]);
    const [candidate] = await run(baseline);
    expect(candidate.verified).toBe(false);
    expect(candidate.verificationStatus).toBe('failed');
    expect(candidate.regression.status).toBe('regressed');
    expect(candidate.regression.counts).toEqual({ resolved: 2, persistent: 0, new: 1, unverified: 0 });
  });
  it('reports failed when complete measurements still fail', async () => {
    audit([issue()]);
    expect((await run())[0].verificationStatus).toBe('failed');
  });
  it('displays measured contrast rather than a preset ratio', async () => {
    const baseline = issue({ ruleId: 'text-contrast', measured: { contrastRatio: 2.37 }, expected: { minRatio: 4.5 } });
    audit([{ ...baseline, status: 'pass', measured: { contrastRatio: 5.63 } }]);
    expect((await run([baseline]))[0].metrics.contrast).toEqual({ before: '2.37:1', after: '5.63:1', passed: true });
  });
});
