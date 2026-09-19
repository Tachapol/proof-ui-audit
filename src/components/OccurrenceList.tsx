'use client';

import React, { useState } from 'react';
import { UXIssue } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

interface OccurrenceListProps {
  occurrences: UXIssue[];
  fingerprint: string;
}

export function OccurrenceList({ occurrences, fingerprint }: OccurrenceListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!occurrences || occurrences.length === 0) {
    return null;
  }

  const statusBadge = (status: UXIssue['status']) => {
    switch (status) {
      case 'candidateFail':
        return { label: 'Candidate Issue', bg: 'var(--danger-surface)', color: 'var(--danger)' };
      case 'needsReview':
        return { label: 'Requires Review', bg: 'var(--warning-surface)', color: 'var(--warning)' };
      case 'pass':
      default:
        return { label: 'Threshold Passed', bg: 'var(--success-surface)', color: 'var(--success)' };
    }
  };

  return (
    <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '10px' }}>
      <button
        type="button"
        id={`inspect-occurrences-btn-${fingerprint}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`occurrence-panel-${fingerprint}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '6px 0',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
        }}
      >
        <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={15} color="var(--accent)" />
        {isOpen ? 'Hide' : 'Inspect'} All {occurrences.length} Raw {occurrences.length === 1 ? 'Occurrence' : 'Occurrences'}
      </button>

      {isOpen && (
        <div
          id={`occurrence-panel-${fingerprint}`}
          role="region"
          aria-label={`Raw occurrences for issue ${fingerprint}`}
          style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {occurrences.map((occ, idx) => {
            const viewportLabel =
              occ.viewport.width === 320
                ? '320px Reflow'
                : occ.viewport.width === 375
                ? '375px Mobile'
                : occ.viewport.width === 1440
                ? '1440px Desktop'
                : `${occ.viewport.width}×${occ.viewport.height}px`;

            const badge = statusBadge(occ.status);
            const reviewOrExceptionReason: string | null =
              typeof occ.exception === 'string'
                ? occ.exception
                : typeof occ.measured?.unresolvedReason === 'string'
                ? occ.measured.unresolvedReason
                : null;

            return (
              <div
                key={occ.id || idx}
                data-occurrence-id={occ.id}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  fontSize: '12px',
                }}
              >
                {/* Header: Occurrence #, Viewport, and Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                      Occurrence #{idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: badge.bg,
                        color: badge.color,
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground-muted)',
                      fontWeight: 500,
                    }}
                  >
                    Viewport: {viewportLabel}
                  </span>
                </div>

                {/* Occurrence ID */}
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--foreground-muted)' }}>Occurrence ID: </span>
                  <code style={{ fontSize: '11px', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                    {occ.id}
                  </code>
                </div>

                {/* Evidence Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--foreground-muted)' }}>Selector:</span>
                    <code style={{ display: 'block', marginTop: '2px', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                      {occ.selector}
                    </code>
                  </div>

                  <div>
                    <span style={{ color: 'var(--foreground-muted)' }}>Measured:</span>
                    <div style={{ marginTop: '2px' }}>
                      <code style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(occ.measured)}
                      </code>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--foreground-muted)' }}>Expected:</span>
                    <div style={{ marginTop: '2px' }}>
                      <code style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(occ.expected)}
                      </code>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--foreground-muted)' }}>Bounding Box:</span>
                    <div style={{ marginTop: '2px' }}>
                      {occ.boundingBox ? (
                        <code>
                          {Math.round(occ.boundingBox.width)}×{Math.round(occ.boundingBox.height)} at ({Math.round(occ.boundingBox.x)}, {Math.round(occ.boundingBox.y)})
                        </code>
                      ) : (
                        <span style={{ color: 'var(--foreground-muted)', fontStyle: 'italic' }}>
                          None (document or off-screen flow)
                        </span>
                      )}
                    </div>
                  </div>

                  {reviewOrExceptionReason && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--foreground-muted)' }}>Exception / Review Reason:</span>
                      <div style={{ marginTop: '2px', color: 'var(--foreground)' }}>
                        {reviewOrExceptionReason}
                      </div>
                    </div>
                  )}

                  {/* Screenshot with Useful Accessible Name or Explicit Fallback */}
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    <span style={{ color: 'var(--foreground-muted)' }}>Screenshot: </span>
                    {occ.screenshotPath ? (
                      <div style={{ marginTop: '4px', maxWidth: '260px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <img
                          src={occ.screenshotPath}
                          alt={`Visual evidence screenshot for occurrence ${occ.id} (${occ.selector}) at ${viewportLabel}`}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: 'auto', maxHeight: '120px', objectFit: 'contain', display: 'block' }}
                        />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--foreground-muted)', fontStyle: 'italic', display: 'block', marginTop: '2px' }}>
                        No visual screenshot available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
