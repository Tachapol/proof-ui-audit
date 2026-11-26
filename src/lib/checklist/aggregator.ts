import type { UXIssue } from '@/lib/schema/ux-issue';
import { getDefaultRecommendation } from '@/lib/audit/recommendation';
import {
  CHECKLIST_METRICS,
  CHECKLIST_PILLARS,
  type ChecklistItemResult,
  type ChecklistStatus,
  type ChecklistSummary,
  type PriorityLevel,
} from './types';

export interface DomCheckFinding {
  id: string;
  status: ChecklistStatus;
  measuredSummary: string;
  affectedCount: number;
  samples: string[];
  recommendation: string;
}

const PRIORITY_RANK: Record<PriorityLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_RANK: Record<ChecklistStatus, number> = { fail: 0, needsReview: 1, pass: 2, notApplicable: 3 };

function mapIssueStatus(status: UXIssue['status']): ChecklistStatus {
  if (status === 'candidateFail') return 'fail';
  if (status === 'needsReview') return 'needsReview';
  return 'pass';
}

function formatReadableRuleSummary(
  ruleId: string,
  status: ChecklistStatus,
  active: UXIssue[],
  totalChecked: number
): string {
  if (active.length === 0) return `Checked ${totalChecked} element(s)`;
  const places = `${active.length} ${active.length === 1 ? 'place' : 'places'}`;

  if (ruleId === 'text-contrast') {
    return status === 'needsReview'
      ? `Text may be hard to read in ${places}.`
      : `Low text contrast in ${places}.`;
  }
  if (ruleId === 'non-text-contrast') {
    return status === 'needsReview'
      ? `Border or icon contrast needs review in ${places}.`
      : `Low border or icon contrast in ${places}.`;
  }
  if (ruleId === 'target-size') {
    return status === 'needsReview'
      ? `Target size exception needs review in ${places}.`
      : `Interactive targets too small in ${places}.`;
  }
  if (ruleId === 'reflow') {
    return 'Content overflows on mobile.';
  }
  if (ruleId === 'text-spacing') {
    return `Text clipped under spacing overrides in ${places}.`;
  }
  return `${active.length} issue(s) flagged`;
}

function formatIssueSample(issue: UXIssue): string {
  const m = issue.measured || {};
  if (issue.ruleId === 'text-contrast' && typeof m.contrastRatio === 'number') {
    return `${issue.selector} (color:${m.color || '?'}, bg:${m.backgroundColor || '?'}, ratio:${m.contrastRatio.toFixed(2)}:1)`;
  }
  if (issue.ruleId === 'target-size' && typeof m.width === 'number' && typeof m.height === 'number') {
    return `${issue.selector} (${Math.round(m.width)}x${Math.round(m.height)}px)`;
  }
  return issue.selector;
}

/**
 * Aggregates existing deterministic UXIssue records and DOM check findings
 * into a unified 24-metric UX/UI checklist with priority-sorted action items.
 */
export function buildChecklistSummary(
  issues: UXIssue[],
  domFindings: Record<string, DomCheckFinding>
): ChecklistSummary {
  const items: ChecklistItemResult[] = CHECKLIST_METRICS.map((def) => {
    if (def.source === 'audit-rule') {
      const matching = issues.filter((i) => i.ruleId === def.id);
      if (matching.length === 0) {
        return {
          id: def.id,
          group: def.group,
          pillar: def.pillar,
          title: def.title,
          criterion: def.criterion,
          priority: def.priority,
          status: 'pass',
          viewport: '1280px + 320px',
          measuredSummary: 'No violations detected',
          affectedCount: 0,
          samples: [],
          recommendation: getDefaultRecommendation({ ruleId: def.id, status: 'pass' }),
        };
      }

      const fails = matching.filter((i) => i.status === 'candidateFail');
      const reviews = matching.filter((i) => i.status === 'needsReview');
      const status: ChecklistStatus =
        fails.length > 0 ? 'fail' : reviews.length > 0 ? 'needsReview' : 'pass';
      const active = fails.length > 0 ? fails : reviews;

      return {
        id: def.id,
        group: def.group,
        pillar: def.pillar,
        title: def.title,
        criterion: def.criterion,
        priority: def.priority,
        status,
        viewport: '1280px + 320px',
        measuredSummary: formatReadableRuleSummary(def.id, status, active, matching.length),
        affectedCount: active.length,
        samples: active.slice(0, 6).map(formatIssueSample),
        rawSelectors: active.slice(0, 6).map((i) => i.selector),
        recommendation: getDefaultRecommendation({
          ruleId: def.id,
          status: status === 'fail' ? 'candidateFail' : status === 'needsReview' ? 'needsReview' : 'pass',
        }),
      };
    }

    const dom = domFindings[def.id];
    if (!dom) {
      return {
        id: def.id,
        group: def.group,
        pillar: def.pillar,
        title: def.title,
        criterion: def.criterion,
        priority: def.priority,
        status: 'pass',
        viewport: '1280px',
        measuredSummary: 'Checked',
        affectedCount: 0,
        samples: [],
        recommendation: 'Requirement satisfied.',
      };
    }

    return {
      id: def.id,
      group: def.group,
      pillar: def.pillar,
      title: def.title,
      criterion: def.criterion,
      priority: def.priority,
      status: dom.status,
      viewport: '1280px',
      measuredSummary: dom.measuredSummary,
      affectedCount: dom.affectedCount,
      samples: dom.samples.slice(0, 4),
      rawSelectors: dom.samples.slice(0, 4),
      recommendation: dom.recommendation,
    };
  });

  const pillars = CHECKLIST_PILLARS.map((p) => {
    const pillarItems = items.filter((i) => i.pillar === p.id);
    const applicable = pillarItems.filter((i) => i.status !== 'notApplicable');
    const passed = applicable.filter((i) => i.status === 'pass').length;
    return {
      id: p.id,
      group: p.group,
      label: p.label,
      passed,
      total: applicable.length,
      items: pillarItems,
    };
  });

  const applicableItems = items.filter((i) => i.status !== 'notApplicable');
  const uxApplicable = applicableItems.filter((i) => i.group === 'ux');
  const uiApplicable = applicableItems.filter((i) => i.group === 'ui');
  const totalPassed = applicableItems.filter((i) => i.status === 'pass').length;
  const totalFailed = applicableItems.filter((i) => i.status === 'fail').length;
  const totalNeedsReview = applicableItems.filter((i) => i.status === 'needsReview').length;
  const totalNotApplicable = items.length - applicableItems.length;
  const totalMetrics = applicableItems.length;

  const priorityList = applicableItems
    .filter((i) => i.status !== 'pass')
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.affectedCount - a.affectedCount
    );

  return {
    totalPassed,
    totalFailed,
    totalNeedsReview,
    totalNotApplicable,
    totalMetrics,
    passRate: totalMetrics > 0 ? Math.round((totalPassed / totalMetrics) * 100) : 0,
    ux: {
      passed: uxApplicable.filter((i) => i.status === 'pass').length,
      total: uxApplicable.length,
    },
    ui: {
      passed: uiApplicable.filter((i) => i.status === 'pass').length,
      total: uiApplicable.length,
    },
    pillars,
    items,
    priorityList,
  };
}

export { mapIssueStatus };
