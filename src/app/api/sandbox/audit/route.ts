import { NextRequest, NextResponse } from 'next/server';
import { saveSandboxSnippet } from '@/lib/sandbox/store';
import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues } from '@/lib/audit/grouping';
import { getAuditRun, saveAuditRun } from '@/lib/storage/db';
import { AuditRun } from '@/lib/schema/ux-issue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const priorRunId = typeof body.priorRunId === 'string' ? body.priorRunId.trim() : undefined;
    const acceptedCandidate = body.acceptedCandidate;

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

    // Link and inherit Before/After evidence from prior run if available
    let priorRun: AuditRun | null = null;
    if (priorRunId) {
      try {
        priorRun = await getAuditRun(priorRunId);
        if (priorRun) {
          if (acceptedCandidate) {
            for (const pg of priorRun.groupedIssues) {
              if (pg.iterationComparison) {
                pg.iterationComparison.finalDesignerDecision = 'accept';
                pg.iterationComparison.approvalTimestamp = new Date().toISOString();
                pg.iterationComparison.approvalReason = `Accepted candidate fix: ${acceptedCandidate.name || acceptedCandidate.id}`;
              }
              pg.decisionHistory = pg.decisionHistory || [];
              pg.decisionHistory.push({
                id: crypto.randomUUID(),
                action: 'accept',
                reason: `Accepted candidate fix: ${acceptedCandidate.name || acceptedCandidate.id}`,
                timestamp: new Date().toISOString(),
                reviewer: 'Designer',
              });
            }
            await saveAuditRun(priorRun);
          }

          // Inherit iteration comparison on corresponding issues in the new run
          for (const newGroup of grouped) {
            const matchedPrior = priorRun.groupedIssues.find(
              (pg) =>
                pg.fingerprint === newGroup.fingerprint ||
                (pg.representative.ruleId === newGroup.representative.ruleId &&
                  pg.representative.selector === newGroup.representative.selector)
            );
            if (matchedPrior?.iterationComparison) {
              newGroup.iterationComparison = matchedPrior.iterationComparison;
            }
          }
        }
      } catch {
        // Best-effort prior link
      }
    }

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
      priorRunId: priorRun?.id,
      appliedCandidate: acceptedCandidate && priorRun
        ? {
            candidateId: acceptedCandidate.id,
            candidateName: acceptedCandidate.name,
            candidateCode: acceptedCandidate.code,
            appliedAt: new Date().toISOString(),
            priorRunId: priorRun.id,
          }
        : undefined,
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

