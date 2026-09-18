import { describe, it, expect } from 'vitest';
import { UXIssue } from '@/lib/schema/ux-issue';
import { computeIssueFingerprint, groupUXIssues, calculateAuditSummary } from '../grouping';

describe('Deterministic Grouping and Fingerprint Generation (TEST-14, TEST-15)', () => {
  const baseIssue: UXIssue = {
    id: 'issue-1',
    ruleId: 'target-size',
    wcagCriterion: 'WCAG 2.2 SC 2.5.8',
    status: 'candidateFail',
    title: 'Target size below 24px',
    description: '18x18 px button',
    url: 'http://localhost:3123/fixtures/target-size-demo',
    viewport: { width: 375, height: 667 },
    selector: 'button.delete-btn',
    element: 'button',
    measured: { width: 18.2, height: 18.4 },
    expected: { minWidth: 24, minHeight: 24 },
    initialPriority: 'P2',
    priorityRationale: 'Target below 24px',
  };

  it('generates stable, deterministic fingerprints across variations in spacing and subpixels (TEST-15)', () => {
    const fp1 = computeIssueFingerprint(baseIssue);
    const fp2 = computeIssueFingerprint({
      ...baseIssue,
      selector: '  button.delete-btn  ',
      measured: { width: 17.9, height: 18.1 },
    });

    expect(fp1).toBe('target-size::button.delete-btn::18x18');
    expect(fp2).toBe('target-size::button.delete-btn::18x18');
    expect(fp1).toBe(fp2);
  });

  it('groups duplicate raw findings into a single unique actionable issue card (TEST-14)', () => {
    const duplicate1 = { ...baseIssue, id: 'raw-1' };
    const duplicate2 = { ...baseIssue, id: 'raw-2', viewport: { width: 1440, height: 900 } };
    const duplicate3 = { ...baseIssue, id: 'raw-3' };
    const differentIssue: UXIssue = {
      ...baseIssue,
      id: 'raw-4',
      selector: 'button.save-btn',
      measured: { width: 12, height: 12 },
    };

    const grouped = groupUXIssues([duplicate1, duplicate2, duplicate3, differentIssue]);

    expect(grouped.length).toBe(2);

    const deleteGroup = grouped.find((g) => g.fingerprint.includes('button.delete-btn'));
    expect(deleteGroup).toBeDefined();
    expect(deleteGroup?.rawOccurrencesCount).toBe(3);
    expect(deleteGroup?.occurrences.length).toBe(3);

    const saveGroup = grouped.find((g) => g.fingerprint.includes('button.save-btn'));
    expect(saveGroup).toBeDefined();
    expect(saveGroup?.rawOccurrencesCount).toBe(1);
  });

  it('calculates audit summary counts accurately', () => {
    const passIssue: UXIssue = { ...baseIssue, id: 'p1', status: 'pass' };
    const failIssue: UXIssue = { ...baseIssue, id: 'f1', status: 'candidateFail', selector: '#f1' };
    const reviewIssue: UXIssue = { ...baseIssue, id: 'r1', status: 'needsReview', selector: '#r1' };

    const grouped = groupUXIssues([passIssue, failIssue, reviewIssue]);
    const summary = calculateAuditSummary([passIssue, failIssue, reviewIssue], grouped);

    expect(summary.totalRawFindings).toBe(3);
    expect(summary.totalGroupedIssues).toBe(3);
    expect(summary.passCount).toBe(1);
    expect(summary.candidateFailCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);
  });
});
