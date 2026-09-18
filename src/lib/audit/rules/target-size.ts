import { UXIssue, AuditStatus, Priority, BoundingBox } from '@/lib/schema/ux-issue';

export interface TargetMeasurement {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isInline: boolean;
  hasSufficientSpacing?: boolean;
  isUserAgentDefault?: boolean;
  isEssentialCandidate?: boolean;
  hasEquivalentTarget?: boolean;
}

export const TARGET_SIZE_THRESHOLD = 24;
export const SPACING_CIRCLE_DIAMETER = 24;
export const SPACING_CIRCLE_RADIUS = 12;

/**
 * Evaluates the WCAG 2.2 SC 2.5.8 spacing alternative geometry:
 * A 24 CSS px diameter circle (radius 12px) is centered on the bounding box of the undersized target.
 * The circle must not intersect another target or the circle for another target.
 */
export function checkSpacingAlternative(
  target: BoundingBox,
  otherTargets: BoundingBox[]
): boolean {
  // If target already meets 24x24 px, spacing alternative is not needed
  if (target.width >= TARGET_SIZE_THRESHOLD && target.height >= TARGET_SIZE_THRESHOLD) {
    return true;
  }

  const cxA = target.x + target.width / 2;
  const cyA = target.y + target.height / 2;

  for (const other of otherTargets) {
    // Skip comparing against self (same coordinates and dimensions)
    if (
      Math.abs(target.x - other.x) < 0.01 &&
      Math.abs(target.y - other.y) < 0.01 &&
      Math.abs(target.width - other.width) < 0.01 &&
      Math.abs(target.height - other.height) < 0.01
    ) {
      continue;
    }

    const cxB = other.x + other.width / 2;
    const cyB = other.y + other.height / 2;
    const isOtherUndersized =
      other.width < TARGET_SIZE_THRESHOLD || other.height < TARGET_SIZE_THRESHOLD;

    // Condition 1: If other target is also undersized, their 24px circles must not intersect (center distance >= 24px)
    if (isOtherUndersized) {
      const centerDistSq = (cxA - cxB) ** 2 + (cyA - cyB) ** 2;
      if (centerDistSq < SPACING_CIRCLE_DIAMETER ** 2) {
        return false; // Circles intersect
      }
    }

    // Condition 2: Target A's 12px radius circle must not intersect other target's bounding box
    const closestX = Math.max(other.x, Math.min(cxA, other.x + other.width));
    const closestY = Math.max(other.y, Math.min(cyA, other.y + other.height));
    const distToRectSq = (cxA - closestX) ** 2 + (cyA - closestY) ** 2;

    if (distToRectSq < SPACING_CIRCLE_RADIUS ** 2) {
      return false; // Circle intersects target B
    }
  }

  return true;
}

export function evaluateTargetSize(
  measurement: TargetMeasurement,
  url: string,
  viewport: { width: number; height: number }
): UXIssue {
  const {
    selector,
    element,
    role,
    accessibleName,
    width,
    height,
    x,
    y,
    isInline,
    hasSufficientSpacing,
    isUserAgentDefault,
    isEssentialCandidate,
    hasEquivalentTarget,
  } = measurement;

  const roundedWidth = Math.round(width * 10) / 10;
  const roundedHeight = Math.round(height * 10) / 10;
  const meetsSize = roundedWidth >= TARGET_SIZE_THRESHOLD && roundedHeight >= TARGET_SIZE_THRESHOLD;

  let status: AuditStatus;
  let exception: string | undefined;
  let initialPriority: Priority;
  let priorityRationale: string;
  let title: string;
  let description: string;

  if (meetsSize) {
    status = 'pass';
    initialPriority = 'P3';
    priorityRationale = 'Target meets or exceeds the 24×24 CSS px minimum requirement.';
    title = `Target size meets 24×24 CSS px (${roundedWidth}×${roundedHeight} px)`;
    description = `The interactive target "${accessibleName || selector}" satisfies WCAG 2.2 SC 2.5.8 with dimensions ${roundedWidth}×${roundedHeight} px.`;
  } else if (isInline) {
    status = 'needsReview';
    exception = 'Inline target exception: targets in a sentence or block of text are exempt under WCAG 2.2 SC 2.5.8.';
    initialPriority = 'P3';
    priorityRationale = 'Element is positioned inline within a body of text; UX/UI designer review needed to verify if inline sentence exception applies.';
    title = `Candidate inline target exception (${roundedWidth}×${roundedHeight} px)`;
    description = `The interactive target "${accessibleName || selector}" is smaller than 24×24 CSS px (${roundedWidth}×${roundedHeight} px), but appears to be an inline link within a text block.`;
  } else if (hasEquivalentTarget) {
    status = 'needsReview';
    exception = 'Equivalent control exception: an equivalent control on the same page meets target size.';
    initialPriority = 'P3';
    priorityRationale = 'An equivalent interactive control may exist on the page meeting the target size; designer verification required.';
    title = `Possible equivalent control exception (${roundedWidth}×${roundedHeight} px)`;
    description = `The control "${accessibleName || selector}" is ${roundedWidth}×${roundedHeight} px, but an equivalent target on the page may satisfy the requirement.`;
  } else if (isEssentialCandidate) {
    status = 'needsReview';
    exception = 'Essential presentation exception: presentation of the target is essential to the information conveyed.';
    initialPriority = 'P2';
    priorityRationale = 'Target is smaller than 24×24 px, but the presentation may be legally or functionally essential.';
    title = `Essential control review required (${roundedWidth}×${roundedHeight} px)`;
    description = `The target "${accessibleName || selector}" measures ${roundedWidth}×${roundedHeight} px and requires designer review to determine if its sizing is strictly essential.`;
  } else if (isUserAgentDefault) {
    status = 'needsReview';
    exception = 'User agent control exception: target presentation is determined by the browser user agent and not modified by author CSS.';
    initialPriority = 'P3';
    priorityRationale = 'Target appearance may be unstyled user-agent default; verify whether author styles constrain its size.';
    title = `User agent default control review (${roundedWidth}×${roundedHeight} px)`;
    description = `The target "${accessibleName || selector}" may be unstyled browser chrome (${roundedWidth}×${roundedHeight} px).`;
  } else if (hasSufficientSpacing) {
    status = 'needsReview';
    exception = 'Spacing offset exception: A 24 CSS px diameter circle centered on the target does not intersect any other target or circle for another target.';
    initialPriority = 'P3';
    priorityRationale = 'Target is below 24×24 px, but qualifying 24px diameter circle spacing offset geometry applies; requires designer confirmation.';
    title = `Candidate spacing offset exception (${roundedWidth}×${roundedHeight} px)`;
    description = `The target "${accessibleName || selector}" measures ${roundedWidth}×${roundedHeight} px, but surrounding 24px diameter circle spacing geometry prevents inadvertent activation.`;
  } else {
    // Definitive candidate failure
    status = 'candidateFail';
    if (roundedWidth < 18 || roundedHeight < 18) {
      initialPriority = 'P1';
      priorityRationale = 'Severe target size failure (<18 px): interactive element is substantially undersized and prone to tap errors on touchscreens.';
    } else {
      initialPriority = 'P2';
      priorityRationale = 'Moderate target size failure (18–23 px): interactive target is slightly below the 24×24 CSS px threshold without surrounding spacing.';
    }
    title = `Interactive target below 24×24 CSS px (${roundedWidth}×${roundedHeight} px)`;
    description = `The interactive element "${accessibleName || selector}" has a bounding box of ${roundedWidth}×${roundedHeight} px, failing the WCAG 2.2 SC 2.5.8 minimum target size requirement.`;
  }

  const id = `target-size-${Math.abs(hashString(`${url}:${selector}:${roundedWidth}x${roundedHeight}`))}`;

  return {
    id,
    ruleId: 'target-size',
    wcagCriterion: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
    status,
    title,
    description,
    url,
    viewport,
    selector,
    element,
    role,
    accessibleName,
    measured: {
      width: roundedWidth,
      height: roundedHeight,
      isInline,
      hasSufficientSpacing: !!hasSufficientSpacing,
    },
    expected: {
      minWidth: TARGET_SIZE_THRESHOLD,
      minHeight: TARGET_SIZE_THRESHOLD,
      thresholdDescription: 'At least 24 × 24 CSS px or qualifying WCAG 2.2 spacing exception',
    },
    boundingBox: {
      x: Math.round(x),
      y: Math.round(y),
      width: roundedWidth,
      height: roundedHeight,
    },
    exception,
    initialPriority,
    priorityRationale,
  };
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
