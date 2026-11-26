import { UXIssue, GroupedUXIssue, AuditSummary, type AuditRun } from '@/lib/schema/ux-issue';
import { resolveGroupedPriority } from './priority-engine';
import { collectTouchTargetLabels, labelTouchTargetPair, touchTargetPairFingerprint } from './touch-target-pair';

export function createMeasurementSignature(issue: UXIssue): string {
  const measured = issue.measured || {};

  switch (issue.ruleId) {
    case 'touch-target-spacing':
      return JSON.stringify({ version: issue.metric?.metricVersion, nearestSelector: (measured.nearestTarget as { selector?: string } | null)?.selector ?? null, distance: measured.distance, overlap: measured.overlap });
    case 'heading-hierarchy':
      return JSON.stringify({ version: issue.metric?.metricVersion, level: measured.level, previousHeading: measured.previousHeading, skippedLevels: measured.skippedLevels });
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
  const pairFingerprint = touchTargetPairFingerprint(issue);
  if (pairFingerprint) return pairFingerprint;
  const normSelector = issue.metric ? issue.selector.trim() : issue.selector.trim().toLowerCase().replace(/\s+/g, ' ');
  const sig = createMeasurementSignature(issue);
  return `${issue.ruleId}::${normSelector}::${sig}`;
}

export function groupUXIssues(issues: UXIssue[]): GroupedUXIssue[] {
  const groups = new Map<string, UXIssue[]>();
  const actionLabels = collectTouchTargetLabels(issues);

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
    const measuredRepresentative =
      candidateFail ||
      needsReview ||
      occurrences.find((i) => i.screenshotPath) ||
      occurrences[0];
    const pairTitle = labelTouchTargetPair(measuredRepresentative, actionLabels);
    const representative = pairTitle ? { ...measuredRepresentative, title: pairTitle } : measuredRepresentative;

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

/** Normalize saved spacing groups and refresh their display labels without changing raw findings. */
export function normalizeTouchTargetGroups(run: AuditRun): AuditRun {
  const spacingGroups = new Map<string, GroupedUXIssue[]>();
  for (const group of run.groupedIssues) {
    const key = touchTargetPairFingerprint(group.representative);
    if (!key) continue;
    const sources = spacingGroups.get(key) ?? [];
    sources.push(group);
    spacingGroups.set(key, sources);
  }
  if (!spacingGroups.size) return run;
  const occurrences = [...spacingGroups.values()].flatMap(groups => groups.flatMap(group => group.occurrences));
  const actionLabels = collectTouchTargetLabels(occurrences);
  const legacy = [...spacingGroups].filter(([key, groups]) => groups.length > 1 || groups[0].fingerprint !== key);
  const replacements = new Map<string, GroupedUXIssue | undefined>();
  for (const [key, [group]] of spacingGroups) {
    if (group.fingerprint !== key) continue;
    const title = labelTouchTargetPair(group.representative, actionLabels);
    if (title && title !== group.representative.title) {
      replacements.set(key, { ...group, representative: { ...group.representative, title } });
    }
  }

  const rebuilt = new Map((legacy.length ? groupUXIssues(occurrences) : []).map(group => [group.fingerprint, group]));
  const mostRecentDecision = (source: GroupedUXIssue) => source.reviewedAt ??
    source.decisionHistory.filter(record => ['review_disposition', 'accept', 'reject'].includes(record.action)).at(-1)?.timestamp ?? '';
  for (const [key, groups] of legacy) {
    const group = rebuilt.get(key);
    if (!group) continue;
    const source = groups.slice().sort((a, b) => mostRecentDecision(b).localeCompare(mostRecentDecision(a)) ||
      Number(Boolean(b.reviewDisposition || b.designerDecision)) - Number(Boolean(a.reviewDisposition || a.designerDecision)) ||
      b.decisionHistory.length - a.decisionHistory.length)[0];
    const history = new Map(groups.flatMap(item => item.decisionHistory).map(record => [record.id, record]));
    replacements.set(groups[0].fingerprint, {
      ...group,
      ...source,
      fingerprint: key,
      representative: group.representative,
      occurrences: group.occurrences,
      rawOccurrencesCount: group.rawOccurrencesCount,
      status: group.status,
      hasMixedStatus: group.hasMixedStatus,
      decisionHistory: [...history.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    });
    for (const duplicate of groups.slice(1)) replacements.set(duplicate.fingerprint, undefined);
  }
  if (!replacements.size) return run;
  const groupedIssues = run.groupedIssues.flatMap(group => {
    if (!replacements.has(group.fingerprint)) return [group];
    const replacement = replacements.get(group.fingerprint);
    return replacement ? [replacement] : [];
  });
  return { ...run, groupedIssues, summary: legacy.length ? calculateAuditSummary(run.rawIssues, groupedIssues) : run.summary };
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
