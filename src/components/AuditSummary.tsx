'use client';

import React, { useState } from 'react';
import { AuditSummary as AuditSummaryType } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

import { FIXTURES } from '@/fixtures/fixture-registry';

interface AuditSummaryProps { summary: AuditSummaryType; targetUrl: string; timestamp: string; runId?: string; fixtureId?: string; }
type ExportState = { format: 'json' | 'markdown'; status: 'preparing' | 'completed' | 'failed'; message: string } | null;

export function AuditSummary({ summary, targetUrl, timestamp, runId, fixtureId }: AuditSummaryProps) {
  const [exportState, setExportState] = useState<ExportState>(null);
  const formattedDate = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const fixtureDef = fixtureId ? FIXTURES.find((f) => f.id === fixtureId) : undefined;
  const fixtureName = fixtureDef ? fixtureDef.name : fixtureId;

  const handleExport = async (format: 'json' | 'markdown') => {
    if (!runId || exportState?.status === 'preparing') return;
    setExportState({ format, status: 'preparing', message: `Preparing ${format === 'json' ? 'JSON' : 'Markdown'} report…` });
    try {
      const response = await fetch(`/api/export?runId=${encodeURIComponent(runId)}&format=${format}`);
      if (!response.ok) throw new Error('The report service could not prepare this export.');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const nameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = nameMatch?.[1] || `proofui-audit-${runId}.${format === 'json' ? 'json' : 'md'}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportState({ format, status: 'completed', message: `${format === 'json' ? 'JSON' : 'Markdown'} report downloaded.` });
    } catch (caught: unknown) {
      setExportState({ format, status: 'failed', message: caught instanceof Error ? caught.message : 'Export failed. Try again.' });
    }
  };

  const metrics = [
    { label: 'Raw findings', value: summary.totalRawFindings, id: 'summary-raw-findings-count', tone: 'neutral' },
    { label: 'Grouped issues', value: summary.totalGroupedIssues, tone: 'neutral' },
    { label: 'Pass', value: summary.passCount, tone: 'success' },
    { label: 'Candidate fail', value: summary.candidateFailCount, tone: 'danger' },
    { label: 'Needs review', value: summary.needsReviewCount, tone: 'warning' },
  ];

  const metricStyles: Record<string, { card: string; dt: string; dd: string }> = {
    neutral: {
      card: 'bg-zinc-50 border-zinc-200/80',
      dt: 'text-zinc-500',
      dd: 'text-zinc-900',
    },
    success: {
      card: 'bg-emerald-50/60 border-emerald-200/70',
      dt: 'text-emerald-700',
      dd: 'text-emerald-900',
    },
    danger: {
      card: 'bg-rose-50/60 border-rose-200/70',
      dt: 'text-rose-700',
      dd: 'text-rose-900',
    },
    warning: {
      card: 'bg-amber-50/60 border-amber-200/70',
      dt: 'text-amber-700',
      dd: 'text-amber-900',
    },
  };

  return (
    <section className="audit-summary rounded-xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5" aria-labelledby="audit-summary-title">
      <div className="summary-header flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-1">
        <div className="summary-context space-y-1">
          <h3 id="audit-summary-title" className="text-lg font-bold tracking-tight text-zinc-900">Audit Result Summary</h3>
          {fixtureId ? (
            <>
              <p className="safe-wrap text-xs text-zinc-600">
                <span className="font-medium text-zinc-500">Fixture: </span>
                <strong className="text-zinc-900">{fixtureName}</strong> <code className="text-zinc-500 text-[11px] bg-zinc-100 px-1 py-0.5 rounded">({fixtureId})</code>
              </p>
              <p className="safe-wrap text-xs text-zinc-500">
                <span className="font-medium text-zinc-500">Resolved URL: </span>
                <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/60 font-mono text-zinc-700">{targetUrl}</code>
              </p>
            </>
          ) : (
            <p className="safe-wrap text-xs text-zinc-600">
              <span className="font-medium text-zinc-500">Target: </span>
              <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/60 font-mono text-zinc-700">{targetUrl}</code>
            </p>
          )}
          <p className="text-xs text-zinc-400">Completed at {formattedDate}</p>
        </div>
        {runId && (
          <div className="export-actions flex items-center gap-2 shrink-0" aria-label="Report exports">
            <button
              id="export-json-btn"
              type="button"
              onClick={() => handleExport('json')}
              disabled={exportState?.status === 'preparing'}
              aria-label="Export audit report as JSON"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors shadow-xs disabled:opacity-50"
            >
              <Icon name="Download" size={14} /> JSON
            </button>
            <button
              id="export-markdown-btn"
              type="button"
              onClick={() => handleExport('markdown')}
              disabled={exportState?.status === 'preparing'}
              aria-label="Export audit report as Markdown"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors shadow-xs disabled:opacity-50"
            >
              <Icon name="FileText" size={14} /> Markdown
            </button>
          </div>
        )}
      </div>

      <dl className="summary-strip grid grid-cols-2 sm:grid-cols-5 gap-3">
        {metrics.map((metric) => {
          const style = metricStyles[metric.tone];
          return (
            <div
              key={metric.label}
              className={`summary-metric tone-${metric.tone} rounded-lg border p-3 text-center transition-all ${style.card}`}
            >
              <dt className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${style.dt}`}>
                {metric.label}
              </dt>
              <dd id={metric.id} className={`text-2xl font-bold tracking-tight ${style.dd}`}>
                {metric.value}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="summary-footer flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
        <p className="leading-relaxed">
          P0–P3 is a project heuristic, not WCAG severity. Candidate failures are automated evidence, not confirmed conformance violations.
        </p>
        <div className={`export-status${exportState ? ` is-${exportState.status}` : ''} shrink-0`} role="status" aria-live="polite" aria-atomic="true">
          {exportState && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${exportState.status === 'completed' ? 'text-emerald-700' : exportState.status === 'failed' ? 'text-rose-700' : 'text-zinc-600'}`}>
              <Icon name={exportState.status === 'completed' ? 'CheckCircle2' : exportState.status === 'failed' ? 'AlertTriangle' : 'LoaderCircle'} size={14} className={exportState.status === 'preparing' ? 'animate-spin' : ''} />
              <span>{exportState.message}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
