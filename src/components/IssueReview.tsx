'use client';

import React, { useEffect, useState } from 'react';
import {
  effectiveReviewDisposition, REVIEW_DISPOSITION_LABELS,
  type GroupedUXIssue, type ReviewDisposition,
} from '@/lib/schema/ux-issue';
import { Icon } from './Icon';

export function IssueReview({ issue, runId, onSaved, fixedDisposition }: {
  issue: GroupedUXIssue; runId: string; onSaved: (group: GroupedUXIssue) => void;
  fixedDisposition?: ReviewDisposition;
}) {
  const current = effectiveReviewDisposition(issue);
  const [disposition, setDisposition] = useState<ReviewDisposition>(current || 'needs_review');
  const [reason, setReason] = useState(issue.reviewReason || issue.designerReason || '');
  const [reviewer, setReviewer] = useState(issue.reviewer || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisposition(current || 'needs_review');
    setReason(issue.reviewReason || issue.designerReason || '');
    setReviewer(issue.reviewer || '');
    setError('');
  }, [issue.fingerprint, current, issue.reviewReason, issue.designerReason, issue.reviewer]);

  const prefix = `review-${issue.fingerprint}`;

  const handleSelectQuickDisposition = (targetDisp: ReviewDisposition) => {
    setDisposition(targetDisp);
    setSaved(false);
    setError('');
    if (!reviewer.trim()) {
      setReviewer('UX Reviewer');
    }
    if (targetDisp === 'confirmed_issue') {
      if (!reason.trim()) {
        setReason('Confirmed issue upon visual and evidence review');
      }
    } else if (targetDisp === 'false_positive') {
      if (reason === 'Confirmed issue upon visual and evidence review') {
        setReason('');
      }
    }
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    const targetDisp = fixedDisposition ?? disposition;
    const finalReason = reason.trim() || (targetDisp === 'confirmed_issue' ? 'Confirmed issue upon review' : '');
    const finalReviewer = reviewer.trim() || 'UX Reviewer';

    try {
      const response = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          fingerprint: issue.fingerprint,
          disposition: targetDisp,
          reason: finalReason,
          reviewer: finalReviewer,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.success !== true || result.updatedGroup?.fingerprint !== issue.fingerprint) {
        throw new Error(result?.error || 'Unable to save review.');
      }

      onSaved(result.updatedGroup);
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && reason.trim().length >= 3 && reviewer.trim().length >= 1;

  return (
    <form
      aria-label="Issue review"
      className="unified-issue-review space-y-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs"
      onSubmit={handleFormSubmit}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
        <h4 className="text-sm font-bold text-zinc-900">Finding Review &amp; Disposition</h4>
        <p className="text-xs text-zinc-600">
          Current review: <strong>{current ? REVIEW_DISPOSITION_LABELS[current] : 'Not reviewed'}</strong>
        </p>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Single unified record for this finding. Accepted Risk acknowledges a real issue left unfixed; False Positive marks the finding as incorrect.
      </p>

      {/* Quick Disposition Action Buttons */}
      {!fixedDisposition && (
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Finding disposition quick actions">
          <button
            type="button"
            id={`decision-btn-accept-${issue.fingerprint}`}
            onClick={() => handleSelectQuickDisposition('confirmed_issue')}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
              disposition === 'confirmed_issue'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <Icon name="CheckCircle2" size={13} />
            <span>Accept Issue</span>
          </button>

          <button
            type="button"
            id={`decision-btn-reject-${issue.fingerprint}`}
            onClick={() => handleSelectQuickDisposition('false_positive')}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
              disposition === 'false_positive'
                ? 'bg-rose-700 text-white border-rose-700 shadow-2xs'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <Icon name="X" size={13} />
            <span>Reject (False Positive)</span>
          </button>

          <button
            type="button"
            id={`decision-btn-needs_review-${issue.fingerprint}`}
            onClick={() => handleSelectQuickDisposition('needs_review')}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
              disposition === 'needs_review'
                ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <Icon name="HelpCircle" size={13} />
            <span>Needs Review</span>
          </button>

          <button
            type="button"
            id={`decision-btn-accepted_risk-${issue.fingerprint}`}
            onClick={() => handleSelectQuickDisposition('accepted_risk')}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
              disposition === 'accepted_risk'
                ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <Icon name="ShieldAlert" size={13} />
            <span>Accepted Risk</span>
          </button>
        </div>
      )}

      {fixedDisposition ? (
        <p className="text-xs">Save as <strong>{REVIEW_DISPOSITION_LABELS[fixedDisposition]}</strong></p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1" htmlFor={`${prefix}-status`}>
              Review status
            </label>
            <select
              id={`${prefix}-status`}
              value={disposition}
              disabled={saving}
              className="w-full min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
              onChange={(e) => handleSelectQuickDisposition(e.target.value as ReviewDisposition)}
            >
              {Object.entries(REVIEW_DISPOSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1" htmlFor={`${prefix}-reviewer`}>
              Reviewer / risk approver (self-reported)
            </label>
            <input
              id={`${prefix}-reviewer`}
              required
              maxLength={120}
              value={reviewer}
              disabled={saving}
              placeholder="e.g. Lead Designer"
              className="w-full min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
              onChange={(e) => { setReviewer(e.target.value); setSaved(false); }}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1" htmlFor={`reason-input-${issue.fingerprint}`}>
          Review rationale
        </label>
        <input
          type="text"
          id={`reason-input-${issue.fingerprint}`}
          aria-label="Review rationale"
          required
          minLength={3}
          maxLength={2000}
          value={reason}
          disabled={saving}
          placeholder="Document the review justification, visual inspection notes, or risk assessment..."
          className="w-full min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
          onChange={(e) => { setReason(e.target.value); setSaved(false); }}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          id={`save-decision-btn-${issue.fingerprint}`}
          disabled={!canSave}
          className="min-h-9 rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving review…' : fixedDisposition === 'accepted_risk' ? 'Save Accepted Risk' : 'Save issue review'}
        </button>

        {saved && (
          <div className="flex items-center gap-2">
            <span role="status" className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1">
              <Icon name="Check" size={14} />
              Issue review saved.
            </span>
            <span className="text-xs text-emerald-600 font-medium">Decision saved to audit log</span>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-700 font-medium">
            {error}
          </p>
        )}
      </div>

      {issue.reviewer && (
        <p className="text-[11px] text-zinc-400 pt-1">
          Last reviewer: {issue.reviewer} · {issue.reviewedAt ? new Date(issue.reviewedAt).toLocaleTimeString() : ''}
        </p>
      )}
    </form>
  );
}
