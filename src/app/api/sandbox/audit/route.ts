import { NextRequest, NextResponse } from 'next/server';
import { saveSandboxSnippet } from '@/lib/sandbox/store';
import { runBrowserAudit, DEFAULT_AUDIT_VIEWPORTS } from '@/lib/audit/browser';
import { groupUXIssues } from '@/lib/audit/grouping';
import { getAuditRun, saveAuditRun, withRunLock } from '@/lib/storage/db';
import { AuditRunSchema, AuditRun } from '@/lib/schema/ux-issue';
import { PilotScopeSchema } from '@/lib/schema/pilot-metric';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pilotScope = PilotScopeSchema.optional().safeParse(body.pilotScope);
    if (!pilotScope.success) return NextResponse.json({ success: false, error: 'Invalid pilot UI scope or parent heading level.' }, { status: 400 });
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const priorRunId = typeof body.priorRunId === 'string' ? body.priorRunId.trim() : undefined;
    const acceptedCandidate = body.acceptedCandidate;
    const imported = body.canvasImport ? AuditRunSchema.shape.canvasImport.safeParse({ ...body.canvasImport, scope: 'isolated_reconstruction' }) : undefined;
    if (imported && !imported.success) return NextResponse.json({ success: false, error: 'Invalid Canvas import metadata.' }, { status: 400 });
    const canvasImport = imported?.success ? imported.data : undefined;
    const viewports = canvasImport ? [canvasImport.viewport] : DEFAULT_AUDIT_VIEWPORTS;

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
    const { issues, errors, pageScreenshots, metricResults } = await runBrowserAudit({
      pilotScope: pilotScope.data,
      url: targetUrl,
      timeoutMs: 15000,
      localOrigin,
      viewports,
    });

    const grouped = groupUXIssues(issues);
    const passCount = grouped.filter((g) => g.status === 'pass').length;
    const failCount = grouped.filter((g) => g.status === 'candidateFail').length;
    const reviewCount = grouped.filter((g) => g.status === 'needsReview').length;

    // Link and inherit Before/After evidence from prior run if available
    let resolvedPriorRunId: string | undefined = undefined;
    let appliedCandidateMeta: { candidateId: string; candidateName: string; candidateCode?: string; appliedAt: string; priorRunId?: string } | undefined = undefined;

    if (priorRunId) {
      try {
        await withRunLock(priorRunId, async () => {
          const priorRun = await getAuditRun(priorRunId);
          if (priorRun) {
            resolvedPriorRunId = priorRun.id;
            if (acceptedCandidate) {
              const acceptedId = acceptedCandidate.id || 'candidate-fix';
              const serverCand = priorRun.candidates?.find((c: any) => c.id === acceptedId);
              const candName = serverCand?.name || acceptedCandidate.name || acceptedId;
              const candCode = serverCand?.code || acceptedCandidate.code;

              for (const pg of priorRun.groupedIssues) {
                if (pg.iterationComparison) {
                  pg.iterationComparison.finalDesignerDecision = 'accept';
                  pg.iterationComparison.approvalTimestamp = new Date().toISOString();
                  pg.iterationComparison.approvalReason = `Accepted candidate fix: ${candName}`;
                }
                pg.decisionHistory = pg.decisionHistory || [];
                pg.decisionHistory.push({
                  id: crypto.randomUUID(),
                  action: 'accept',
                  reason: `Accepted candidate fix: ${candName}`,
                  timestamp: new Date().toISOString(),
                  reviewer: 'Designer',
                });
              }
              await saveAuditRun(priorRun);

              appliedCandidateMeta = {
                candidateId: acceptedId,
                candidateName: candName,
                candidateCode: candCode,
                appliedAt: new Date().toISOString(),
                priorRunId: priorRun.id,
              };
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
        });
      } catch {
        // Best-effort prior link
      }
    }

    const runId = `sandbox-${snippet.id}`;
    const run: AuditRun = {
      metricResults,
      canvasImport,
      id: runId,
      targetUrl,
      timestamp: new Date().toISOString(),
      viewports,
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
      priorRunId: resolvedPriorRunId,
      appliedCandidate: appliedCandidateMeta,
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

