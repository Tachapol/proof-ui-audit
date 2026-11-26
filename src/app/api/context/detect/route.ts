import { NextResponse } from 'next/server';
import { validateAndNormalizeAuditUrl } from '@/lib/audit/url-validator';
import { ProductContext, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';
import { FIXTURES } from '@/fixtures/fixture-registry';

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
    const extractContextFromHtml = (html: string): ProductContext => {
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
      const themeColor = extractMeta('theme-color') || extractMeta('msapplication-TileColor');

      const colorHexMatch = html.match(/(?:#|0x)([0-9a-f]{6}|[0-9a-f]{3})\b/i);
      const extractedColor = themeColor || (colorHexMatch ? `#${colorHexMatch[1]}` : '#2563EB');

      const productGoal = description
        ? (title ? `${title}: ${description}` : description).slice(0, 1000)
        : title ? `Interface for ${title}`.slice(0, 1000) : 'Web application interface';

      const brandKeywords = [siteName, keywords].filter(Boolean).join(', ').slice(0, 300) || 'Accessible, Modern, Web';

      return {
        productGoal,
        brandKeywords,
        themeColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(extractedColor) ? extractedColor : '#2563EB',
        targetAudience: 'General web audience and mobile users',
        additionalContext: 'Auto-detected from component markup.',
      };
    };

    // 1. Direct HTML snippet provided
    if (rawHtml) {
      return NextResponse.json({
        success: true,
        context: extractContextFromHtml(rawHtml),
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

