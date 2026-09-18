export type CandidateOverrideId = 'increase-target-size';

export interface AllowlistedOverride {
  id: CandidateOverrideId;
  name: string;
  applicableFixtureId: string;
  applicableRuleId: string;
  targetSelector: string;
  cssProperties: Record<string, string>;
  cssText: string;
  expectedEvidenceChange: string;
  humanReadableDescription: string;
}

export const ALLOWLISTED_OVERRIDES: Record<CandidateOverrideId, AllowlistedOverride> = {
  'increase-target-size': {
    id: 'increase-target-size',
    name: 'Increase Target Size to 24×24 CSS px',
    applicableFixtureId: 'target-size-demo',
    applicableRuleId: 'target-size',
    targetSelector:
      'button.small-btn, #submit-btn, button.icon-btn, .action-btn, #btn-fail-tiny-delete, #btn-fail-tiny-edit, .target-fail-delete, .target-fail-edit',
    cssProperties: {
      minWidth: '24px',
      minHeight: '24px',
      width: '24px',
      height: '24px',
      padding: '4px 8px',
    },
    cssText:
      'min-width: 24px !important; min-height: 24px !important; width: 24px !important; height: 24px !important; padding: 4px 8px !important;',
    expectedEvidenceChange: 'Increases element bounding box from undersized (<24px) to at least 24×24 CSS px, satisfying WCAG 2.2 SC 2.5.8.',
    humanReadableDescription: 'Applies min-width: 24px, min-height: 24px, and 4px 8px padding in an isolated candidate browser context.',
  },
};

export function getAllowlistedOverride(overrideId: string): AllowlistedOverride | null {
  if (overrideId in ALLOWLISTED_OVERRIDES) {
    return ALLOWLISTED_OVERRIDES[overrideId as CandidateOverrideId];
  }
  return null;
}

export function validateOverrideForIssue(
  override: AllowlistedOverride,
  fixtureId: string | undefined,
  ruleId: string
): { valid: boolean; error?: string } {
  if (override.applicableRuleId !== ruleId) {
    return {
      valid: false,
      error: `Override '${override.id}' applies to rule '${override.applicableRuleId}', but issue has rule '${ruleId}'.`,
    };
  }

  if (fixtureId && override.applicableFixtureId !== fixtureId) {
    return {
      valid: false,
      error: `Override '${override.id}' applies to fixture '${override.applicableFixtureId}', but run target is '${fixtureId}'.`,
    };
  }

  return { valid: true };
}
