'use client';

import React, { useState } from 'react';
import { DecisionRecord, REVIEW_DISPOSITION_LABELS } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

interface DecisionLogProps {
  history: DecisionRecord[];
  fingerprint: string;
}

export function DecisionLog({ history, fingerprint }: DecisionLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!history || history.length === 0) {
    return null;
  }

  const actionLabels: Record<string, { label: string; color: string; bg: string }> = {
    review_disposition: { label: 'Issue Review', color: '#175cd3', bg: '#eff8ff' },
    accept: { label: 'Accepted', color: 'var(--success)', bg: 'var(--success-surface)' },
    reject: { label: 'Rejected (False Positive)', color: 'var(--danger)', bg: 'var(--danger-surface)' },
    edit: { label: 'Scope Edited', color: '#175cd3', bg: '#eff8ff' },
    reprioritize: { label: 'Reprioritized', color: '#b54708', bg: '#fffaeb' },
  };

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
      <button
        type="button"
        id={`decision-history-btn-${fingerprint}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`decision-history-panel-${fingerprint}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '6px 0',
          color: 'var(--foreground-muted)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
        }}
      >
        <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={14} />
        Decision Audit Log ({history.length} {history.length === 1 ? 'event' : 'events'})
      </button>

      {isOpen && (
        <div
          id={`decision-history-panel-${fingerprint}`}
          role="region"
          aria-label={`Decision history for issue ${fingerprint}`}
          style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {history.map((record, idx) => {
            const conf = actionLabels[record.action] || {
              label: record.action,
              color: 'var(--foreground)',
              bg: 'var(--surface-subtle)',
            };

            return (
              <div
                key={record.id || idx}
                data-event-id={record.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: conf.bg,
                        color: conf.color,
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      {conf.label}
                    </span>

                    {record.previousState && record.newState && record.previousState !== record.newState && (
                      <span style={{ fontSize: '11px', color: 'var(--foreground-muted)' }}>
                        State: {record.previousState} → <strong style={{ color: 'var(--foreground)' }}>{record.newState}</strong>
                      </span>
                    )}

                    {record.fromPriority && record.toPriority && record.fromPriority !== record.toPriority && (
                      <span style={{ fontWeight: 500, color: 'var(--foreground-muted)' }}>
                        Priority: {record.fromPriority} → <strong style={{ color: 'var(--foreground)' }}>{record.toPriority}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--foreground-muted)' }}>
                    <span>{new Date(record.timestamp).toISOString()}</span>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginBottom: '4px' }}>
                  Event ID: <code style={{ wordBreak: 'break-all' }}>{record.id}</code>
                </div>

                {record.newDisposition && (
                  <p>Review: {record.previousDisposition ? REVIEW_DISPOSITION_LABELS[record.previousDisposition] : 'Not reviewed'} → {REVIEW_DISPOSITION_LABELS[record.newDisposition]}</p>
                )}
                {record.reviewer && <p>Reviewer (self-reported): {record.reviewer}</p>}
                {record.reason && (
                  <div style={{ color: 'var(--foreground)', marginTop: '4px', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--foreground-muted)' }}>Rationale:</strong> {record.reason}
                  </div>
                )}

                {record.editedRecommendation && (
                  <div style={{ marginTop: '6px', padding: '6px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    {record.previousRecommendation && (
                      <div style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginBottom: '2px' }}>
                        <strong>Previous:</strong> {record.previousRecommendation}
                      </div>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#175cd3' }}>
                      Edited Recommendation:
                    </span>
                    <p style={{ margin: '2px 0 0 0', color: 'var(--foreground)', lineHeight: 1.4 }}>
                      {record.editedRecommendation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
