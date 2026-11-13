'use client';

import { useEffect, useState } from 'react';
import {
  effectiveReviewDisposition, REVIEW_DISPOSITION_LABELS,
  type GroupedUXIssue, type ReviewDisposition,
} from '@/lib/schema/ux-issue';

export function IssueReview({ issue, runId, onSaved }: {
  issue: GroupedUXIssue; runId: string; onSaved: (group: GroupedUXIssue) => void;
}) {
  const current = effectiveReviewDisposition(issue);
  const [disposition, setDisposition] = useState<ReviewDisposition>(current || 'needs_review');
  const [reason, setReason] = useState(issue.reviewReason || '');
  const [reviewer, setReviewer] = useState(issue.reviewer || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDisposition(current || 'needs_review');
    setReason(issue.reviewReason || ''); setReviewer(issue.reviewer || ''); setError('');
  }, [issue.fingerprint, current, issue.reviewReason, issue.reviewer]);
  const prefix = `review-${issue.fingerprint}`;
  return (
    <form aria-label="Issue review" className="my-4 space-y-2 rounded-lg border border-zinc-200 p-3"
      onSubmit={async event => {
        event.preventDefault(); setSaving(true); setSaved(false); setError('');
        try {
          const response = await fetch('/api/decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ runId, fingerprint: issue.fingerprint, disposition, reason: reason.trim(), reviewer: reviewer.trim() }) });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save review.');
          onSaved(result.updatedGroup); setSaved(true);
        } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save review.'); }
        finally { setSaving(false); }
      }}>
      <h4 className="text-sm font-semibold">Issue review status</h4>
      <p className="text-xs">Current review: <strong>{current ? REVIEW_DISPOSITION_LABELS[current] : 'Not reviewed'}</strong></p>
      <p className="text-xs text-zinc-600">Accepted Risk acknowledges a real issue left unfixed. False Positive means the finding is incorrect. Review does not change automated evidence or accept a candidate fix.</p>
      <label className="block text-xs" htmlFor={`${prefix}-status`}>Review status</label>
      <select id={`${prefix}-status`} value={disposition} disabled={saving}
        className="min-h-11 w-full rounded border border-zinc-300 p-2 text-sm"
        onChange={event => { setDisposition(event.target.value as ReviewDisposition); setSaved(false); }}>
        {Object.entries(REVIEW_DISPOSITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="block text-xs" htmlFor={`${prefix}-reviewer`}>Reviewer / risk approver (self-reported)</label>
      <input id={`${prefix}-reviewer`} required maxLength={120} value={reviewer} disabled={saving}
        className="min-h-11 w-full rounded border border-zinc-300 p-2 text-sm"
        onChange={event => { setReviewer(event.target.value); setSaved(false); }} />
      <label className="block text-xs" htmlFor={`${prefix}-reason`}>Review rationale</label>
      <textarea id={`${prefix}-reason`} required minLength={3} maxLength={2000} value={reason} disabled={saving}
        className="w-full rounded border border-zinc-300 p-2 text-sm"
        onChange={event => { setReason(event.target.value); setSaved(false); }} />
      <button type="submit" disabled={saving || reason.trim().length < 3 || !reviewer.trim()}
        className="min-h-11 rounded border border-zinc-300 px-3 text-sm disabled:opacity-50">
        {saving ? 'Saving review…' : 'Save issue review'}
      </button>
      {issue.reviewer && <p className="text-xs">Last reviewer: {issue.reviewer} · {issue.reviewedAt}</p>}
      {saved && <p role="status" className="text-xs text-emerald-700">Issue review saved.</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
