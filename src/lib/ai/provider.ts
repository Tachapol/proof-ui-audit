import { AIExplanationInput, AIExplanationResult } from '@/lib/schema/ai-response';

export interface ExplanationProvider {
  readonly id: 'gemini' | 'cpe' | 'fallback';
  explain(input: AIExplanationInput): Promise<AIExplanationResult>;
}
