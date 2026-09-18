import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExplanationProvider } from './provider';
import { AIExplanationInput, AIExplanationResult, RawModelOutputSchema } from '@/lib/schema/ai-response';
import { buildExplanationPrompt } from './prompt-builder';
import { validateAIGrounding } from './grounding';

export interface GeminiAdapterOptions {
  model?: string;
  timeoutMs?: number;
  allowInTest?: boolean;
}

export class GeminiExplanationProvider implements ExplanationProvider {
  readonly id = 'gemini' as const;
  private client: GoogleGenerativeAI;
  private modelName: string;
  private timeoutMs: number;

  constructor(apiKey: string, options?: GeminiAdapterOptions) {
    // Automated test safety guard: block real Gemini SDK instantiation in test suites
    const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST || !!process.env.PLAYWRIGHT_TEST;
    if (isTestEnv && !options?.allowInTest) {
      throw new Error('Test environment safety guard: Real Gemini network calls are strictly prohibited in automated test runs.');
    }

    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('GeminiExplanationProvider requires a non-empty API key.');
    }
    this.client = new GoogleGenerativeAI(apiKey.trim());
    this.modelName = options?.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.timeoutMs = options?.timeoutMs || 8000;
  }

  async explain(input: AIExplanationInput): Promise<AIExplanationResult> {
    const startTime = Date.now();
    const { systemInstruction, userPrompt } = buildExplanationPrompt(input);

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Conservative generation suitable for factual explanation
      },
    });

    // Enforce bounded timeout
    const generatePromise = model.generateContent(userPrompt);
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Gemini request timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);
      generatePromise.finally(() => clearTimeout(timer));
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    const rawText = response.response.text();
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Gemini returned an empty response.');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseErr: any) {
      throw new Error(`Gemini returned malformed JSON: ${parseErr.message}`);
    }

    // 1. Validate structured schema with Zod (strictly rejecting unknown fields and empty strings)
    const zodParsed = RawModelOutputSchema.safeParse(parsedJson);
    if (!zodParsed.success) {
      throw new Error(`Gemini output failed schema validation: ${zodParsed.error.message}`);
    }

    const outputData = zodParsed.data;

    // 2. Apply deterministic grounding validation
    const groundingCheck = validateAIGrounding(
      {
        explanation: outputData.explanation,
        recommendation: outputData.recommendation,
        requiresDesignerReview: outputData.requiresDesignerReview,
        uncertaintyNote: outputData.uncertaintyNote || undefined,
      },
      input
    );

    if (!groundingCheck.valid) {
      throw new Error(`Gemini output rejected by grounding check: ${groundingCheck.reason}`);
    }

    // 3. Server owns provenance, timestamp, and fallback metadata
    const result: AIExplanationResult = {
      explanation: outputData.explanation,
      recommendation: outputData.recommendation,
      requiresDesignerReview: outputData.requiresDesignerReview,
      uncertaintyNote: outputData.uncertaintyNote || undefined,
      provenance: 'gemini',
      isFallback: false,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    return result;
  }
}
