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
  const reviewEvent = current ? issue.decisionHistory.filter(event =>
    (event.action === 'review_disposition' && event.newDisposition === current) ||
    (event.action === 'accept' && current === 'confirmed_issue') ||
    (event.action === 'reject' && current === 'false_positive')
  ).at(-1) : undefined;
  const legacyReason = issue.designerDecision === 'accept' || issue.designerDecision === 'reject' ? issue.designerReason : undefined;
  const savedReason = issue.reviewReason ?? reviewEvent?.reason ?? legacyReason ?? '';
  const savedReviewer = issue.reviewer ?? reviewEvent?.reviewer ?? '';
  const [disposition, setDisposition] = useState<ReviewDisposition | ''>(current ?? '');
  const [reason, setReason] = useState(savedReason);
  const [reviewer, setReviewer] = useState(savedReviewer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisposition(current ?? '');
    setReason(savedReason);
    setReviewer(savedReviewer);
    setError('');
  }, [runId, issue.fingerprint, current, savedReason, savedReviewer]);

  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 3500);
    return () => clearTimeout(timeout);
  }, [saved]);

  const prefix = `review-${issue.fingerprint}`;

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetDisp = fixedDisposition ?? disposition;
    if (!targetDisp || saving) return;
    const finalReason = reason.trim();
    const finalReviewer = reviewer.trim();
    if (finalReason.length < 3 || !finalReviewer) {
      setError('Enter a reviewer name and a rationale of at least 3 characters.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError('');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && (fixedDisposition ? reason.trim().length >= 3 && reviewer.trim().length > 0 : Boolean(disposition));

  return (
    <form
      aria-label="Issue review"
      className="unified-issue-review space-y-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs"
      onSubmit={handleFormSubmit}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
        <h4 className="text-sm font-bold text-zinc-900">Reviewer decision</h4>
        <p className="text-xs text-zinc-600">
          Current review: <strong>{current ? REVIEW_DISPOSITION_LABELS[current] : 'Not reviewed'}</strong>
        </p>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Accepted Risk acknowledges a real issue left unfixed. False Positive marks the finding as incorrect.
      </p>

      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        {fixedDisposition ? (
          <p className="self-center text-xs">Save as <strong>{REVIEW_DISPOSITION_LABELS[fixedDisposition]}</strong></p>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1" htmlFor={`${prefix}-status`}>
              Review status
            </label>
            <select
              id={`${prefix}-status`}
              data-review-status
              required
              value={disposition}
              disabled={saving}
              className="w-full min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
              onChange={event => {
                setDisposition(event.target.value as ReviewDisposition | '');
                setSaved(false);
                setError('');
              }}
            >
              <option value="" disabled>Select a review status</option>
              {Object.entries(REVIEW_DISPOSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

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
            onChange={(e) => { setReviewer(e.target.value); setSaved(false); setError(''); }}
          />
        </div>
      </div>

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
          onChange={(e) => { setReason(e.target.value); setSaved(false); setError(''); }}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          id={`save-decision-btn-${issue.fingerprint}`}
          disabled={!canSave}
          className="min-h-9 rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving review…' : fixedDisposition === 'accepted_risk' ? 'Save Accepted Risk' : 'Save review'}
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
