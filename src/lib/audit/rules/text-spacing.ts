import { UXIssue, AuditStatus, Priority, BoundingBox } from '@/lib/schema/ux-issue';

export const TEXT_SPACING_OVERRIDE_CSS = `
* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p {
  margin-bottom: 2em !important;
}
`;

export interface ElementSpacingState {
  width: number;
  height: number;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  isClipped: boolean;
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
  } = measurement;

  const clipDeficit = Math.max(0, candidate.scrollHeight - candidate.clientHeight);
  const isDeterministicallyClipped =
    (candidate.isClipped && !baseline.isClipped) ||
    (clipDeficit > 2 && candidate.height < candidate.scrollHeight);

  let status: AuditStatus;
  let exception: string | undefined;
  let initialPriority: Priority;
  let priorityRationale: string;
  let title: string;
  let description: string;

  if (isDeterministicallyClipped) {
    status = 'candidateFail';
    initialPriority = clipDeficit > 15 ? 'P1' : 'P2';
    priorityRationale = clipDeficit > 15
      ? 'Project Heuristic P1 (Not WCAG Severity): Severe content clipping (>15px hidden) under WCAG text-spacing overrides. Interactive text or essential information is truncated.'
      : 'Project Heuristic P2 (Not WCAG Severity): Moderate text clipping detected under WCAG text-spacing overrides. Container does not adapt to expanded font metrics.';
    title = `Text content clipped under text spacing override (${Math.round(clipDeficit)}px overflow)`;
    description = `When WCAG 2.2 SC 1.4.12 text spacing styles (line-height: 1.5, letter-spacing: 0.12em, word-spacing: 0.16em, p margin-bottom: 2em) are applied, content in "${accessibleName || selector}" is clipped by its fixed container dimensions.`;
  } else if (hasTextOverlap || isAmbiguousOverlap) {
    status = 'needsReview';
    exception = 'Ambiguous text overlap review: Text elements overlap or touch after text spacing overrides are applied; designer review required to verify if readability or operation is impaired.';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Text expansion causes potential bounding box collision. Designer review required to confirm whether glyphs visibly collide or remain readable.';
    title = `Text expansion collision requires review`;
    description = `Under text spacing overrides, text in "${accessibleName || selector}" expanded and overlaps adjacent elements or boundaries. Designer review is required to verify visual legibility.`;
  } else {
    status = 'pass';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Container adapts fluidly to WCAG text spacing overrides without text clipping, overflow, or collision.';
    title = `Text adapts cleanly to text spacing overrides`;
    description = `The text container "${accessibleName || selector}" successfully accommodates WCAG 2.2 SC 1.4.12 overrides (line-height: 1.5, letter-spacing: 0.12em, word-spacing: 0.16em) without clipping or collision.`;
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
      candidateScrollHeight: candidate.scrollHeight,
      candidateClientHeight: candidate.clientHeight,
      clipDeficitPx: Math.round(clipDeficit),
      isClipped: isDeterministicallyClipped,
      hasTextOverlap: !!hasTextOverlap,
    },
    expected: {
      maxClipDeficitPx: 0,
      thresholdDescription: 'No loss of content or functionality when line-height: 1.5, letter-spacing: 0.12em, word-spacing: 0.16em, and p margin-bottom: 2em are applied',
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
    hash |= 0;
  }
  return hash;
}
