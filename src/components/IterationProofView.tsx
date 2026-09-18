'use client';

import React, { useState } from 'react';
import { IterationComparison } from '@/lib/schema/iteration';
import { DesignerDecision } from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

interface IterationProofViewProps {
  runId: string;
  fingerprint: string;
  initialComparison?: IterationComparison;
  isEligible: boolean; // Target Size candidateFail
  onComparisonUpdated?: (comparison: IterationComparison) => void;
}

export function IterationProofView({
  runId,
  fingerprint,
  initialComparison,
  isEligible,
  onComparisonUpdated,
}: IterationProofViewProps) {
  const [comparison, setComparison] = useState<IterationComparison | undefined>(initialComparison);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Final Decision state
  const [finalDecision, setFinalDecision] = useState<DesignerDecision | null>(
    comparison?.finalDesignerDecision || null
  );
  const [reason, setReason] = useState<string>(comparison?.finalDesignerReason || '');
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState(false);

  if (!isEligible && !comparison) {
    return null;
  }

  const handleLaunchPreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/iteration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint,
          overrideId: 'increase-target-size',
          approvalReason: 'Designer launched isolated iteration proof for 24px target size fix',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate isolated preview.');
      }

      setComparison(data.comparison);
      if (onComparisonUpdated) {
        onComparisonUpdated(data.comparison);
      }
    } catch (err: any) {
      setError(err.message || 'Error launching preview.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveFinalDecision = async (decision: DesignerDecision) => {
    if ((decision === 'reject' || decision === 'edit' || decision === 'reprioritize') && reason.trim().length < 3) {
      setError('Please provide a descriptive reason (at least 3 characters).');
      return;
    }

    setIsSavingDecision(true);
    setError(null);

    try {
      const res = await fetch('/api/iteration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint,
          finalDecision: decision,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record decision.');
      }

      setComparison(data.comparison);
      setFinalDecision(decision);
      setDecisionSuccess(true);
      if (onComparisonUpdated) {
        onComparisonUpdated(data.comparison);
      }
      setTimeout(() => setDecisionSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error recording final decision.');
    } finally {
      setIsSavingDecision(false);
    }
  };

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '16px',
        background: 'var(--surface-subtle)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="Sliders" size={16} color="var(--accent)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
            Isolated Before / After Optimization Proof
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
          Isolated preview — source unchanged
        </span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            marginBottom: '12px',
            background: 'var(--danger-surface)',
            color: 'var(--danger)',
            fontSize: '12px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Pre-launch state */}
      {!comparison ? (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            A predefined allowlisted CSS fix (<code>min-width: 24px; min-height: 24px;</code>) is available for this Target Size candidate failure. The override will run in an isolated browser context without touching fixture source files.
          </p>
          <button
            type="button"
            id={`launch-iteration-btn-${fingerprint}`}
            onClick={handleLaunchPreview}
            disabled={isGenerating}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isGenerating ? 'Running Isolated Preview...' : 'Approve & Launch Isolated Preview'}
          </button>
        </div>
      ) : (
        /* Step 2: Comparison Display */
        <div>
          {/* Plain language summary banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background:
                comparison.regressionResult === 'improved'
                  ? 'var(--success-surface)'
                  : comparison.regressionResult === 'regressed'
                  ? 'var(--danger-surface)'
                  : 'var(--surface)',
              border: `1px solid ${
                comparison.regressionResult === 'improved'
                  ? 'rgba(6, 118, 71, 0.2)'
                  : comparison.regressionResult === 'regressed'
                  ? 'rgba(180, 35, 24, 0.2)'
                  : 'var(--border)'
              }`,
            }}
          >
            <Icon
              name={
                comparison.regressionResult === 'improved'
                  ? 'CheckCircle2'
                  : comparison.regressionResult === 'regressed'
                  ? 'AlertTriangle'
                  : 'Info'
              }
              size={18}
              color={
                comparison.regressionResult === 'improved'
                  ? 'var(--success)'
                  : comparison.regressionResult === 'regressed'
                  ? 'var(--danger)'
                  : 'var(--foreground)'
              }
            />
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', minWidth: 0, overflowWrap: 'anywhere' }}>
              <strong>Result: [{comparison.regressionResult.toUpperCase()}]</strong> {comparison.plainLanguageSummary}
            </div>
          </div>

          {/* Desktop side-by-side / Mobile stacked comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: '14px',
              marginBottom: '14px',
            }}
          >
            {/* Baseline Card */}
            <div
              style={{
                background: 'var(--surface)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>Baseline</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger)' }}>
                  {comparison.baselineStatus.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '8px' }}>
                Measured: <strong>{String(comparison.baselineMeasurement.width)} × {String(comparison.baselineMeasurement.height)} px</strong>
              </div>
              {comparison.baselineScreenshotPath ? (
                <img
                  src={comparison.baselineScreenshotPath}
                  alt="Baseline target size visual evidence"
                  style={{ width: '100%', maxHeight: '140px', objectFit: 'contain', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
                />
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--foreground-muted)', background: 'var(--surface-subtle)' }}>
                  No baseline image
                </div>
              )}
            </div>

            {/* Candidate Card */}
            <div
              style={{
                background: 'var(--surface)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>Candidate Preview</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)' }}>
                  {comparison.candidateStatus.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '8px' }}>
                Measured: <strong>{String(comparison.candidateMeasurement.width)} × {String(comparison.candidateMeasurement.height)} px</strong>
              </div>
              {comparison.candidateScreenshotPath ? (
                <img
                  src={comparison.candidateScreenshotPath}
                  alt="Candidate preview target size visual evidence"
                  style={{ width: '100%', maxHeight: '140px', objectFit: 'contain', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
                />
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--foreground-muted)', background: 'var(--surface-subtle)' }}>
                  Candidate screenshot captured
                </div>
              )}
            </div>
          </div>

          {/* Technical Details Disclosure */}
          <details style={{ marginBottom: '14px', fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--foreground-muted)', fontWeight: 500, padding: '4px 0' }}>
              Technical Details & CSS Override
            </summary>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', maxWidth: '100%' }}>
              <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}><strong>Applied Override ID:</strong> <code style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{comparison.overrideId}</code></div>
              <div style={{ marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}><strong>Applied CSS:</strong> <code style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{comparison.appliedCss}</code></div>
              <div style={{ marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}><strong>Target Selector:</strong> <code style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{comparison.targetSelector}</code></div>
              <div style={{ marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                <strong>Measurement Delta:</strong> <code style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{JSON.stringify(comparison.measurementDelta)}</code>
              </div>
              <div style={{ marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                <strong>Approved At:</strong> {comparison.approvalTimestamp}
              </div>
            </div>
          </details>

          {/* Final Designer Decision Controls */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '8px' }}>
              Record Final Candidate Decision
            </div>

            {decisionSuccess && (
              <div style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '8px', fontWeight: 500 }}>
                ✓ Final decision saved to audit run.
              </div>
            )}

            {comparison.finalDesignerDecision ? (
              <div style={{ fontSize: '13px', color: 'var(--foreground)', background: 'var(--surface)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                Final Decision: <strong>{comparison.finalDesignerDecision.toUpperCase()}</strong>
                {comparison.finalDesignerReason && <span> — {comparison.finalDesignerReason}</span>}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Designer reason / notes for decision (required for reject/revision)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    marginBottom: '8px',
                    minHeight: '44px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    id={`accept-candidate-btn-${fingerprint}`}
                    onClick={() => handleSaveFinalDecision('accept')}
                    disabled={isSavingDecision}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Accept Candidate
                  </button>
                  <button
                    type="button"
                    id={`reject-candidate-btn-${fingerprint}`}
                    onClick={() => handleSaveFinalDecision('reject')}
                    disabled={isSavingDecision}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Reject Candidate
                  </button>
                  <button
                    type="button"
                    id={`edit-candidate-btn-${fingerprint}`}
                    onClick={() => handleSaveFinalDecision('edit')}
                    disabled={isSavingDecision}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Request Revision
                  </button>
                  <button
                    type="button"
                    id={`reprioritize-candidate-btn-${fingerprint}`}
                    onClick={() => handleSaveFinalDecision('reprioritize')}
                    disabled={isSavingDecision}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Reprioritize
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
