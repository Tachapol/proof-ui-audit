import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { validateAndNormalizeAuditUrl } from '@/lib/audit/url-validator';
import { ProductContext, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';
import { FIXTURES } from '@/fixtures/fixture-registry';

export interface DetectedThemeColor {
  hex: string;
  role: string;
}

const AiDetectedContextSchema = z.object({
  productGoal: z.string().min(1).max(1000),
  brandKeywords: z.string().min(1).max(300),
  themeColors: z
    .array(
      z.object({
        hex: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
        role: z.string().min(1).max(40),
      })
    )
    .min(1)
    .max(5),
  targetAudience: z.string().min(1).max(500),
  additionalContext: z.string().min(1).max(1000),
});

function normalizeHex6(raw: string): string | null {
  const cleaned = raw.trim().replace(/^0x/i, '#');
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleaned)) return null;
  if (cleaned.length === 4) {
    const r = cleaned[1];
    const g = cleaned[2];
    const b = cleaned[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return cleaned.toUpperCase();
}

function isNearNeutralHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Skip pure white, pure black, and low-saturation grays
  return max - min < 18 || max < 22 || min > 238;
}

function extractPaletteFromHtml(html: string, metaThemeColor?: string): DetectedThemeColor[] {
  const counts = new Map<string, number>();
  const metaNorm = metaThemeColor ? normalizeHex6(metaThemeColor) : null;
  if (metaNorm) counts.set(metaNorm, (counts.get(metaNorm) || 0) + 10);

  const hexMatches = html.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || [];
  for (const raw of hexMatches) {
    const norm = normalizeHex6(raw);
    if (!norm || isNearNeutralHex(norm)) continue;
    counts.set(norm, (counts.get(norm) || 0) + 1);
  }

  const roles = ['Primary', 'Secondary', 'Accent', 'Highlight'];
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hex], idx) => ({ hex, role: roles[idx] || 'Accent' }));

  if (sorted.length === 0) {
    return [{ hex: '#2563EB', role: 'Primary' }];
  }
  return sorted;
}

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

async function detectContextWithAi(
  html: string,
  fallback: ProductContext & { themeColors: DetectedThemeColor[] }
): Promise<(ProductContext & { themeColors: DetectedThemeColor[] }) | null> {
  const compactHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  const prompt = [
    'Analyze this web page HTML/CSS and extract its Product Context for UX/UI design auditing.',
    'Return ONLY valid JSON with these exact keys:',
    '{',
    '  "productGoal": "concise 1-sentence primary goal of this page/product",',
    '  "brandKeywords": "3-4 comma-separated adjectives describing brand tone & visual style",',
    '  "themeColors": [{"hex": "#RRGGBB", "role": "Primary|Secondary|Accent|Highlight"}],',
    '  "targetAudience": "specific intended users & devices",',
    '  "additionalContext": "key user task, primary language, and notable layout/design constraints"',
    '}',
    'Rules:',
    '- Pick 1 to 4 actual brand/UI colors used in the HTML/CSS (exclude pure white/black/gray unless monochrome).',
    '- Be concrete and specific to the page content, never generic.',
    '',
    'HTML:',
    compactHtml,
  ].join('\n');

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_VLM_MODEL?.trim() || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 800,
        },
      });
      const parsed = AiDetectedContextSchema.safeParse(extractJsonObject(res.response.text()));
      if (parsed.success) {
        const colors = parsed.data.themeColors.map((c) => ({
          hex: normalizeHex6(c.hex) || c.hex.toUpperCase(),
          role: c.role,
        }));
        return {
          productGoal: parsed.data.productGoal,
          brandKeywords: parsed.data.brandKeywords,
          themeColor: colors[0]?.hex || fallback.themeColor,
          themeColors: colors,
          targetAudience: parsed.data.targetAudience,
          additionalContext: parsed.data.additionalContext,
        };
      }
    } catch {
      // Fall through to OpenAI-compatible or heuristic
    }
  }

  const cpeKey = (process.env.LLM_API_KEY || process.env.CPE_API_KEY)?.trim();
  const cpeBase = (process.env.LLM_BASE_URL || process.env.CPE_API_BASE_URL)?.trim();
  const modelId = (process.env.CPE_MODEL || process.env.VLM_MODEL)?.trim();
  if (cpeKey && cpeBase && modelId) {
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
          model: modelId,
          temperature: 0.1,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const json = await response.json();
        const rawText = json?.choices?.[0]?.message?.content;
        if (typeof rawText === 'string') {
          const parsed = AiDetectedContextSchema.safeParse(extractJsonObject(rawText));
          if (parsed.success) {
            const colors = parsed.data.themeColors.map((c) => ({
              hex: normalizeHex6(c.hex) || c.hex.toUpperCase(),
              role: c.role,
            }));
            return {
              productGoal: parsed.data.productGoal,
              brandKeywords: parsed.data.brandKeywords,
              themeColor: colors[0]?.hex || fallback.themeColor,
              themeColors: colors,
              targetAudience: parsed.data.targetAudience,
              additionalContext: parsed.data.additionalContext,
            };
          }
        }
      }
    } catch {
      // Fall back to heuristic
    }
  }

  return null;
}

const FIXTURE_CONTEXTS: Record<string, Partial<ProductContext>> = {
  'mvp-contrast-demo': {
    productGoal: 'Course registration demo for accessibility testing',
    brandKeywords: 'Accessible, Clear, Learning',
    themeColor: '#2563EB',
    targetAudience: 'University students and faculty',
    additionalContext: 'Evaluates WCAG 2.2 SC 1.4.3 minimum contrast requirements.',
  },
  'target-size-benchmarks': {
    productGoal: 'Interactive touch and pointer action targets',
    brandKeywords: 'Ergonomic, Touch-first, Responsive',
    themeColor: '#059669',
    targetAudience: 'Mobile users on touch-screen devices',
    additionalContext: 'Evaluates WCAG 2.2 SC 2.5.8 minimum target sizing.',
  },
  'contrast-matrix': {
    productGoal: 'Components color matrix and non-text indicators',
    brandKeywords: 'High-contrast, Corporate, Structured',
    themeColor: '#4F46E5',
    targetAudience: 'Designers and frontend engineers',
    additionalContext: 'Evaluates SC 1.4.3 and SC 1.4.11 graphical contrast.',
  },
  'reflow-suite': {
    productGoal: 'Adaptive documentation and reflow layout',
    brandKeywords: 'Readable, Adaptive, Fluid',
    themeColor: '#0284C7',
    targetAudience: 'Users with low vision zooming at 400% or 320px width',
    additionalContext: 'Evaluates WCAG 2.2 SC 1.4.10 reflow.',
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = (body.target || '').trim();
    const rawHtml = (body.html || '').trim();

    // Helper: Parse context from HTML string
    const extractContextFromHtml = (html: string): ProductContext & { themeColors: DetectedThemeColor[] } => {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const extractMeta = (propOrName: string) => {
        const regex = new RegExp(`<meta[^>]*(?:name|property)=["']${propOrName}["'][^>]*content=["']([^"']*)["']`, 'i');
        const match = html.match(regex);
        if (match && match[1]) return match[1].trim();
        const reversedRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${propOrName}["']`, 'i');
        const matchRev = html.match(reversedRegex);
        return matchRev && matchRev[1] ? matchRev[1].trim() : '';
      };

      const description =
        extractMeta('description') ||
        extractMeta('og:description') ||
        extractMeta('twitter:description');

      const siteName = extractMeta('og:site_name') || extractMeta('application-name');
      const keywords = extractMeta('keywords');
      const metaThemeColor = extractMeta('theme-color') || extractMeta('msapplication-TileColor');
      const themeColors = extractPaletteFromHtml(html, metaThemeColor);
      const primaryColor = themeColors[0]?.hex || '#2563EB';

      const productGoal = description
        ? (title ? `${title}: ${description}` : description).slice(0, 1000)
        : title ? `Interface for ${title}`.slice(0, 1000) : 'Web application interface';

      const brandKeywords = [siteName, keywords].filter(Boolean).join(', ').slice(0, 300) || 'Accessible, Modern, Web';

      return {
        productGoal,
        brandKeywords,
        themeColor: primaryColor,
        themeColors,
        targetAudience: 'General web audience and mobile users',
        additionalContext: 'Auto-detected from component markup.',
      };
    };

    // 1. Direct HTML snippet provided (AI first, heuristic fallback)
    if (rawHtml) {
      const heuristic = extractContextFromHtml(rawHtml);
      const aiContext = await detectContextWithAi(rawHtml, heuristic);
      return NextResponse.json({
        success: true,
        source: aiContext ? 'ai' : 'heuristic',
        context: aiContext || heuristic,
      });
    }

    if (!target) {
      return NextResponse.json({ success: false, error: 'Target URL is required.' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'localhost:3123';
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : (process.env.PORT || '3123');
    const baseUrl = `http://localhost:${port}`;

    const validation = await validateAndNormalizeAuditUrl(target, baseUrl, undefined, {
      allowLocalhost: body.allowLocalhost === true && process.env.NODE_ENV === 'development',
    });

    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json({ success: false, error: validation.error || 'Invalid target URL.' }, { status: 400 });
    }

    // 2. Fixture Lookup (Checks both explicit fixture map and registry)
    if (validation.fixtureId) {
      const fixCtx = FIXTURE_CONTEXTS[validation.fixtureId];
      const fixtureDef = FIXTURES.find((f) => f.id === validation.fixtureId);

      if (fixCtx || fixtureDef) {
        return NextResponse.json({
          success: true,
          context: {
            productGoal: fixCtx?.productGoal || fixtureDef?.description || fixtureDef?.name || 'Benchmark UI component',
            brandKeywords: fixCtx?.brandKeywords || `${fixtureDef?.category || 'ui'}, accessible, benchmark`,
            themeColor: fixCtx?.themeColor || '#2563EB',
            targetAudience: fixCtx?.targetAudience || 'Designers and frontend engineers',
            additionalContext: fixCtx?.additionalContext || (fixtureDef ? `Evaluates ${fixtureDef.name}` : ''),
          },
        });
      }
    }

    // For external URLs: fetch HTML with timeout and parse metadata
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(validation.normalizedUrl, {
        headers: { 'User-Agent': 'ProofUI-Audit/1.0 (Metadata Detection)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return NextResponse.json({
          success: true,
          context: {
            ...EMPTY_PRODUCT_CONTEXT,
            additionalContext: `Page returned HTTP ${res.status}.`,
          },
        });
      }

      const html = await res.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract meta tags helper
      const extractMeta = (propOrName: string) => {
        const regex = new RegExp(`<meta[^>]*(?:name|property)=["']${propOrName}["'][^>]*content=["']([^"']*)["']`, 'i');
        const match = html.match(regex);
        if (match && match[1]) return match[1].trim();
        const reversedRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${propOrName}["']`, 'i');
        const matchRev = html.match(reversedRegex);
        return matchRev && matchRev[1] ? matchRev[1].trim() : '';
      };

      const description =
        extractMeta('description') ||
        extractMeta('og:description') ||
        extractMeta('twitter:description');

      const siteName = extractMeta('og:site_name') || extractMeta('application-name');
      const keywords = extractMeta('keywords');
      const themeColor = extractMeta('theme-color') || extractMeta('msapplication-TileColor');

      const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
      const lang = langMatch ? langMatch[1].trim() : 'en';

      const productGoal = description
        ? (title ? `${title}: ${description}` : description).slice(0, 1000)
        : title.slice(0, 1000);

      const brandKeywords = [siteName, keywords].filter(Boolean).join(', ').slice(0, 300);

      let validThemeColor = '';
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(themeColor)) {
        validThemeColor = themeColor;
      }

      const targetAudience = lang && lang !== 'en' ? `Web visitors (${lang})` : 'General web audience';

      const context: ProductContext = {
        productGoal,
        brandKeywords,
        themeColor: validThemeColor,
        targetAudience,
        additionalContext: 'Auto-detected from page metadata.',
      };

      return NextResponse.json({ success: true, context });
    } catch {
      return NextResponse.json({
        success: true,
        context: {
          ...EMPTY_PRODUCT_CONTEXT,
          additionalContext: 'Metadata detection timed out; general guidelines will be applied.',
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Detection failed' }, { status: 500 });
  }
}

