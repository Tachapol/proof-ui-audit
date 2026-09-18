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

export interface NestedScrollContainerInfo {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  scrollWidth: number;
  clientWidth: number;
  overflowPx: number;
  isEssential2D: boolean;
  computedStyles: {
    overflowX: string;
    overflowY: string;
    position: string;
    display: string;
  };
  boundingBox: BoundingBox;
}

export interface AncestorClippedElementInfo {
  selector: string;
  ancestorSelector: string;
  element: string;
  scrollWidth: number;
  clientWidth: number;
  clipDeficitPx: number;
  computedStyles: {
    overflowX: string;
    overflowY: string;
  };
  boundingBox: BoundingBox;
}

export interface ClippedControlInfo {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  violation: 'outside-viewport' | 'outside-clipping-ancestor';
  clipDeficitPx: number;
  boundingBox: BoundingBox;
}

export interface ReflowMeasurement {
  viewport: { width: number; height: number };
  scrollWidth: number;
  clientWidth: number;
  horizontalOverflowPx: number; // scrollWidth - clientWidth
  hasDocumentHorizontalScroll: boolean;
  overflowingElements: OverflowingElementInfo[];
  nestedScrollContainers?: NestedScrollContainerInfo[];
  ancestorClippedElements?: AncestorClippedElementInfo[];
  clippedControls?: ClippedControlInfo[];
  decorativeElementsExcludedCount?: number;
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
    nestedScrollContainers = [],
    ancestorClippedElements = [],
    clippedControls = [],
  } = measurement;

  const issues: UXIssue[] = [];
  const roundedOverflow = Math.max(0, Math.round(horizontalOverflowPx * 10) / 10);

  // 1. Evaluate Document-Level Horizontal Overflow
  if (horizontalOverflowPx > HORIZONTAL_OVERFLOW_TOLERANCE_PX) {
    const essentialElements = overflowingElements.filter((el) => el.isEssential2D);
    const unintendedElements = overflowingElements.filter((el) => !el.isEssential2D);

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
  }

  // 2. Evaluate Nested Horizontal Scroll Containers
  for (const nested of nestedScrollContainers) {
    const id = `reflow-nested-${Math.abs(hashString(`${url}:${nested.selector}:${nested.overflowPx}`))}`;
    if (nested.isEssential2D) {
      issues.push({
        id,
        ruleId: 'reflow',
        wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
        status: 'needsReview',
        title: `Essential two-dimensional nested scroll requires review (${nested.overflowPx}px overflow)`,
        description: `Nested container ${nested.selector} has horizontal scroll (${nested.overflowPx}px), but qualifies for essential two-dimensional presentation review (data table, diagram, or map).`,
        url,
        viewport,
        selector: nested.selector,
        element: nested.element,
        role: nested.role,
        accessibleName: nested.accessibleName,
        measured: {
          scrollWidth: nested.scrollWidth,
          clientWidth: nested.clientWidth,
          horizontalOverflowPx: nested.overflowPx,
          isEssential2D: true,
          computedStyles: nested.computedStyles,
        },
        expected: {
          maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
          thresholdDescription: 'Single-column reflow without horizontal scrolling in nested containers unless essential',
        },
        boundingBox: nested.boundingBox,
        exception: 'Essential two-dimensional presentation exception: WCAG 2.2 SC 1.4.10 permits 2D scrolling where spatial layout is essential.',
        initialPriority: 'P3',
        priorityRationale: 'Project Heuristic P3 (Not WCAG Severity): Nested scroll container associated with essential 2D component. Designer review required.',
      });
    } else {
      issues.push({
        id,
        ruleId: 'reflow',
        wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
        status: 'candidateFail',
        title: `Nested horizontal scroll container forces two-dimensional panning (${nested.overflowPx}px overflow)`,
        description: `Nested container ${nested.selector} forces internal horizontal scrolling (${nested.overflowPx}px) at ${viewport.width} CSS px for non-essential content.`,
        url,
        viewport,
        selector: nested.selector,
        element: nested.element,
        role: nested.role,
        accessibleName: nested.accessibleName,
        measured: {
          scrollWidth: nested.scrollWidth,
          clientWidth: nested.clientWidth,
          horizontalOverflowPx: nested.overflowPx,
          computedStyles: nested.computedStyles,
        },
        expected: {
          maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
          thresholdDescription: 'Content must reflow into a single column without nested horizontal scrolling containers',
        },
        boundingBox: nested.boundingBox,
        initialPriority: 'P2',
        priorityRationale: 'Project Heuristic P2 (Not WCAG Severity): Unintended nested horizontal scrolling container prevents single-direction flow. Designer reprioritization supported.',
      });
    }
  }

  // 3. Evaluate Significant Content Clipped by Ancestor (Overflow that does not increase document.scrollWidth)
  for (const clipped of ancestorClippedElements) {
    const id = `reflow-clipped-${Math.abs(hashString(`${url}:${clipped.selector}:${clipped.ancestorSelector}`))}`;
    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'candidateFail',
      title: `Content clipped by ancestor overflow restriction at ${viewport.width}px (${clipped.clipDeficitPx}px clipped)`,
      description: `Content in ${clipped.selector} is clipped by ancestor ${clipped.ancestorSelector} (overflow: ${clipped.computedStyles.overflowX}) without increasing document scroll width, causing loss of visible content.`,
      url,
      viewport,
      selector: clipped.selector,
      element: clipped.element,
      measured: {
        scrollWidth: clipped.scrollWidth,
        clientWidth: clipped.clientWidth,
        clipDeficitPx: clipped.clipDeficitPx,
        ancestorSelector: clipped.ancestorSelector,
        computedStyles: clipped.computedStyles,
      },
      expected: {
        maxOverflowPx: HORIZONTAL_OVERFLOW_TOLERANCE_PX,
        thresholdDescription: 'Content must reflow completely without being clipped by ancestor overflow restrictions',
      },
      boundingBox: clipped.boundingBox,
      initialPriority: 'P1',
      priorityRationale: 'Project Heuristic P1 (Not WCAG Severity): Content clipped and unreachable due to overflow: hidden. High risk of lost user information.',
    });
  }

  // 4. Evaluate Interactive Controls Positioned Outside Visible or Clipping Area
  for (const control of clippedControls) {
    const id = `reflow-control-${Math.abs(hashString(`${url}:${control.selector}:${control.violation}`))}`;
    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'candidateFail',
      title: `Interactive control positioned outside visible or clipping area`,
      description: `Interactive control ${control.selector} (${control.element}) is positioned ${control.violation === 'outside-viewport' ? 'outside the 320px viewport' : 'outside its clipping ancestor'} (deficit: ${control.clipDeficitPx}px).`,
      url,
      viewport,
      selector: control.selector,
      element: control.element,
      role: control.role,
      accessibleName: control.accessibleName,
      measured: {
        violation: control.violation,
        clipDeficitPx: control.clipDeficitPx,
        boundingBox: control.boundingBox,
      },
      expected: {
        maxOverflowPx: 0,
        thresholdDescription: 'Interactive controls must remain fully visible and operable at 320 CSS px',
      },
      boundingBox: control.boundingBox,
      initialPriority: 'P1',
      priorityRationale: 'Project Heuristic P1 (Not WCAG Severity): Interactive control is out of bounds or clipped, causing loss of functionality.',
    });
  }

  // 5. Clean Reflow Pass: Emitted ONLY when there are no candidate fails and no review items
  if (issues.length === 0) {
    const id = `reflow-${Math.abs(hashString(`${url}:${viewport.width}:clean-pass`))}`;
    issues.push({
      id,
      ruleId: 'reflow',
      wcagCriterion: 'WCAG 2.2 SC 1.4.10 Reflow',
      status: 'pass',
      title: `Content reflows without 2D scrolling at ${viewport.width}px`,
      description: `The page reflows into a single column at ${viewport.width} CSS px without requiring horizontal scrolling, nested horizontal scrolling, or clipping (scroll width: ${scrollWidth}px, client width: ${clientWidth}px).`,
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
      priorityRationale: 'Project Heuristic P3 (Not WCAG Severity): Content reflows cleanly without horizontal overflow or clipping at 320 CSS px.',
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
