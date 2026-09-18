import { NextResponse } from 'next/server';
import { validateAndNormalizeAuditUrl } from '@/lib/audit/url-validator';
import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues, calculateAuditSummary } from '@/lib/audit/grouping';
import { saveAuditRun, getAuditRun } from '@/lib/storage/db';
import { AuditRun } from '@/lib/schema/ux-issue';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = body.target;

    const host = req.headers.get('host') || 'localhost:3123';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // 1. Validate & normalize URL with SSRF protection (SEC-04, SEC-05)
    const validation = await validateAndNormalizeAuditUrl(target, baseUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid audit target.' },
        { status: 400 }
      );
    }

    // 2. Execute browser auditing across mobile & desktop viewports (RULE-02, SEC-07)
    const { issues, errors } = await runBrowserAudit({
      url: validation.normalizedUrl,
      timeoutMs: 25000,
    });

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
      fixtureId: validation.fixtureId,
      timestamp: new Date().toISOString(),
      viewports: DEFAULT_AUDIT_VIEWPORTS,
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
    return NextResponse.json({ success: false, error: 'Audit run ID required' }, { status: 400 });
  }

  const run = await getAuditRun(id);
  if (!run) {
    return NextResponse.json({ success: false, error: 'Audit run not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, run });
}
