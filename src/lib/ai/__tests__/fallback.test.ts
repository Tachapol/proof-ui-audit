import { describe, it, expect } from 'vitest';
import { DeterministicExplanationProvider } from '../fallback';
import { AIExplanationInput } from '@/lib/schema/ai-response';

describe('DeterministicExplanationProvider', () => {
  const baseInput: AIExplanationInput = {
    ruleId: 'target-size',
    wcagCriterion: '2.5.8 Target Size (Minimum)',
    status: 'candidateFail',
    title: 'Touch target size is smaller than 24x24 CSS pixels',
    description: 'Target size 18x18px is below minimum 24x24px threshold',
    selector: 'button#small-btn',
    element: 'button',
    role: 'button',
    accessibleName: 'Submit',
    viewport: { width: 375, height: 667 },
    measured: { width: 18, height: 18 },
    expected: { minWidth: 24, minHeight: 24 },
    initialPriority: 'P1',
    priorityRationale: 'Interactive element fails target size',
  };

  it('covers all five rule families for candidateFail', async () => {
    const rules: AIExplanationInput['ruleId'][] = [
      'target-size',
      'text-contrast',
      'non-text-contrast',
      'reflow',
      'text-spacing',
    ];

    const provider = new DeterministicExplanationProvider('no_api_key');

    for (const ruleId of rules) {
      const input: AIExplanationInput = {
        ...baseInput,
        ruleId,
        measured: { width: 18, height: 18, contrastRatio: 2.5, horizontalOverflowPx: 120, clipDeficitPx: 14 },
        expected: { minWidth: 24, minHeight: 24, thresholdDescription: '4.5:1' },
      };

      const result = await provider.explain(input);
      expect(result.explanation).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
      expect(result.provenance).toBe('fallback');
      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBe('no_api_key');
    }
  });

  it('covers all three statuses: pass, candidateFail, needsReview', async () => {
    const provider = new DeterministicExplanationProvider('no_api_key');

    // candidateFail
    const failResult = await provider.explain(baseInput);
    expect(failResult.explanation).toContain('below the WCAG');
    expect(failResult.requiresDesignerReview).toBe(false);

    // pass
    const passResult = await provider.explain({
      ...baseInput,
      status: 'pass',
      measured: { width: 28, height: 28 },
    });
    expect(passResult.explanation).toContain('meeting or exceeding');
    expect(passResult.requiresDesignerReview).toBe(false);

    // needsReview
    const reviewResult = await provider.explain({
      ...baseInput,
      status: 'needsReview',
      reviewReason: 'Dynamic element geometry undetermined',
    });
    expect(reviewResult.requiresDesignerReview).toBe(true);
    expect(reviewResult.uncertaintyNote).toBeTruthy();
    expect(reviewResult.uncertaintyNote).toContain('Dynamic element geometry undetermined');
  });

  it('produces identical output for identical input (pure determinism)', async () => {
    const provider1 = new DeterministicExplanationProvider('no_api_key');
    const provider2 = new DeterministicExplanationProvider('no_api_key');

    const result1 = await provider1.explain(baseInput);
    const result2 = await provider2.explain(baseInput);

    expect(result1.explanation).toBe(result2.explanation);
    expect(result1.recommendation).toBe(result2.recommendation);
    expect(result1.requiresDesignerReview).toBe(result2.requiresDesignerReview);
  });

  it('mentions only measurements present in evidence and does not invent metrics', async () => {
    const provider = new DeterministicExplanationProvider('no_api_key');
    const input: AIExplanationInput = {
      ...baseInput,
      measured: { width: 19.5, height: 19.5 },
      expected: { minWidth: 24, minHeight: 24 },
    };

    const result = await provider.explain(input);
    expect(result.explanation).toContain('19.5');
    expect(result.explanation).not.toContain('999');
  });

  it('handles exceptions with proper uncertainty notes and designer review', async () => {
    const provider = new DeterministicExplanationProvider('no_api_key');
    const input: AIExplanationInput = {
      ...baseInput,
      status: 'needsReview',
      exception: 'Inline target exception under WCAG 2.5.8',
    };

    const result = await provider.explain(input);
    expect(result.requiresDesignerReview).toBe(true);
    expect(result.uncertaintyNote).toContain('Inline target exception under WCAG 2.5.8');
  });

  it('unconditionally sets requiresDesignerReview: true and non-empty uncertaintyNote when exception and reviewReason are absent', async () => {
    const provider = new DeterministicExplanationProvider('no_api_key');
    const input: AIExplanationInput = {
      ...baseInput,
      status: 'needsReview',
      exception: undefined,
      reviewReason: undefined,
    };

    const result = await provider.explain(input);
    expect(result.requiresDesignerReview).toBe(true);
    expect(result.uncertaintyNote).toBeTruthy();
    expect(result.uncertaintyNote!.trim().length).toBeGreaterThan(0);
  });
});
