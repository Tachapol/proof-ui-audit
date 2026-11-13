import { NextRequest, NextResponse } from 'next/server';
import { runMultiCandidateIteration } from '@/lib/sandbox/iteration';
import { UXIssue } from '@/lib/schema/ux-issue';
import { getAuditRun, saveAuditRun } from '@/lib/storage/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const issues: UXIssue[] = Array.isArray(body.issues) ? body.issues : [];
    const runId = typeof body.runId === 'string' ? body.runId.trim() : '';

    if (!html) {
      return NextResponse.json({ success: false, error: 'HTML snippet is required.' }, { status: 400 });
    }

    let baselineIssues = issues;
    if (baselineIssues.length === 0 && runId) {
      try {
        const existing = await getAuditRun(runId);
        if (existing?.rawIssues?.length) {
          baselineIssues = existing.rawIssues;
        }
      } catch {
        // Fallback
      }
    }

    const host = req.headers.get('host') || 'localhost:3123';
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : (process.env.PORT || '3123');
    const localOrigin = `http://localhost:${port}`;

    const candidates = await runMultiCandidateIteration(html, baselineIssues, localOrigin);

    if (runId && candidates.length > 0) {
      try {
        const run = await getAuditRun(runId);
        if (run) {
          const rec = candidates[0];
          for (const group of run.groupedIssues) {
            const rep = group.representative;
            const measurement = rec.measurements.find(
              (m) => m.ruleId === rep.ruleId && m.selector === rep.selector
            );
            group.iterationComparison = {
              candidateId: rec.id,
              candidateName: rec.name,
              candidateCode: rec.code,
              viewport: rep.viewport,
              targetSelector: rep.selector,
              baselineMeasurement: rep.measured || {},
              baselineStatus: rep.status,
              candidateMeasurement: measurement?.after || {},
              candidateStatus: (measurement?.status === 'unable_to_verify' ? 'unable_to_verify' : measurement?.status) as any,
              regressionResult:
                rec.regression?.status === 'regressed'
                  ? 'regressed'
                  : rec.verificationStatus === 'verified'
                  ? 'no_new_failures'
                  : 'unable_to_verify',
              verificationStatus: rec.verificationStatus,
              verificationErrors: rec.verificationErrors,
              regressionCounts: rec.regression?.counts,
              plainLanguageSummary: rec.description,
            };
          }
          await saveAuditRun(run);
        }
      } catch {
        // Non-fatal persistence
      }
    }

    return NextResponse.json({
      success: true,
      candidates,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Iteration failed.' },
      { status: 500 }
    );
  }
}

