import { AIExplanationInput, AIExplanationResult, AIFallbackReason } from '@/lib/schema/ai-response';
import { ExplanationProvider } from './provider';
import { DeterministicExplanationProvider } from './fallback';
import { GeminiExplanationProvider } from './gemini-adapter';
import { CpeExplanationProvider } from './cpe-adapter';

export interface ExplanationServiceOptions {
  provider?: ExplanationProvider;
  geminiApiKey?: string;
  timeoutMs?: number;
}

export class ExplanationService {
  private fallbackProvider: DeterministicExplanationProvider;
  private geminiProvider: ExplanationProvider | null = null;

  constructor(options?: ExplanationServiceOptions) {
    this.fallbackProvider = new DeterministicExplanationProvider('no_api_key');

    if (options?.provider) {
      this.geminiProvider = options.provider;
    } else {
      // In automated test environments, never instantiate real Gemini network provider from env
      const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST || !!process.env.PLAYWRIGHT_TEST;
      if (!isTestEnv && process.env.CPE_API_KEY && process.env.CPE_MODEL) {
        this.geminiProvider = new CpeExplanationProvider(process.env.CPE_API_KEY, process.env.CPE_MODEL, process.env.CPE_API_BASE_URL);
      } else if (!isTestEnv) {
        const apiKey = options?.geminiApiKey ?? process.env.GEMINI_API_KEY;
        if (apiKey && apiKey.trim().length > 0) {
          try {
            this.geminiProvider = new GeminiExplanationProvider(apiKey.trim(), {
              timeoutMs: options?.timeoutMs ?? 8000,
            });
          } catch {
            this.geminiProvider = null;
          }
        }
      }
    }
  }

  async explain(input: AIExplanationInput): Promise<AIExplanationResult> {
    if (!this.geminiProvider) {
      return new DeterministicExplanationProvider('no_api_key').explain(input);
    }

    try {
      return await this.geminiProvider.explain(input);
    } catch (err: any) {
      const errMsg = err?.message || '';
      let reason: AIFallbackReason = 'provider_error';

      if (errMsg.includes('timed out')) {
        reason = 'provider_timeout';
      } else if (errMsg.includes('empty response')) {
        reason = 'empty_response';
      } else if (errMsg.includes('malformed JSON')) {
        reason = 'malformed_json';
      } else if (errMsg.includes('failed schema validation')) {
        reason = 'schema_validation_failed';
      } else if (errMsg.includes('rejected by grounding check')) {
        reason = 'grounding_failed';
      }

      // Seamlessly fall back to deterministic explanation without leaking raw stack traces or keys
      const fallback = new DeterministicExplanationProvider(reason);
      return await fallback.explain(input);
    }
  }
}

// Global default service instance
export const defaultExplanationService = new ExplanationService();
