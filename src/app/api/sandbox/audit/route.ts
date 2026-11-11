import { NextRequest, NextResponse } from 'next/server';
import { saveSandboxSnippet } from '@/lib/sandbox/store';
import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues } from '@/lib/audit/grouping';
import { saveAuditRun } from '@/lib/storage/db';
import { AuditRun } from '@/lib/schema/ux-issue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';

    if (!html) {
      return NextResponse.json({ success: false, error: 'HTML snippet content is required.' }, { status: 400 });
    }

    const snippet = saveSandboxSnippet(html);
    const host = req.headers.get('host') || 'localhost:3123';
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : (process.env.PORT || '3123');
    const localOrigin = `http://localhost:${port}`;
    const targetUrl = `${localOrigin}/api/sandbox/render?id=${snippet.id}`;

    // Run browser audit across desktop (1440px) and mobile (375px)
    const { issues, errors, pageScreenshots } = await runBrowserAudit({
      url: targetUrl,
      timeoutMs: 15000,
      localOrigin,
      viewports: DEFAULT_AUDIT_VIEWPORTS,
    });

    const grouped = groupUXIssues(issues);
    const passCount = grouped.filter((g) => g.status === 'pass').length;
    const failCount = grouped.filter((g) => g.status === 'candidateFail').length;
    const reviewCount = grouped.filter((g) => g.status === 'needsReview').length;

    const runId = `sandbox-${snippet.id}`;
    const run: AuditRun = {
      id: runId,
      targetUrl,
      timestamp: new Date().toISOString(),
      viewports: DEFAULT_AUDIT_VIEWPORTS,
      rawIssues: issues,
      groupedIssues: grouped,
      summary: {
        totalRawFindings: issues.length,
        totalGroupedIssues: grouped.length,
        passCount,
        candidateFailCount: failCount,
        needsReviewCount: reviewCount,
      },
      auditWarnings: errors.length > 0 ? errors : undefined,
    };

    await saveAuditRun(run);

    return NextResponse.json({
      success: true,
      snippetId: snippet.id,
      renderUrl: targetUrl,
      run,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Audit failed.' },
      { status: 500 }
    );
  }
}

