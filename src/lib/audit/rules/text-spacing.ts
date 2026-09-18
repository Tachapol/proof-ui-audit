import { UXIssue, AuditStatus, Priority, BoundingBox } from '@/lib/schema/ux-issue';

export interface SpacingProperties {
  fontSize: number;
  lineHeightPx: number;
  letterSpacingPx: number;
  wordSpacingPx: number;
  marginBottomPx: number;
}

export interface MinimumPreservingResult {
  targetLineHeightPx: number;
  targetLetterSpacingPx: number;
  targetWordSpacingPx: number;
  targetMarginBottomPx: number;
  isLineHeightPreserved: boolean;
  isLetterSpacingPreserved: boolean;
  isWordSpacingPreserved: boolean;
  isMarginBottomPreserved: boolean;
}

/**
 * Computes minimum-preserving spacing according to WCAG 2.2 SC 1.4.12:
 * - Line height: at least 1.5 times font size
 * - Letter spacing: at least 0.12 times font size
 * - Word spacing: at least 0.16 times font size
 * - Paragraph margin-bottom: at least 2.0 times font size
 *
 * CRITICAL: If author styles ALREADY exceed the required minimum, they must NOT be reduced!
 */
export function computeMinimumPreservingSpacing(props: SpacingProperties): MinimumPreservingResult {
  const minLh = 1.5 * props.fontSize;
  const minLs = 0.12 * props.fontSize;
  const minWs = 0.16 * props.fontSize;
  const minMb = 2.0 * props.fontSize;

  const isLineHeightPreserved = props.lineHeightPx >= minLh - 0.05;
  const isLetterSpacingPreserved = props.letterSpacingPx >= minLs - 0.05;
  const isWordSpacingPreserved = props.wordSpacingPx >= minWs - 0.05;
  const isMarginBottomPreserved = props.marginBottomPx >= minMb - 0.05;

  return {
    targetLineHeightPx: Math.max(props.lineHeightPx, minLh),
    targetLetterSpacingPx: Math.max(props.letterSpacingPx, minLs),
    targetWordSpacingPx: Math.max(props.wordSpacingPx, minWs),
    targetMarginBottomPx: Math.max(props.marginBottomPx, minMb),
    isLineHeightPreserved,
    isLetterSpacingPreserved,
    isWordSpacingPreserved,
    isMarginBottomPreserved,
  };
}

export interface ElementSpacingState {
  width: number;
  height: number;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  isClipped: boolean;
  isHorizontalClipped?: boolean;
  isBoundingBoxEscaped?: boolean;
  boundingBox: BoundingBox;
}

export interface TextSpacingMeasurement {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  textSnippet: string;
  baseline: ElementSpacingState;
  candidate: ElementSpacingState;
  hasTextOverlap?: boolean;
  isAmbiguousOverlap?: boolean;
  isControlObscured?: boolean;
  isNewDocumentOverflow?: boolean;
  obscuredControlSelector?: string;
}

export function evaluateTextSpacing(
  measurement: TextSpacingMeasurement,
  url: string,
  viewport: { width: number; height: number }
): UXIssue {
  const {
    selector,
    element,
    role,
    accessibleName,
    textSnippet,
    baseline,
    candidate,
    hasTextOverlap,
    isAmbiguousOverlap,
    isControlObscured,
    isNewDocumentOverflow,
    obscuredControlSelector,
  } = measurement;

  const verticalClipDeficit = Math.max(0, candidate.scrollHeight - candidate.clientHeight);
  const horizontalClipDeficit = Math.max(0, candidate.scrollWidth - candidate.clientWidth);

  const isVerticallyClipped =
    (candidate.isClipped && !baseline.isClipped) ||
    (verticalClipDeficit > 1.0 && candidate.height < candidate.scrollHeight);

  const isHorizontallyClipped =
    candidate.isHorizontalClipped ||
    (horizontalClipDeficit > 1.0 && candidate.width < candidate.scrollWidth);

  const isEscaped = !!candidate.isBoundingBoxEscaped;

  let status: AuditStatus;
  let exception: string | undefined;
  let initialPriority: Priority;
  let priorityRationale: string;
  let title: string;
  let description: string;

  // 1. Obscured Interactive Control Failure
  if (isControlObscured) {
    status = 'candidateFail';
    initialPriority = 'P0';
    priorityRationale = 'Project Heuristic P0 (Not WCAG Severity): Interactive control is obscured or overlapped by expanding text, causing critical loss of functionality.';
    title = `Interactive control obscured by expanded text`;
    description = `Under WCAG text spacing overrides, text in "${accessibleName || selector}" expanded and obscures interactive control "${obscuredControlSelector || 'adjacent control'}".`;
  }
  // 2. Newly Introduced Document-Level or Container Overflow Failure
  else if (isNewDocumentOverflow) {
    status = 'candidateFail';
    initialPriority = 'P1';
    priorityRationale = 'Project Heuristic P1 (Not WCAG Severity): Text spacing override introduced horizontal overflow requiring bidirectional scrolling.';
    title = `Text spacing override introduced horizontal overflow`;
    description = `Applying WCAG 2.2 SC 1.4.12 text spacing overrides introduced horizontal document-level scrolling at ${viewport.width}px.`;
  }
  // 3. Vertical Clipping Failure
  else if (isVerticallyClipped) {
    status = 'candidateFail';
    initialPriority = verticalClipDeficit > 15 ? 'P1' : 'P2';
    priorityRationale = verticalClipDeficit > 15
      ? 'Project Heuristic P1 (Not WCAG Severity): Severe vertical text clipping (>15px hidden) under WCAG text-spacing overrides. Content is permanently truncated.'
      : 'Project Heuristic P2 (Not WCAG Severity): Moderate vertical text clipping detected under WCAG text-spacing overrides.';
    title = `Text content vertically clipped under text spacing override (${Math.round(verticalClipDeficit)}px clipped)`;
    description = `When WCAG 2.2 SC 1.4.12 text spacing styles (line-height >= 1.5, letter-spacing >= 0.12em, word-spacing >= 0.16em, p margin-bottom >= 2em) are applied, content in "${accessibleName || selector}" is vertically clipped by ${Math.round(verticalClipDeficit)}px.`;
  }
  // 4. Horizontal Clipping Failure
  else if (isHorizontallyClipped) {
    status = 'candidateFail';
    initialPriority = 'P1';
    priorityRationale = 'Project Heuristic P1 (Not WCAG Severity): Text is horizontally clipped by fixed-width or nowrap container under WCAG text-spacing overrides.';
    title = `Text content horizontally clipped under text spacing override (${Math.round(horizontalClipDeficit)}px clipped)`;
    description = `When WCAG 2.2 SC 1.4.12 text spacing styles are applied, content in "${accessibleName || selector}" is horizontally clipped by ${Math.round(horizontalClipDeficit)}px.`;
  }
  // 5. Bounding Box Escape Failure
  else if (isEscaped) {
    status = 'candidateFail';
    initialPriority = 'P2';
    priorityRationale = 'Project Heuristic P2 (Not WCAG Severity): Text escapes container boundary under WCAG text-spacing overrides, breaking layout structure.';
    title = `Text escapes container bounding box under text spacing override`;
    description = `When WCAG 2.2 SC 1.4.12 text spacing styles are applied, text in "${accessibleName || selector}" spills outside its container bounds.`;
  }
  // 6. Ambiguous Sibling Collision / Overlap Needs Review
  else if (hasTextOverlap || isAmbiguousOverlap) {
    status = 'needsReview';
    exception = 'Ambiguous text overlap review: Adjacent text elements collide or overlap after text spacing overrides are applied; designer review required to verify if readability is impaired.';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Text expansion causes potential bounding box collision. Designer review required to confirm whether glyphs visibly collide or remain readable.';
    title = `Text expansion collision requires review`;
    description = `Under text spacing overrides, text in "${accessibleName || selector}" expanded and touches or overlaps adjacent elements. Designer review is required to verify visual legibility.`;
  }
  // 7. Clean Pass (including normal wrapping and natural height expansion)
  else {
    status = 'pass';
    initialPriority = 'P3';
    const isExpanded = candidate.height > baseline.height;
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Container adapts fluidly to WCAG text spacing overrides without text clipping, overflow, escape, or collision.';
    title = isExpanded
      ? `Text wraps and container expands fluidly (${baseline.height}px -> ${candidate.height}px)`
      : `Text adapts cleanly to text spacing overrides`;
    description = `The text container "${accessibleName || selector}" successfully accommodates WCAG 2.2 SC 1.4.12 overrides without clipping or loss of content or functionality.`;
  }

  const id = `text-spacing-${Math.abs(hashString(`${url}:${selector}:${status}`))}`;

  return {
    id,
    ruleId: 'text-spacing',
    wcagCriterion: 'WCAG 2.2 SC 1.4.12 Text Spacing',
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
      baselineHeight: baseline.height,
      candidateHeight: candidate.height,
      baselineScrollHeight: baseline.scrollHeight,
      candidateScrollHeight: candidate.scrollHeight,
      candidateClientHeight: candidate.clientHeight,
      clipDeficitPx: Math.round(verticalClipDeficit),
      horizontalClipDeficitPx: Math.round(horizontalClipDeficit),
      isClipped: isVerticallyClipped || isHorizontallyClipped,
      hasTextOverlap: !!hasTextOverlap,
      isControlObscured: !!isControlObscured,
      isBoundingBoxEscaped: isEscaped,
    },
    expected: {
      maxClipDeficitPx: 0,
      thresholdDescription: 'No loss of content or functionality when line-height >= 1.5, letter-spacing >= 0.12em, word-spacing >= 0.16em, and p margin-bottom >= 2em are applied',
    },
    boundingBox: candidate.boundingBox,
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
  }
  return hash;
}
