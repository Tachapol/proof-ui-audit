'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';

interface NavigationRailProps {
  isOpen: boolean;
  onClose: () => void;
  currentRunId?: string;
  currentFixtureId?: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

interface RecentRunItem {
  id: string;
  targetUrl: string;
  fixtureId?: string;
  timestamp: string;
  summary: {
    candidateFailCount: number;
    needsReviewCount: number;
    passCount: number;
  };
}

export function NavigationRail({
  isOpen,
  onClose,
  currentRunId,
  currentFixtureId,
  triggerRef,
}: NavigationRailProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRunItem[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingRuns(true);
    fetch('/api/audit')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.runs)) {
          setRecentRuns(d.runs);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingRuns(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const controls = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, triggerRef]);

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    handleClose();

    if (target === '#audit-input') {
      const el = document.getElementById('audit-input');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === '#local-fixtures') {
      window.dispatchEvent(new CustomEvent('proofui:select-fixture-tab'));
      const el = document.getElementById('audit-input');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === '#visual-canvas-section') {
      const el =
        document.getElementById('visual-canvas-section') ||
        document.getElementById('audit-results') ||
        document.getElementById('audit-input');
      el?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === '#audit-results') {
      const el =
        document.getElementById('audit-results') ||
        document.getElementById('empty-state') ||
        document.getElementById('audit-input');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {isOpen && <button className="drawer-backdrop" aria-label="Close navigation drawer" onClick={handleClose} />}
      <aside
        ref={drawerRef}
        id="primary-navigation"
        className={`navigation-rail${isOpen ? ' is-open' : ''}`}
        aria-label="Primary navigation"
        aria-modal={isOpen ? 'true' : undefined}
        role={isOpen ? 'dialog' : undefined}
      >
        <div className="rail-brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div>
            <strong>ProofUI</strong>
            <span>Audit workspace</span>
          </div>
          <button ref={closeRef} className="icon-button rail-close" type="button" onClick={handleClose} aria-label="Close navigation drawer">
            <Icon name="X" size={19} />
          </button>
        </div>

        <nav aria-label="Audit workspace" className="rail-nav-links">
          <a
            className="rail-link"
            href="#audit-input"
            onClick={(e) => handleAnchorClick(e, '#audit-input')}
          >
            <Icon name="Target" size={17} />
            <div className="rail-link-text">
              <span>Target & Context</span>
              <small>Configure URL or Fixture</small>
            </div>
          </a>

          <a
            className="rail-link"
            href="#local-fixtures"
            onClick={(e) => handleAnchorClick(e, '#local-fixtures')}
          >
            <Icon name="FlaskConical" size={17} />
            <div className="rail-link-text">
              <span>Local Test Fixtures</span>
              <small>WCAG 2.2 benchmark suites</small>
            </div>
          </a>

          <a
            className={`rail-link ${!currentRunId ? 'is-disabled' : ''}`}
            href="#visual-canvas-section"
            aria-disabled={!currentRunId}
            onClick={(e) => {
              if (currentRunId) handleAnchorClick(e, '#visual-canvas-section');
            }}
          >
            <Icon name="Maximize2" size={17} />
            <div className="rail-link-text">
              <span>Visual Canvas</span>
              <small>{currentRunId ? 'Live overlay & Before/After' : 'Run audit to preview'}</small>
            </div>
          </a>

          <a
            className={`rail-link ${!currentRunId ? 'is-disabled' : ''}`}
            href="#audit-results"
            aria-disabled={!currentRunId}
            onClick={(e) => {
              if (currentRunId) handleAnchorClick(e, '#audit-results');
            }}
          >
            <Icon name="FileText" size={17} />
            <div className="rail-link-text">
              <span>Audit Findings</span>
              <small>{currentRunId ? 'Grouped evidence & decisions' : 'No audit results yet'}</small>
            </div>
          </a>

          <Link
            className="rail-link rail-studio-link"
            href={currentRunId ? `/studio?runId=${encodeURIComponent(currentRunId)}` : '/studio'}
            onClick={handleClose}
          >
            <Icon name="Users" size={17} />
            <div className="rail-link-text">
              <span>Critique Studio</span>
              <small>{currentRunId ? 'Deliberate this run with AI' : 'Multi-role AI round-table'}</small>
            </div>
            <Icon name="ArrowRight" size={14} className="ml-auto opacity-60" />
          </Link>
        </nav>

        <section className="rail-section rail-recent" aria-labelledby="recent-title">
          <div className="rail-section-header flex items-center justify-between pb-1">
            <h2 id="recent-title" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recent Audit Runs
            </h2>
            {recentRuns.length > 0 && (
              <span className="text-[10px] text-zinc-400 font-mono">{recentRuns.length} saved</span>
            )}
          </div>

          {isLoadingRuns ? (
            <div className="py-4 text-center text-xs text-zinc-400">Loading history…</div>
          ) : recentRuns.length > 0 ? (
            <div className="recent-runs-list">
              {recentRuns.slice(0, 8).map((run) => {
                const isSelected = run.id === currentRunId;
                const displayName = run.fixtureId ? `fixture://${run.fixtureId}` : run.targetUrl;
                let dateStr = '';
                try {
                  dateStr = new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch {
                  dateStr = '';
                }

                return (
                  <Link
                    key={run.id}
                    className={`recent-run-card ${isSelected ? 'is-current' : ''}`}
                    href={`/?runId=${encodeURIComponent(run.id)}`}
                    onClick={handleClose}
                  >
                    <div className="run-card-top flex items-center justify-between gap-2">
                      <span className="run-card-target truncate font-mono text-xs font-medium text-zinc-800" title={displayName}>
                        {displayName}
                      </span>
                      {dateStr && (
                        <span className="run-card-time text-[10px] text-zinc-400 shrink-0">
                          {dateStr}
                        </span>
                      )}
                    </div>

                    <div className="run-card-badges flex items-center gap-1.5 mt-1 text-[10px]">
                      {run.summary.candidateFailCount > 0 ? (
                        <span className="run-badge badge-fail text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded font-medium">
                          {run.summary.candidateFailCount} {run.summary.candidateFailCount === 1 ? 'fail' : 'fails'}
                        </span>
                      ) : (
                        <span className="run-badge badge-pass text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                          Pass
                        </span>
                      )}
                      {run.summary.needsReviewCount > 0 && (
                        <span className="run-badge badge-review text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                          {run.summary.needsReviewCount} review
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 py-4 text-center">No saved audit runs yet.</p>
          )}
        </section>
      </aside>
    </>
  );
}
