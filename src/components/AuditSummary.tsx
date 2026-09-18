'use client';

import React from 'react';
import { AuditSummary as AuditSummaryType } from '@/lib/schema/ux-issue';

interface AuditSummaryProps {
  summary: AuditSummaryType;
  targetUrl: string;
  timestamp: string;
}

export function AuditSummary({ summary, targetUrl, timestamp }: AuditSummaryProps) {
  const formattedDate = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--foreground-muted)', letterSpacing: '0.05em' }}>
            Audit Result Summary
          </span>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)', marginTop: '2px' }} className="safe-wrap">
            Target: <code>{targetUrl}</code>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--foreground-muted)' }}>
          Run completed at {formattedDate}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>Raw Findings</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>{summary.totalRawFindings}</div>
        </div>

        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>Grouped Issues</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>{summary.totalGroupedIssues}</div>
        </div>

        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-surface)', border: '1px solid rgba(180, 35, 24, 0.2)' }}>
          <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500 }}>Candidate Fail</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--danger)', marginTop: '4px' }}>{summary.candidateFailCount}</div>
        </div>

        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-surface)', border: '1px solid rgba(181, 71, 8, 0.2)' }}>
          <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 500 }}>Needs Review</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--warning)', marginTop: '4px' }}>{summary.needsReviewCount}</div>
        </div>

        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--success-surface)', border: '1px solid rgba(6, 118, 71, 0.2)' }}>
          <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>Pass</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--success)', marginTop: '4px' }}>{summary.passCount}</div>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginTop: '14px', fontStyle: 'italic' }}>
        Note: P0–P3 is a research project heuristic and not a severity scale defined by WCAG. Automated results do not establish complete WCAG conformance.
      </p>
    </div>
  );
}
