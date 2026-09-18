import { UXIssue, GroupedUXIssue, AuditSummary } from '@/lib/schema/ux-issue';

export function createMeasurementSignature(issue: UXIssue): string {
  const measured = issue.measured || {};

  switch (issue.ruleId) {
    case 'target-size': {
      const w = Math.round(Number(measured.width || 0));
      const h = Math.round(Number(measured.height || 0));
      return `${w}x${h}`;
    }
    case 'text-contrast':
    case 'non-text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio.toFixed(1) : 'unknown';
      return `ratio-${ratio}`;
    }
    case 'reflow': {
      const scrollW = Math.round(Number(measured.scrollWidth || 0));
      const overflow = Math.round(Number(measured.horizontalOverflowPx || 0));
      return `scroll-${scrollW}-overflow-${overflow}`;
    }
    case 'text-spacing': {
      if (measured.isClipped) return `clipped-${measured.clipDeficitPx || 0}`;
      if (measured.hasTextOverlap) return 'overlap';
      return 'clean';
    }
    default: {
      return JSON.stringify(measured);
    }
  }
}

export function computeIssueFingerprint(issue: UXIssue): string {
  const normSelector = issue.selector.trim().toLowerCase().replace(/\s+/g, ' ');
  const sig = createMeasurementSignature(issue);
  return `${issue.ruleId}::${normSelector}::${sig}`;
}

export function groupUXIssues(issues: UXIssue[]): GroupedUXIssue[] {
  const groups = new Map<string, UXIssue[]>();

  for (const issue of issues) {
    const fp = computeIssueFingerprint(issue);
    const list = groups.get(fp) || [];
    list.push(issue);
    groups.set(fp, list);
  }

  const grouped: GroupedUXIssue[] = [];

  for (const [fingerprint, occurrences] of groups.entries()) {
    // Representative issue: prefer candidateFail over needsReview over pass; otherwise first occurrence
    const candidateFail = occurrences.find((i) => i.status === 'candidateFail');
    const needsReview = occurrences.find((i) => i.status === 'needsReview');
    const representative = candidateFail || needsReview || occurrences[0];

    // Priority ordering P0 > P1 > P2 > P3
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const highestPriority = occurrences.reduce((highest, curr) => {
      return priorityRank[curr.initialPriority] < priorityRank[highest] ? curr.initialPriority : highest;
    }, occurrences[0].initialPriority);

    grouped.push({
      fingerprint,
      representative,
      rawOccurrencesCount: occurrences.length,
      occurrences,
      status: representative.status,
      initialPriority: highestPriority,
      currentPriority: highestPriority,
      designerDecision: representative.designerDecision,
      designerReason: representative.designerReason,
      decisionHistory: [],
    });
  }

  return grouped;
}

export function calculateAuditSummary(rawIssues: UXIssue[], groupedIssues: GroupedUXIssue[]): AuditSummary {
  let passCount = 0;
  let candidateFailCount = 0;
  let needsReviewCount = 0;

  for (const group of groupedIssues) {
    if (group.status === 'pass') passCount++;
    else if (group.status === 'candidateFail') candidateFailCount++;
    else if (group.status === 'needsReview') needsReviewCount++;
  }

  return {
    totalRawFindings: rawIssues.length,
    totalGroupedIssues: groupedIssues.length,
    passCount,
    candidateFailCount,
    needsReviewCount,
  };
}
