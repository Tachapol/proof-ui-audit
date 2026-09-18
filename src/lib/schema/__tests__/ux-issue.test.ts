import { describe, it, expect } from 'vitest';
import { UXIssueSchema, GroupedUXIssueSchema, UXIssue } from '../ux-issue';

describe('UXIssue Schema Validation', () => {
  const validIssue: UXIssue = {
    id: 'issue-1',
    ruleId: 'target-size',
    wcagCriterion: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
    status: 'candidateFail',
    title: 'Interactive target below 24×24 CSS px',
    description: 'Element has measured dimensions 18×18 px.',
    url: 'http://localhost:3123/fixtures/target-size-demo',
    viewport: { width: 375, height: 667 },
    selector: '#btn-small',
    element: 'button',
    role: 'button',
    accessibleName: 'Close',
    measured: { width: 18, height: 18 },
    expected: { minWidth: 24, minHeight: 24 },
    boundingBox: { x: 10, y: 20, width: 18, height: 18 },
    initialPriority: 'P1',
    priorityRationale: 'Interactive button with essential action is difficult to activate on mobile touchscreens.',
  };

  it('validates a correct UXIssue object', () => {
    const parsed = UXIssueSchema.safeParse(validIssue);
    expect(parsed.success).toBe(true);
  });

  it('rejects an issue missing required fields (TEST-17)', () => {
    const invalid = { ...validIssue } as Partial<UXIssue>;
    delete invalid.selector;
    const parsed = UXIssueSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects an issue with invalid status (TEST-17)', () => {
    const invalid = { ...validIssue, status: 'inaccessible' };
    const parsed = UXIssueSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates a GroupedUXIssue object (TEST-16)', () => {
    const grouped = {
      fingerprint: 'target-size:#btn-small:18x18',
      representative: validIssue,
      rawOccurrencesCount: 3,
      occurrences: [validIssue, validIssue, validIssue],
      status: 'candidateFail',
      initialPriority: 'P1',
      currentPriority: 'P1',
      decisionHistory: [],
    };
    const parsed = GroupedUXIssueSchema.safeParse(grouped);
    expect(parsed.success).toBe(true);
  });

  it('rejects grouped issue with zero occurrences', () => {
    const grouped = {
      fingerprint: 'target-size:#btn-small:18x18',
      representative: validIssue,
      rawOccurrencesCount: 0,
      occurrences: [],
      status: 'candidateFail',
      initialPriority: 'P1',
      currentPriority: 'P1',
      decisionHistory: [],
    };
    const parsed = GroupedUXIssueSchema.safeParse(grouped);
    expect(parsed.success).toBe(false);
  });
});
