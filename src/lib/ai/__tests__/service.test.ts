import { describe, it, expect, vi } from 'vitest';
import { ExplanationService } from '../service';
import { ExplanationProvider } from '../provider';
import { GeminiExplanationProvider } from '../gemini-adapter';
import { AIExplanationInput, RawModelOutputSchema } from '@/lib/schema/ai-response';

describe('ExplanationService Provider Selection and Fallbacks', () => {
  const sampleInput: AIExplanationInput = {
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

  it('selects deterministic fallback when no API key is provided', async () => {
    const service = new ExplanationService({ geminiApiKey: undefined });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.provenance).toBe('fallback');
    expect(result.fallbackReason).toBe('no_api_key');
    expect(result.explanation).toContain('18×18 CSS px');
  });

  it('guarantees tests never call real Gemini even when a non-empty fake GEMINI_API_KEY is present', async () => {
    // In test environment, ExplanationService blocks real Gemini provider creation
    const serviceWithKey = new ExplanationService({ geminiApiKey: 'AIzaSyFakeDevMachineKey123456789' });
    const result = await serviceWithKey.explain(sampleInput);

    // Confirms no external network call is made and deterministic fallback is safely returned
    expect(result.isFallback).toBe(true);
    expect(result.provenance).toBe('fallback');
    expect(result.fallbackReason).toBe('no_api_key');
  });

  it('enforces safety guard throwing an error if direct real Gemini SDK instantiation is attempted in tests', () => {
    expect(() => {
      new GeminiExplanationProvider('AIzaSyDirectInvocationKey');
    }).toThrow(/Test environment safety guard: Real Gemini network calls are strictly prohibited/);
  });

  it('handles provider timeout by falling back with provider_timeout', async () => {
    const mockTimeoutProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Provider request timed out after 8000ms')),
    };

    const service = new ExplanationService({ provider: mockTimeoutProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.provenance).toBe('fallback');
    expect(result.fallbackReason).toBe('provider_timeout');
  });

  it('handles provider error by falling back with provider_error', async () => {
    const mockErrorProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Network error: connection refused')),
    };

    const service = new ExplanationService({ provider: mockErrorProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe('provider_error');
  });

  it('handles empty response by falling back with empty_response', async () => {
    const mockEmptyProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Gemini returned an empty response')),
    };

    const service = new ExplanationService({ provider: mockEmptyProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe('empty_response');
  });

  it('handles malformed JSON by falling back with malformed_json', async () => {
    const mockJsonProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Gemini response was malformed JSON')),
    };

    const service = new ExplanationService({ provider: mockJsonProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe('malformed_json');
  });

  it('handles schema validation failure by falling back with schema_validation_failed', async () => {
    const mockSchemaProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Gemini response failed schema validation: required field missing')),
    };

    const service = new ExplanationService({ provider: mockSchemaProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe('schema_validation_failed');
  });

  it('handles grounding failure by falling back with grounding_failed', async () => {
    const mockGroundingProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockRejectedValue(new Error('Gemini response rejected by grounding check: Invented or unverified measurement')),
    };

    const service = new ExplanationService({ provider: mockGroundingProvider });
    const result = await service.explain(sampleInput);

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toBe('grounding_failed');
  });

  it('never reveals API key in serialized output or metadata', async () => {
    const secretKey = 'ai-secret-key-12345';
    const mockProvider: ExplanationProvider = {
      id: 'gemini',
      explain: vi.fn().mockResolvedValue({
        explanation: 'Valid explanation for button.',
        recommendation: 'Increase target size.',
        requiresDesignerReview: false,
        provenance: 'gemini',
        isFallback: false,
        timestamp: new Date().toISOString(),
      }),
    };

    const service = new ExplanationService({ provider: mockProvider, geminiApiKey: secretKey });
    const result = await service.explain(sampleInput);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretKey);
  });

  describe('Strict Structured Model Output Validation', () => {
    it('accepts valid structured model output', () => {
      const valid = {
        explanation: 'The button is 18x18px.',
        recommendation: 'Increase button size to 24x24px.',
        requiresDesignerReview: false,
        uncertaintyNote: undefined,
      };
      const parsed = RawModelOutputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects unknown or extra fields supplied by the model', () => {
      const withExtra = {
        explanation: 'The button is 18x18px.',
        recommendation: 'Increase button size.',
        requiresDesignerReview: false,
        // Forbidden extra fields:
        provenance: 'gemini',
        timestamp: new Date().toISOString(),
        isFallback: false,
        score: 95,
      };
      const parsed = RawModelOutputSchema.safeParse(withExtra);
      expect(parsed.success).toBe(false);
    });

    it('rejects empty explanation', () => {
      const empty = {
        explanation: '',
        recommendation: 'Increase button size.',
        requiresDesignerReview: false,
      };
      const parsed = RawModelOutputSchema.safeParse(empty);
      expect(parsed.success).toBe(false);
    });

    it('rejects whitespace-only explanation', () => {
      const whitespace = {
        explanation: '   \n\t  ',
        recommendation: 'Increase button size.',
        requiresDesignerReview: false,
      };
      const parsed = RawModelOutputSchema.safeParse(whitespace);
      expect(parsed.success).toBe(false);
    });

    it('rejects empty recommendation', () => {
      const empty = {
        explanation: 'The button is 18x18px.',
        recommendation: '',
        requiresDesignerReview: false,
      };
      const parsed = RawModelOutputSchema.safeParse(empty);
      expect(parsed.success).toBe(false);
    });

    it('rejects whitespace-only recommendation', () => {
      const whitespace = {
        explanation: 'The button is 18x18px.',
        recommendation: '   ',
        requiresDesignerReview: false,
      };
      const parsed = RawModelOutputSchema.safeParse(whitespace);
      expect(parsed.success).toBe(false);
    });

    it('ensures server owns provenance and timestamp metadata', () => {
      // RawModelOutputSchema does not have provenance or timestamp.
      // Those fields can only be attached by server-side code.
      const raw = {
        explanation: 'The button is 18x18px.',
        recommendation: 'Increase size.',
        requiresDesignerReview: false,
      };
      const validated = RawModelOutputSchema.parse(raw);
      expect((validated as any).provenance).toBeUndefined();
      expect((validated as any).timestamp).toBeUndefined();
    });
  });
});
