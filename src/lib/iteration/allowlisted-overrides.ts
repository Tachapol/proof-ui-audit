export type CandidateOverrideId = 'increase-target-size';

export interface AllowlistedOverride {
  id: CandidateOverrideId;
  name: string;
  /**
   * Fixture IDs this override is permitted for.
   * Use `'*'` to allow any fixture or external URL audit target.
   * Use an array of fixture IDs to restrict to specific fixtures.
   */
  applicableFixtureIds: string[] | '*';
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
    // Applies to any target-size audit — fixtures, snippets, or external URLs.
    // The override uses the issue's own selector from the audit run, so it is
    // not bound to a specific fixture's DOM structure.
    applicableFixtureIds: '*',
    applicableRuleId: 'target-size',
    // Fallback selector used when the issue's representative selector is unavailable.
    // In practice, isolated-preview.ts always uses rep.selector instead.
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

  // '*' means unrestricted — any fixture or external URL is permitted.
  if (override.applicableFixtureIds !== '*') {
    // For a fixture-based run: the fixture must be in the allowlist.
    if (fixtureId && !override.applicableFixtureIds.includes(fixtureId)) {
      return {
        valid: false,
        error: `Override '${override.id}' is not permitted for fixture '${fixtureId}'. Allowed fixtures: ${override.applicableFixtureIds.join(', ')}.`,
      };
    }
    // For external URL runs (no fixtureId): only allowed if '*' is set.
    // Array-restricted overrides are fixture-only for safety.
    if (!fixtureId) {
      return {
        valid: false,
        error: `Override '${override.id}' is restricted to specific fixtures and cannot be applied to external URL targets.`,
      };
    }
  }

  return { valid: true };
}
