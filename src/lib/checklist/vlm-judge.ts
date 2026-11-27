import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { AuditContextInput, ChecklistJsonPatch, VlmReviewSummary } from './types';

const VlmVerdictSchema = z.object({
  verdict: z.enum(['approve', 'warn', 'reject']),
  visualScore: z.number().min(1).max(5),
  semanticPass: z.boolean(),
  critique: z.string().min(1).max(400),
});

const GENERIC_PLACEHOLDER_LABEL_RE = /^(image|img|photo|picture|icon|logo|graphic|button|btn|link|click here|untitled)$/i;
const HIDDEN_CONTENT_CSS_RE = /\b(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?(?:\s*;|\s*!important|\s*\}))/i;
const NON_NAV_CONTENT_SELECTOR_RE = /\b(main|article|section|form|table|h[1-6]|p|img|\.card)\b/i;

/**
 * Deterministic anti-gaming guard that catches common LLM "rule-gaming" shortcuts
 * before spending VLM tokens. Allows responsive `@media` rules ONLY for nav/menu
 * selectors (verified by Playwright `navAccessibleAt320`), never for general content.
 */
export function runDeterministicPatchAntiGamingGuard(
  patch: ChecklistJsonPatch
): { passed: boolean; reason?: string } {
  for (const rule of patch.cssAdditions || []) {
    const trimmed = rule.trim();
    if (!HIDDEN_CONTENT_CSS_RE.test(trimmed)) continue;
    const isMediaRule = /^@media\b/i.test(trimmed);
    const isNavOnlyMediaRule =
      isMediaRule &&
      /\b(nav|menu|drawer)\b/i.test(trimmed) &&
      !NON_NAV_CONTENT_SELECTOR_RE.test(trimmed);
    if (!isNavOnlyMediaRule) {
      return {
        passed: false,
        reason: `Rejected CSS rule hiding content (${trimmed.slice(0, 80)})`,
      };
    }
  }

  for (const attrPatch of patch.attributePatches || []) {
    const attrs = attrPatch.setAttributes || {};
    for (const key of ['alt', 'aria-label']) {
      const val = attrs[key];
      if (typeof val === 'string' && GENERIC_PLACEHOLDER_LABEL_RE.test(val.trim())) {
        return {
          passed: false,
          reason: `Rejected generic non-descriptive ${key}="${val.trim()}"`,
        };
      }
    }
  }

  return { passed: true };
}

function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildJudgePrompt(
  patch: ChecklistJsonPatch,
  viewportEvaluated: '1280x800' | '320x640',
  context?: AuditContextInput
): string {
  const contextText = [
    context?.productGoal ? `Product Goal: ${context.productGoal}` : '',
    context?.targetAudience ? `Audience: ${context.targetAudience}` : '',
    context?.theme ? `Brand / Theme: ${context.theme}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return `You are a Senior Design QA Judge reviewing a before/after UI optimization at ${viewportEvaluated} viewport.
Compare Image 1 (BEFORE) and Image 2 (AFTER) along with the applied patch.
${contextText ? `Context: ${contextText}` : ''}

Applied Patch Summary:
- CSS rules added: ${(patch.cssAdditions || []).slice(0, 8).join(' | ') || 'none'}
- Attribute updates: ${JSON.stringify((patch.attributePatches || []).slice(0, 8))}

Evaluate TWO dimensions:
1. Semantic Accuracy (semanticPass): Do any new alt / aria-label / semantic updates make sense for the actual UI elements?
2. Visual Integrity (visualScore 1-5): At ${viewportEvaluated}, does the layout remain clean, non-overlapping, unclipped, and faithful to the brand palette?

Return ONLY valid JSON:
{
  "verdict": "approve" | "warn" | "reject",
  "visualScore": 1-5,
  "semanticPass": true | false,
  "critique": "1-2 concise sentences explaining what improved or what visually/semantically regressed."
}
Use "reject" ONLY if the patch visibly broke the layout, clipped/obscured content, ruined brand colors, or added clearly wrong/nonsensical labels.`;
}

/**
 * Layer 2 Multimodal VLM Judge: evaluates visual integrity & semantic quality
 * of Before vs After screenshots after passing Layer 1 deterministic checks.
 * Never fabricates VLM scores when no multimodal VLM response is obtained.
 */
export async function runVlmJudge(input: {
  beforeScreenshotBase64?: string;
  afterScreenshotBase64?: string;
  viewportEvaluated?: '1280x800' | '320x640';
  appliedPatch: ChecklistJsonPatch;
  context?: AuditContextInput;
}): Promise<VlmReviewSummary> {
  const viewportEvaluated = input.viewportEvaluated || '1280x800';
  const guard = runDeterministicPatchAntiGamingGuard(input.appliedPatch);
  if (!guard.passed) {
    return {
      verdict: 'reject',
      guardPassed: false,
      viewportEvaluated,
      critique: guard.reason || 'Patch rejected by deterministic anti-gaming guard.',
      provider: 'deterministic-guard',
    };
  }

  const { beforeScreenshotBase64, afterScreenshotBase64 } = input;
  if (!beforeScreenshotBase64 || !afterScreenshotBase64) {
    return {
      verdict: 'unavailable',
      guardPassed: true,
      viewportEvaluated,
      critique: 'Deterministic guard passed. Visual review unavailable (screenshots not captured).',
      provider: 'deterministic-guard',
    };
  }

  const prompt = buildJudgePrompt(input.appliedPatch, viewportEvaluated, input.context);

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_VLM_MODEL?.trim() || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: beforeScreenshotBase64 } },
              { inlineData: { mimeType: 'image/jpeg', data: afterScreenshotBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      });
      const parsed = VlmVerdictSchema.safeParse(extractJsonObject(res.response.text()));
      if (parsed.success) {
        return {
          ...parsed.data,
          guardPassed: true,
          viewportEvaluated,
          provider: 'gemini-vision',
          model: modelName,
        };
      }
    } catch {
      // Fall through to gateway or unavailable state
    }
  }

  const cpeKey = (process.env.LLM_API_KEY || process.env.CPE_API_KEY)?.trim();
  const cpeBase = (process.env.LLM_BASE_URL || process.env.CPE_API_BASE_URL)?.trim();
  const vlmModel = (process.env.VLM_MODEL || process.env.CPE_MODEL)?.trim();
  if (cpeKey && cpeBase && vlmModel) {
    try {
      const endpoint = cpeBase.endsWith('/chat/completions')
        ? cpeBase
        : `${cpeBase.replace(/\/$/, '')}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cpeKey}`,
        },
        body: JSON.stringify({
          model: vlmModel,
          temperature: 0,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${beforeScreenshotBase64}` } },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${afterScreenshotBase64}` } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const json = await response.json();
        const rawText = json?.choices?.[0]?.message?.content;
        if (typeof rawText === 'string') {
          const parsed = VlmVerdictSchema.safeParse(extractJsonObject(rawText));
          if (parsed.success) {
            return {
              ...parsed.data,
              guardPassed: true,
              viewportEvaluated,
              provider: 'openai-vision',
              model: vlmModel,
            };
          }
        }
      }
    } catch {
      // Fall through honestly
    }
  }

  return {
    verdict: 'unavailable',
    guardPassed: true,
    viewportEvaluated,
    critique: 'Deterministic guard passed. Visual review unavailable (no multimodal VLM response).',
    provider: 'deterministic-guard',
  };
}
