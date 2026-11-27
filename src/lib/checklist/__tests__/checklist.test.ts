import { describe, it, expect } from 'vitest';
import { buildBatchAuditReport, buildChecklistSummary } from '../aggregator';
import {
  applyDeterministicChecklistFixes,
  applyJsonPatchToHtml,
  buildFeedbackWorksheet,
} from '../auto-iterate';
import { runDeterministicPatchAntiGamingGuard, runVlmJudge } from '../vlm-judge';
import type { UXIssue } from '@/lib/schema/ux-issue';
import type { BatchPageAuditResult, ChecklistJsonPatch } from '../types';

describe('36-Metric UX/UI Checklist Aggregator & Patching', () => {
  it('groups metrics into 6 pillars (18 UX + 18 UI) and orders priorityList P0 -> P3', () => {
    const fakeIssues: UXIssue[] = [
      {
        id: 'issue-1',
        ruleId: 'text-contrast',
        wcagCriterion: '1.4.3',
        url: 'http://localhost/test',
        viewport: { width: 1280, height: 800 },
        selector: '#low-contrast',
        element: 'p',
        boundingBox: { x: 0, y: 0, width: 100, height: 20 },
        measured: { contrastRatio: 2.1 },
        expected: { minRatio: 4.5 },
        status: 'candidateFail',
        title: 'Low contrast',
        description: 'Contrast below threshold',
        initialPriority: 'P0',
        priorityRationale: 'P0',
      },
      {
        id: 'issue-2',
        ruleId: 'target-size',
        wcagCriterion: '2.5.8',
        url: 'http://localhost/test',
        viewport: { width: 1280, height: 800 },
        selector: '#tiny-btn',
        element: 'button',
        boundingBox: { x: 0, y: 0, width: 18, height: 18 },
        measured: { width: 18, height: 18 },
        expected: { minWidth: 24, minHeight: 24 },
        status: 'candidateFail',
        title: 'Small target',
        description: 'Target smaller than 24x24',
        initialPriority: 'P1',
        priorityRationale: 'P1',
      },
    ];

    const summary = buildChecklistSummary(fakeIssues, {
      'image-alt': {
        id: 'image-alt',
        status: 'fail',
        measuredSummary: '1 missing alt',
        affectedCount: 1,
        samples: ['img.hero'],
        recommendation: 'Add alt attribute',
      },
      'status-not-color-only': {
        id: 'status-not-color-only',
        status: 'notApplicable',
        measuredSummary: 'N/A (0 status/badge elements found)',
        affectedCount: 0,
        samples: [],
        recommendation: 'N/A',
      },
    });

    expect(summary.totalMetrics).toBe(35);
    expect(summary.totalNotApplicable).toBe(1);
    expect(summary.ux.total).toBe(18);
    expect(summary.ui.total).toBe(17);
    expect(summary.pillars).toHaveLength(6);
    expect(summary.totalPassed).toBe(32);
    expect(summary.priorityList.map((i) => i.id)).toEqual([
      'image-alt',
      'text-contrast',
      'target-size',
    ]);

    const { worksheet } = buildFeedbackWorksheet(summary.priorityList, {
      productGoal: 'Booking',
    });
    expect(worksheet.issues).toHaveLength(3);
    expect(worksheet.issues[0]).toMatchObject({
      metricId: 'image-alt',
      priority: 'P0',
      selector: 'img.hero',
    });
  });

  it('applies structured JSON patches, logs operations, and rejects broad global color overrides', () => {
    const baseHtml = `<!DOCTYPE html><html lang="en"><head><title>Booking</title></head><body><a href="#" class="nav">Stays</a><img src="/a.jpg"><button id="go">Go</button></body></html>`;
    const patch: ChecklistJsonPatch = {
      cssAdditions: [
        '#go { min-width: 24px; min-height: 24px; }',
        'p { color: #111827; }',
      ],
      attributePatches: [
        { metricId: 'valid-interactive-actions', selector: 'a[href="#"]', setAttributes: { href: '#main-content' } },
        { metricId: 'image-alt', selector: '.nonexistent', setAttributes: { alt: 'Missing' } },
      ],
      wrapMain: true,
    };
    const patched = applyJsonPatchToHtml(baseHtml, patch);

    expect(patched).toContain('href="#main-content"');
    expect(patched).toContain('<main id="main-content">');
    expect(patched).toContain('#go { min-width: 24px; min-height: 24px; }');
    expect(patched).not.toContain('p { color: #111827; }');
    expect((patch as any).operationLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'attribute', selector: 'a[href="#"]', status: 'applied', matchedCount: 1 }),
        expect.objectContaining({ op: 'attribute', selector: '.nonexistent', status: 'rejected', matchedCount: 0 }),
        expect.objectContaining({ op: 'css', status: 'rejected' }),
      ])
    );
  });

  it('applies conservative deterministic fallback without fabricating alt or link targets', () => {
    const fakeIssues: UXIssue[] = [
      {
        id: 'issue-ts',
        ruleId: 'target-size',
        wcagCriterion: '2.5.8',
        url: 'http://localhost/test',
        viewport: { width: 1280, height: 800 },
        selector: 'button',
        element: 'button',
        boundingBox: { x: 0, y: 0, width: 16, height: 16 },
        measured: { width: 16, height: 16 },
        expected: { minWidth: 24, minHeight: 24 },
        status: 'candidateFail',
        title: 'Small target',
        description: 'Too small',
        initialPriority: 'P1',
        priorityRationale: 'P1',
      },
    ];

    const summary = buildChecklistSummary(fakeIssues, {
      'document-metadata': {
        id: 'document-metadata',
        status: 'fail',
        measuredSummary: 'missing',
        affectedCount: 2,
        samples: [],
        recommendation: 'Add lang and title',
      },
      'image-alt': {
        id: 'image-alt',
        status: 'fail',
        measuredSummary: '1 missing',
        affectedCount: 1,
        samples: ['img'],
        recommendation: 'Add alt',
      },
    });

    const fixed = applyDeterministicChecklistFixes(
      '<div><img src="/a.png"><button>Go</button></div>',
      summary.priorityList
    );

    expect(fixed).toContain('<html lang="en">');
    expect(fixed).toContain('<title>ProofUI Audited Page</title>');
    expect(fixed).not.toContain('alt="Illustration"');
    expect(fixed).toContain('min-width: 24px; min-height: 24px;');
  });

  it('aggregates multi-page batch audits with worstPage and page_hint in feedback', () => {
    const homeSummary = buildChecklistSummary([], {});
    const checkoutSummary = buildChecklistSummary([], {
      'image-alt': {
        id: 'image-alt',
        status: 'fail',
        measuredSummary: '1 missing alt',
        affectedCount: 1,
        samples: ['img.card-logo'],
        recommendation: 'Add alt text',
      },
      'interactive-label': {
        id: 'interactive-label',
        status: 'fail',
        measuredSummary: '1 unlabeled button',
        affectedCount: 1,
        samples: ['button.submit'],
        recommendation: 'Add aria-label',
      },
    });

    const homeFb = buildFeedbackWorksheet(homeSummary.priorityList, undefined, undefined, 'index.html').worksheet;
    const checkoutFb = buildFeedbackWorksheet(checkoutSummary.priorityList, undefined, undefined, 'checkout.html').worksheet;

    const pages: BatchPageAuditResult[] = [
      {
        page: 'index.html',
        result: { bestIteration: 0, stopReason: 'audit_only', iterations: [] },
        summary: homeSummary,
        feedback: homeFb,
        durationMs: 120,
      },
      {
        page: 'checkout.html',
        result: { bestIteration: 0, stopReason: 'audit_only', iterations: [] },
        summary: checkoutSummary,
        feedback: checkoutFb,
        durationMs: 180,
      },
    ];

    const report = buildBatchAuditReport('Booking Site', pages, { productGoal: 'Hotel booking' });
    expect(report.totalPages).toBe(2);
    expect(report.completedPages).toBe(2);
    expect(report.aggregate.worstPage).toBe('checkout.html');
    expect(report.aggregate.minPassRate).toBe(checkoutSummary.passRate);
    expect(report.aggregate.totalFailed).toBe(2);
    expect(report.feedback.issues).toHaveLength(2);
    expect(report.feedback.issues.every((i) => i.page_hint === 'checkout.html')).toBe(true);
  });

  it('rejects rule-gaming patches, allows @media nav rules, and reports unavailable when VLM is absent', async () => {
    const hiddenCssGuard = runDeterministicPatchAntiGamingGuard({
      cssAdditions: ['.overflow-banner { display: none; }'],
      attributePatches: [],
    });
    expect(hiddenCssGuard.passed).toBe(false);

    const mediaNavGuard = runDeterministicPatchAntiGamingGuard({
      cssAdditions: ['@media (max-width: 768px) { .desktop-nav { display: none; } .mobile-menu-btn { display: inline-flex; } }'],
      attributePatches: [],
    });
    expect(mediaNavGuard.passed).toBe(true);

    const genericAltVerdict = await runVlmJudge({
      appliedPatch: {
        cssAdditions: [],
        attributePatches: [{ metricId: 'image-alt', selector: 'img.hero', setAttributes: { alt: 'image' } }],
      },
    });
    expect(genericAltVerdict.verdict).toBe('reject');
    expect(genericAltVerdict.guardPassed).toBe(false);
    expect(genericAltVerdict.visualScore).toBeUndefined();
    expect(genericAltVerdict.provider).toBe('deterministic-guard');

    const unavailableVerdict = await runVlmJudge({
      appliedPatch: {
        cssAdditions: ['button { min-height: 24px; }'],
        attributePatches: [{ metricId: 'image-alt', selector: 'img.hero', setAttributes: { alt: 'Tokyo skyline at sunset' } }],
      },
    });
    expect(unavailableVerdict.verdict).toBe('unavailable');
    expect(unavailableVerdict.guardPassed).toBe(true);
    expect(unavailableVerdict.visualScore).toBeUndefined();
    expect(unavailableVerdict.semanticPass).toBeUndefined();
  });
});
