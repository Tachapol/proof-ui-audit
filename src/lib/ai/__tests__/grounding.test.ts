import { describe, it, expect } from 'vitest';
import { validateAIGrounding } from '../grounding';
import { AIExplanationInput, AIExplanationResult } from '@/lib/schema/ai-response';

describe('Grounding Validation Engine', () => {
  const baseInput: AIExplanationInput = {
    ruleId: 'target-size',
    wcagCriterion: '2.5.8 Target Size (Minimum)',
    status: 'candidateFail',
    title: 'Touch target size smaller than 24x24px',
    description: 'Measured 18x18px is below 24x24px threshold',
    selector: 'button#btn',
    element: 'button',
    viewport: { width: 375, height: 667 },
    measured: { width: 18, height: 18 },
    expected: { minWidth: 24, minHeight: 24 },
    initialPriority: 'P1',
    priorityRationale: 'Interactive element fails target size',
  };

  const validOutput: AIExplanationResult = {
    explanation: 'The button measures 18px by 18px, which does not meet the minimum 24px by 24px target size.',
    recommendation: 'Consider increasing padding to achieve at least 24px by 24px.',
    requiresDesignerReview: false,
    provenance: 'gemini',
    isFallback: false,
    timestamp: new Date().toISOString(),
  };

  it('accepts strictly grounded output', () => {
    const check = validateAIGrounding(validOutput, baseInput);
    expect(check.valid).toBe(true);
    expect(check.reason).toBeUndefined();
  });

  it('allows harmless numbered prose and selector numbers without false rejection', () => {
    const proseOutput: AIExplanationResult = {
      ...validOutput,
      explanation: 'Step 1: The button measures 18px by 18px on selector button#btn-2. 2 remediation options exist.',
      recommendation: 'Option 1: Add 4px padding. Option 2: Wrap inside container.',
    };
    const check = validateAIGrounding(proseOutput, baseInput);
    expect(check.valid).toBe(true);
  });

  it('rejects output citing a different WCAG criterion', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      explanation: 'Under WCAG 1.4.3 Contrast (Minimum), this target size is invalid.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('conflicting WCAG criterion');
  });

  it('rejects output containing an invented measurement not in evidence', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      explanation: 'The element width was measured at 11.25px and height at 13.75px.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Invented or unverified measurement');
  });

  it('rejects claims of complete WCAG compliance or full accessibility', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      explanation: 'The website is now 100% compliant with WCAG standards.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('unsupported compliance claim');
  });

  it('rejects claims that source code was modified', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      recommendation: 'We have updated the CSS rules in the codebase to fix this issue.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('source code was modified');
  });

  it('rejects claims that recommendation was tested or verified', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      recommendation: 'This fix has been verified in testing and eliminates the defect.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('recommendation was tested');
  });

  it('rejects presenting P0-P3 as WCAG severity', () => {
    const invalidOutput: AIExplanationResult = {
      ...validOutput,
      explanation: 'Under WCAG severity P1, this failure must be addressed immediately.',
    };
    const check = validateAIGrounding(invalidOutput, baseInput);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('conflated project priority');
  });

  describe('needsReview Status Enforcement', () => {
    const reviewInputNoOptional: AIExplanationInput = {
      ...baseInput,
      status: 'needsReview',
      exception: undefined, // absent
      reviewReason: undefined, // absent
    };

    it('strictly requires requiresDesignerReview === true even when exception and reviewReason are absent', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        requiresDesignerReview: false, // invalid
        uncertaintyNote: 'Possible touch target exception',
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('needsReview issue must set requiresDesignerReview to true');
    });

    it('strictly requires non-empty uncertaintyNote even when exception and reviewReason are absent', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        requiresDesignerReview: true,
        uncertaintyNote: undefined, // invalid
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('needsReview issue must provide an explicit non-empty uncertaintyNote');
    });

    it('rejects needsReview output presenting issue as a definite failure', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'This element is a confirmed violation and definite failure of touch target requirements.',
        requiresDesignerReview: true,
        uncertaintyNote: 'Review needed',
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrectly claimed definite failure');
    });

    it('rejects needsReview output presenting issue as a definite pass', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'This element is fully compliant and passes accessibility standards.',
        requiresDesignerReview: true,
        uncertaintyNote: 'Review needed',
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrectly claimed definite pass');
    });

    it('rejects needsReview output claiming confirmed exception without designer review', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The component qualifies as a confirmed exception under spacing rules.',
        requiresDesignerReview: true,
        uncertaintyNote: 'Review needed',
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('claimed confirmed exception');
    });

    it('rejects needsReview output claiming confirmed fix', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The recommended fix is confirmed and resolves this potential issue.',
        requiresDesignerReview: true,
        uncertaintyNote: 'Review needed',
      };
      const check = validateAIGrounding(invalidOutput, reviewInputNoOptional);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('claimed confirmed fix');
    });
  });

  describe('Threshold Grounding Per Rule Family', () => {
    it('rejects incorrect threshold claim for target-size (conflicting with 24x24 px)', () => {
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The element fails the WCAG threshold of 48px.',
      };
      const check = validateAIGrounding(invalidOutput, baseInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for target-size');
    });

    it('rejects incorrect threshold claim for normal text contrast (conflicting with 4.5:1)', () => {
      const contrastInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-contrast',
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        expected: { thresholdDescription: '4.5:1 for normal text' },
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The text fails the minimum of 3:1 contrast required for normal text.',
      };
      const check = validateAIGrounding(invalidOutput, contrastInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for text-contrast on normal text');
    });

    it('rejects incorrect threshold claim for large text contrast (conflicting with 3:1)', () => {
      const contrastInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-contrast',
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        expected: { thresholdDescription: '3:1 for large text' },
        description: 'Large text header has insufficient contrast',
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'Large text requires 4.5:1 contrast under WCAG 1.4.3.',
      };
      const check = validateAIGrounding(invalidOutput, contrastInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for text-contrast on large text');
    });

    it('rejects incorrect threshold claim for non-text-contrast (conflicting with 3:1)', () => {
      const nonTextInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'non-text-contrast',
        wcagCriterion: '1.4.11 Non-text Contrast',
        expected: { thresholdDescription: '3:1' },
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The button border fails the threshold of 4.5:1 for UI components.',
      };
      const check = validateAIGrounding(invalidOutput, nonTextInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for non-text-contrast');
    });

    it('rejects incorrect threshold claim for reflow (conflicting with 320 CSS px)', () => {
      const reflowInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'reflow',
        wcagCriterion: '1.4.10 Reflow',
        viewport: { width: 320, height: 640 },
        measured: { horizontalOverflowPx: 80 },
        expected: { maxScrollWidth: 320 },
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The layout fails reflow threshold at 400px.',
      };
      const check = validateAIGrounding(invalidOutput, reflowInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for reflow');
    });

    it('rejects incorrect line-height threshold for text-spacing (conflicting with 1.5)', () => {
      const textSpacingInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-spacing',
        wcagCriterion: '1.4.12 Text Spacing',
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'WCAG 1.4.12 specifies a line-height of 1.2 times the font size.',
      };
      const check = validateAIGrounding(invalidOutput, textSpacingInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for line-height');
    });

    it('rejects incorrect paragraph spacing threshold for text-spacing (conflicting with 2)', () => {
      const textSpacingInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-spacing',
        wcagCriterion: '1.4.12 Text Spacing',
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'Paragraph spacing must accommodate paragraph spacing of 1.5 times the font size.',
      };
      const check = validateAIGrounding(invalidOutput, textSpacingInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for paragraph spacing');
    });

    it('rejects incorrect letter spacing threshold for text-spacing (conflicting with 0.12)', () => {
      const textSpacingInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-spacing',
        wcagCriterion: '1.4.12 Text Spacing',
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'The container fails under letter spacing of 0.2 times the font size.',
      };
      const check = validateAIGrounding(invalidOutput, textSpacingInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for letter spacing');
    });

    it('rejects incorrect word spacing threshold for text-spacing (conflicting with 0.16)', () => {
      const textSpacingInput: AIExplanationInput = {
        ...baseInput,
        ruleId: 'text-spacing',
        wcagCriterion: '1.4.12 Text Spacing',
      };
      const invalidOutput: AIExplanationResult = {
        ...validOutput,
        explanation: 'Word spacing must support word spacing of 0.25 times the font size.',
      };
      const check = validateAIGrounding(invalidOutput, textSpacingInput);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('incorrect threshold claimed for word spacing');
    });
  });
});
