import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { runFullChecklistAudit } from './dom-evaluators';
import type {
  AuditContextInput,
  AutoIterationResult,
  ChecklistItemResult,
  ChecklistJsonPatch,
  ChecklistSummary,
  FeedbackIssue,
  FeedbackWorksheet,
  IterationSnapshot,
  IterationUsage,
  PatchOperationLog,
  StopReason,
} from './types';

const ChecklistPatchSchema = z.object({
  cssAdditions: z.array(z.string()).default([]),
  attributePatches: z
    .array(
      z.object({
        metricId: z.string().optional(),
        selector: z.string().min(1),
        setAttributes: z.record(z.string()).nullable().optional(),
        removeAttributes: z.array(z.string()).nullable().optional(),
      })
    )
    .default([]),
  tagRenames: z
    .array(
      z.object({
        metricId: z.string().optional(),
        selector: z.string().min(1),
        newTag: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'main', 'section', 'button', 'a']),
      })
    )
    .optional(),
  wrapMain: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function extractJsonFromResponse(text: string): unknown | null {
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

/**
 * Strips only heavy inline <script> bodies; keeps CSS intact so the LLM
 * can inspect exact class names, widths, and colors causing reflow or contrast fails.
 */
function prepareHtmlForPrompt(html: string): string {
  const withoutScripts = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    '<script>/* [script preserved] */</script>'
  );
  return withoutScripts.length > 35_000
    ? withoutScripts.slice(0, 35_000) + '\n<!-- [truncated] -->'
    : withoutScripts;
}

/**
 * Builds a structured UXBench-style `feedback.json` worksheet from failing checklist items.
 */
export function buildFeedbackWorksheet(
  priorityList: ChecklistItemResult[],
  context?: AuditContextInput,
  prioritizedMetricIds?: string[]
): { worksheet: FeedbackWorksheet; orderedItems: ChecklistItemResult[] } {
  let orderedItems = [...priorityList];
  if (prioritizedMetricIds && prioritizedMetricIds.length > 0) {
    const orderMap = new Map(prioritizedMetricIds.map((id, idx) => [id, idx]));
    orderedItems = orderedItems
      .filter((item) => orderMap.has(item.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }

  const issues: FeedbackIssue[] = orderedItems.map((item, idx) => ({
    id: `FB-${String(idx + 1).padStart(2, '0')}`,
    metricId: item.id,
    status: item.status,
    priority: item.priority,
    group: item.group,
    selector: item.samples.length > 0 ? item.samples.join(', ') : 'document',
    measured: item.measuredSummary,
    expected: item.criterion,
    problem: `${item.title}: ${item.measuredSummary}`,
    suggested_fix: item.recommendation,
  }));

  return {
    worksheet: {
      summary: {
        totalFailing: issues.length,
        context,
      },
      issues,
    },
    orderedItems,
  };
}

/**
 * Builds the readable Construction Plan preview for the Designer UI.
 */
export function buildConstructionPlan(
  priorityList: ChecklistItemResult[],
  context?: AuditContextInput,
  prioritizedMetricIds?: string[]
): { planText: string; orderedItems: ChecklistItemResult[]; worksheet: FeedbackWorksheet } {
  const { worksheet, orderedItems } = buildFeedbackWorksheet(
    priorityList,
    context,
    prioritizedMetricIds
  );

  const contextLines = [
    context?.productGoal ? `- Product Goal: ${context.productGoal}` : '',
    context?.targetAudience ? `- Target Audience: ${context.targetAudience}` : '',
    context?.theme ? `- Theme / Brand: ${context.theme}` : '',
    context?.customPrompt ? `- Designer Guidelines: ${context.customPrompt}` : '',
  ].filter(Boolean);

  const planText = [
    '=== CONSTRUCTION PLAN (feedback.json) ===',
    contextLines.length ? contextLines.join('\n') : 'Context: Standard UX/UI & WCAG 2.2 optimization',
    '',
    JSON.stringify(worksheet.issues, null, 2),
  ].join('\n');

  return { planText, orderedItems, worksheet };
}

const BROAD_GLOBAL_COLOR_RULE = /^\s*(?:\*|html|body|p|div|span|h[1-6](?:\s*,\s*h[1-6])*)\s*\{[^}]*\bcolor\s*:/i;

/**
 * Applies a structured JSON Patch to HTML using Cheerio, validating selectors
 * and rejecting broad global color rules or zero-match operations with an audit log.
 */
export function applyJsonPatchToHtml(
  inputHtml: string,
  patch: ChecklistJsonPatch,
  iterationLabel = 'patch'
): string {
  const $ = cheerio.load(inputHtml);
  const operationLogs: PatchOperationLog[] = [];

  for (const attrPatch of patch.attributePatches || []) {
    try {
      const matched = $(attrPatch.selector);
      if (matched.length === 0) {
        operationLogs.push({
          op: 'attribute',
          metricId: attrPatch.metricId,
          selector: attrPatch.selector,
          matchedCount: 0,
          status: 'rejected',
          reason: 'Selector matched 0 elements',
        });
        continue;
      }
      if (attrPatch.removeAttributes) {
        for (const attr of attrPatch.removeAttributes) {
          matched.removeAttr(attr);
        }
      }
      if (attrPatch.setAttributes) {
        for (const [k, v] of Object.entries(attrPatch.setAttributes)) {
          matched.attr(k, v);
        }
      }
      operationLogs.push({
        op: 'attribute',
        metricId: attrPatch.metricId,
        selector: attrPatch.selector,
        matchedCount: matched.length,
        status: 'applied',
      });
    } catch {
      operationLogs.push({
        op: 'attribute',
        metricId: attrPatch.metricId,
        selector: attrPatch.selector,
        matchedCount: 0,
        status: 'rejected',
        reason: 'Invalid CSS selector',
      });
    }
  }

  for (const rename of patch.tagRenames || []) {
    try {
      const matched = $(rename.selector);
      if (matched.length === 0) {
        operationLogs.push({
          op: 'tagRename',
          metricId: rename.metricId,
          selector: rename.selector,
          matchedCount: 0,
          status: 'rejected',
          reason: 'Selector matched 0 elements',
        });
        continue;
      }
      matched.each((_, el) => {
        if (el.type === 'tag') {
          el.name = rename.newTag;
        }
      });
      operationLogs.push({
        op: 'tagRename',
        metricId: rename.metricId,
        selector: rename.selector,
        matchedCount: matched.length,
        status: 'applied',
      });
    } catch {
      operationLogs.push({
        op: 'tagRename',
        metricId: rename.metricId,
        selector: rename.selector,
        matchedCount: 0,
        status: 'rejected',
        reason: 'Invalid CSS selector',
      });
    }
  }

  if (patch.wrapMain) {
    if ($('main, [role="main"]').length === 0 && $('body').length > 0) {
      const header = $('body > header').first();
      const footer = $('body > footer').first();
      const mainChildren = $('body')
        .children()
        .filter((_, el) => el !== header[0] && el !== footer[0]);

      if (mainChildren.length > 0) {
        const mainEl = $('<main id="main-content"></main>');
        mainChildren.first().before(mainEl);
        mainEl.append(mainChildren);
        operationLogs.push({
          op: 'wrapMain',
          metricId: 'landmark-structure',
          matchedCount: 1,
          status: 'applied',
        });
      }
    } else {
      operationLogs.push({
        op: 'wrapMain',
        metricId: 'landmark-structure',
        matchedCount: 0,
        status: 'rejected',
        reason: '<main> landmark already exists',
      });
    }
  }

  const acceptedCss: string[] = [];
  for (const rawRule of patch.cssAdditions || []) {
    const rule = rawRule.trim();
    if (!rule) continue;
    if (BROAD_GLOBAL_COLOR_RULE.test(rule)) {
      operationLogs.push({
        op: 'css',
        selector: rule.split('{')[0]?.trim(),
        matchedCount: 0,
        status: 'rejected',
        reason: 'Rejected broad global color override',
      });
      continue;
    }
    acceptedCss.push(rule);
    operationLogs.push({
      op: 'css',
      selector: rule.split('{')[0]?.trim(),
      matchedCount: 1,
      status: 'applied',
    });
  }

  if (acceptedCss.length > 0) {
    const styleEl = `<style data-proofui-patch="${iterationLabel}">\n${acceptedCss.join('\n')}\n</style>`;
    if ($('head').length > 0) {
      $('head').append(`\n${styleEl}\n`);
    } else {
      $.root().prepend(`${styleEl}\n`);
    }
  }

  patch.operationLogs = operationLogs;
  return $.html();
}

async function callOpenAICompatibleJsonPatch(
  prompt: string
): Promise<{ patch: ChecklistJsonPatch; model: string; usage?: IterationUsage }> {
  const apiKey = (process.env.LLM_API_KEY || process.env.CPE_API_KEY)?.trim() || '';
  const model = (process.env.LLM_MODEL || process.env.CPE_MODEL)?.trim() || 'qwen3.8-27b';
  let baseUrl =
    (process.env.LLM_API_BASE_URL || process.env.CPE_API_BASE_URL)?.trim() ||
    'https://gateway.ai.cpe.kmutt.ac.th/v1';

  if (!apiKey) throw new Error('LLM_API_KEY not configured');
  if (apiKey.startsWith('xpl_') && baseUrl === 'https://gateway.ai.cpe.kmutt.ac.th/v1') {
    baseUrl = 'https://api.experientiallabs.ai/v1';
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior UX/UI & Accessibility engineer. Return ONLY a valid JSON object matching { "cssAdditions": string[], "attributePatches": [{ "selector": string, "setAttributes": Record<string, string> }], "tagRenames"?: [{ "selector": string, "newTag": "h2"|"h3" }], "wrapMain"?: boolean, "notes": string }. Never rewrite full HTML.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) throw new Error(`LLM API HTTP ${response.status}`);
  const body = await response.json();
  const raw = body.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('LLM API returned empty response');

  const usage: IterationUsage | undefined = body.usage
    ? {
        promptTokens: Number(body.usage.prompt_tokens || 0),
        completionTokens: Number(body.usage.completion_tokens || 0),
        totalTokens: Number(body.usage.total_tokens || 0),
        costUsd: typeof body.usage.cost === 'number' ? body.usage.cost : undefined,
      }
    : undefined;

  const json = extractJsonFromResponse(raw);
  const parsed = ChecklistPatchSchema.safeParse(json);
  if (!parsed.success) throw new Error('LLM API returned invalid JSON patch schema');

  return {
    patch: {
      cssAdditions: parsed.data.cssAdditions,
      attributePatches: parsed.data.attributePatches.map((a) => ({
        selector: a.selector,
        setAttributes: a.setAttributes ?? undefined,
        removeAttributes: a.removeAttributes ?? undefined,
      })),
      tagRenames: parsed.data.tagRenames,
      wrapMain: parsed.data.wrapMain ?? undefined,
      notes: parsed.data.notes ?? undefined,
    },
    model,
    usage,
  };
}

async function callGeminiJsonPatch(prompt: string): Promise<ChecklistJsonPatch> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await Promise.race([
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 30000)),
  ]);
  const json = extractJsonFromResponse(result.response.text());
  const parsed = ChecklistPatchSchema.safeParse(json);
  if (!parsed.success) throw new Error('Gemini returned invalid JSON patch schema');
  return {
    cssAdditions: parsed.data.cssAdditions,
    attributePatches: parsed.data.attributePatches.map((a) => ({
      selector: a.selector,
      setAttributes: a.setAttributes ?? undefined,
      removeAttributes: a.removeAttributes ?? undefined,
    })),
    tagRenames: parsed.data.tagRenames,
    wrapMain: parsed.data.wrapMain ?? undefined,
    notes: parsed.data.notes ?? undefined,
  };
}

/**
 * Generates a focused JSON Patch for the top priority issues in `feedback.json`.
 */
async function generatePatchWithLlm(
  html: string,
  priorityList: ChecklistItemResult[],
  context?: AuditContextInput,
  prioritizedMetricIds?: string[],
  step = 1,
  previousFailedAttempt?: { notes: string; patch?: ChecklistJsonPatch; regressedIds: string[] }
): Promise<{
  html: string;
  patch: ChecklistJsonPatch;
  mode: 'llm-api' | 'gemini-llm' | 'deterministic-fallback';
  notes: string;
  usage?: IterationUsage;
}> {
  const { worksheet, orderedItems } = buildFeedbackWorksheet(
    priorityList,
    context,
    prioritizedMetricIds
  );

  // Focus on top 6 issues; include needsReview only when explicitly confirmed by designer
  const focusedIssues = (
    prioritizedMetricIds && prioritizedMetricIds.length > 0
      ? worksheet.issues
      : worksheet.issues.filter((i) => i.status === 'fail')
  ).slice(0, 6);
  if (focusedIssues.length === 0) {
    const emptyPatch: ChecklistJsonPatch = { cssAdditions: [], attributePatches: [], notes: 'No failing issues to patch.' };
    return { html, patch: emptyPatch, mode: 'deterministic-fallback', notes: 'No failing metrics to patch.' };
  }

  const retryContext = previousFailedAttempt
    ? `\nIMPORTANT — Previous attempt did NOT improve the score (${previousFailedAttempt.notes}).${
        previousFailedAttempt.regressedIds.length
          ? ` It regressed: ${previousFailedAttempt.regressedIds.join(', ')}.`
          : ''
      } Previous CSS tried: ${JSON.stringify(previousFailedAttempt.patch?.cssAdditions || [])}. Do NOT repeat the exact same patch; address ALL failing issues listed below including any overflowing selectors at 320px, landmarks, inputs, and links.\n`
    : '';

  const promptHtml = prepareHtmlForPrompt(html);
  const prompt = `Fix the following prioritized issues from feedback.json by returning ONLY a JSON patch.

Context:
${JSON.stringify(worksheet.summary.context || {}, null, 2)}
${retryContext}
feedback.json (top ${focusedIssues.length} issues):
${JSON.stringify(focusedIssues, null, 2)}

Rules for your JSON Patch:
- "cssAdditions": array of targeted CSS rules.
  - CRITICAL: NEVER write broad global color rules like "p { color: ... }" or "h1, h2, h3 { color: ... }" because dark-background sections (.genius-banner, .hero, .header, .footer) intentionally use white text! Target ONLY the exact failing selector from feedback.json.
  - For "reflow" at 320px: add "@media (max-width: 640px)" rules that set flex-wrap: wrap, grid-template-columns: 1fr, width: 100%, min-width: 0, overflow-x: hidden on wide containers/search bars/grids.
  - For "text-contrast": target ONLY the specific failing selector shown in feedback.json with an accessible color matching its background.
  - For "touch-target-spacing": add gap >= 8px on button/link groups.
- "attributePatches": array of { "selector": "valid CSS selector", "setAttributes": { ... } } (e.g. fix a[href="#"] -> href="#main-content", add unique name/type/id/aria-label to each input using :nth-of-type, add alt to img).
- "tagRenames": optional array of { "selector": "e.g. h4", "newTag": "h2" } to fix skipped heading hierarchy.
- "wrapMain": true if <main> landmark is missing.
- Keep output valid JSON only.

HTML & CSS:
\`\`\`html
${promptHtml}
\`\`\``;

  const errors: string[] = [];

  if ((process.env.LLM_API_KEY || process.env.CPE_API_KEY)?.trim()) {
    try {
      const { patch, model, usage } = await callOpenAICompatibleJsonPatch(prompt);
      const patchedHtml = applyJsonPatchToHtml(html, patch, `iter-${step}`);
      return {
        html: patchedHtml,
        patch,
        mode: 'llm-api',
        notes: patch.notes || `LLM JSON Patch (${model}): ${patch.cssAdditions.length} CSS, ${patch.attributePatches.length} attr.`,
        usage,
      };
    } catch (err) {
      errors.push(`LLM API: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const patch = await callGeminiJsonPatch(prompt);
      const patchedHtml = applyJsonPatchToHtml(html, patch, `iter-${step}`);
      return {
        html: patchedHtml,
        patch,
        mode: 'gemini-llm',
        notes: patch.notes || `Gemini JSON Patch: ${patch.cssAdditions.length} CSS, ${patch.attributePatches.length} attr.`,
      };
    } catch (err) {
      errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const fallbackHtml = applyDeterministicChecklistFixes(html, orderedItems);
  return {
    html: fallbackHtml,
    patch: { cssAdditions: [], attributePatches: [], notes: 'Deterministic fallback' },
    mode: 'deterministic-fallback',
    notes: errors.length ? `Fallback (${errors.join('; ')})` : 'Deterministic fallback.',
  };
}

/**
 * Conservative deterministic fixer used only when no LLM is available.
 * Never fabricates alt text or link destinations.
 */
export function applyDeterministicChecklistFixes(
  inputHtml: string,
  priorityList: ChecklistItemResult[]
): string {
  const failing = new Set(priorityList.map((i) => i.id));
  const patch: ChecklistJsonPatch = {
    cssAdditions: [],
    attributePatches: [],
    wrapMain: failing.has('landmark-structure'),
  };

  if (failing.has('document-metadata')) {
    patch.attributePatches.push({
      metricId: 'document-metadata',
      selector: 'html',
      setAttributes: { lang: 'en' },
    });
  }
  if (failing.has('target-size')) {
    patch.cssAdditions.push('button, [role="button"] { min-width: 24px; min-height: 24px; }');
  }
  if (failing.has('interactive-cursor')) {
    patch.cssAdditions.push('button, a[href], [role="button"] { cursor: pointer; }');
  }
  if (failing.has('focus-visible')) {
    patch.cssAdditions.push(':focus-visible { outline: 2px solid #2563eb !important; outline-offset: 2px !important; }');
  }

  let html = inputHtml;
  if (!/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>ProofUI Audited Page</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
  }
  return applyJsonPatchToHtml(html, patch, 'fallback');
}

function diffSummaries(prev: ChecklistSummary, next: ChecklistSummary) {
  const prevMap = new Map(prev.items.map((i) => [i.id, i.status]));
  const resolvedIds: string[] = [];
  const regressedIds: string[] = [];

  for (const item of next.items) {
    const oldStatus = prevMap.get(item.id);
    if (oldStatus && oldStatus !== 'pass' && item.status === 'pass') {
      resolvedIds.push(item.id);
    } else if (oldStatus === 'pass' && item.status !== 'pass') {
      regressedIds.push(item.id);
    }
  }
  return { resolvedIds, regressedIds };
}

/**
 * Runs baseline audit and optional LLM JSON-Patch + Self-Audit Evaluator loop.
 * Always branches from `iterations[bestIdx]` so regressions never compound.
 */
export async function runAutoIterationLoop(input: {
  html?: string;
  url?: string;
  localOrigin: string;
  mode: 'audit' | 'iterate';
  maxIterations: number;
  context?: AuditContextInput;
  prioritizedMetricIds?: string[];
}): Promise<AutoIterationResult> {
  const maxIterations = Math.min(Math.max(input.maxIterations || 3, 1), 5);
  const baseline = await runFullChecklistAudit({
    html: input.html,
    url: input.url,
    localOrigin: input.localOrigin,
  });

  const { planText, worksheet } = buildConstructionPlan(
    baseline.summary.priorityList,
    input.context,
    input.prioritizedMetricIds
  );

  const iterations: IterationSnapshot[] = [
    {
      iteration: 0,
      label: 'Baseline',
      summary: baseline.summary,
      html: baseline.html,
      deltaFromBase: 0,
      deltaFromBaseline: 0,
      resolvedIds: [],
      regressedIds: [],
      fixerMode: 'baseline',
      notes: 'Initial deterministic 24-metric audit.',
    },
  ];

  const targetIds = new Set(
    input.prioritizedMetricIds && input.prioritizedMetricIds.length > 0
      ? input.prioritizedMetricIds
      : baseline.summary.priorityList.map((i) => i.id)
  );

  const countTargetStatus = (summary: ChecklistSummary) => {
    const targets = summary.items.filter((i) => targetIds.has(i.id));
    const passed = targets.filter((i) => i.status === 'pass').length;
    const failed = targets.filter((i) => i.status === 'fail').length;
    const needsReview = summary.items.filter((i) => i.status === 'needsReview').length;
    return { targetPassed: passed, targetFailed: failed, targetTotal: targets.length, needsReview };
  };

  if (input.mode === 'audit') {
    return {
      bestIteration: 0,
      stopReason: 'audit_only',
      hasRemainingNeedsReview: countTargetStatus(baseline.summary).needsReview > 0,
      constructionPlan: planText,
      feedback: worksheet,
      iterations,
    };
  }

  let bestIdx = 0;
  let staleCount = 0;
  let stopReason: StopReason = 'max_iterations';
  let lastFailedAttempt:
    | { notes: string; patch?: ChecklistJsonPatch; regressedIds: string[] }
    | undefined;

  const baseStats = countTargetStatus(baseline.summary);
  if (baseStats.targetTotal === 0 || baseStats.targetPassed === baseStats.targetTotal) {
    return {
      bestIteration: 0,
      stopReason: baseStats.needsReview === 0 && baseline.summary.totalPassed === baseline.summary.totalMetrics ? 'all_passed' : 'targets_passed',
      hasRemainingNeedsReview: baseStats.needsReview > 0,
      constructionPlan: planText,
      feedback: worksheet,
      iterations,
    };
  }

  for (let step = 1; step <= maxIterations; step++) {
    const baseIdx = bestIdx;
    const base = iterations[baseIdx];
    const fixed = await generatePatchWithLlm(
      base.html,
      base.summary.priorityList,
      input.context,
      input.prioritizedMetricIds,
      step,
      lastFailedAttempt
    );
    const evaluated = await runFullChecklistAudit({
      html: fixed.html,
      localOrigin: input.localOrigin,
    });

    const { resolvedIds, regressedIds } = diffSummaries(base.summary, evaluated.summary);
    const deltaFromBase = evaluated.summary.totalPassed - base.summary.totalPassed;
    const deltaFromBaseline = evaluated.summary.totalPassed - baseline.summary.totalPassed;

    iterations.push({
      iteration: step,
      label: `Iteration ${step}`,
      branchedFromIteration: baseIdx,
      summary: evaluated.summary,
      html: evaluated.html,
      deltaFromBase,
      deltaFromBaseline,
      resolvedIds,
      regressedIds,
      fixerMode: fixed.mode,
      notes: fixed.notes,
      appliedPatch: fixed.patch,
      usage: fixed.usage,
    });

    const bestStats = countTargetStatus(base.summary);
    const evalStats = countTargetStatus(evaluated.summary);

    // Accept only when zero previously passing checks regressed and targets/overall improved
    const targetImproved =
      evalStats.targetPassed > bestStats.targetPassed ||
      (evalStats.targetPassed === bestStats.targetPassed && evalStats.targetFailed < bestStats.targetFailed);
    const overallImproved = evaluated.summary.totalPassed > base.summary.totalPassed;
    const accepted = regressedIds.length === 0 && (targetImproved || overallImproved);

    if (accepted) {
      bestIdx = step;
      staleCount = 0;
      lastFailedAttempt = undefined;
    } else {
      staleCount++;
      lastFailedAttempt = {
        notes: fixed.notes,
        patch: fixed.patch,
        regressedIds,
      };
    }

    if (evalStats.targetPassed === evalStats.targetTotal && regressedIds.length === 0) {
      stopReason =
        evalStats.needsReview === 0 && evaluated.summary.totalPassed === evaluated.summary.totalMetrics
          ? 'all_passed'
          : 'targets_passed';
      break;
    }

    if (staleCount >= 2) {
      stopReason = 'no_improvement';
      break;
    }
  }

  const finalBestStats = countTargetStatus(iterations[bestIdx].summary);

  const totalUsage = iterations.reduce<IterationUsage>(
    (acc, it) => ({
      promptTokens: acc.promptTokens + (it.usage?.promptTokens || 0),
      completionTokens: acc.completionTokens + (it.usage?.completionTokens || 0),
      totalTokens: acc.totalTokens + (it.usage?.totalTokens || 0),
      costUsd:
        it.usage?.costUsd !== undefined
          ? (acc.costUsd || 0) + it.usage.costUsd
          : acc.costUsd,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  return {
    bestIteration: bestIdx,
    stopReason,
    hasRemainingNeedsReview: finalBestStats.needsReview > 0,
    constructionPlan: planText,
    feedback: worksheet,
    totalUsage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
    iterations,
  };
}
