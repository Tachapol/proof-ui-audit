import { NextRequest, NextResponse } from 'next/server';
import { runMultiCandidateIteration } from '@/lib/sandbox/iteration';
import { UXIssue } from '@/lib/schema/ux-issue';
import { getAuditRun, saveAuditRun, withRunLock } from '@/lib/storage/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const issues: UXIssue[] = Array.isArray(body.issues) ? body.issues : [];
    const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
    const constraints = Array.isArray(body.constraints) ? body.constraints : undefined;
    const customDirective = typeof body.customDirective === 'string' ? body.customDirective.trim() : undefined;

    // Handle immediate candidate selection sync (Issue 3 & Issue 5)
    // Server enforces candidate verification from its own stored candidates (Issue 1.2 & Issue 1.3)
    if (body.action === 'selectCandidate' && runId && (body.candidateId || body.candidate?.id)) {
      const candidateId = body.candidateId || body.candidate?.id;
      const selectionTimestamp = typeof body.selectionTimestamp === 'number' ? body.selectionTimestamp : Date.now();

      return await withRunLock(runId, async () => {
        const run = await getAuditRun(runId);
        if (!run) {
          return NextResponse.json({ success: false, error: 'Audit run not found' }, { status: 404 });
        }

        // Stale selection check: drop if an out-of-order older selection arrives after a newer one
        if (run.lastSelectionTimestamp && selectionTimestamp < run.lastSelectionTimestamp) {
          return NextResponse.json({ success: true, run, stale: true });
        }
        run.lastSelectionTimestamp = selectionTimestamp;

        // Verify candidate strictly against server-recorded candidates (never blindly trust client verified payload)
        let rec = run.candidates?.find((c: any) => c.id === candidateId);
        if (!rec) {
          if (run.candidates && run.candidates.length > 0) {
            return NextResponse.json(
              { success: false, error: `Candidate ${candidateId} not found in verified server audit records.` },
              { status: 400 }
            );
          }
          // Fallback for legacy runs without stored candidates
          rec = body.candidate;
        }

        for (const group of run.groupedIssues) {
          const rep = group.representative;
          const measurement = rec.measurements?.find(
            (m: any) =>
              m.ruleId === rep.ruleId &&
              m.selector === rep.selector &&
              (!rep.viewport || (m.viewport?.width === rep.viewport.width && m.viewport?.height === rep.viewport.height))
          ) || rec.measurements?.find(
            (m: any) => m.ruleId === rep.ruleId && m.selector === rep.selector
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
        return NextResponse.json({ success: true, run });
      });
    }

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

    const candidates = await runMultiCandidateIteration(
      html,
      baselineIssues,
      localOrigin,
      { constraints, customDirective }
    );

    if (runId && candidates.length > 0) {
      try {
        await withRunLock(runId, async () => {
          const run = await getAuditRun(runId);
          if (run) {
            run.candidates = candidates; // Persist server-verified candidates
            const selectedCandidateId = typeof body.selectedCandidateId === 'string' ? body.selectedCandidateId : undefined;
            const rec = (selectedCandidateId && candidates.find((c) => c.id === selectedCandidateId)) || candidates[0];
            for (const group of run.groupedIssues) {
              const rep = group.representative;
              const measurement = rec.measurements.find(
                (m: any) =>
                  m.ruleId === rep.ruleId &&
                  m.selector === rep.selector &&
                  (!rep.viewport || (m.viewport?.width === rep.viewport.width && m.viewport?.height === rep.viewport.height))
              ) || rec.measurements.find(
                (m: any) => m.ruleId === rep.ruleId && m.selector === rep.selector
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
        });
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

