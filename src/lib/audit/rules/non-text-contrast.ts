import { UXIssue, AuditStatus, Priority } from '@/lib/schema/ux-issue';
import { calculateContrastRatioRaw } from '../color-math';

export interface NonTextContrastMeasurement {
  selector: string;
  element: string;
  role?: string;
  accessibleName?: string;
  componentType: 'ui-component-border' | 'ui-component-fill' | 'graphical-object' | 'focus-indicator';
  indicatorColor: string;
  adjacentColor: string;
  isInactiveOrDisabled?: boolean;
  isDecorativeOrLogo?: boolean;
  isStateMeaningUncertain?: boolean;
  isAmbiguous?: boolean;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const NON_TEXT_CONTRAST_THRESHOLD = 3.0;

export function evaluateNonTextContrast(
  measurement: NonTextContrastMeasurement,
  url: string,
  viewport: { width: number; height: number }
): UXIssue {
  const {
    selector,
    element,
    role,
    accessibleName,
    componentType,
    indicatorColor,
    adjacentColor,
    isInactiveOrDisabled,
    isDecorativeOrLogo,
    isStateMeaningUncertain,
    isAmbiguous,
    boundingBox,
  } = measurement;

  // Use full-precision raw ratio for classification
  const rawRatio = calculateContrastRatioRaw(indicatorColor, adjacentColor);

  let contrastRatio: number;
  if (rawRatio < NON_TEXT_CONTRAST_THRESHOLD) {
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

  if (isInactiveOrDisabled) {
    status = 'pass';
    exception = 'Inactive control exception (SC 1.4.11): Inactive or disabled user interface components are excluded and not applicable under WCAG 2.2 SC 1.4.11.';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Element is marked disabled or inactive; recorded as excluded / not applicable under SC 1.4.11.';
    title = `Inactive control excluded from SC 1.4.11 (${contrastRatio}:1)`;
    description = `The component "${accessibleName || selector}" is marked inactive or disabled, exempting it from the 3:1 non-text contrast requirement.`;
  } else if (isDecorativeOrLogo) {
    status = 'pass';
    exception = 'Decorative or logo exception (SC 1.4.11): Purely decorative graphical objects or branding logos are excluded under WCAG 2.2 SC 1.4.11.';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Graphical element is decorative or brand mark; excluded under SC 1.4.11.';
    title = `Decorative element excluded from SC 1.4.11 (${contrastRatio}:1)`;
    description = `The element "${accessibleName || selector}" is identified as decorative or branding, exempting it from the 3:1 non-text contrast requirement.`;
  } else if (isStateMeaningUncertain || isAmbiguous) {
    status = 'needsReview';
    exception = 'Uncertain component state/meaning review: System cannot deterministically verify whether visual indicator is required to identify interactive state or operate the control.';
    initialPriority = 'P3';
    priorityRationale = 'Project Heuristic P3 (Not WCAG Severity): Interactive state or graphical meaning is ambiguous. Designer review required to verify if visual cue is mandatory to operate the control. Designer reprioritization supported.';
    title = `Ambiguous non-text element requires review (${contrastRatio}:1)`;
    description = `The element "${accessibleName || selector}" has a contrast ratio of ${contrastRatio}:1 against adjacent colors. Designer verification is needed to determine if the graphic conveys required state information.`;
  } else if (rawRatio >= NON_TEXT_CONTRAST_THRESHOLD) {
    status = 'pass';
    initialPriority = 'P3';
    priorityRationale = `Project Heuristic P3 (Not WCAG Severity): Non-text contrast ratio of ${contrastRatio}:1 meets or exceeds the required 3:1 threshold.`;
    title = `Non-text contrast meets 3:1 (${contrastRatio}:1)`;
    description = `The UI component visual indicator "${accessibleName || selector}" meets WCAG 2.2 SC 1.4.11 with a measured contrast ratio of ${contrastRatio}:1.`;
  } else {
    status = 'candidateFail';
    if (rawRatio < 2.0) {
      initialPriority = 'P1';
      priorityRationale = `Project Heuristic P1 (Not WCAG Severity): Severe non-text contrast candidate failure (${contrastRatio}:1 vs 3:1). Critical component boundary or interactive state is virtually imperceptible. Designer reprioritization supported.`;
    } else {
      initialPriority = 'P2';
      priorityRationale = `Project Heuristic P2 (Not WCAG Severity): Moderate non-text contrast candidate failure (${contrastRatio}:1 vs 3:1). Component boundary or indicator is below the 3:1 threshold. Designer reprioritization supported.`;
    }
    title = `Non-text contrast below 3:1 threshold (${contrastRatio}:1)`;
    description = `The UI component or graphical object "${accessibleName || selector}" has a contrast ratio of ${contrastRatio}:1 between indicator (${indicatorColor}) and adjacent surface (${adjacentColor}), failing the 3:1 requirement under WCAG 2.2 SC 1.4.11.`;
  }

  const id = `non-text-contrast-${Math.abs(hashString(`${url}:${selector}:${indicatorColor}:${adjacentColor}`))}`;

  return {
    id,
    ruleId: 'non-text-contrast',
    wcagCriterion: 'WCAG 2.2 SC 1.4.11 Non-text Contrast',
    status,
    title,
    description,
    url,
    viewport,
    selector,
    element,
    role,
    accessibleName: accessibleName || selector,
    measured: {
      contrastRatio,
      componentType,
      indicatorColor,
      adjacentColor,
      isInactiveOrDisabled: !!isInactiveOrDisabled,
      isStateMeaningUncertain: !!isStateMeaningUncertain,
    },
    expected: {
      minRatio: NON_TEXT_CONTRAST_THRESHOLD,
      thresholdDescription: 'At least 3:1 against adjacent colors for UI components and meaningful graphics',
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
