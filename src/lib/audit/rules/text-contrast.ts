import { UXIssue, AuditStatus, Priority } from '@/lib/schema/ux-issue';
import { calculateContrastRatioRaw } from '../color-math';

export interface TextContrastMeasurement {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  textSnippet: string;
  fontSizePx: number;
  fontWeight: number | string;
  color: string;
  backgroundColor: string;
  hasComplexBackground?: boolean; // gradient, image, canvas, video, filter
  hasUnresolvedTransparency?: boolean;
  hasAncestorGroupOpacity?: boolean;
  unresolvedReason?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Normalizes CSS font-weight values to numeric equivalents.
 * Keywords: 'bold'/'bolder' -> 700, 'normal'/'lighter' -> 400.
 */
export function normalizeFontWeight(weight: number | string): number {
  if (typeof weight === 'number') return weight;
  const str = String(weight).trim().toLowerCase();
  if (str === 'bold' || str === 'bolder') return 700;
  if (str === 'normal' || str === 'lighter') return 400;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 400 : parsed;
}

/**
 * Exact bold-weight boundary:
 * In WCAG 2.2 SC 1.4.3 and CSS Fonts Module, 'bold' is defined as font-weight >= 700.
 * Weights below 700 (e.g. 400 normal, 500 medium, 600 semi-bold) do not qualify as bold under SC 1.4.3.
 */
export function isBoldWeight(weight: number | string): boolean {
  return normalizeFontWeight(weight) >= 700;
}

/**
 * Large text definition under WCAG 2.2 SC 1.4.3:
 * - At least 24 CSS px (18pt) for normal-weight text
 * - At least 18.66 CSS px (14pt) when computed font-weight qualifies as bold (>= 700)
 */
export function isLargeText(fontSizePx: number, fontWeight: number | string): boolean {
  const bold = isBoldWeight(fontWeight);
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && bold);
}

export function evaluateTextContrast(
  measurement: TextContrastMeasurement,
  url: string,
  viewport: { width: number; height: number }
): UXIssue {
  const {
    selector,
    element,
    role,
    accessibleName,
    textSnippet,
    fontSizePx,
    fontWeight,
    color,
    backgroundColor,
    hasComplexBackground,
    hasUnresolvedTransparency,
    hasAncestorGroupOpacity,
    unresolvedReason,
    boundingBox,
  } = measurement;

  const numericWeight = normalizeFontWeight(fontWeight);
  const largeText = isLargeText(fontSizePx, numericWeight);
  const requiredRatio = largeText ? 3.0 : 4.5;

  // CRITICAL: Classification strictly uses full-precision floating point rawRatio.
  // Avoid rounded display values influencing pass/fail calculation.
  const rawRatio = calculateContrastRatioRaw(color, backgroundColor);

  // Presentation contrast ratio: rounded to 2 decimals, ensuring that if rawRatio is below threshold,
  // the formatted presentation value does not misleadingly round up to meet/exceed the threshold.
  let contrastRatio: number;
  if (rawRatio < requiredRatio) {
    // If raw is 4.496, Math.round is 4.50 (misleading!). Floor to 2 decimals (4.49) to preserve fail display.
    contrastRatio = Math.floor(rawRatio * 100) / 100;
  } else {
    contrastRatio = Math.round(rawRatio * 100) / 100;
  }

  let status: AuditStatus;
  let exception: string | undefined;
  let initialPriority: Priority;
  let priorityRationale: string;
  let title: string;
  let description: string;

  if (hasComplexBackground || hasUnresolvedTransparency || hasAncestorGroupOpacity) {
    status = 'needsReview';
    initialPriority = 'P3';
    if (hasAncestorGroupOpacity) {
      exception = 'Ancestor group opacity review required: Text or its background resides inside an ancestor with CSS opacity < 1. Group opacity compositing applies to the entire rendered subtree, preventing deterministic flat luminance evaluation.';
      priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Subtree group opacity affects perceived contrast. Human designer review is required to verify rendering.';
      title = `Text inside translucent ancestor requires review (${largeText ? 'large text' : 'normal text'})`;
      description = `The text "${textSnippet.slice(0, 40)}" (${fontSizePx}px) is rendered within an ancestor element with opacity < 1, which alters perceived subtree contrast.`;
    } else if (hasComplexBackground) {
      exception = 'Complex background review required: Text rendered over an image, CSS gradient, SVG, canvas, video, or filter cannot be reliably evaluated by deterministic flat luminance checks.';
      priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Deterministic contrast calculation is inconclusive due to background complexity. Human designer review is required to verify contrast across glyph surfaces. Priority can be reclassified by the designer.';
      title = `Text over complex background requires review (${largeText ? 'large text' : 'normal text'})`;
      description = `The text "${textSnippet.slice(0, 40)}" (${fontSizePx}px) is rendered over an image or gradient background. Automated luminance checks cannot guarantee uniform readability.`;
    } else {
      exception = `Unresolved transparency review required: ${unresolvedReason || 'Effective background color reaches document root without an opaque ancestor surface.'}`;
      priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Background alpha is < 1 upon reaching the document root. Human designer review is required.';
      title = `Text with unresolved background transparency requires review (${largeText ? 'large text' : 'normal text'})`;
      description = `The text "${textSnippet.slice(0, 40)}" (${fontSizePx}px) has a translucent background without an opaque ancestor surface.`;
    }
  } else if (rawRatio >= requiredRatio) {
    status = 'pass';
    initialPriority = 'P3';
    priorityRationale = `Project Heuristic P3 (Not WCAG Severity): Contrast ratio of ${contrastRatio}:1 satisfies the required ${requiredRatio}:1 threshold for ${largeText ? 'large' : 'normal'} text.`;
    title = `Text contrast meets ${requiredRatio}:1 (${contrastRatio}:1)`;
    description = `The text "${textSnippet.slice(0, 40)}" satisfies WCAG 2.2 SC 1.4.3 with a measured contrast ratio of ${contrastRatio}:1 against its background.`;
  } else {
    status = 'candidateFail';
    // Priority heuristic based on severe deficit vs moderate deficit
    if (!largeText && rawRatio < 3.0) {
      initialPriority = 'P1';
      priorityRationale = `Project Heuristic P1 (Not WCAG Severity): Severe text contrast deficit (${contrastRatio}:1 vs required 4.5:1). Normal body text is significantly washed out with high risk of user reading failure. Designer reprioritization supported.`;
    } else {
      initialPriority = 'P2';
      priorityRationale = `Project Heuristic P2 (Not WCAG Severity): Moderate text contrast deficit (${contrastRatio}:1 vs required ${requiredRatio}:1). Text contrast is below the WCAG threshold. Designer reprioritization supported.`;
    }
    title = `Text contrast below ${requiredRatio}:1 threshold (${contrastRatio}:1)`;
    description = `The text "${textSnippet.slice(0, 40)}" has a measured contrast ratio of ${contrastRatio}:1 (foreground: ${color}, background: ${backgroundColor}), which is below the required ${requiredRatio}:1 for ${largeText ? 'large' : 'normal'} text.`;
  }

  const id = `text-contrast-${Math.abs(hashString(`${url}:${selector}:${color}:${backgroundColor}`))}`;

  return {
    id,
    ruleId: 'text-contrast',
    wcagCriterion: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum)',
    status,
    title,
    description,
    url,
    viewport,
    selector,
    element,
    role,
    accessibleName: accessibleName || textSnippet.slice(0, 50),
    measured: {
      contrastRatio,
      fontSizePx,
      fontWeight: numericWeight,
      isLargeText: largeText,
      color,
      backgroundColor,
      hasComplexBackground: !!hasComplexBackground,
    },
    expected: {
      minRatio: requiredRatio,
      thresholdDescription: largeText
        ? 'At least 3:1 for large text (>= 24px or >= 18.66px bold [weight >= 700])'
        : 'At least 4.5:1 for normal text',
    },
    boundingBox,
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
