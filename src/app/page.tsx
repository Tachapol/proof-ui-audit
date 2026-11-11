'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AuditInput } from '@/components/AuditInput';
import { AuditSummary } from '@/components/AuditSummary';
import { IssueCard } from '@/components/IssueCard';
import { VisualCanvasOverlay } from '@/components/VisualCanvasOverlay';
import { NavigationRail } from '@/components/NavigationRail';
import { StateView } from '@/components/StateViews';
import { AuditUiStatus, TopBar } from '@/components/TopBar';
import { AuditRun, AuditStatus } from '@/lib/schema/ux-issue';
import { Icon } from '@/components/Icon';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { ProductContext } from '@/lib/schema/product-context';

export default function HomePage() {
  const [currentRun, setCurrentRun] = useState<AuditRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [partialMessage, setPartialMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AuditStatus>('all');
  const [auditStatus, setAuditStatus] = useState<AuditUiStatus>('ready');
  const [pendingTarget, setPendingTarget] = useState('fixture://target-size-demo');
  const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasInputValidationError, setHasInputValidationError] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const runningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (runningTimerRef.current) clearTimeout(runningTimerRef.current);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const runId = params.get('runId');
    if (!runId) return;
    setIsLoading(true);
    setAuditStatus('queued');
    fetch(`/api/audit?id=${encodeURIComponent(runId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.success || !data.run) throw new Error(data.error || 'Saved audit run could not be loaded.');
        setCurrentRun(data.run);
        setPendingTarget(data.run.fixtureId ? `fixture://${data.run.fixtureId}` : data.run.targetUrl);
        setAuditStatus('completed');
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Saved audit run could not be loaded.');
        setAuditStatus('failed');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleTargetChange = useCallback((target: string) => setPendingTarget(target), []);

  const handleRunAudit = async (target: string, productContext?: ProductContext, autoDetectContext?: boolean) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setPartialMessage(null);
    setPipelineMessage(target === 'fixture://mvp-contrast-demo' ? 'Step 1/3: Measuring text contrast from rendered DOM…' : '');
    setAuditStatus('queued');
    runningTimerRef.current = setTimeout(() => setAuditStatus('running'), 180);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, productContext, autoDetectContext }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to complete audit.');
      if (data.run.fixtureId === 'mvp-contrast-demo') {
        data.run.groupedIssues.sort((a: { status: string }, b: { status: string }) => Number(b.status === 'candidateFail') - Number(a.status === 'candidateFail'));
        setCurrentRun(data.run);
        setPipelineMessage('Step 2/3: Requesting LLM critique from measured evidence…');
        const candidate = data.run.groupedIssues.find((group: { status: string }) => group.status === 'candidateFail');
        if (candidate) {
          try {
            const explained = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: data.run.id, fingerprint: candidate.fingerprint }) });
            const answer = await explained.json();
            if (!explained.ok || !answer.success || !answer.updatedGroup) throw new Error('Critique could not be loaded. Use Request Explanation to retry.');
            data.run.groupedIssues = data.run.groupedIssues.map((group: { fingerprint: string }) => group.fingerprint === candidate.fingerprint ? answer.updatedGroup : group);
            setPipelineMessage(answer.aiResult.isFallback ? 'Measurements complete. LLM unavailable: template fallback shown. Retry Request Explanation.' : 'Step 3/3: Live LLM critique ready. Review the finding, record your decision, and export.');
          } catch {
            setPipelineMessage('Measurements complete. Critique unavailable. Use Request Explanation on the candidate issue to retry.');
          }
        } else setPipelineMessage('Measurements complete. No candidate issue requires critique.');
      }
      setCurrentRun({ ...data.run });
      setStatusFilter('all');
      if (data.partialErrors?.length) {
        setPartialMessage(`The audit completed with limited coverage: ${data.partialErrors.join('; ')}`);
        setAuditStatus('partial');
      } else {
        setAuditStatus('completed');
      }
      window.history.replaceState(null, '', `?runId=${encodeURIComponent(data.run.id)}`);
      localStorage.setItem('proofui_last_run_id', data.run.id);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Audit execution error.');
      setAuditStatus('failed');
    } finally {
      if (runningTimerRef.current) clearTimeout(runningTimerRef.current);
      setIsLoading(false);
    }
  };

  const filteredIssues = (currentRun?.groupedIssues || []).filter((issue) => statusFilter === 'all' || issue.status === statusFilter);
  const currentFixtureDef = currentRun?.fixtureId ? FIXTURES.find((f) => f.id === currentRun.fixtureId) : undefined;
  const pendingFixtureId = pendingTarget.startsWith('fixture://') ? pendingTarget.replace('fixture://', '') : undefined;
  const pendingFixtureDef = pendingFixtureId ? FIXTURES.find((f) => f.id === pendingFixtureId) : undefined;

  const displayTarget = currentRun
    ? (currentFixtureDef ? `${currentFixtureDef.name} (Local Fixture)` : currentRun.targetUrl)
    : (pendingFixtureDef ? `${pendingFixtureDef.name} (Local Fixture)` : pendingTarget);
  const viewportLabel = currentRun ? currentRun.viewports.map((viewport) => `${viewport.width}px`).join(' · ') : '320 · 375 · 1440px';

  return (
    <div className="application-shell min-h-screen bg-zinc-50/50 text-zinc-950 font-sans antialiased">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NavigationRail isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} currentRunId={currentRun?.id} currentFixtureId={currentRun?.fixtureId} triggerRef={menuButtonRef} />

      <div className="workspace">
        <TopBar menuButtonRef={menuButtonRef} onOpenNavigation={() => setDrawerOpen(true)} target={displayTarget} status={auditStatus} viewportLabel={viewportLabel} />
        <div className="workspace-content max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8" inert={drawerOpen ? true : undefined} aria-hidden={drawerOpen ? true : undefined}>
          <main id="main-content" tabIndex={-1} className="outline-none space-y-6">
            <header className="page-intro flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900">ProofUI Audit PoC</h1>
                  <span className="text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded-full">v1.0</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Deterministic accessibility measurements and evidence collection for WCAG 2.1 conformance.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 transition-colors shrink-0"
              >
                <Icon name="Users" size={14} />
                <span>Open Critique Studio</span>
                <Icon name="ArrowRight" size={13} />
              </Link>
            </header>

            <AuditInput
              currentContext={currentRun?.productContext}
              currentFixtureId={currentRun?.fixtureId}
              onRunAudit={handleRunAudit}
              onTargetChange={handleTargetChange}
              onValidationStateChange={setHasInputValidationError}
              isLoading={isLoading}
              error={error}
            />

            {pipelineMessage && (
              <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-700 bg-zinc-100/90 border border-zinc-200/80 px-3.5 py-2.5 rounded-lg" role="status" aria-live="polite">
                <Icon name="LoaderCircle" size={14} className="animate-spin text-zinc-500 shrink-0" />
                <span>{pipelineMessage}</span>
              </div>
            )}

            <div className="dynamic-state-slot space-y-4">
              {isLoading && (
                <StateView
                  kind="loading"
                  title={auditStatus === 'queued' ? 'Audit queued' : 'Audit running'}
                  description={auditStatus === 'queued' ? 'Preparing the isolated browser and requested viewports.' : 'Collecting deterministic measurements and screenshot evidence. You can keep this page open.'}
                />
              )}
              {!isLoading && error && (
                <StateView
                  kind="error"
                  title="Audit could not be completed"
                  description={`${error} The entered target is preserved above so you can correct or retry it.`}
                />
              )}
              {!isLoading && partialMessage && (
                <StateView
                  kind="partial"
                  title="Partial results are available"
                  description={partialMessage}
                />
              )}
              {!isLoading && !error && !hasInputValidationError && !currentRun && (
                <StateView
                  kind="empty"
                  title="Ready for a first audit"
                  description="The Target Size local fixture is selected. Run it to see grouped evidence, designer actions, and an isolated preview without using an external URL."
                />
              )}
            </div>

            {currentRun && (
              <section id="audit-results" className="space-y-6 pt-2" aria-labelledby="results-heading">
                <div className="results-heading-row flex items-end justify-between gap-4 pb-2 border-b border-zinc-200">
                  <div>
                    <p className="eyebrow text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Review queue</p>
                    <h2 id="results-heading" className="text-lg font-bold tracking-tight text-zinc-900">Audit evidence</h2>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200/60 font-mono">
                      {currentRun.groupedIssues.length} grouped {currentRun.groupedIssues.length === 1 ? 'issue' : 'issues'}
                    </span>
                    <Link
                      href={`/studio?runId=${encodeURIComponent(currentRun.id)}`}
                      className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 transition-colors"
                      title="Open this audit in Critique Studio"
                    >
                      <Icon name="Users" size={13} />
                      <span>Open in Studio</span>
                      <Icon name="ArrowRight" size={12} />
                    </Link>
                  </div>
                </div>

                {currentRun.productContext && Object.values(currentRun.productContext).some(Boolean) && (
                  <details className="saved-product-context rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs text-xs space-y-3">
                    <summary className="font-semibold text-zinc-800 cursor-pointer select-none">
                      Product context used for this audit
                    </summary>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
                      {Object.entries(currentRun.productContext)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <div key={key} className="space-y-0.5">
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                              {({ productGoal: 'Product Goal', brandKeywords: 'Brand Keywords', themeColor: 'Theme Color', targetAudience: 'Target Audience', additionalContext: 'Others' } as Record<string, string>)[key]}
                            </dt>
                            <dd className="text-zinc-800 font-medium">{value}</dd>
                          </div>
                        ))}
                    </dl>
                  </details>
                )}

                <AuditSummary
                  summary={currentRun.summary}
                  targetUrl={currentRun.targetUrl}
                  timestamp={currentRun.timestamp}
                  runId={currentRun.id}
                  fixtureId={currentRun.fixtureId}
                />

                {/* Designer Visual Canvas Overlay */}
                <VisualCanvasOverlay
                  currentRun={currentRun}
                  activeFingerprint={activeFingerprint}
                  onSelectIssue={(fp) => {
                    setActiveFingerprint(fp);
                  }}
                  onDecisionSaved={(updated) => {
                    setCurrentRun((previous) =>
                      previous
                        ? {
                            ...previous,
                            groupedIssues: previous.groupedIssues.map((group) =>
                              group.fingerprint === updated.fingerprint ? updated : group
                            ),
                          }
                        : null
                    );
                  }}
                />

                <div className="filter-bar flex flex-wrap items-center gap-2 py-1" role="group" aria-label="Filter audit issues by status">
                  {([
                    { id: 'all', label: 'All', count: currentRun.groupedIssues.length },
                    { id: 'candidateFail', label: 'Candidate fail', count: currentRun.summary.candidateFailCount },
                    { id: 'needsReview', label: 'Needs review', count: currentRun.summary.needsReviewCount },
                    { id: 'pass', label: 'Pass', count: currentRun.summary.passCount },
                  ] as const).map((filter) => {
                    const isActive = statusFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        aria-pressed={isActive}
                        aria-label={`Show ${filter.label.toLowerCase()} issues, ${filter.count}`}
                        onClick={() => setStatusFilter(filter.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
                          isActive
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                        }`}
                      >
                        <span>{filter.label}</span>
                        <strong
                          className={`text-[11px] font-mono font-medium px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          ({filter.count})
                        </strong>
                      </button>
                    );
                  })}
                </div>

                {filteredIssues.length === 0 ? (
                  <div className="filter-empty flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs" role="status">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-600 border border-zinc-200">
                      <Icon name={statusFilter === 'candidateFail' ? 'CheckCircle2' : 'Info'} size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {statusFilter === 'candidateFail' ? 'No candidate issues found' : 'No cards match this filter'}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        {statusFilter === 'candidateFail'
                          ? 'No automated measurements crossed the candidate-failure threshold in this run.'
                          : 'Choose another status filter to return to the visible evidence.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="issue-feed space-y-4">
                    {filteredIssues.map((issue) => (
                      <IssueCard
                        key={issue.fingerprint}
                        issue={issue}
                        runId={currentRun.id}
                        onDecisionSaved={(updated) =>
                          setCurrentRun((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  groupedIssues: previous.groupedIssues.map((group) =>
                                    group.fingerprint === updated.fingerprint ? updated : group
                                  ),
                                }
                              : null
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
