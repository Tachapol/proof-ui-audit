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

  return (
    <section className="audit-summary" aria-labelledby="audit-summary-title">
      <div className="summary-header">
        <div className="summary-context">
          <h3 id="audit-summary-title">Audit Result Summary</h3>
          {fixtureId ? (
            <>
              <p className="safe-wrap">
                <span>Fixture</span> <strong>{fixtureName} (<code>{fixtureId}</code>)</strong>
              </p>
              <p className="safe-wrap" style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                <span>Resolved URL</span> <code>{targetUrl}</code>
              </p>
            </>
          ) : (
            <p className="safe-wrap"><span>Target</span> <code>{targetUrl}</code></p>
          )}
          <p>Completed at {formattedDate}</p>
        </div>
        {runId && (
          <div className="export-actions" aria-label="Report exports">
            <button id="export-json-btn" type="button" onClick={() => handleExport('json')} disabled={exportState?.status === 'preparing'} aria-label="Export audit report as JSON"><Icon name="Download" size={16} /> JSON</button>
            <button id="export-markdown-btn" type="button" onClick={() => handleExport('markdown')} disabled={exportState?.status === 'preparing'} aria-label="Export audit report as Markdown"><Icon name="FileText" size={16} /> Markdown</button>
          </div>
        )}
      </div>

      <dl className="summary-strip">
        {metrics.map((metric) => <div key={metric.label} className={`summary-metric tone-${metric.tone}`}><dt>{metric.label}</dt><dd id={metric.id}>{metric.value}</dd></div>)}
      </dl>

      <div className="summary-footer">
        <p>P0–P3 is a project heuristic, not WCAG severity. Candidate failures are automated evidence, not confirmed conformance violations.</p>
        <div className={`export-status${exportState ? ` is-${exportState.status}` : ''}`} role="status" aria-live="polite" aria-atomic="true">
          {exportState && <><Icon name={exportState.status === 'completed' ? 'CheckCircle2' : exportState.status === 'failed' ? 'AlertTriangle' : 'LoaderCircle'} size={15} className={exportState.status === 'preparing' ? 'spin' : ''} /><span>{exportState.message}</span></>}
        </div>
      </div>
    </section>
  );
}
