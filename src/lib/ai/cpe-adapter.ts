import { AIExplanationInput, AIExplanationResult, RawModelOutputSchema } from '@/lib/schema/ai-response';
import { ExplanationProvider } from './provider';
import { buildExplanationPrompt } from './prompt-builder';
import { validateAIGrounding } from './grounding';

export class CpeExplanationProvider implements ExplanationProvider {
  readonly id = 'cpe' as const;
  constructor(private apiKey: string, private model: string, private baseUrl = 'https://gateway.ai.cpe.kmutt.ac.th/v1', private fetchImpl: typeof fetch = fetch) {
    if (!apiKey.trim() || !model.trim()) throw new Error('CPE API key and model are required.');
  }
  async explain(input: AIExplanationInput): Promise<AIExplanationResult> {
    const prompt = buildExplanationPrompt(input);
    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, temperature: 0.1, max_tokens: 2048, messages: [
          { role: 'system', content: prompt.systemInstruction }, { role: 'user', content: prompt.userPrompt },
        ] }), signal: AbortSignal.timeout(60000),
      });
    } catch { throw new Error('CPE provider unavailable or timed out.'); }
    if (!response.ok) throw new Error(`CPE provider error (HTTP ${response.status}).`);
    const body = await response.json();
    const raw = body.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('CPE returned empty response.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { throw new Error('CPE returned malformed JSON.'); }
    if (parsed && typeof parsed === 'object' && 'uncertaintyNote' in parsed && parsed.uncertaintyNote === null) delete parsed.uncertaintyNote;
    const result = RawModelOutputSchema.safeParse(parsed);
    if (!result.success) throw new Error('CPE response failed schema validation.');
    if (!validateAIGrounding(result.data, input).valid) throw new Error('CPE response rejected by grounding check.');
    return { ...result.data, provenance: 'cpe', model: this.model, isFallback: false, timestamp: new Date().toISOString(), durationMs: Date.now() - started };
  }
}
