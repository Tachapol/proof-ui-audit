import type { PilotMetricMetadata, PilotMetricResult } from '@/lib/schema/pilot-metric';
import type { UXIssue, Viewport, BoundingBox } from '@/lib/schema/ux-issue';
import type { PilotSnapshot, PilotElement } from './pilot-extraction';

export const PILOT_METRIC_VERSION = '1.0.0' as const;
export const TOUCH_SPACING_ADVISORY_PX = 8;
export const PILOT_METRIC_IDS = ['touch-target-spacing', 'heading-hierarchy'] as const;
type MetricId = typeof PILOT_METRIC_IDS[number];
export interface MetricEvaluation { result: PilotMetricResult; issues: UXIssue[] }

export function unavailablePilotMetric(
  metricId: MetricId, url: string, viewport: Viewport,
  executionStatus: 'skipped' | 'error', reason: string, scopeSelector: string | null = null,
): PilotMetricResult {
  return {
    metricId, metricVersion: PILOT_METRIC_VERSION, unit: metricId === 'touch-target-spacing' ? 'CSS px' : 'heading level',
    executionStatus, applicability: 'unknown', basis: 'project-advisory',
    url, viewport, scopeSelector, outcome: null, reason, measurements: [], limitations: [],
  };
}

function base(snapshot: PilotSnapshot, id: MetricId, url: string, viewport: Viewport): PilotMetricResult {
  return {
    ...unavailablePilotMetric(id, url, viewport, 'skipped', '', snapshot.scopeSelector),
    executionStatus: 'completed', applicability: 'applicable', parentHeadingLevel: snapshot.parentHeadingLevel,
    rawParentHeadingLevel: snapshot.rawParentHeadingLevel,
    limitations: snapshot.limitations,
  };
}
function issueFor(
  element: PilotElement, result: PilotMetricResult, measured: Record<string, unknown>,
  expected: Record<string, unknown>, status: 'pass' | 'needsReview', title: string, description: string,
): UXIssue {
  const metric: PilotMetricMetadata = {
    metricId: result.metricId, metricVersion: result.metricVersion, unit: result.unit,
    executionStatus: result.executionStatus, applicability: result.applicability, basis: result.basis,
  };
  return {
    id: `${result.metricId}-${result.viewport.width}-${crypto.randomUUID()}`,
    ruleId: result.metricId, wcagCriterion: 'Project advisory — no automatic WCAG failure',
    metric, url: result.url, viewport: result.viewport,
    selector: element.selector, element: element.element, accessibleName: element.accessibleName,
    boundingBox: element.boundingBox, measured, expected, status, title, description,
    initialPriority: 'P3', priorityRationale: 'Pilot project advisory; contextual designer review, not WCAG severity.',
  };
}
const validBox = (box: BoundingBox) => box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0;

/** Euclidean distance between closest rectangle edges; contact is 0, not overlap. */
export function rectangleGap(a: BoundingBox, b: BoundingBox) {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return { distance: Math.hypot(dx, dy), overlap: overlapWidth > 0 && overlapHeight > 0, overlapArea: overlapWidth * overlapHeight };
}

export function evaluateTouchTargetSpacing(snapshot: PilotSnapshot, url: string, viewport: Viewport): MetricEvaluation {
  const result = base(snapshot, 'touch-target-spacing', url, viewport);
  if (snapshot.scopeError) return { result: { ...result, executionStatus: snapshot.scopeSelector ? 'error' : 'skipped', applicability: 'unknown', reason: snapshot.scopeError }, issues: [] };
  const targets = snapshot.targets.filter(t => validBox(t.boundingBox));
  const incomplete = targets.length !== snapshot.targets.length || snapshot.pointerDiscoveryIncomplete === true;
  result.executionStatus = incomplete ? 'partial' : 'completed';
  result.measurements = snapshot.targets.map(target => {
    const valid = validBox(target.boundingBox);
    const candidates = valid ? targets.filter(other => other !== target && other.actionId !== target.actionId) : [];
    const nearest = candidates.map(other => ({ target: other, ...rectangleGap(target.boundingBox, other.boundingBox) }))
      .sort((a, b) => a.distance - b.distance || Number(b.overlap) - Number(a.overlap) || b.overlapArea - a.overlapArea || a.target.selector.localeCompare(b.target.selector))[0];
    return {
      target, nearestTarget: nearest?.target ?? null, distance: nearest?.distance ?? null,
      overlap: nearest?.overlap ?? null, overlapArea: nearest?.overlapArea ?? null,
      geometryValid: !!valid, unit: 'CSS px', metricVersion: PILOT_METRIC_VERSION,
      outcome: nearest ? nearest.distance < TOUCH_SPACING_ADVISORY_PX ? 'needsReview' : 'pass' : null,
    };
  });
  const comparable = result.measurements.filter(row => row.outcome !== null);
  result.applicability = comparable.length ? 'applicable' : incomplete ? 'unknown' : 'not_applicable';
  result.outcome = comparable.length ? comparable.some(row => row.outcome === 'needsReview') ? 'needsReview' : 'pass' : null;
  if (!comparable.length && !incomplete) result.executionStatus = 'skipped';
  result.reason = incomplete ? 'Target geometry or pointer discovery is incomplete; nearest distances use only discovered targets and may overestimate spacing.'
    : comparable.length ? 'Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.'
      : 'Fewer than two independent pointer targets; no nearest pair is available.';
  // Incomplete geometry cannot establish a clean spacing result.
  if (incomplete && result.outcome === 'pass') result.outcome = null;
  const issues = comparable.map(row => {
    const target = row.target as PilotElement;
    const status = row.outcome === 'needsReview' || incomplete ? 'needsReview' : 'pass';
    return issueFor(target, result, row, { advisoryMinGap: 8, unit: 'CSS px', basis: 'project-advisory' }, status,
      status === 'needsReview' ? 'Touch target spacing requires review' : 'Touch target spacing meets project advisory',
      `Nearest target ${String((row.nearestTarget as PilotElement).selector)} is ${Number(row.distance).toFixed(2)} CSS px from ${target.selector}; overlap: ${String(row.overlap)}. Below 8 CSS px requests contextual review only; this is not a WCAG failure.${incomplete ? ' Target coverage is incomplete.' : ''}`);
  });
  return { result, issues };
}

export function evaluateHeadingHierarchy(snapshot: PilotSnapshot, url: string, viewport: Viewport): MetricEvaluation {
  const result = base(snapshot, 'heading-hierarchy', url, viewport);
  if (snapshot.scopeError) return { result: { ...result, executionStatus: snapshot.scopeSelector ? 'error' : 'skipped', applicability: 'unknown', reason: snapshot.scopeError }, issues: [] };
  let previous: { level: number; selector: string | null } | null = snapshot.parentHeadingLevel !== undefined
    ? { level: snapshot.parentHeadingLevel, selector: null } : null;
  let incomplete = snapshot.invalidParentContext !== undefined;
  result.measurements = snapshot.headings.map(heading => {
    const valid = heading.level !== null && Number.isSafeInteger(heading.level) && heading.level > 0;
    const skippedLevels = valid && previous ? Math.max(0, heading.level! - previous.level - 1) : null;
    const row = {
      ...heading, previousHeading: previous, skippedLevels,
      boundaryContextKnown: previous !== null, unit: 'heading level', metricVersion: PILOT_METRIC_VERSION,
      outcome: skippedLevels === null ? null : skippedLevels > 0 ? 'needsReview' : 'pass',
    };
    if (!valid) incomplete = true;
    // Invalid ARIA headings interrupt the sequence; do not invent a transition across missing data.
    previous = valid ? { level: heading.level!, selector: heading.selector } : null;
    return row;
  });
  const comparable = result.measurements.filter(row => row.outcome !== null);
  result.executionStatus = incomplete ? 'partial' : comparable.length ? 'completed' : 'skipped';
  result.applicability = comparable.length ? 'applicable' : incomplete || snapshot.headings.length ? 'unknown' : 'not_applicable';
  result.outcome = comparable.some(row => row.outcome === 'needsReview') ? 'needsReview' : comparable.length && !incomplete ? 'pass' : null;
  result.reason = incomplete ? 'Invalid heading level or parent context; valid DOM transitions were evaluated, missing levels were not inferred.'
    : comparable.length ? 'DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.'
      : 'No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.';
  const issues = comparable.map(row => {
    const warning = row.outcome === 'needsReview';
    const previousHeading = row.previousHeading as { level: number; selector: string | null };
    return issueFor(row as unknown as PilotElement, result, row,
      { maxDeeperStep: 1, upwardTransitionsAllowed: true, basis: 'project-advisory' }, warning ? 'needsReview' : 'pass',
      warning ? 'Heading level skip requires context review' : 'Heading transition follows DOM hierarchy advisory',
      `Heading level ${previousHeading.level} → ${row.level} in DOM order.${warning ? ' Review the section and component parent context; this is not an automatic WCAG failure.' : ' Equal levels and returns to higher-ranked sections do not require a skip warning.'}`);
  });
  return { result, issues };
}
