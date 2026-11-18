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
import { AuditRun, AuditStatus, GroupedUXIssue } from '@/lib/schema/ux-issue';
import { Icon } from '@/components/Icon';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { ProductContext } from '@/lib/schema/product-context';
import { PilotMetricEvidence } from '@/components/PilotMetricEvidence';

type ReviewStatus = Exclude<AuditStatus, 'pass'>;
const reviewStatuses = [
  { id: 'candidateFail', label: 'Candidate fail', tone: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
  { id: 'needsReview', label: 'Needs review', tone: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
] as const;

export default function HomePage() {
  const [currentRun, setCurrentRun] = useState<AuditRun | null>(null);
  const [isUnsavedRun, setIsUnsavedRun] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [partialMessage, setPartialMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AuditStatus>('all');
  const [auditStatus, setAuditStatus] = useState<AuditUiStatus>('ready');
  const [pendingTarget, setPendingTarget] = useState('fixture://target-size-demo');
  const [activeFingerprint, setActiveFingerprint] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasInputValidationError, setHasInputValidationError] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const runningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreScrollRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('proofui_sidebar_collapsed');
      if (saved === 'true') {
        setSidebarCollapsed(true);
      }
    } catch { }
  }, []);

  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('proofui_sidebar_collapsed', String(next));
        } catch { }
        return next;
      });
    } else {
      setDrawerOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebar]);

  // Keep review navigation local to this tab and isolated by audit run.
  useEffect(() => {
    if (!currentRun) return;
    const key = `proofui_audit_review:${currentRun.id}`;
    let restoring = restoreScrollRef.current !== null;
    let leaving = false;
    const save = () => {
      if (restoring || leaving) return;
      try {
        sessionStorage.setItem(key, JSON.stringify({ statusFilter, activeFingerprint, scrollY: window.scrollY }));
      } catch { /* Review navigation still works when storage is unavailable. */ }
    };
    const frame = requestAnimationFrame(() => {
      if (restoreScrollRef.current !== null) {
        window.scrollTo({ top: restoreScrollRef.current, behavior: 'instant' });
        restoreScrollRef.current = null;
      }
      restoring = false;
      save();
    });
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    // Capture before Next.js resets the scroll position during navigation.
    const onNavigate = (event: MouseEvent) => {
      save();
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (link && !link.hasAttribute('download') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && link.target !== '_blank') {
        const destination = new URL(link.href, window.location.href);
        leaving = destination.pathname !== window.location.pathname;
      }
    };
    document.addEventListener('click', onNavigate, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('click', onNavigate, true);
    };
  }, [currentRun?.id, statusFilter, activeFingerprint]);

  useEffect(() => () => {
    if (runningTimerRef.current) clearTimeout(runningTimerRef.current);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const runId = params.get('runId');
    if (!runId) {
      setShowAuditForm(true);
      return;
    }
    setShowAuditForm(false);
    setIsLoading(true);
    setAuditStatus('queued');
    fetch(`/api/audit?id=${encodeURIComponent(runId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.success || !data.run) throw new Error(data.error || 'Saved audit run could not be loaded.');
        try {
          const saved = JSON.parse(sessionStorage.getItem(`proofui_audit_review:${runId}`) || 'null');
          if (saved) {
            if (['all', 'candidateFail', 'needsReview', 'pass'].includes(saved.statusFilter)) setStatusFilter(saved.statusFilter);
            if (data.run.groupedIssues.some((group: { fingerprint: string }) => group.fingerprint === saved.activeFingerprint)) {
              setActiveFingerprint(saved.activeFingerprint);
            }
            if (Number.isFinite(saved.scrollY) && saved.scrollY >= 0) restoreScrollRef.current = saved.scrollY;
          }
        } catch { /* Ignore unavailable storage or outdated navigation state. */ }
        setCurrentRun(data.run);
        setIsUnsavedRun(false);
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

  const handleRunAudit = async (target: string, productContext?: ProductContext, autoDetectContext?: boolean, htmlSnippet?: string) => {
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
        body: JSON.stringify({ target, productContext, autoDetectContext, html: htmlSnippet }),
      });
      const data = await response.json();
      const unsaved = data.saved === false && !!data.run;
      if (!unsaved && (!response.ok || !data.success || !data.run)) throw new Error(data.error || 'Failed to complete audit.');
      setIsUnsavedRun(unsaved);
      if (data.run.fixtureId === 'mvp-contrast-demo') {
        data.run.groupedIssues.sort((a: { status: string }, b: { status: string }) => Number(b.status === 'candidateFail') - Number(a.status === 'candidateFail'));
        setCurrentRun(data.run);
        setPipelineMessage('Step 2/3: Requesting LLM critique from measured evidence…');
        const candidate = data.run.groupedIssues.find((group: { status: string }) => group.status === 'candidateFail');
        if (candidate && !unsaved) {
          try {
            const explained = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: data.run.id, fingerprint: candidate.fingerprint }) });
            const answer = await explained.json();
            if (!explained.ok || !answer.success || !answer.updatedGroup) throw new Error('Critique could not be loaded. Use Request Explanation to retry.');
            data.run.groupedIssues = data.run.groupedIssues.map((group: { fingerprint: string }) => group.fingerprint === candidate.fingerprint ? answer.updatedGroup : group);
            setPipelineMessage(answer.aiResult.isFallback ? 'Measurements complete. LLM unavailable: template fallback shown. Retry Request Explanation.' : 'Step 3/3: Live LLM critique ready. Review the finding, record your decision, and export.');
          } catch {
            setPipelineMessage('Measurements complete. Critique unavailable. Use Request Explanation on the candidate issue to retry.');
          }
        } else setPipelineMessage(unsaved ? 'Measurements complete. The run could not be saved.' : 'Measurements complete. No candidate issue requires critique.');
      }
      setCurrentRun({ ...data.run });
      setShowAuditForm(false);
      setStatusFilter('all');
      setActiveFingerprint(null);
      const warnings = data.partialErrors ?? data.run.auditWarnings;
      if (warnings?.length) {
        setPartialMessage(`The audit completed with limited coverage: ${warnings.join('; ')}`);
        setAuditStatus('partial');
      } else {
        setAuditStatus('completed');
      }
      const url = new URL(window.location.href);
      if (unsaved) {
        url.searchParams.delete('runId');
      } else {
        url.searchParams.set('runId', data.run.id);
        try { localStorage.setItem('proofui_last_run_id', data.run.id); } catch { /* Optional shortcut. */ }
      }
      window.history.replaceState(null, '', url);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Audit execution error.');
      setAuditStatus('failed');
    } finally {
      if (runningTimerRef.current) clearTimeout(runningTimerRef.current);
      setIsLoading(false);
    }
  };

  const groupedIssues = currentRun?.groupedIssues ?? [];
  const reviewGroups = reviewStatuses.map((status) => ({
    ...status,
    issues: groupedIssues.filter((issue) => issue.status === status.id),
  }));
  const passedChecks = groupedIssues.filter((issue) => issue.status === 'pass');
  const visibleReviewGroups = reviewGroups.filter((group) =>
    statusFilter === 'all' ? group.issues.length > 0 : group.id === statusFilter
  );

  const openReviewGroup = (status: ReviewStatus) => {
    setStatusFilter(status);
    requestAnimationFrame(() => {
      const heading = document.getElementById(`review-${status}`);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'start' });
    });
  };

  const handleDecisionSaved = (updated: GroupedUXIssue) => {
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
  };

  const filteredIssues = (currentRun?.groupedIssues || []).filter((issue) => statusFilter === 'all' || issue.status === statusFilter);
  const currentFixtureDef = currentRun?.fixtureId ? FIXTURES.find((f) => f.id === currentRun.fixtureId) : undefined;
  const pendingFixtureId = pendingTarget.startsWith('fixture://') ? pendingTarget.replace('fixture://', '') : undefined;
  const pendingFixtureDef = pendingFixtureId ? FIXTURES.find((f) => f.id === pendingFixtureId) : undefined;

  const fixtureShortCode = currentFixtureDef
    ? (currentFixtureDef.name.includes(':') ? currentFixtureDef.name.split(':')[0].trim() : currentFixtureDef.name)
    : (currentRun?.codeVersion ? `HTML Component (${currentRun.codeVersion})` : currentRun?.targetUrl || 'Audit');

  const displayTarget = currentRun
    ? (currentFixtureDef ? `${currentFixtureDef.name} (Sample UI)` : currentRun.codeVersion ? `HTML Component (${currentRun.codeVersion})` : currentRun.targetUrl)
    : (pendingFixtureDef ? `${pendingFixtureDef.name} (Sample UI)` : pendingTarget.startsWith('snippet://') ? 'HTML / CSS Component' : pendingTarget);

  return (
    <div className={`application-shell min-h-screen bg-zinc-50/50 text-zinc-950 font-sans antialiased${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NavigationRail
        isOpen={drawerOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setDrawerOpen(false)}
        onToggleCollapse={handleToggleSidebar}
        currentRun={currentRun}
        isUnsavedRun={isUnsavedRun}
        triggerRef={menuButtonRef}
      />

      <div className="workspace">
        <TopBar
          menuButtonRef={menuButtonRef}
          onOpenNavigation={handleToggleSidebar}
          target={displayTarget}
          status={auditStatus}
          isSidebarCollapsed={sidebarCollapsed}
        />
        <div className="workspace-content max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8" inert={drawerOpen ? true : undefined} aria-hidden={drawerOpen ? true : undefined}>
          <main id="main-content" tabIndex={-1} className="outline-none space-y-6">
            <header className="page-intro pb-4 border-b border-zinc-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-900">ProofUI Audit PoC</h1>
                  <span className="text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded-full">v1.0</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Deterministic accessibility measurements and evidence collection. Checks selected WCAG criteria.
                </p>
              </div>
            </header>

            {/* Run Results Header Banner when viewing an audit */}
            {currentRun && (
              <div
                id="audit-run-banner"
                className="audit-run-banner rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 break-all">
                      {fixtureShortCode} · Audit completed
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <Icon name="CheckCircle2" size={12} />
                      Audit completed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-zinc-600">
                    <button
                      type="button"
                      onClick={() => openReviewGroup('candidateFail')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      {currentRun.summary.candidateFailCount} Candidate fail
                    </button>
                    <span className="text-zinc-300">·</span>
                    <button
                      type="button"
                      onClick={() => openReviewGroup('needsReview')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      {currentRun.summary.needsReviewCount} Needs review
                    </button>
                    <span className="text-zinc-300">·</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 font-semibold">
                      {currentRun.summary.passCount} Pass
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    id="new-audit-button"
                    onClick={() => setShowAuditForm((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all border shadow-2xs ${showAuditForm
                      ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    aria-expanded={showAuditForm}
                    aria-controls="audit-setup-section"
                  >
                    <Icon name={showAuditForm ? 'ChevronUp' : 'Plus'} size={13} />
                    <span>{showAuditForm ? 'Hide setup form' : 'New audit'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inline Setup Form ONLY when no audit run exists */}
            {!currentRun && (
              <div id="audit-setup-section" className="audit-setup-section space-y-4">
                <AuditInput
                  onRunAudit={handleRunAudit}
                  onTargetChange={handleTargetChange}
                  onValidationStateChange={setHasInputValidationError}
                  isLoading={isLoading}
                  error={error}
                />
              </div>
            )}

            {/* Modal Dialog for New Audit when viewing an existing audit run (does not push evidence down) */}
            {currentRun && (
              <div
                className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/50 backdrop-blur-xs ${showAuditForm ? 'flex' : 'hidden'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-audit-modal-title"
                aria-hidden={!showAuditForm}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowAuditForm(false);
                }}
              >
                <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-zinc-200 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <div>
                      <h2 id="new-audit-modal-title" className="text-base font-bold text-zinc-900">
                        Configure new audit
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Select a fixture or enter a target URL with product context to run a new audit.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuditForm(false)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      aria-label="Close setup modal"
                    >
                      <Icon name="X" size={18} />
                    </button>
                  </div>

                  <div id="audit-setup-section" className={`audit-setup-section ${showAuditForm ? 'block' : 'hidden'}`}>
                    <AuditInput
                      currentContext={currentRun ? currentRun.productContext : undefined}
                      currentFixtureId={currentRun ? currentRun.fixtureId : undefined}
                      onRunAudit={async (target, context, autoDetect, html) => {
                        setShowAuditForm(false);
                        await handleRunAudit(target, context, autoDetect, html);
                      }}
                      onTargetChange={handleTargetChange}
                      onValidationStateChange={setHasInputValidationError}
                      isLoading={isLoading}
                      error={error}
                    />
                  </div>
                </div>
              </div>
            )}

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
                  runId={isUnsavedRun ? undefined : currentRun.id}
                  fixtureId={currentRun.fixtureId}
                />
                {isUnsavedRun && (
                  <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Unsaved run.</strong> The measurements are available for this visit. Run the audit again to save a new result.
                  </p>
                )}

                <PilotMetricEvidence results={currentRun.metricResults} />

                {/* Designer Visual Canvas Overlay */}
                <VisualCanvasOverlay
                  currentRun={currentRun}
                  readOnly={isUnsavedRun}
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
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${isActive
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                          }`}
                      >
                        <span>{filter.label}</span>
                        <strong
                          className={`text-[11px] font-mono font-medium px-1.5 py-0.2 rounded-full ${isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                            }`}
                        >
                          ({filter.count})
                        </strong>
                      </button>
                    );
                  })}
                </div>

                {visibleReviewGroups.length === 0 && passedChecks.length === 0 && (
                  <div className="filter-empty flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs" role="status">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-600 border border-zinc-200">
                      <Icon name="CheckCircle2" size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">No items match this filter</h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Choose another status filter to return to the visible evidence.
                      </p>
                    </div>
                  </div>
                )}

                {statusFilter !== 'pass' && visibleReviewGroups.map(({ id, label, issues }) => (
                  <section key={id} aria-labelledby={`review-${id}`} className="space-y-3">
                    <h3 id={`review-${id}`} tabIndex={-1} className="scroll-mt-24 text-sm font-semibold text-zinc-900 outline-none">
                      {label} ({issues.length})
                    </h3>
                    {issues.length === 0 ? (
                      <p className="text-sm text-zinc-600">No items with this status in the measured results.</p>
                    ) : (
                      <div className="issue-feed space-y-4">
                        {issues.map((issue) => (
                          <IssueCard
                            key={issue.fingerprint}
                            issue={issue}
                            runId={currentRun.id}
                            readOnly={isUnsavedRun}
                            onDecisionSaved={handleDecisionSaved}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                <details key={currentRun.id} className="rounded-xl border border-zinc-200 bg-white p-4" open={statusFilter === 'pass'}>
                  <summary className="cursor-pointer font-semibold text-zinc-900">Passed checks ({passedChecks.length})</summary>
                  <div className="issue-feed mt-4 space-y-4">
                    {passedChecks.length === 0 && <p className="text-sm text-zinc-600">No passed checks recorded in this run.</p>}
                    {passedChecks.map((check) => (
                      <IssueCard key={check.fingerprint} issue={check} runId={currentRun.id} readOnly={isUnsavedRun} />
                    ))}
                  </div>
                </details>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
