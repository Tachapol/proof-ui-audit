import { UXIssue, AuditStatus, Priority, BoundingBox } from '@/lib/schema/ux-issue';

export interface OverflowingElementInfo {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  boundingBox: BoundingBox;
  computedStyles: {
    overflowX: string;
    overflowY: string;
    position: string;
    display: string;
    width: string;
    maxWidth?: string;
  };
  isEssential2D?: boolean; // data table, map, diagram, canvas, video
  isDecorativeClipped?: boolean;
  isInternalScrollContainer?: boolean;
}

export interface ReflowMeasurement {
  viewport: { width: number; height: number };
  scrollWidth: number;
  clientWidth: number;
  horizontalOverflowPx: number; // scrollWidth - clientWidth
  hasDocumentHorizontalScroll: boolean;
  overflowingElements: OverflowingElementInfo[];
}

/**
 * Subpixel tolerance for horizontal scroll width.
 * Differences <= 1.0 CSS px are attributed to browser subpixel rounding and do not trigger failure.
 */
export const HORIZONTAL_OVERFLOW_TOLERANCE_PX = 1.0;

export function evaluateReflow(
  measurement: ReflowMeasurement,
  url: string
): UXIssue[] {
  const {
    viewport,
    scrollWidth,
    clientWidth,
    horizontalOverflowPx,
    overflowingElements,
  } = measurement;

  const issues: UXIssue[] = [];
  const roundedOverflow = Math.max(0, Math.round(horizontalOverflowPx * 10) / 10);

  // Case 1: Clean Reflow Pass
  if (horizontalOverflowPx <= HORIZONTAL_OVERFLOW_TOLERANCE_PX) {
    const id = `reflow-${Math.abs(hashString(`${url}:${viewport.width}:clean-pass`))}`;
    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'pass',
      title: `Content reflows without 2D scrolling at ${viewport.width}px`,
      description: `The page reflows into a single column at ${viewport.width} CSS px without requiring horizontal scrolling (scroll width: ${scrollWidth}px, client width: ${clientWidth}px).`,
      url,
      viewport,
      selector: 'html',
      element: 'html',
      measured: {
        scrollWidth,
        clientWidth,
        horizontalOverflowPx: roundedOverflow,
        overflowingElementsCount: 0,
      },
      expected: {
        maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
        thresholdDescription: 'No horizontal scrolling required at 320 CSS px (overflow <= 1.0px tolerance)',
      },
      boundingBox: {
        x: 0,
        y: 0,
        width: clientWidth,
        height: viewport.height,
      },
      initialPriority: 'P3',
      priorityRationale: 'Project Heuristic P3 (Not WCAG Severity): Content reflows cleanly without horizontal overflow at 320 CSS px.',
    });
    return issues;
  }

  // Case 2: Horizontal Overflow Detected
  const essentialElements = overflowingElements.filter((el) => el.isEssential2D);
  const unintendedElements = overflowingElements.filter((el) => !el.isEssential2D);

  // If there are unintended overflowing elements (or general unidentified overflow), emit candidateFail
  if (unintendedElements.length > 0 || essentialElements.length === 0) {
    const primaryOffender = unintendedElements[0];
    const targetSelector = primaryOffender?.selector || 'html';
    const targetElement = primaryOffender?.element || 'html';
    const targetBoundingBox = primaryOffender?.boundingBox || {
      x: 0,
      y: 0,
      width: scrollWidth,
      height: viewport.height,
    };

    const initialPriority: Priority = roundedOverflow > 50 ? 'P1' : 'P2';
    const id = `reflow-${Math.abs(hashString(`${url}:${targetSelector}:candidate-fail`))}`;

    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'candidateFail',
      title: `Unintended horizontal overflow at ${viewport.width}px (${roundedOverflow}px overflow)`,
      description: `The page requires two-dimensional scrolling at ${viewport.width} CSS px (document scroll width: ${scrollWidth}px exceeds client width: ${clientWidth}px by ${roundedOverflow}px). Offending element: ${targetSelector}.`,
      url,
      viewport,
      selector: targetSelector,
      element: targetElement,
      role: primaryOffender?.role,
      accessibleName: primaryOffender?.accessibleName,
      measured: {
        scrollWidth,
        clientWidth,
        horizontalOverflowPx: roundedOverflow,
        computedStyles: primaryOffender?.computedStyles,
      },
      expected: {
        maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
        thresholdDescription: 'Content must reflow without two-dimensional scrolling at 320 CSS px',
      },
      boundingBox: targetBoundingBox,
      initialPriority,
      priorityRationale: roundedOverflow > 50
        ? 'Project Heuristic P1 (Not WCAG Severity): Severe horizontal overflow (>50px) forcing bidirectional scrolling on mobile. Designer reprioritization supported.'
        : 'Project Heuristic P2 (Not WCAG Severity): Moderate horizontal overflow forcing horizontal panning on mobile. Designer reprioritization supported.',
    });
  }

  // If there are essential 2D elements, emit needsReview
  for (const essentialElement of essentialElements) {
    const id = `reflow-${Math.abs(hashString(`${url}:${essentialElement.selector}:essential-2d`))}`;
    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'needsReview',
      title: `Essential two-dimensional layout requires review (${roundedOverflow}px overflow)`,
      description: `Horizontal scrolling (${roundedOverflow}px) is present at ${viewport.width} CSS px, but appears to be associated with an essential 2D component (${essentialElement.selector}: data table, diagram, or map).`,
      url,
      viewport,
      selector: essentialElement.selector,
      element: essentialElement.element,
      role: essentialElement.role,
      accessibleName: essentialElement.accessibleName,
      measured: {
        scrollWidth,
        clientWidth,
        horizontalOverflowPx: roundedOverflow,
        isEssential2D: true,
        computedStyles: essentialElement.computedStyles,
      },
      expected: {
        maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
        thresholdDescription: 'Single-direction scrolling unless two-dimensional layout is essential to content meaning',
      },
      boundingBox: essentialElement.boundingBox,
      exception: 'Essential two-dimensional presentation exception: WCAG 2.2 SC 1.4.10 permits 2D scrolling where spatial layout is essential (e.g. data tables, maps, diagrams).',
      initialPriority: 'P3',
      priorityRationale: 'Project Heuristic P3 (Not WCAG Severity): Overflow is attributable to a table, map, or 2D diagram. Designer review required to confirm if 2D scrolling is essential.',
    });
  }

  return issues;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
