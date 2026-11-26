import { BoundingBoxSchema, type GroupedUXIssue, type UXIssue } from '@/lib/schema/ux-issue';
import { z } from 'zod';

export const touchTargetSpacingStatusLabels = { pass: 'Pass', needsReview: 'Needs review', candidateFail: 'Candidate fail' } as const;

const endpointSchema = z.object({
  selector: z.string().trim().min(1),
  element: z.string().optional(),
  accessibleName: z.string().optional(),
  actionId: z.string().optional(),
  boundingBox: BoundingBoxSchema.optional(),
});

export function readTouchTargetPair(issue: UXIssue) {
  if (issue.ruleId !== 'touch-target-spacing' || !issue.selector.trim()) return undefined;
  const nearest = endpointSchema.safeParse(issue.measured?.nearestTarget);
  if (!nearest.success || nearest.data.selector === issue.selector.trim()) return undefined;
  const measured = endpointSchema.safeParse(issue.measured?.target);

  return {
    target: {
      selector: issue.selector.trim(),
      element: issue.element,
      accessibleName: issue.accessibleName || measured.data?.accessibleName,
      actionId: measured.data?.actionId,
      boundingBox: issue.boundingBox ?? measured.data?.boundingBox,
    },
    nearest: nearest.data,
  };
}

export function touchTargetPairFingerprint(issue: UXIssue): string | undefined {
  const pair = readTouchTargetPair(issue);
  if (!pair) return undefined;
  return `touch-target-spacing::pair::${JSON.stringify([pair.target.selector, pair.nearest.selector].sort())}`;
}

export function labelTouchTargetPair(issue: UXIssue, actionLabels: Map<string, string>): string | undefined {
  const pair = readTouchTargetPair(issue);
  if (!pair) return undefined;
  // Use the measured reading order for the label. The group key is independent of this order.
  const names = [pair.target, pair.nearest].sort((a, b) =>
    (a.boundingBox?.y ?? 0) - (b.boundingBox?.y ?? 0) ||
    (a.boundingBox?.x ?? 0) - (b.boundingBox?.x ?? 0) ||
    a.selector.localeCompare(b.selector)
  ).map(target => {
    const name = target.accessibleName?.trim() || actionLabels.get(target.actionId ?? '');
    if (name && target.element) return `${name} ${target.element}`;
    const label = name || target.element;
    return label ? `${label} (${target.selector})` : target.selector;
  });
  return names.join(' ↔ ');
}

export function collectTouchTargetLabels(issues: UXIssue[]) {
  const labels = new Map<string, string>();
  for (const issue of issues) {
    const pair = readTouchTargetPair(issue);
    if (!pair) continue;
    for (const endpoint of [pair.target, pair.nearest]) {
      if (endpoint.element === 'label' && endpoint.actionId && endpoint.accessibleName?.trim()) {
        labels.set(endpoint.actionId, endpoint.accessibleName.trim());
      }
    }
  }
  return labels;
}

export function touchTargetViewportEvidence(group: Pick<GroupedUXIssue, 'representative' | 'occurrences'>) {
  if (!readTouchTargetPair(group.representative)) return [];
  const rows = new Map<string, { viewport: UXIssue['viewport']; distance: number; overlap: boolean; needsReview: boolean }>();
  for (const { viewport, measured, status } of group.occurrences) {
    if (typeof measured.distance !== 'number' || !Number.isFinite(measured.distance) || measured.distance < 0) continue;
    const key = `${viewport.width}×${viewport.height}`;
    const row = rows.get(key);
    rows.set(key, {
      viewport,
      distance: Math.min(row?.distance ?? measured.distance, measured.distance),
      overlap: row?.overlap === true || measured.overlap === true,
      needsReview: row?.needsReview === true || status !== 'pass',
    });
  }
  return [...rows.values()].sort((a, b) => a.viewport.width - b.viewport.width || a.viewport.height - b.viewport.height);
}

export function describeTouchTargetPair(group: Pick<GroupedUXIssue, 'representative' | 'occurrences'>): string | undefined {
  const rows = touchTargetViewportEvidence(group);
  if (!rows.length) return undefined;
  const distances = rows.map(row => row.distance);
  const min = Math.min(...distances);
  const max = Math.max(...distances);
  const gap = min === max ? String(min) : `${min}–${max}`;
  return `${gap} CSS px across ${rows.length} ${rows.length === 1 ? 'viewport' : 'viewports'}`;
}
