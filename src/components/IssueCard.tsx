'use client';

import React, { useState } from 'react';
import { GroupedUXIssue, DesignerDecision, Priority } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

interface IssueCardProps {
  issue: GroupedUXIssue;
  runId: string;
  onDecisionSaved?: (updated: GroupedUXIssue) => void;
}

export function IssueCard({ issue: initialIssue, runId, onDecisionSaved }: IssueCardProps) {
  const [issue, setIssue] = useState<GroupedUXIssue>(initialIssue);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeDecision, setActiveDecision] = useState<DesignerDecision | null>(
    issue.designerDecision || null
  );
  const [reason, setReason] = useState<string>(issue.designerReason || '');
  const [selectedPriority, setSelectedPriority] = useState<Priority>(issue.currentPriority);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const rep = issue.representative;

  // Status visual attributes
  const isExcluded = issue.status === 'pass' && !!rep.exception;
  const statusConfig = {
    pass: {
      label: isExcluded ? 'Excluded / Not Applicable' : 'Threshold Passed',
      bg: isExcluded ? 'var(--surface-subtle)' : 'var(--success-surface)',
      color: isExcluded ? 'var(--foreground-muted)' : 'var(--success)',
      icon: isExcluded ? ('HelpCircle' as const) : ('CheckCircle2' as const),
    },
    candidateFail: {
      label: 'Candidate Issue',
      bg: 'var(--danger-surface)',
      color: 'var(--danger)',
      icon: 'AlertTriangle' as const,
    },
    needsReview: {
      label: 'Requires Designer Review',
      bg: 'var(--warning-surface)',
      color: 'var(--warning)',
      icon: 'HelpCircle' as const,
    },
  }[issue.status];

  // Priority visual attributes
  const priorityConfig = {
    P0: { label: 'P0 — Critical', color: '#b42318', bg: '#fef3f2' },
    P1: { label: 'P1 — High', color: '#b54708', bg: '#fffaeb' },
    P2: { label: 'P2 — Medium', color: '#175cd3', bg: '#eff8ff' },
    P3: { label: 'P3 — Low', color: '#475467', bg: '#f2f4f7' },
  }[issue.currentPriority];

  const handleSaveDecision = async (decisionToSave: DesignerDecision) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint: issue.fingerprint,
          decision: decisionToSave,
          reason,
          newPriority: decisionToSave === 'reprioritize' ? selectedPriority : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save decision.');
      }

      setIssue(data.updatedGroup);
      setActiveDecision(decisionToSave);
      setSaveSuccess(true);
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving decision.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 1. Plain-Language Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--foreground)' }}>
          {rep.title}
        </h3>
        {issue.rawOccurrencesCount > 1 && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-subtle)',
              color: 'var(--foreground-muted)',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            {issue.rawOccurrencesCount} occurrences
          </span>
        )}
      </div>

      {/* 2. Status & Initial Priority Badges */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: statusConfig.bg,
            color: statusConfig.color,
          }}
        >
          <Icon name={statusConfig.icon} size={14} color={statusConfig.color} />
          {statusConfig.label}
        </span>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: priorityConfig.bg,
            color: priorityConfig.color,
          }}
        >
          {priorityConfig.label}
        </span>

        <span style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
          Viewport: {rep.viewport.width}px
        </span>

        {issue.designerDecision && (
          <span
            className="decision-badge"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-subtle)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
            }}
          >
            Decision: {issue.designerDecision}
          </span>
        )}
      </div>

      {issue.designerReason && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '13px' }}>
          <strong>Saved Designer Rationale:</strong> {issue.designerReason}
        </div>
      )}

      {/* 3. Screenshot & Bounding Box Evidence */}
      {rep.screenshotPath && (
        <div style={{ marginTop: '16px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-subtle)', maxWidth: '400px' }}>
          <img
            src={rep.screenshotPath}
            alt={`Rendered evidence for ${rep.selector}`}
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* 4. Concise Explanation */}
      <div style={{ marginTop: '16px' }}>
        <p style={{ fontSize: '14px', color: 'var(--foreground)', lineHeight: 1.6 }}>
          {rep.description}
        </p>
        {rep.exception && (
          <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
            <strong>Exception / Review Note:</strong> {rep.exception}
          </p>
        )}
        <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
          <strong>Priority Rationale:</strong> {rep.priorityRationale}
        </p>
      </div>

      {/* 5. Suggested Recommendation */}
      <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {rep.aiRecommendation ? 'AI Advisory Recommendation' : 'Automated Rule Guidance'}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--foreground)', marginTop: '4px' }}>
          {rep.aiRecommendation ||
            (issue.status === 'candidateFail'
              ? `Increase the interactive target dimension to at least ${rep.expected.minWidth || 24}×${rep.expected.minHeight || 24} CSS px, or increase transparent padding to satisfy the WCAG spacing offset exception.`
              : 'Review whether this target qualifies for an inline sentence or equivalent control exception.')}
        </p>
      </div>

      {/* 6. Designer Decision Controls */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '10px' }}>
          UX/UI Designer Decision
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {(['accept', 'reject', 'edit', 'reprioritize'] as DesignerDecision[]).map((action) => {
            const isSelected = activeDecision === action;
            return (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setActiveDecision(action);
                  setSaveSuccess(false);
                }}
                disabled={isSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--surface)' : 'var(--surface-subtle)',
                  color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontSize: '13px',
                }}
              >
                {action === 'accept' && 'Accept Issue'}
                {action === 'reject' && 'Reject (False Positive)'}
                {action === 'edit' && 'Edit Scope'}
                {action === 'reprioritize' && 'Reprioritize'}
              </button>
            );
          })}
        </div>

        {activeDecision && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {activeDecision === 'reprioritize' && (
              <div>
                <label htmlFor={`priority-select-${issue.fingerprint}`} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-muted)' }}>
                  Select New Target Priority
                </label>
                <select
                  id={`priority-select-${issue.fingerprint}`}
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    marginLeft: '8px',
                    minHeight: '44px',
                  }}
                >
                  <option value="P0">P0 — Critical blocker</option>
                  <option value="P1">P1 — High priority</option>
                  <option value="P2">P2 — Medium priority</option>
                  <option value="P3">P3 — Low / backlog</option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor={`reason-input-${issue.fingerprint}`} style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--foreground-muted)' }}>
                Designer Rationale / Reason {activeDecision !== 'accept' ? '(Required)' : '(Optional)'}
              </label>
              <input
                id={`reason-input-${issue.fingerprint}`}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the UX rationale, context, or why this was adjusted..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  minHeight: '44px',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => handleSaveDecision(activeDecision)}
                disabled={isSaving}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                {isSaving ? 'Saving...' : 'Save Decision'}
              </button>

              {saveSuccess && (
                <span style={{ fontSize: '13px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="Check" size={16} color="var(--success)" />
                  Decision saved to audit log
                </span>
              )}

              {saveError && (
                <span style={{ fontSize: '13px', color: 'var(--danger)' }}>
                  {saveError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. Expandable Technical Evidence (Collapsed by Default) */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 0',
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '44px',
          }}
        >
          <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
          {isExpanded ? 'Hide Technical Evidence' : 'Expand Technical Evidence'}
        </button>

        {isExpanded && (
          <div style={{ marginTop: '12px', background: 'var(--surface-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Selector:</span>
                <code style={{ display: 'block', marginTop: '2px' }} className="safe-wrap">{rep.selector}</code>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Element & Role:</span>
                <div style={{ marginTop: '2px' }}><code>&lt;{rep.element}&gt;</code> (role: {rep.role || 'none'})</div>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Accessible Name:</span>
                <div style={{ marginTop: '2px' }}>{rep.accessibleName || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Measured Value:</span>
                <div style={{ marginTop: '2px' }}><code>{JSON.stringify(rep.measured)}</code></div>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Expected Threshold:</span>
                <div style={{ marginTop: '2px' }}><code>{JSON.stringify(rep.expected)}</code></div>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>WCAG Reference:</span>
                <div style={{ marginTop: '2px' }}>{rep.wcagCriterion}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Grouping Fingerprint:</span>
                <code style={{ display: 'block', marginTop: '2px' }} className="safe-wrap">{issue.fingerprint}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
