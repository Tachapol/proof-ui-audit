import { AuditStatus } from '@/lib/schema/ux-issue';

export interface RecommendationParams {
  ruleId: string;
  status: AuditStatus;
  element?: string;
  selector?: string;
  exception?: string;
  measured?: Record<string, unknown>;
  expected?: Record<string, unknown>;
}

export function isElementExcluded(status: AuditStatus, exception?: string): boolean {
  if (!exception) return false;
  const lower = exception.toLowerCase();
  return lower.includes('excluded') || lower.includes('not applicable');
}

/**
 * Returns evidence-grounded recommendation text strictly adhering to status semantics:
 * - pass: requirement satisfied; no exception/remediation recommendation
 * - candidateFail: evidence-grounded possible correction
 * - needsReview: cautious exception/context language
 * - excluded/not applicable: explain exclusion without describing it as a measured pass
 */
export function getDefaultRecommendation(params: RecommendationParams): string {
  const { ruleId, status, element, selector, exception } = params;

  // 1. Excluded / Not Applicable elements
  if (isElementExcluded(status, exception)) {
    switch (ruleId) {
      case 'non-text-contrast':
        return 'Element is inactive, disabled, or purely decorative and is excluded under WCAG 2.2 SC 1.4.11; no remediation required.';
      case 'target-size':
        return 'Element is excluded from target size evaluation; no remediation required.';
      case 'text-contrast':
        return 'Element is excluded from text contrast evaluation; no remediation required.';
      case 'reflow':
        return 'Decorative or non-essential content is excluded from 2D reflow evaluation; no remediation required.';
      case 'text-spacing':
        return 'Element is excluded from text spacing evaluation; no remediation required.';
      default:
        return 'Element is excluded from evaluation under stated criteria; no remediation required.';
    }
  }

  // 2. Pass status: requirement satisfied; no exception/remediation recommendation
  if (status === 'pass') {
    switch (ruleId) {
      case 'target-size':
        return 'Target size meets or exceeds the 24×24 CSS px threshold. Requirement satisfied; no remediation required.';
      case 'text-contrast':
        return 'Text contrast satisfies the minimum required threshold. Requirement satisfied; no remediation required.';
      case 'non-text-contrast':
        return 'UI component or graphical boundary satisfies the 3:1 contrast threshold. Requirement satisfied; no remediation required.';
      case 'reflow':
        return 'Layout reflows cleanly without 2D horizontal scrolling at 320px. Requirement satisfied; no remediation required.';
      case 'text-spacing':
        return 'Container accommodates WCAG 2.2 SC 1.4.12 text spacing overrides without content clipping. Requirement satisfied; no remediation required.';
      default:
        return 'WCAG-informed threshold satisfied; no remediation required.';
    }
  }

  // 3. Needs Review: cautious exception/context language
  if (status === 'needsReview') {
    switch (ruleId) {
      case 'target-size':
        return 'A designer must review whether this component qualifies for an inline link or spacing alternative exception.';
      case 'text-contrast':
        return 'A designer must visually verify text contrast against the complex background, gradient, or imagery.';
      case 'non-text-contrast':
        return 'A designer should review whether this boundary or indicator is essential for user understanding and operation.';
      case 'reflow':
        return 'A designer must determine whether 2D scrolling is strictly essential to content meaning or can be converted to single-column reflow.';
      case 'text-spacing':
        return 'A designer should visually inspect whether text expansion causes legibility impairment or component collision.';
      default:
        return 'A designer should review the context to determine whether an allowable exception applies.';
    }
  }

  // 4. Candidate Fail: evidence-grounded possible correction
  const targetName = element ? `<${element}>` : (selector || 'component');
  switch (ruleId) {
    case 'target-size':
      return `Increase interactive target dimensions for ${targetName} to at least 24×24 CSS px or provide sufficient 24px diameter clear spacing.`;
    case 'text-contrast':
      return `Adjust foreground text color or background color for ${targetName} to achieve the required contrast ratio.`;
    case 'non-text-contrast':
      return `Increase visual boundary or indicator contrast for ${targetName} to achieve at least a 3:1 ratio against adjacent colors.`;
    case 'reflow':
      return `Replace fixed widths on ${targetName} with responsive units (e.g. max-width: 100%) to allow single-axis vertical reflow.`;
    case 'text-spacing':
      return `Remove fixed height or overflow constraints on ${targetName} so content expands fluidly under custom text spacing.`;
    default:
      return `Adjust geometry or styles for ${targetName} to satisfy the WCAG-informed threshold.`;
  }
}
