import { UXIssue, GroupedUXIssue, AuditSummary } from '@/lib/schema/ux-issue';
import { resolveGroupedPriority } from './priority-engine';

export function createMeasurementSignature(issue: UXIssue): string {
  const measured = issue.measured || {};

  switch (issue.ruleId) {
    case 'target-size': {
      const w = Math.round(Number(measured.width || 0));
      const h = Math.round(Number(measured.height || 0));
      if (measured.hasSpacingAlternative === false && measured.closestTargetDistance) {
        return `${w}x${h}-spacing-${Math.round(Number(measured.closestTargetDistance))}`;
      }
      return `${w}x${h}`;
    }
    case 'text-contrast': {
      if (typeof measured.contrastRatio === 'number') {
        const ratio = measured.contrastRatio.toFixed(1);
        return `ratio-${ratio}`;
      }
      if (measured.hasComplexBackground) return 'complex-bg';
      if (measured.hasUnresolvedTransparency) return 'unresolved-transparency';
      if (measured.hasAncestorGroupOpacity) return 'group-opacity';
      return 'unknown';
    }
    case 'non-text-contrast': {
      if (typeof measured.contrastRatio === 'number') {
        const ratio = measured.contrastRatio.toFixed(1);
        return `ratio-${ratio}`;
      }
      if (measured.hasUncertainComponentState) return 'uncertain-state';
      if (measured.hasComplexGraphic) return 'complex-graphic';
      return 'unknown';
    }
    case 'reflow': {
      if (measured.clipDeficitPx) return `clipped-${Math.round(Number(measured.clipDeficitPx))}`;
      if (measured.violation) return `control-${measured.violation}`;
      if (measured.isNestedScroll) return 'nested-scroll';
      if (measured.isEssential2D) return 'essential-2d';
      const scrollW = Math.round(Number(measured.scrollWidth || 0));
      const overflow = Math.round(Number(measured.horizontalOverflowPx || 0));
      return `scroll-${scrollW}-overflow-${overflow}`;
    }
    case 'text-spacing': {
      if (measured.isControlObscured) return 'obscured-control';
      if (measured.isBoundingBoxEscaped) return 'escaped';
      if (Number(measured.horizontalClipDeficitPx || 0) > 0) {
        return `horiz-clipped-${Math.round(Number(measured.horizontalClipDeficitPx))}`;
      }
      if (measured.isClipped) return `clipped-${Math.round(Number(measured.clipDeficitPx || 0))}`;
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

  for (const [fingerprint, rawOccurrences] of groups.entries()) {
    // Sort occurrences stably by viewport width and id
    const occurrences = rawOccurrences.slice().sort((a, b) => {
      if (a.viewport.width !== b.viewport.width) {
        return a.viewport.width - b.viewport.width;
      }
      return a.id.localeCompare(b.id);
    });

    // Representative issue: prefer candidateFail over needsReview over pass.
    // Within the same status, prefer an occurrence that has a captured screenshot.
    const candidateFail =
      occurrences.find((i) => i.status === 'candidateFail' && i.screenshotPath) ||
      occurrences.find((i) => i.status === 'candidateFail');
    const needsReview =
      occurrences.find((i) => i.status === 'needsReview' && i.screenshotPath) ||
      occurrences.find((i) => i.status === 'needsReview');
    const representative =
      candidateFail ||
      needsReview ||
      occurrences.find((i) => i.screenshotPath) ||
      occurrences[0];

    // Priority ordering via Priority Engine
    const { priority: currentPriority, initialPriority } = resolveGroupedPriority(occurrences);

    // Aggregate status policy: candidateFail (actionable defect) > needsReview (advisory exception check) > pass.
    // If occurrences differ in status across viewports, explicitly expose hasMixedStatus flag.
    const distinctStatuses = new Set(occurrences.map((o) => o.status));
    const hasMixedStatus = distinctStatuses.size > 1;

    grouped.push({
      fingerprint,
      representative,
      rawOccurrencesCount: occurrences.length,
      occurrences,
      status: representative.status,
      hasMixedStatus,
      initialPriority,
      currentPriority,
      designerDecision: representative.designerDecision,
      designerReason: representative.designerReason,
      editedRecommendation: representative.editedRecommendation,
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
