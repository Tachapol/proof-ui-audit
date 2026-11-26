import { describe, expect, it } from 'vitest';
import type { UXIssue } from '@/lib/schema/ux-issue';
import { compareRegression } from '../regression';

const issue = (overrides: Partial<UXIssue> = {}): UXIssue => ({
  id: 'old-id', ruleId: 'target-size', wcagCriterion: '2.5.8', status: 'candidateFail',
  title: 'Target', description: 'Measured target', url: 'http://localhost/before',
  viewport: { width: 375, height: 667 }, selector: '#target', element: 'button',
  measured: { width: 16, height: 19 }, expected: { minWidth: 24, minHeight: 24 },
  initialPriority: 'P1', priorityRationale: 'Project heuristic', ...overrides,
});

describe('Occurrence regression comparison', () => {
  it('detects a new failure even when total failures decrease', () => {
    const baseline = [issue(), issue({ selector: '#second' }), issue({ selector: '#third', status: 'pass' })];
    const candidate = [issue({ status: 'pass' }), issue({ selector: '#second', status: 'pass' }), issue({ selector: '#third' })];
    const result = compareRegression(baseline, candidate);
    expect(result.status).toBe('regressed');
    expect(result.counts).toEqual({ resolved: 2, persistent: 0, new: 1, unverified: 0 });
    expect(result.findings.find(f => f.change === 'new')?.after?.selector).toBe('#third');
  });
  it('matches independently of run IDs and snippet URLs', () => {
    const result = compareRegression([issue()], [issue({ id: 'new-id', url: 'http://localhost/after', status: 'pass' })]);
    expect(result.counts.resolved).toBe(1);
  });
  it('does not treat a missing element as resolved', () => {
    const result = compareRegression([issue()], []);
    expect(result.status).toBe('unable_to_verify');
    expect(result.counts.resolved).toBe(0);
    expect(result.counts.unverified).toBe(1);
  });
  it('keeps viewports and rules distinct', () => {
    const before = [issue(), issue({ viewport: { width: 1440, height: 900 } })];
    const result = compareRegression(before, [issue({ status: 'pass' }), issue({ ruleId: 'text-contrast', measured: { contrastRatio: 2 } })]);
    expect(result.counts).toEqual({ resolved: 1, persistent: 0, new: 1, unverified: 1 });
  });
  it('records persistent failures', () => {
    expect(compareRegression([issue()], [issue()]).counts.persistent).toBe(1);
  });
  it('preserves uncertainty for needsReview on either side', () => {
    expect(compareRegression([issue()], [issue({ status: 'needsReview' })]).counts.unverified).toBe(1);
    expect(compareRegression([issue({ status: 'needsReview' })], [issue()]).counts.unverified).toBe(1);
  });
  it('does not claim resolution during a partial audit', () => {
    const result = compareRegression([issue()], [issue({ status: 'pass' })], ['Viewport failed']);
    expect(result.counts.resolved).toBe(0);
    expect(result.status).toBe('unable_to_verify');
  });
  it('requires valid measurements', () => {
    expect(compareRegression([issue()], [issue({ status: 'pass', measured: {} })]).status).toBe('unable_to_verify');
  });
  it('does not silently match duplicate identities', () => {
    const result = compareRegression([issue(), issue()], [issue({ status: 'pass' })]);
    expect(result.counts.unverified).toBe(1);
    expect(result.counts.resolved).toBe(0);
  });
  it('reports unchanged passing checks without inventing improvements', () => {
    const result = compareRegression([issue({ status: 'pass' })], [issue({ status: 'pass' })]);
    expect(result.status).toBe('no_new_failures');
    expect(result.findings).toEqual([]);
  });
  it('cannot establish a comparison with no baseline', () => {
    expect(compareRegression([], [issue({ status: 'pass' })]).status).toBe('unable_to_verify');
  });
});
