import { NextResponse } from 'next/server';
import { validateAndNormalizeAuditUrl } from '@/lib/audit/url-validator';
import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues, calculateAuditSummary } from '@/lib/audit/grouping';
import { saveAuditRun, getAuditRun, listAuditRuns } from '@/lib/storage/db';
import { AuditRun } from '@/lib/schema/ux-issue';
import { ProductContext, ProductContextSchema } from '@/lib/schema/product-context';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = body.target;
    const context = ProductContextSchema.optional().safeParse(body.productContext);
    if (!context.success) return NextResponse.json({ success: false, error: context.error.issues[0].message }, { status: 400 });

    const host = req.headers.get('host') || 'localhost:3123';
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : (process.env.PORT || '3123');
    // Internal fixture requests should always target local loopback on the running server port over HTTP
    const baseUrl = `http://localhost:${port}`;

    // 1. Validate & normalize URL with SSRF protection (SEC-04, SEC-05)
    const validation = await validateAndNormalizeAuditUrl(target, baseUrl, undefined, { allowLocalhost: body.allowLocalhost === true && process.env.NODE_ENV === 'development' });
    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid audit target.' },
        { status: 400 }
      );
    }

    // 2. Execute browser auditing across viewports (RULE-02, SEC-07)
    const isMvp = validation.fixtureId === 'mvp-contrast-demo';
    const viewports = isMvp ? [{ width: 375, height: 667 }] : DEFAULT_AUDIT_VIEWPORTS;
    const { issues: allIssues, errors, pageScreenshots, detectedContext } = await runBrowserAudit({
      url: validation.normalizedUrl,
      timeoutMs: 25000,
      localOrigin: validation.localOrigin,
      viewports,
    });

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

    const fixtureContext = validation.fixtureId ? FIXTURE_CONTEXTS[validation.fixtureId] : undefined;
    const baseDetected = detectedContext || fixtureContext;

    let finalContext: ProductContext | undefined = context.data;
    const isUserContextEmpty = !finalContext || !Object.values(finalContext).some(Boolean);
    const autoDetectRequested = body.autoDetectContext !== false;

    if (autoDetectRequested && baseDetected) {
      finalContext = {
        productGoal: finalContext?.productGoal || baseDetected.productGoal || '',
        brandKeywords: finalContext?.brandKeywords || baseDetected.brandKeywords || '',
        themeColor: finalContext?.themeColor || baseDetected.themeColor || '',
        targetAudience: finalContext?.targetAudience || baseDetected.targetAudience || '',
        additionalContext: finalContext?.additionalContext || baseDetected.additionalContext || '',
      };
    }

    const caseSelectors = ['#normal-pass', '#normal-fail', '#large-pass', '#gradient-review'];
    const issues = isMvp ? allIssues.filter(issue => issue.ruleId === 'text-contrast' && caseSelectors.includes(issue.selector)) : allIssues;
    if (isMvp && errors.length === 0 && issues.length !== 4) return NextResponse.json({ success: false, error: 'MVP measurement incomplete: expected four controlled text cases.' }, { status: 502 });
    if (issues.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join('; ') },
        { status: 502 }
      );
    }

    // 3. Deterministic grouping and summary calculation (DATA-03, DATA-04)
    const groupedIssues = groupUXIssues(issues);
    const summary = calculateAuditSummary(issues, groupedIssues);

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const auditRun: AuditRun = {
      id: runId,
      targetUrl: validation.normalizedUrl,
      pageScreenshots,
      auditWarnings: errors.length ? errors : undefined,
      fixtureId: validation.fixtureId,
      productContext: finalContext,
      timestamp: new Date().toISOString(),
      viewports,
      rawIssues: issues,
      groupedIssues,
      summary,
    };

    // 4. Atomic local persistence (DATA-05)
    await saveAuditRun(auditRun);

    return NextResponse.json({
      success: true,
      run: auditRun,
      partialErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    // Secret & trace sanitization (SEC-08)
    return NextResponse.json(
      { success: false, error: 'Internal audit engine error: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    const runs = await listAuditRuns();
    return NextResponse.json({ success: true, runs });
  }

  const run = await getAuditRun(id);
  if (!run) {
    return NextResponse.json({ success: false, error: 'Audit run not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, run });
}
