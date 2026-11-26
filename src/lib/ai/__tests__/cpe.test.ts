import { describe, it, expect, vi } from 'vitest';
import { CpeExplanationProvider } from '../cpe-adapter';
import { AIExplanationInput, AIExplanationResultSchema } from '@/lib/schema/ai-response';
const input: AIExplanationInput = {
  ruleId: 'text-contrast', wcagCriterion: 'WCAG 2.2 SC 1.4.3', status: 'candidateFail',
  title: 'Low contrast', description: 'Normal text', selector: '#normal-fail', element: 'p',
  viewport: { width: 375, height: 667 }, measured: { contrastRatio: 2.32 }, expected: { minContrastRatio: 4.5 },
  initialPriority: 'P1', priorityRationale: 'Project heuristic',
};
describe('CPE OpenAI-compatible provider', () => {
  it('sends measured evidence and retains CPE/model provenance through schema parsing', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ explanation: 'Measured contrast is 2.32:1.', recommendation: 'Consider increasing contrast.', requiresDesignerReview: false }) } }] }), { status: 200 }));
    const result = await new CpeExplanationProvider('test-token', 'test-model', undefined, request).explain(input);
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(payload.messages[1].content).toContain('2.32');
    expect(AIExplanationResultSchema.parse(result)).toMatchObject({ provenance: 'cpe', model: 'test-model', isFallback: false });
  });
  it('hides raw HTTP error response', async () => {
    const request = vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 401 }));
    await expect(new CpeExplanationProvider('test-token', 'test-model', undefined, request).explain(input)).rejects.toThrow('CPE provider error (HTTP 401).');
  });
  it('rejects malformed JSON and review outputs that claim certainty', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'not JSON' } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ explanation: 'Confirmed failure.', recommendation: 'Fix it.', requiresDesignerReview: false }) } }] })));
    const provider = new CpeExplanationProvider('test-token', 'test-model', undefined, request);
    await expect(provider.explain(input)).rejects.toThrow('malformed JSON');
    await expect(provider.explain({ ...input, status: 'needsReview' })).rejects.toThrow('grounding check');
  });
});
