'use client';

import React, { useEffect, useState } from 'react';
import { GroupedUXIssue, Priority, extractEvidenceMetrics } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';
import { OccurrenceList } from './OccurrenceList';
import { IssueReview } from './IssueReview';
import { DecisionLog } from './DecisionLog';
import { IterationProofView } from './IterationProofView';
import { getDefaultRecommendation } from '@/lib/audit/recommendation';
import { PRIORITY_METADATA, PRIORITY_DISCLAIMER } from '@/lib/audit/priority-engine';
import { describeTouchTargetPair, touchTargetSpacingStatusLabels, touchTargetViewportEvidence } from '@/lib/audit/touch-target-pair';

interface IssueCardProps {
  issue: GroupedUXIssue;
  runId: string;
  readOnly?: boolean;
  onDecisionSaved?: (updated: GroupedUXIssue) => void;
  onShowPair?: (fingerprint: string) => void;
}

export function IssueCard({ issue: initialIssue, runId, readOnly = false, onDecisionSaved, onShowPair }: IssueCardProps) {
  const [issue, setIssue] = useState<GroupedUXIssue>(initialIssue);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [customRecommendation, setCustomRecommendation] = useState<string>(
    issue.editedRecommendation || issue.aiRecommendation || issue.representative.aiRecommendation || ''
  );
  const [selectedPriority, setSelectedPriority] = useState<Priority>(
    issue.currentPriority === 'P0' ? 'P1' : 'P0'
  );
  const [activeAdjustment, setActiveAdjustment] = useState<'edit' | 'reprioritize' | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<boolean>(false);
  const [adjustmentSuccess, setAdjustmentSuccess] = useState<boolean>(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  // AI explanation state
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => { setIssue(initialIssue); }, [initialIssue]);

  const rep = issue.representative;
  const pairSummary = describeTouchTargetPair(issue);
  const isPassedCheck = issue.status === 'pass';
  const canReview = !isPassedCheck && !readOnly;
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
  const statusLabel = pairSummary ? touchTargetSpacingStatusLabels[issue.status]
    : rep.metric && isPassedCheck ? 'Project advisory checked' : statusConfig.label;

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

  const handleSaveAdjustment = async (action: 'edit' | 'reprioritize') => {
    if (adjustmentReason.trim().length < 3) {
      setAdjustmentError('A descriptive rationale (minimum 3 characters) is required.');
      return;
    }
    if (action === 'edit') {
      if (customRecommendation.trim().length < 3) {
        setAdjustmentError('A custom recommendation (minimum 3 characters) is required when editing scope.');
        return;
      }
      if (customRecommendation.trim() === currentEffectiveRec) {
        setAdjustmentError('Edited recommendation must differ from the current effective recommendation.');
        return;
      }
    }
    if (action === 'reprioritize' && selectedPriority === issue.currentPriority) {
      setAdjustmentError('Target priority must differ from the current effective priority.');
      return;
    }

    setIsSavingAdjustment(true);
    setAdjustmentError(null);
    setAdjustmentSuccess(false);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint: issue.fingerprint,
          decision: action,
          reason: adjustmentReason.trim(),
          newPriority: action === 'reprioritize' ? selectedPriority : undefined,
          editedRecommendation: action === 'edit' ? customRecommendation.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save decision.');
      }

      setIssue(data.updatedGroup);
      setAdjustmentSuccess(true);
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
      setTimeout(() => setAdjustmentSuccess(false), 3500);
    } catch (err: any) {
      setAdjustmentError(err.message || 'Error saving decision.');
    } finally {
      setIsSavingAdjustment(false);
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
      tabIndex={-1}
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
          {rep.title}{pairSummary && ` · ${pairSummary}`}
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
          Audit result: {statusLabel}
        </span>

        {pairSummary && <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">Project advisory</span>}

        <span
          title={`${PRIORITY_METADATA[issue.currentPriority]?.fullDescription || ''} (${PRIORITY_DISCLAIMER})`}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: priorityConfig.bg,
            color: priorityConfig.color,
            cursor: 'help',
          }}
        >
          {priorityConfig.label}
        </span>

        {!pairSummary && <span style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
          Viewport: {rep.viewport.width}px
        </span>}

        {(issue.designerDecision === 'edit' || issue.designerDecision === 'reprioritize') && (
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
            Last adjustment: {issue.designerDecision === 'edit' ? 'Edited recommendation' : 'Changed priority'}
          </span>
        )}
      </div>

      {pairSummary && (
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <ul aria-label="Pair measurements by viewport" className="space-y-1">
            {touchTargetViewportEvidence(issue).map(({ viewport, distance, overlap, needsReview }) => (
              <li key={`${viewport.width}×${viewport.height}`}>
                {viewport.width}×{viewport.height} · {distance} CSS px · {needsReview ? 'Needs review' : 'Pass'}{overlap && ' · Overlap'}
              </li>
            ))}
          </ul>
          {onShowPair && (
            <button type="button" className="rounded-md border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => onShowPair(issue.fingerprint)}>
              Show pair on Visual Canvas
            </button>
          )}
        </div>
      )}

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
          return (
            <div
              className={`issue-evidence-media screenshot-fallback${isPassedCheck ? ' screenshot-omitted-pass' : ''}`}
              role="img"
              aria-label={isPassedCheck ? `Screenshot not captured for this passed check on ${rep.selector}` : `No visual screenshot is available for ${rep.selector}`}
            >
              <Icon name="Info" size={18} />
              <div>
                <strong>{isPassedCheck ? 'No image was saved for this check.' : 'Screenshot unavailable'}</strong>
                <span>Measurements are available below. Run a new audit to capture fresh visual evidence.</span>
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
        {rep.metric && <p className="text-xs text-zinc-600">
          Project advisory · v{rep.metric.metricVersion} · {rep.metric.unit} · Execution: {rep.metric.executionStatus} · Applicability: {rep.metric.applicability}. No automatic WCAG failure.
        </p>}
        <p style={{ fontSize: '14px', color: 'var(--foreground)', lineHeight: 1.6 }}>
          {pairSummary ? 'Review the gaps between these controls against the 8 CSS px project advisory.' : rep.description}
        </p>
        {rep.exception && (
          <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
            <strong>Exception / Review Note:</strong> {rep.exception}
          </p>
        )}
        <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginTop: '4px' }}>
          <strong>Priority Rationale (Project Heuristic):</strong> {rep.priorityRationale}
          {issue.currentPriority !== issue.initialPriority && (
            <span className="ml-1 font-semibold text-amber-700">
              (Reprioritized by designer: {issue.initialPriority} → {issue.currentPriority})
            </span>
          )}
        </p>
      </div>

      {/* 5. AI Explanation & Fallback Section */}
      {canReview && <div
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
            disabled={isExplaining || !!rep.metric}
            title={rep.metric ? 'Pilot metrics use deterministic evidence and project advisory guidance. AI explanation is not enabled for these metrics.' : undefined}
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
            {rep.metric ? 'Deterministic pilot guidance' : isExplaining ? 'Generating...' : aiResult ? 'Regenerate Explanation' : 'Request Explanation'}
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

      </div>}
      {/* 5.5 Isolated Before/After Optimization Proof */}
      {canReview && <div className="iteration-proof-slot">
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
      </div>}

      {/* 6. Secondary Commands: Scope & Priority Adjustments */}
      {canReview && (
        <div className="secondary-commands-slot" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Scope &amp; Priority Adjustments
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                id={`decision-btn-edit-${issue.fingerprint}`}
                onClick={() => {
                  setActiveAdjustment((prev) => (prev === 'edit' ? null : 'edit'));
                  setAdjustmentError(null);
                  setAdjustmentSuccess(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                  activeAdjustment === 'edit'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <Icon name="Edit3" size={13} />
                <span>Edit Scope</span>
              </button>
              <button
                type="button"
                id={`decision-btn-reprioritize-${issue.fingerprint}`}
                onClick={() => {
                  setActiveAdjustment((prev) => (prev === 'reprioritize' ? null : 'reprioritize'));
                  setAdjustmentError(null);
                  setAdjustmentSuccess(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                  activeAdjustment === 'reprioritize'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <Icon name="Sliders" size={13} />
                <span>Reprioritize</span>
              </button>
            </div>
          </div>

          {activeAdjustment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              {activeAdjustment === 'reprioritize' && (
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

              {activeAdjustment === 'edit' && (
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
                  Adjustment Rationale (Required, min 3 chars)
                </label>
                <input
                  id={`reason-input-${issue.fingerprint}`}
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => {
                    setAdjustmentReason(e.target.value);
                    if (adjustmentError) setAdjustmentError(null);
                  }}
                  placeholder={
                    activeAdjustment === 'edit'
                      ? 'Explain why this recommendation or scope was edited...'
                      : 'Explain why the priority was adjusted...'
                  }
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id={`save-decision-btn-${issue.fingerprint}`}
                  onClick={() => handleSaveAdjustment(activeAdjustment)}
                  disabled={isSavingAdjustment || adjustmentReason.trim().length < 3}
                  style={{
                    background: adjustmentReason.trim().length >= 3 ? 'var(--accent)' : 'var(--border)',
                    color: adjustmentReason.trim().length >= 3 ? 'var(--accent-foreground)' : 'var(--foreground-muted)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: adjustmentReason.trim().length >= 3 ? 'pointer' : 'not-allowed',
                    minHeight: '44px',
                  }}
                >
                  {isSavingAdjustment ? 'Saving...' : 'Save Decision'}
                </button>

                {adjustmentSuccess && (
                  <span role="status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="Check" size={16} color="var(--success)" />
                    Decision saved to audit log
                  </span>
                )}

                {adjustmentError && (
                  <span role="alert" style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>
                    {adjustmentError}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Unified Finding Review & Disposition */}
      {canReview && !activeAdjustment && (
        <div className="unified-finding-review-slot" style={{ marginTop: '16px' }}>
          <IssueReview
            key={`${runId}:${issue.fingerprint}`}
            issue={issue}
            runId={runId}
            onSaved={(updated) => {
              setIssue(updated);
              if (onDecisionSaved) onDecisionSaved(updated);
            }}
          />
        </div>
      )}
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
        {(canReview || (issue.decisionHistory && issue.decisionHistory.length > 0)) && (
          <DecisionLog history={issue.decisionHistory || []} fingerprint={issue.fingerprint} />
        )}
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
