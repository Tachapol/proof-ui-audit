'use client';

import React, { useEffect, useState } from 'react';
import { GroupedUXIssue, DesignerDecision, Priority, extractEvidenceMetrics } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';
import { OccurrenceList } from './OccurrenceList';
import { IssueReview } from './IssueReview';
import { DecisionLog } from './DecisionLog';
import { IterationProofView } from './IterationProofView';
import { getDefaultRecommendation } from '@/lib/audit/recommendation';

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
  const [customRecommendation, setCustomRecommendation] = useState<string>(
    issue.editedRecommendation || issue.aiRecommendation || issue.representative.aiRecommendation || ''
  );
  const [selectedPriority, setSelectedPriority] = useState<Priority>(
    issue.currentPriority === 'P0' ? 'P1' : 'P0'
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI explanation state
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => { setIssue(initialIssue); }, [initialIssue]);

  const rep = issue.representative;
  const aiResult = issue.aiExplanationResult || rep.aiExplanationResult;

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

  const defaultGuidance =
    issue.aiRecommendation ||
    rep.aiRecommendation ||
    getDefaultRecommendation({
      ruleId: rep.ruleId,
      status: issue.status,
      element: rep.element,
      selector: rep.selector,
      exception: rep.exception,
      measured: rep.measured,
      expected: rep.expected,
    });

  const currentEffectiveRec =
    issue.editedRecommendation || issue.aiRecommendation || rep.aiRecommendation || defaultGuidance;

  const isReasonRequired = ['reject', 'edit', 'reprioritize'].includes(activeDecision || '');
  const isReasonValid = !isReasonRequired || reason.trim().length >= 3;
  const isEditDifferent =
    activeDecision !== 'edit' ||
    (customRecommendation.trim().length >= 3 && customRecommendation.trim() !== currentEffectiveRec);
  const isPriorityDifferent =
    activeDecision !== 'reprioritize' || selectedPriority !== issue.currentPriority;
  const canSave = isReasonValid && isEditDifferent && isPriorityDifferent && !isSaving;

  const handleSaveDecision = async (decisionToSave: DesignerDecision) => {
    if (!canSave) {
      if (!isReasonValid) {
        setSaveError(`A descriptive rationale (minimum 3 characters) is required for '${decisionToSave}'.`);
      } else if (activeDecision === 'edit') {
        if (customRecommendation.trim().length < 3) {
          setSaveError('A custom recommendation (minimum 3 characters) is required when editing scope.');
        } else if (customRecommendation.trim() === currentEffectiveRec) {
          setSaveError('Edited recommendation must differ from the current effective recommendation.');
        }
      } else if (activeDecision === 'reprioritize' && !isPriorityDifferent) {
        setSaveError('Target priority must differ from the current effective priority.');
      }
      return;
    }

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
          reason: reason.trim(),
          newPriority: decisionToSave === 'reprioritize' ? selectedPriority : undefined,
          editedRecommendation: decisionToSave === 'edit' ? customRecommendation.trim() : undefined,
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
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving decision.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestExplanation = async () => {
    setIsExplaining(true);
    setExplainError(null);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint: issue.fingerprint,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate explanation.');
      }

      setIssue(data.updatedGroup);
      if (!issue.editedRecommendation) {
        setCustomRecommendation(data.updatedGroup.aiRecommendation || '');
      }
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
    } catch (err: any) {
      setExplainError(err.message || 'Error generating explanation.');
    } finally {
      setIsExplaining(false);
    }
  };



  const fallbackReasonDescriptions: Record<string, string> = {
    no_api_key: 'Deterministic fallback (No Gemini API key configured)',
    provider_timeout: 'Deterministic fallback (Provider request timed out)',
    provider_error: 'Deterministic fallback (Provider service unavailable)',
    empty_response: 'Deterministic fallback (Empty model response)',
    malformed_json: 'Deterministic fallback (Malformed response syntax)',
    schema_validation_failed: 'Deterministic fallback (Schema validation rejected output)',
    grounding_failed: 'Deterministic fallback (Grounding checks rejected unsupported claims)',
  };

  return (
    <article
      id={`issue-card-${issue.fingerprint}`}
      className="issue-card"
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
        overflowWrap: 'break-word',
      }}
    >
      {/* 1. Plain-Language Title */}
      <div className="issue-title-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--foreground)' }}>
          {rep.title}
        </h3>
        {issue.rawOccurrencesCount > 1 && (
          <span
            className="occurrence-badge"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-subtle)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            {issue.rawOccurrencesCount} occurrences
          </span>
        )}
      </div>

      {/* 2. Status & Priority Badges */}
      <div className="issue-status-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
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

      {/* Transparent Occurrence Inspection */}
      <div className="issue-occurrences">
        <OccurrenceList occurrences={issue.occurrences} fingerprint={issue.fingerprint} />
      </div>

      {/* Saved Designer Rationale Notice */}
      {issue.designerReason && (
        <div className="issue-designer-note" style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '13px' }}>
          <strong style={{ color: 'var(--foreground)' }}>Saved Designer Rationale:</strong>{' '}
          <span style={{ color: 'var(--foreground)' }}>{issue.designerReason}</span>
        </div>
      )}

      {/* 3. Screenshot & Bounding Box Evidence */}
      {(() => {
        const screenshotUrl = rep.screenshotPath || issue.occurrences?.find((o) => o.screenshotPath)?.screenshotPath;
        if (!screenshotUrl) {
          const isPassedCheck = issue.status === 'pass';
          return (
            <div
              className={`issue-evidence-media screenshot-fallback${isPassedCheck ? ' screenshot-omitted-pass' : ''}`}
              role="img"
              aria-label={isPassedCheck ? `Screenshot not captured for this passed check on ${rep.selector}` : `No visual screenshot is available for ${rep.selector}`}
            >
              <Icon name="Info" size={18} />
              <div>
                <strong>{isPassedCheck ? 'Screenshot not captured for this passed check.' : 'Screenshot unavailable'}</strong>
                <span>Deterministic measurements remain available below.</span>
              </div>
            </div>
          );
        }
        return (
          <figure className="issue-evidence-media" style={{ marginTop: '16px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-subtle)', maxWidth: '400px' }}>
            <img
              src={screenshotUrl}
              alt={`Rendered evidence for ${rep.selector}`}
              loading="lazy"
              decoding="async"
              style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'contain' }}
            />
            <figcaption className="sr-only">Screenshot and bounding-box evidence</figcaption>
          </figure>
        );
      })()}

      {/* 4. Concise Deterministic Explanation */}
      <div className="deterministic-evidence" style={{ marginTop: '16px' }}>
        <div className="content-label">Deterministic evidence</div>
        <p style={{ fontSize: '14px', color: 'var(--foreground)', lineHeight: 1.6 }}>
          {rep.description}
        </p>
        {rep.exception && (
          <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
            <strong>Exception / Review Note:</strong> {rep.exception}
          </p>
        )}
        <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
          <strong>Priority Rationale (Project Heuristic):</strong> {rep.priorityRationale}
        </p>
      </div>

      {/* 5. AI Explanation & Fallback Section */}
      <div
        className="assisted-guidance"
        style={{
          marginTop: '16px',
          padding: '16px',
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              Assisted Explanation & Recommendation
            </span>

            {/* Provenance Label */}
            {aiResult ? (
              <span
                data-testid={`provenance-badge-${issue.fingerprint}`}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: aiResult.isFallback ? 'var(--surface)' : '#eff8ff',
                  color: aiResult.isFallback ? 'var(--foreground-muted)' : '#175cd3',
                  border: `1px solid ${aiResult.isFallback ? 'var(--border)' : '#b2ddff'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {aiResult.isFallback ? 'Deterministic Fallback' : aiResult.provenance === 'cpe' ? `AI-Generated (CPE · ${aiResult.model || 'LLM'})` : 'AI-Generated (Gemini)'}
              </span>
            ) : null}

            {issue.editedRecommendation && (
              <span
                data-testid={`designer-edit-badge-${issue.fingerprint}`}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#fef3f2',
                  color: '#b42318',
                  border: '1px solid #fecdca',
                }}
              >
                Designer-Edited Recommendation
              </span>
            )}
          </div>

          <button
            type="button"
            id={`explain-btn-${issue.fingerprint}`}
            data-testid={`explain-btn-${issue.fingerprint}`}
            onClick={handleRequestExplanation}
            disabled={isExplaining}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: isExplaining ? 'var(--surface-subtle)' : 'var(--surface)',
              color: 'var(--foreground)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isExplaining ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isExplaining ? 'Generating...' : aiResult ? 'Regenerate Explanation' : 'Request Explanation'}
          </button>
        </div>

        {explainError && (
          <div role="alert" style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '8px' }}>
            {explainError}
          </div>
        )}

        {/* Fallback reason description if fallback was used */}
        {aiResult?.isFallback && aiResult.fallbackReason && (
          <div
            data-testid={`fallback-reason-${issue.fingerprint}`}
            style={{
              fontSize: '12px',
              color: 'var(--foreground-muted)',
              marginBottom: '10px',
              fontStyle: 'italic',
            }}
          >
            {fallbackReasonDescriptions[aiResult.fallbackReason] || `Deterministic fallback (${aiResult.fallbackReason})`}
          </div>
        )}

        {/* Designer Review Warning or Uncertainty Note */}
        {(aiResult?.requiresDesignerReview || aiResult?.uncertaintyNote) && (
          <div
            data-testid={`uncertainty-callout-${issue.fingerprint}`}
            style={{
              background: '#fffaeb',
              border: '1px solid #fedf89',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#b54708',
            }}
          >
            <strong>Designer Review Warning:</strong>{' '}
            {aiResult.uncertaintyNote || 'Manual human verification is required before acting on this issue.'}
          </div>
        )}

        {/* Generated Explanation Content */}
        {aiResult?.explanation && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Explanation
            </div>
            <p
              data-testid={`ai-explanation-${issue.fingerprint}`}
              style={{ fontSize: '13px', color: 'var(--foreground)', marginTop: '2px', lineHeight: 1.5 }}
            >
              {aiResult.explanation}
            </p>
          </div>
        )}

        {/* Suggested Recommendation (With Edited Override Support) */}
        <div>
          {issue.editedRecommendation ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#175cd3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Icon name="Edit3" size={12} color="#175cd3" />
                Designer Custom Recommendation (Active)
              </div>
              <p
                data-testid={`active-recommendation-${issue.fingerprint}`}
                style={{ fontSize: '13px', color: 'var(--foreground)', marginTop: '4px', fontWeight: 500 }}
              >
                {issue.editedRecommendation}
              </p>
              <details style={{ marginTop: '8px', fontSize: '12px', color: 'var(--foreground-muted)' }}>
                <summary style={{ cursor: 'pointer' }}>View Original Automated / AI Guidance</summary>
                <p
                  data-testid={`archived-guidance-${issue.fingerprint}`}
                  style={{ marginTop: '4px', fontStyle: 'italic' }}
                >
                  {aiResult?.recommendation || defaultGuidance}
                </p>
              </details>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recommendation
              </div>
              <p
                data-testid={`active-recommendation-${issue.fingerprint}`}
                style={{ fontSize: '13px', color: 'var(--foreground)', marginTop: '2px', lineHeight: 1.5 }}
              >
                {aiResult?.recommendation || defaultGuidance}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 5.5 Isolated Before/After Optimization Proof */}
      <div className="iteration-proof-slot">
        <IterationProofView
          runId={runId}
          fingerprint={issue.fingerprint}
          initialComparison={issue.iterationComparison}
          isEligible={issue.representative.ruleId === 'target-size' && issue.status === 'candidateFail'}
          onComparisonUpdated={(updated) => {
            setIssue((prev) => ({ ...prev, iterationComparison: updated }));
            if (onDecisionSaved) onDecisionSaved({ ...issue, iterationComparison: updated });
          }}
        />
      </div>

      {/* 6. Designer Decision Controls */}
      <div className="designer-actions" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
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
                id={`decision-btn-${action}-${issue.fingerprint}`}
                onClick={() => {
                  setActiveDecision(action);
                  setSaveSuccess(false);
                  setSaveError(null);
                }}
                disabled={isSaving}
                aria-pressed={isSelected}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            {activeDecision === 'reprioritize' && (
              <div>
                <label htmlFor={`priority-select-${issue.fingerprint}`} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                  Target Priority (Project Heuristic)
                </label>
                <div className="priority-control-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <select
                    id={`priority-select-${issue.fingerprint}`}
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      minHeight: '44px',
                      fontSize: '13px',
                      background: 'var(--surface)',
                    }}
                  >
                    <option value="P0">P0 — Critical blocker</option>
                    <option value="P1">P1 — High priority</option>
                    <option value="P2">P2 — Medium priority</option>
                    <option value="P3">P3 — Low / backlog</option>
                  </select>
                  <span style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                    Note: P0–P3 is an internal research priority heuristic, not WCAG severity.
                  </span>
                </div>
              </div>
            )}

            {activeDecision === 'edit' && (
              <div>
                <label htmlFor={`custom-rec-${issue.fingerprint}`} style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '4px' }}>
                  Custom Recommendation / Scope (Required)
                </label>
                <textarea
                  id={`custom-rec-${issue.fingerprint}`}
                  value={customRecommendation}
                  onChange={(e) => setCustomRecommendation(e.target.value)}
                  placeholder="Define custom designer-authored recommendation..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            )}

            <div>
              <label htmlFor={`reason-input-${issue.fingerprint}`} style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--foreground)' }}>
                Designer Rationale / Reason {isReasonRequired ? '(Required)' : '(Optional)'}
              </label>
              <input
                id={`reason-input-${issue.fingerprint}`}
                type="text"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (saveError) setSaveError(null);
                }}
                placeholder={
                  activeDecision === 'reject'
                    ? 'Explain the UX rationale: why this finding is a false positive or acceptable exception...'
                    : activeDecision === 'edit'
                    ? 'Explain the UX rationale: why this scope or recommendation was edited...'
                    : activeDecision === 'reprioritize'
                    ? 'Explain the UX rationale: why the priority was adjusted...'
                    : 'Explain the UX rationale, context, or why this was accepted...'
                }
                aria-invalid={!isReasonValid && reason.length > 0 ? 'true' : 'false'}
                aria-describedby={!isReasonValid && reason.length > 0 ? `reason-error-${issue.fingerprint}` : undefined}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: !isReasonValid && reason.length > 0 ? '1px solid var(--danger)' : '1px solid var(--border)',
                  background: 'var(--surface)',
                  minHeight: '44px',
                  fontSize: '13px',
                }}
              />
              {isReasonRequired && reason.trim().length > 0 && reason.trim().length < 3 && (
                <span id={`reason-error-${issue.fingerprint}`} style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px', display: 'block' }}>
                  Rationale must be at least 3 characters.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                id={`save-decision-btn-${issue.fingerprint}`}
                onClick={() => handleSaveDecision(activeDecision)}
                disabled={isSaving || !canSave}
                style={{
                  background: canSave ? 'var(--accent)' : 'var(--border)',
                  color: canSave ? 'var(--accent-foreground)' : 'var(--foreground-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  minHeight: '44px',
                }}
              >
                {isSaving ? 'Saving...' : 'Save Decision'}
              </button>

              {saveSuccess && (
                <span role="status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="Check" size={16} color="var(--success)" />
                  Decision saved to audit log
                </span>
              )}

              {saveError && (
                <span role="alert" style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>
                  {saveError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. Expandable Technical Evidence (Collapsed by Default) */}
      <div className="technical-evidence" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
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
                <span style={{ color: 'var(--foreground-muted)' }}>Target URL:</span>
                <code style={{ display: 'block', marginTop: '2px' }} className="safe-wrap">{rep.url}</code>
              </div>
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
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Measured Evidence:</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {extractEvidenceMetrics(rep.ruleId, rep.measured, rep.expected).map((metric) => (
                    <div
                      key={metric.key}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border ${
                        metric.isViolation
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      <span className="font-semibold text-zinc-500">{metric.label}:</span>
                      <span className="font-mono">{metric.value}{metric.unit && !metric.value.includes(metric.unit) ? ` ${metric.unit}` : ''}</span>
                    </div>
                  ))}
                </div>
                <details className="mt-2 text-xs text-zinc-500">
                  <summary className="cursor-pointer hover:text-zinc-800">Raw measurement payload</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 font-mono text-[11px] text-zinc-800">
                    {JSON.stringify(rep.measured, null, 2)}
                  </pre>
                </details>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Expected Threshold:</span>
                <div style={{ marginTop: '2px' }} className="text-xs text-zinc-700 font-medium">
                  {typeof rep.expected?.thresholdDescription === 'string'
                    ? rep.expected.thresholdDescription
                    : JSON.stringify(rep.expected)}
                </div>
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

      {/* Append-Only Decision History Log */}
      <div className="decision-history-slot">
        <IssueReview issue={issue} runId={runId} onSaved={updated => {
          setIssue(updated); onDecisionSaved?.(updated);
        }} />
        <DecisionLog history={issue.decisionHistory || []} fingerprint={issue.fingerprint} />
      </div>

      {issue.aiGenerationHistory && issue.aiGenerationHistory.length > 1 && (
        <details className="generation-history-slot" data-testid={`generation-history-${issue.fingerprint}`}>
          <summary>AI generation history ({issue.aiGenerationHistory.length} records)</summary>
          <div className="history-list">
            {issue.aiGenerationHistory.map((record, index) => (
              <div key={record.id} data-testid={`generation-record-${issue.fingerprint}-${index}`} className="history-record">
                <div><strong>Record #{index + 1} ({record.isFallback ? 'Fallback' : 'Gemini'})</strong><span>{new Date(record.timestamp).toLocaleTimeString()}</span></div>
                <p><em>ID:</em> <code>{record.id}</code></p>
                <p><em>Explanation:</em> {record.explanation}</p>
                <p><em>Recommendation:</em> {record.recommendation}</p>
                {record.uncertaintyNote && <p><em>Uncertainty:</em> {record.uncertaintyNote}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
