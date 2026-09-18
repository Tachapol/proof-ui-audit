'use client';

import React, { useState, useEffect } from 'react';
import { AuditInput } from '@/components/AuditInput';
import { AuditSummary } from '@/components/AuditSummary';
import { IssueCard } from '@/components/IssueCard';
import { AuditRun, GroupedUXIssue, AuditStatus } from '@/lib/schema/ux-issue';
import { Icon } from '@/components/Icon';

export default function HomePage() {
  const [currentRun, setCurrentRun] = useState<AuditRun | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AuditStatus>('all');

  // Reload verification for persisted runs & decisions (Item A.8)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const runId = params.get('runId');

    if (runId) {
      setIsLoading(true);
      fetch(`/api/audit?id=${runId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.run) {
            setCurrentRun(data.run);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, []);

  const handleRunAudit = async (target: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete audit.');
      }

      setCurrentRun(data.run);
      if (typeof window !== 'undefined' && data.run?.id) {
        window.history.replaceState(null, '', `?runId=${data.run.id}`);
        localStorage.setItem('proofui_last_run_id', data.run.id);
      }
    } catch (err: any) {
      setError(err.message || 'Audit execution error.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIssues = (currentRun?.groupedIssues || []).filter((issue) => {
    if (statusFilter === 'all') return true;
    return issue.status === statusFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Bar */}
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--foreground)' }}>
            ProofUI
          </span>
          <span style={{ fontSize: '13px', color: 'var(--foreground-muted)' }}>
            Audit PoC / Designer-in-the-Loop
          </span>
        </div>

        {currentRun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--foreground-muted)' }}>Target:</span>
            <code className="safe-wrap" style={{ maxWidth: '300px' }}>
              {currentRun.fixtureId ? `fixture://${currentRun.fixtureId}` : currentRun.targetUrl}
            </code>
          </div>
        )}
      </header>

      {/* Main Review Column */}
      <main style={{ maxWidth: '860px', width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1 }}>
        <section style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--foreground)' }}>
            ProofUI Audit PoC
          </h1>
          <h2 style={{ fontSize: '15px', fontWeight: 400, color: 'var(--foreground-muted)', marginTop: '4px' }}>
            Evidence-Based UX/UI Optimization with Designer-in-the-Loop Validation
          </h2>
        </section>

        {/* Audit Input Area */}
        <section style={{ marginBottom: '28px' }}>
          <AuditInput onRunAudit={handleRunAudit} isLoading={isLoading} error={error} />
        </section>

        {/* Audit Summary & Issues Feed */}
        {currentRun && (
          <section>
            <AuditSummary
              summary={currentRun.summary}
              targetUrl={currentRun.targetUrl}
              timestamp={currentRun.timestamp}
              runId={currentRun.id}
            />

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              {(
                [
                  { id: 'all', label: `All Issues (${currentRun.groupedIssues.length})` },
                  { id: 'candidateFail', label: `Candidate Fail (${currentRun.summary.candidateFailCount})` },
                  { id: 'needsReview', label: `Needs Review (${currentRun.summary.needsReviewCount})` },
                  { id: 'pass', label: `Pass (${currentRun.summary.passCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: statusFilter === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                    color: statusFilter === tab.id ? 'var(--foreground)' : 'var(--foreground-muted)',
                    fontWeight: statusFilter === tab.id ? 600 : 400,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    minHeight: '44px',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Issues Feed */}
            {filteredIssues.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <Icon name="CheckCircle2" size={32} color="var(--success)" />
                <p style={{ marginTop: '8px', fontWeight: 500 }}>No issues matching filter.</p>
              </div>
            ) : (
              <div>
                {filteredIssues.map((issue) => (
                  <IssueCard
                    key={issue.fingerprint}
                    issue={issue}
                    runId={currentRun.id}
                    onDecisionSaved={(updated) => {
                      setCurrentRun((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          groupedIssues: prev.groupedIssues.map((g) =>
                            g.fingerprint === updated.fingerprint ? updated : g
                          ),
                        };
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
