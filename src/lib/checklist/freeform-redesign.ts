import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { runFullChecklistAudit } from './dom-evaluators';
import type { AuditContextInput, ChecklistSummary, IterationSnapshot } from './types';

export interface FocusMetricHint {
  id: string;
  title: string;
  priority?: string;
  measuredSummary?: string;
  recommendation?: string;
  samples?: string[];
}

const FreeformRedesignOutputSchema = z.object({
  summary: z.string().min(1).max(500),
  critique: z.array(z.string().min(1).max(300)).min(1).max(12),
  html: z.string().min(50),
});

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildFreeformPrompt(
  html: string,
  context?: AuditContextInput,
  focusMetrics?: FocusMetricHint[]
): string {
  const contextLines = [
    context?.productGoal ? `- Product Goal: ${context.productGoal}` : '',
    context?.targetAudience ? `- Target Audience: ${context.targetAudience}` : '',
    context?.theme ? `- Brand / Theme Colors: ${context.theme}` : '',
    context?.customPrompt ? `- Additional Guidelines: ${context.customPrompt}` : '',
  ].filter(Boolean);

  const focusLines = (focusMetrics || []).map(
    (m, i) =>
      `${i + 1}. [${m.priority || 'P1'}] ${m.title} (${m.id})${m.measuredSummary ? ` — ${m.measuredSummary}` : ''}${m.recommendation ? ` | Fix: ${m.recommendation}` : ''}`
  );

  return [
    'You are a Principal Product Designer & Frontend Architect.',
    'Review the attached desktop (1280x800) and mobile (320x640) screenshots along with the source HTML below.',
    'Independently identify UX, UI, visual hierarchy, spacing, responsive layout, and accessibility issues, AND make sure every prioritized metric below is fixed cleanly, then generate an improved self-contained HTML document.',
    '',
    contextLines.length ? 'PRODUCT CONTEXT:\n' + contextLines.join('\n') : '',
    focusLines.length
      ? 'MANDATORY PRIORITY METRICS (from Designer Choose Metrics):\n' + focusLines.join('\n')
      : '',
    '',
    'RULES:',
    '1. Preserve all real copy, links, navigation items, forms, images, and brand identity — do NOT delete real content or replace it with placeholders.',
    '2. Elevate visual polish: clean spacing rhythm, clear visual hierarchy, strong contrast (>= 4.5:1 text, >= 3:1 UI borders/icons), visible :focus-visible rings, >= 44px touch targets, and clean responsive reflow at 320px without horizontal overflow.',
    '3. Keep all styles inside the HTML (<style> in <head>) so it renders standalone.',
    '',
    'Return ONLY valid JSON with these exact keys:',
    '{',
    '  "summary": "1-2 sentence overview of what you improved",',
    '  "critique": ["concise issue 1 found & fixed", "concise issue 2 found & fixed"],',
    '  "html": "<!DOCTYPE html>..."',
    '}',
    '',
    'SOURCE HTML:',
    html.slice(0, 40000),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPolishPrompt(
  html: string,
  remainingFails: FocusMetricHint[],
  context?: AuditContextInput
): string {
  const contextLines = [
    context?.productGoal ? `- Product Goal: ${context.productGoal}` : '',
    context?.theme ? `- Brand / Theme Colors: ${context.theme}` : '',
  ].filter(Boolean);

  const failLines = remainingFails.map(
    (m, i) =>
      `${i + 1}. [${m.priority || 'P1'}] ${m.title} (${m.id}): ${m.measuredSummary || 'Still failing'}${m.samples?.length ? ` | Samples: ${m.samples.slice(0, 3).join('; ')}` : ''}${m.recommendation ? ` | Fix: ${m.recommendation}` : ''}`
  );

  return [
    'You are doing a 1-pass targeted accessibility & UX polish on an already redesigned HTML page.',
    'Keep the existing visual design, layout, spacing, and all content from the HTML below intact, and fix ONLY the remaining failing metrics listed below.',
    '',
    contextLines.length ? 'PRODUCT CONTEXT:\n' + contextLines.join('\n') : '',
    'REMAINING FAILING METRICS TO FIX:',
    failLines.join('\n'),
    '',
    'Return ONLY valid JSON with these exact keys:',
    '{',
    '  "summary": "1-sentence summary of the targeted fixes applied",',
    '  "critique": ["fixed metric 1...", "fixed metric 2..."],',
    '  "html": "<!DOCTYPE html>..."',
    '}',
    '',
    'CURRENT REDESIGNED HTML:',
    html.slice(0, 40000),
  ]
    .filter(Boolean)
    .join('\n');
}

async function invokeFreeformModel(
  prompt: string,
  desktopBase64?: string,
  mobileBase64?: string
): Promise<{
  parsed: z.infer<typeof FreeformRedesignOutputSchema>;
  provider: 'gemini-vision' | 'openai-vision';
} | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_VLM_MODEL?.trim() || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [{ text: prompt }];
      if (desktopBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: desktopBase64 } });
      }
      if (mobileBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: mobileBase64 } });
      }
      const res = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
        },
      });
      const parsed = FreeformRedesignOutputSchema.safeParse(
        extractJsonObject(res.response.text())
      );
      if (parsed.success) {
        return { parsed: parsed.data, provider: 'gemini-vision' };
      }
    } catch {
      // Fall through to OpenAI-compatible provider
    }
  }

  const cpeKey = (process.env.LLM_API_KEY || process.env.CPE_API_KEY)?.trim();
  const cpeBase = (process.env.LLM_BASE_URL || process.env.CPE_API_BASE_URL)?.trim();
  const modelId = (process.env.VLM_MODEL || process.env.CPE_MODEL)?.trim();
  if (cpeKey && cpeBase && modelId) {
    try {
      const endpoint = cpeBase.endsWith('/chat/completions')
        ? cpeBase
        : `${cpeBase.replace(/\/$/, '')}/chat/completions`;

      const contentParts: Array<
        { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
      > = [{ type: 'text', text: prompt }];
      if (desktopBase64) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${desktopBase64}` },
        });
      }
      if (mobileBase64) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${mobileBase64}` },
        });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cpeKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.2,
          max_tokens: 16384,
          messages: [{ role: 'user', content: contentParts }],
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (response.ok) {
        const json = await response.json();
        const rawText = json?.choices?.[0]?.message?.content;
        if (typeof rawText === 'string') {
          const parsed = FreeformRedesignOutputSchema.safeParse(extractJsonObject(rawText));
          if (parsed.success) {
            return { parsed: parsed.data, provider: 'openai-vision' };
          }
        }
      }
    } catch {
      // Handled below
    }
  }

  return null;
}

function buildSnapshotFromEval(params: {
  iteration: number;
  label: string;
  html: string;
  evalSummary: ChecklistSummary;
  baselineSummary: ChecklistSummary;
  provider: 'gemini-vision' | 'openai-vision';
  summaryText: string;
  critique: string[];
}): IterationSnapshot {
  const baselineFailed = new Set(
    params.baselineSummary.items
      .filter((item) => item.status === 'fail' || item.status === 'needsReview')
      .map((item) => item.id)
  );
  const baselinePassed = new Set(
    params.baselineSummary.items
      .filter((item) => item.status === 'pass')
      .map((item) => item.id)
  );

  const resolvedIds = params.evalSummary.items
    .filter((item) => item.status === 'pass' && baselineFailed.has(item.id))
    .map((item) => item.id);
  const regressedIds = params.evalSummary.items
    .filter((item) => item.status === 'fail' && baselinePassed.has(item.id))
    .map((item) => item.id);
  const deltaFromBaseline = params.evalSummary.totalPassed - params.baselineSummary.totalPassed;

  const notes = [params.summaryText, ...params.critique].join(' • ');

  return {
    iteration: params.iteration,
    label: params.label,
    html: params.html,
    summary: params.evalSummary,
    deltaFromBase: deltaFromBaseline,
    deltaFromBaseline,
    resolvedIds,
    regressedIds,
    fixerMode: params.provider === 'gemini-vision' ? 'gemini-llm' : 'llm-api',
    notes,
    appliedPatch: {
      cssAdditions: [],
      attributePatches: [],
      notes,
    },
    vlmReview: {
      verdict: 'approve',
      guardPassed: true,
      viewportEvaluated: '1280x800',
      critique: params.summaryText,
      provider: params.provider,
    },
  };
}

/**
 * Hybrid AI Critique & Generate Pipeline:
 * 1. Captures Baseline 1280x800 & 320x640 screenshots + 36-metric baseline.
 * 2. Round 1 (AI Redesign): AI independently critiques & generates improved HTML
 *    guided by Product Context + Choose Metrics priority items, then runs 36-metric check.
 * 3. Round 2 (AI Polish, optional): If any fail items remain after Round 1, runs
 *    1 targeted polish pass to fix remaining failures and stops.
 */
export async function runFreeformAiRedesign(input: {
  html: string;
  localOrigin: string;
  context?: AuditContextInput;
  focusMetrics?: FocusMetricHint[];
  maxIterations?: number;
  enablePolishPass?: boolean;
  startIterationNumber?: number;
}): Promise<{
  baselineSummary: ChecklistSummary;
  iterations: IterationSnapshot[];
  bestIterationIndex: number;
  stopReason: 'all_passed' | 'no_improvement' | 'max_iterations';
  critique: string[];
  summaryText: string;
  provider: 'gemini-vision' | 'openai-vision';
}> {
  const maxRounds = Math.min(
    5,
    Math.max(1, input.maxIterations ?? (input.enablePolishPass === false ? 1 : 2))
  );

  const baselineEval = await runFullChecklistAudit({
    html: input.html,
    localOrigin: input.localOrigin,
  });

  const prompt = buildFreeformPrompt(input.html, input.context, input.focusMetrics);
  const aiOut = await invokeFreeformModel(
    prompt,
    baselineEval.screenshotBase64,
    baselineEval.mobile320ScreenshotBase64
  );

  if (!aiOut) {
    throw new Error(
      'AI Critique & Generate unavailable: configure GEMINI_API_KEY or LLM_API_KEY / LLM_BASE_URL / CPE_MODEL.'
    );
  }

  let currentEval = await runFullChecklistAudit({
    html: aiOut.parsed.html,
    localOrigin: input.localOrigin,
  });

  const startIter = input.startIterationNumber ?? 1;
  const round1Snapshot = buildSnapshotFromEval({
    iteration: startIter,
    label: `Iteration ${startIter}`,
    html: aiOut.parsed.html,
    evalSummary: currentEval.summary,
    baselineSummary: baselineEval.summary,
    provider: aiOut.provider,
    summaryText: aiOut.parsed.summary,
    critique: aiOut.parsed.critique,
  });

  const generatedIterations: IterationSnapshot[] = [round1Snapshot];
  let bestSnapshot = round1Snapshot;
  let bestIterationIndex = 0;
  let currentHtml = aiOut.parsed.html;
  let stopReason: 'all_passed' | 'no_improvement' | 'max_iterations' =
    currentEval.summary.totalFailed === 0 ? 'all_passed' : 'max_iterations';

  for (let round = 2; round <= maxRounds; round++) {
    const remainingFails: FocusMetricHint[] = currentEval.summary.items
      .filter((item) => item.status === 'fail')
      .map((item) => ({
        id: item.id,
        title: item.title,
        priority: item.priority,
        measuredSummary: item.measuredSummary,
        recommendation: item.recommendation,
        samples: item.samples,
      }));

    if (remainingFails.length === 0) {
      stopReason = 'all_passed';
      break;
    }

    const polishPrompt = buildPolishPrompt(currentHtml, remainingFails, input.context);
    const polishOut = await invokeFreeformModel(
      polishPrompt,
      currentEval.screenshotBase64,
      currentEval.mobile320ScreenshotBase64
    );
    if (!polishOut) break;

    const polishEval = await runFullChecklistAudit({
      html: polishOut.parsed.html,
      localOrigin: input.localOrigin,
    });
    const polishSnapshot = buildSnapshotFromEval({
      iteration: startIter + round - 1,
      label: `Iteration ${startIter + round - 1}`,
      html: polishOut.parsed.html,
      evalSummary: polishEval.summary,
      baselineSummary: baselineEval.summary,
      provider: polishOut.provider,
      summaryText: polishOut.parsed.summary,
      critique: polishOut.parsed.critique,
    });

    if (polishSnapshot.summary.totalPassed <= bestSnapshot.summary.totalPassed) {
      stopReason = 'no_improvement';
      break;
    }

    generatedIterations.push(polishSnapshot);
    bestSnapshot = polishSnapshot;
    bestIterationIndex = generatedIterations.length - 1;
    currentHtml = polishOut.parsed.html;
    currentEval = polishEval;

    if (polishSnapshot.summary.totalFailed === 0) {
      stopReason = 'all_passed';
      break;
    }
  }

  return {
    baselineSummary: baselineEval.summary,
    iterations: generatedIterations,
    bestIterationIndex,
    stopReason,
    critique: bestSnapshot.appliedPatch?.notes ? [bestSnapshot.appliedPatch.notes] : aiOut.parsed.critique,
    summaryText: bestSnapshot.vlmReview?.critique || aiOut.parsed.summary,
    provider: aiOut.provider,
  };
}
