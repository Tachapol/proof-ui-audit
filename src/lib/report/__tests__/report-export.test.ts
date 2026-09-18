import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildNormalizedReport, STANDARD_DISCLAIMERS, KNOWN_LIMITATIONS } from '../report-builder';
import { generateJsonReport } from '../json-export';
import {
  generateMarkdownReport,
  escapeHtml,
  sanitizeFormula,
  sanitizeMarkdownProse,
  safeCodeFence,
  safeInlineCode,
} from '../markdown-export';
import { ReportModelSchema, sanitizePath } from '../report-schema';
import { AuditRun } from '@/lib/schema/ux-issue';
import { GET } from '@/app/api/export/route';
import { NextRequest } from 'next/server';
import * as db from '@/lib/storage/db';

function createMockRun(overrides?: Partial<AuditRun>): AuditRun {
  return {
    id: 'test-run-12345',
    targetUrl: 'http://localhost:3123/fixtures/all-rules',
    fixtureId: 'all-rules',
    timestamp: '2026-09-19T00:00:00.000Z',
    viewports: [
      { width: 375, height: 667 },
      { width: 1440, height: 900 },
      { width: 320, height: 568 },
    ],
    summary: {
      totalRawFindings: 5,
      totalGroupedIssues: 3,
      candidateFailCount: 1,
      needsReviewCount: 1,
      passCount: 1,
    },
    groupedIssues: [
      {
        fingerprint: 'fp-target-size',
        status: 'candidateFail',
        initialPriority: 'P1',
        currentPriority: 'P1',
        rawOccurrencesCount: 2,
        decisionHistory: [
          {
            id: 'dec-1',
            timestamp: '2026-09-19T00:05:00.000Z',
            action: 'edit',
            reason: 'Set explicit 24px padding',
            fromPriority: 'P1',
            toPriority: 'P1',
            originalRecommendation: 'Increase button size to 24px',
            previousRecommendation: 'Increase button size to 24px',
            editedRecommendation: 'Set padding: 8px 16px to reach 32px height',
          },
        ],
        designerDecision: 'edit',
        designerReason: 'Set explicit 24px padding',
        editedRecommendation: 'Set padding: 8px 16px to reach 32px height',
        aiExplanation: 'The button bounding box is 18x18px, failing the 24px minimum.',
        aiRecommendation: 'Increase button size to 24px',
        aiExplanationResult: {
          id: 'ai-rec-1',
          timestamp: '2026-09-19T00:04:00.000Z',
          provenance: 'gemini',
          isFallback: false,
          explanation: 'The button bounding box is 18x18px, failing the 24px minimum.',
          recommendation: 'Increase button size to 24px',
          uncertaintyNote: 'Applies unless inline exception holds.',
          requiresDesignerReview: false,
          evidenceFingerprint: 'fp-target-size',
        },
        aiGenerationHistory: [
          {
            id: 'ai-rec-1',
            timestamp: '2026-09-19T00:04:00.000Z',
            provenance: 'gemini',
            isFallback: false,
            explanation: 'The button bounding box is 18x18px, failing the 24px minimum.',
            recommendation: 'Increase button size to 24px',
            uncertaintyNote: 'Applies unless inline exception holds.',
            requiresDesignerReview: false,
            evidenceFingerprint: 'fp-target-size',
          },
        ],
        occurrences: [
          {
            id: 'occ-ts-1',
            ruleId: 'target-size',
            wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
            status: 'candidateFail',
            title: 'Interactive target smaller than 24x24px',
            description: 'Button is 18x18px',
            url: 'http://localhost:3123/fixtures/all-rules',
            viewport: { width: 375, height: 667 },
            selector: '#submit-btn',
            element: 'button',
            role: 'button',
            accessibleName: 'Submit',
            measured: { width: 18, height: 18 },
            expected: { minWidth: 24, minHeight: 24 },
            boundingBox: { x: 10, y: 10, width: 18, height: 18 },
            screenshotPath: '/Users/mysteriouz/Projects/proof-ui-audit/public/screenshots/ts-1.png',
            initialPriority: 'P1',
            priorityRationale: 'Primary interactive button below threshold',
          },
          {
            id: 'occ-ts-2',
            ruleId: 'target-size',
            wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
            status: 'candidateFail',
            title: 'Interactive target smaller than 24x24px',
            description: 'Button is 18x18px',
            url: 'http://localhost:3123/fixtures/all-rules',
            viewport: { width: 1440, height: 900 },
            selector: '#submit-btn',
            element: 'button',
            role: 'button',
            accessibleName: 'Submit',
            measured: { width: 18, height: 18 },
            expected: { minWidth: 24, minHeight: 24 },
            boundingBox: { x: 10, y: 10, width: 18, height: 18 },
            screenshotPath: '/Users/mysteriouz/Projects/proof-ui-audit/public/screenshots/ts-2.png',
            initialPriority: 'P1',
            priorityRationale: 'Primary interactive button below threshold',
          },
        ],
        representative: {
          id: 'occ-ts-1',
          ruleId: 'target-size',
          wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
          status: 'candidateFail',
          title: 'Interactive target smaller than 24x24px',
          description: 'Button is 18x18px',
          url: 'http://localhost:3123/fixtures/all-rules',
          viewport: { width: 375, height: 667 },
          selector: '#submit-btn',
          element: 'button',
          role: 'button',
          accessibleName: 'Submit',
          measured: { width: 18, height: 18 },
          expected: { minWidth: 24, minHeight: 24 },
          boundingBox: { x: 10, y: 10, width: 18, height: 18 },
          screenshotPath: '/Users/mysteriouz/Projects/proof-ui-audit/public/screenshots/ts-1.png',
          initialPriority: 'P1',
          priorityRationale: 'Primary interactive button below threshold',
        },
      },
      {
        fingerprint: 'fp-text-contrast',
        status: 'needsReview',
        initialPriority: 'P2',
        currentPriority: 'P2',
        rawOccurrencesCount: 1,
        decisionHistory: [],
        aiExplanation: 'Text background is a complex gradient.',
        aiRecommendation: 'Review visually with design tool.',
        aiExplanationResult: {
          id: 'ai-rec-2',
          timestamp: '2026-09-19T00:04:30.000Z',
          provenance: 'fallback',
          isFallback: true,
          fallbackReason: 'no_api_key',
          explanation: 'Text background is a complex gradient.',
          recommendation: 'Review visually with design tool.',
          uncertaintyNote: 'Gradient background requires visual inspection.',
          requiresDesignerReview: true,
          evidenceFingerprint: 'fp-text-contrast',
        },
        occurrences: [
          {
            id: 'occ-tc-1',
            ruleId: 'text-contrast',
            wcagCriterion: 'WCAG 1.4.3 Contrast (Minimum)',
            status: 'needsReview',
            title: 'Text over gradient background',
            description: 'Automated sampler cannot resolve multi-stop gradient',
            url: 'http://localhost:3123/fixtures/all-rules',
            viewport: { width: 1440, height: 900 },
            selector: '.hero-heading',
            element: 'h1',
            measured: { backgroundType: 'gradient' },
            expected: { contrastRatio: 4.5 },
            exception: 'gradient background',
            initialPriority: 'P2',
            priorityRationale: 'Hero text readability impact',
          },
        ],
        representative: {
          id: 'occ-tc-1',
          ruleId: 'text-contrast',
          wcagCriterion: 'WCAG 1.4.3 Contrast (Minimum)',
          status: 'needsReview',
          title: 'Text over gradient background',
          description: 'Automated sampler cannot resolve multi-stop gradient',
          url: 'http://localhost:3123/fixtures/all-rules',
          viewport: { width: 1440, height: 900 },
          selector: '.hero-heading',
          element: 'h1',
          measured: { backgroundType: 'gradient' },
          expected: { contrastRatio: 4.5 },
          exception: 'gradient background',
          initialPriority: 'P2',
          priorityRationale: 'Hero text readability impact',
        },
      },
      {
        fingerprint: 'fp-reflow',
        status: 'pass',
        initialPriority: 'P3',
        currentPriority: 'P3',
        rawOccurrencesCount: 1,
        decisionHistory: [],
        occurrences: [
          {
            id: 'occ-reflow-1',
            ruleId: 'reflow',
            wcagCriterion: 'WCAG 1.4.10 Reflow',
            status: 'pass',
            title: 'No 2D scrolling required at 320px',
            description: 'Page reflows within 320px without horizontal overflow',
            url: 'http://localhost:3123/fixtures/all-rules',
            viewport: { width: 320, height: 568 },
            selector: 'html',
            element: 'html',
            measured: { scrollWidth: 320, clientWidth: 320 },
            expected: { maxScrollWidth: 320 },
            initialPriority: 'P3',
            priorityRationale: 'Pass check',
          },
        ],
        representative: {
          id: 'occ-reflow-1',
          ruleId: 'reflow',
          wcagCriterion: 'WCAG 1.4.10 Reflow',
          status: 'pass',
          title: 'No 2D scrolling required at 320px',
          description: 'Page reflows within 320px without horizontal overflow',
          url: 'http://localhost:3123/fixtures/all-rules',
          viewport: { width: 320, height: 568 },
          selector: 'html',
          element: 'html',
          measured: { scrollWidth: 320, clientWidth: 320 },
          expected: { maxScrollWidth: 320 },
          initialPriority: 'P3',
          priorityRationale: 'Pass check',
        },
      },
    ],
    rawIssues: [
      {
        id: 'occ-ts-1',
        ruleId: 'target-size',
        wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
        status: 'candidateFail',
        title: 'Interactive target smaller than 24x24px',
        description: 'Button is 18x18px',
        url: 'http://localhost:3123/fixtures/all-rules',
        viewport: { width: 375, height: 667 },
        selector: '#submit-btn',
        element: 'button',
        role: 'button',
        accessibleName: 'Submit',
        measured: { width: 18, height: 18 },
        expected: { minWidth: 24, minHeight: 24 },
        boundingBox: { x: 10, y: 10, width: 18, height: 18 },
        screenshotPath: '/Users/mysteriouz/Projects/proof-ui-audit/public/screenshots/ts-1.png',
        initialPriority: 'P1',
        priorityRationale: 'Primary interactive button below threshold',
      },
      {
        id: 'occ-ts-2',
        ruleId: 'target-size',
        wcagCriterion: 'WCAG 2.5.8 Target Size (Minimum)',
        status: 'candidateFail',
        title: 'Interactive target smaller than 24x24px',
        description: 'Button is 18x18px',
        url: 'http://localhost:3123/fixtures/all-rules',
        viewport: { width: 1440, height: 900 },
        selector: '#submit-btn',
        element: 'button',
        role: 'button',
        accessibleName: 'Submit',
        measured: { width: 18, height: 18 },
        expected: { minWidth: 24, minHeight: 24 },
        boundingBox: { x: 10, y: 10, width: 18, height: 18 },
        screenshotPath: '/Users/mysteriouz/Projects/proof-ui-audit/public/screenshots/ts-2.png',
        initialPriority: 'P1',
        priorityRationale: 'Primary interactive button below threshold',
      },
      {
        id: 'occ-tc-1',
        ruleId: 'text-contrast',
        wcagCriterion: 'WCAG 1.4.3 Contrast (Minimum)',
        status: 'needsReview',
        title: 'Text over gradient background',
        description: 'Automated sampler cannot resolve multi-stop gradient',
        url: 'http://localhost:3123/fixtures/all-rules',
        viewport: { width: 1440, height: 900 },
        selector: '.hero-heading',
        element: 'h1',
        measured: { backgroundType: 'gradient' },
        expected: { contrastRatio: 4.5 },
        exception: 'gradient background',
        initialPriority: 'P2',
        priorityRationale: 'Hero text readability impact',
      },
      {
        id: 'occ-reflow-1',
        ruleId: 'reflow',
        wcagCriterion: 'WCAG 1.4.10 Reflow',
        status: 'pass',
        title: 'No 2D scrolling required at 320px',
        description: 'Page reflows within 320px without horizontal overflow',
        url: 'http://localhost:3123/fixtures/all-rules',
        viewport: { width: 320, height: 568 },
        selector: 'html',
        element: 'html',
        measured: { scrollWidth: 320, clientWidth: 320 },
        expected: { maxScrollWidth: 320 },
        initialPriority: 'P3',
        priorityRationale: 'Pass check',
      },
    ],
    ...overrides,
  };
}

describe('Report Export — Phase 6A', () => {
  it('builds a normalized report conforming to ReportModelSchema', () => {
    const run = createMockRun();
    const model = buildNormalizedReport(run, '2026-09-19T01:00:00.000Z');

    const validated = ReportModelSchema.parse(model);
    expect(validated.schemaVersion).toBe('1.0.0');
    expect(validated.audit.runId).toBe(run.id);
    expect(validated.summary.rawFindingCount).toBe(4);
    expect(validated.summary.groupedIssueCount).toBe(3);
    expect(validated.summary.candidateFailCount).toBe(1);
    expect(validated.summary.needsReviewCount).toBe(1);
    expect(validated.summary.passCount).toBe(1);
    expect(validated.summary.priorityCounts.P1).toBe(1);
    expect(validated.summary.priorityCounts.P2).toBe(1);
    expect(validated.summary.priorityCounts.P3).toBe(1);
    expect(validated.summary.priorityCounts.P0).toBe(0);
  });

  it('generates valid JSON report without internal absolute paths or secrets', () => {
    const run = createMockRun();
    const model = buildNormalizedReport(run);
    const jsonString = generateJsonReport(model);

    expect(() => JSON.parse(jsonString)).not.toThrow();
    const parsed = JSON.parse(jsonString);

    // Schema validation
    expect(ReportModelSchema.parse(parsed)).toBeDefined();

    // Absolute path sanitization check
    expect(jsonString).not.toContain('/Users/');
    expect(jsonString).not.toContain('/home/');
    expect(jsonString).not.toContain('C:\\');
    expect(parsed.groupedIssues[0].screenshotPath).toBe('/screenshots/ts-1.png');

    // Secrets check
    expect(jsonString).not.toContain('GEMINI_API_KEY');
  });

  it('generates Markdown report with all required sections and disclaimers', () => {
    const run = createMockRun();
    const model = buildNormalizedReport(run);
    const md = generateMarkdownReport(model);

    // 1. Report title
    expect(md).toContain('# ProofUI UX/UI Audit Report');

    // 2. Audit metadata
    expect(md).toContain('## Audit Metadata');
    expect(md).toContain(`\`${run.id}\``);

    // 3. Scope and disclaimers
    expect(md).toContain('## Scope and Disclaimers');
    for (const disclaimer of STANDARD_DISCLAIMERS) {
      expect(md).toContain(escapeHtml(disclaimer));
    }

    // 4. Summary counts
    expect(md).toContain('## Summary Counts');
    expect(md).toContain('Total Raw Occurrences | 4');
    expect(md).toContain('Unique Grouped Issues | 3');

    // 5. Candidate failures
    expect(md).toContain('## Candidate Failures');
    expect(md).toContain('Interactive target smaller than 24x24px');
    expect(md).toContain('`target-size`');

    // 6. Needs-review items
    expect(md).toContain('## Needs-Review Items');
    expect(md).toContain('Text over gradient background');

    // 7. Passed checks
    expect(md).toContain('## Passed Checks');
    expect(md).toContain('No 2D scrolling required at 320px');

    // 8. Designer decisions
    expect(md).toContain('## Designer Decisions');
    expect(md).toContain('`edit`');
    expect(md).toContain('Set explicit 24px padding');

    // 9. Decision history
    expect(md).toContain('## Decision History');
    expect(md).toContain('Set padding: 8px 16px to reach 32px height');

    // 10. AI / Fallback provenance
    expect(md).toContain('## AI / Fallback Provenance');
    expect(md).toContain('`gemini`');
    expect(md).toContain('`fallback`');

    // 11. Known limitations
    expect(md).toContain('## Known Limitations');
    for (const limit of KNOWN_LIMITATIONS) {
      expect(md).toContain(escapeHtml(limit));
    }
  });

  it('guarantees JSON and Markdown exports have consistent counts and decisions', () => {
    const run = createMockRun();
    const model = buildNormalizedReport(run);
    const json = JSON.parse(generateJsonReport(model));
    const md = generateMarkdownReport(model);

    // Run ID match
    expect(json.audit.runId).toBe(run.id);
    expect(md).toContain(run.id);

    // Summary counts match
    expect(md).toContain(`Total Raw Occurrences | ${json.summary.rawFindingCount}`);
    expect(md).toContain(`Unique Grouped Issues | ${json.summary.groupedIssueCount}`);
    expect(md).toContain(`Candidate Failures (\`candidateFail\`) | ${json.summary.candidateFailCount}`);
    expect(md).toContain(`Needs Human Review (\`needsReview\`) | ${json.summary.needsReviewCount}`);
    expect(md).toContain(`Passed Checks (\`pass\`) | ${json.summary.passCount}`);

    // Decisions match
    expect(json.groupedIssues[0].designerDecision).toBe('edit');
    expect(md).toContain('`edit`');
    expect(md).toContain(json.groupedIssues[0].editedRecommendation);
  });

  describe('Untrusted-content safety and injection defenses', () => {
    it('escapes raw HTML tags to prevent XSS in rendered Markdown viewers', () => {
      const escaped = escapeHtml('<script>alert(1)</script><img src=x onerror=alert(2)>');
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&lt;img');
    });

    it('neutralizes Markdown heading injection in user reasons and titles', () => {
      const injected = '# Fake Injected Heading\n## Subheading\nRegular comment';
      const sanitized = sanitizeMarkdownProse(injected);
      expect(sanitized).toBe('\\# Fake Injected Heading\n\\## Subheading\nRegular comment');
    });

    it('neutralizes horizontal rule injections', () => {
      const injected = '---\n=== Fake Header ===\n___';
      const sanitized = sanitizeMarkdownProse(injected);
      expect(sanitized).toBe('\\---\n\\=== Fake Header ===\n\\___');
    });

    it('neutralizes spreadsheet formula injection strings', () => {
      expect(sanitizeFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeFormula('+12345')).toBe("'+12345");
      expect(sanitizeFormula('-12345')).toBe("'-12345");
      expect(sanitizeFormula('@cmd')).toBe("'@cmd");
      expect(sanitizeFormula('Normal text')).toBe('Normal text');
    });

    it('safely fences selectors containing backticks without terminating the code fence', () => {
      const maliciousSelector = 'div[data-name="`malicious`"] > span';
      const fenced = safeCodeFence(maliciousSelector, 'css');
      expect(fenced).toMatch(/^````css\n/);
      expect(fenced).toMatch(/\n````$/);

      const extremeSelector = 'div[data-val="````evil````"]';
      const extremeFenced = safeCodeFence(extremeSelector, 'css');
      expect(extremeFenced).toMatch(/^`````css\n/);
      expect(extremeFenced).toMatch(/\n`````$/);
    });

    it('sanitizes absolute filesystem paths into safe relative paths', () => {
      expect(sanitizePath('/Users/alice/projects/app/public/screenshots/btn.png')).toBe('/screenshots/btn.png');
      expect(sanitizePath('C:\\Users\\bob\\Desktop\\screenshot.png')).toBe('/screenshots/screenshot.png');
      expect(sanitizePath('/screenshots/already-safe.png')).toBe('/screenshots/already-safe.png');
      expect(sanitizePath(undefined)).toBeUndefined();
    });
  });

  describe('Edge cases: missing optional fields and empty issues', () => {
    it('handles empty issues without crashing or invalid schema', () => {
      const emptyRun = createMockRun({
        summary: {
          totalRawFindings: 0,
          totalGroupedIssues: 0,
          candidateFailCount: 0,
          needsReviewCount: 0,
          passCount: 0,
        },
        groupedIssues: [],
        rawIssues: [],
      });

      const model = buildNormalizedReport(emptyRun);
      expect(model.summary.rawFindingCount).toBe(0);
      expect(model.summary.groupedIssueCount).toBe(0);

      const json = generateJsonReport(model);
      expect(JSON.parse(json).groupedIssues).toHaveLength(0);

      const md = generateMarkdownReport(model);
      expect(md).toContain('No candidate failures identified');
      expect(md).toContain('No items requiring manual designer review');
    });

    it('handles missing boundingBox and missing screenshotPath cleanly', () => {
      const run = createMockRun();
      delete (run.groupedIssues[0].representative as any).boundingBox;
      delete (run.groupedIssues[0].representative as any).screenshotPath;

      const model = buildNormalizedReport(run);
      expect(model.groupedIssues[0].boundingBox).toBeUndefined();
      expect(model.groupedIssues[0].screenshotPath).toBeUndefined();

      const json = generateJsonReport(model);
      expect(JSON.parse(json).groupedIssues[0].boundingBox).toBeUndefined();

      const md = generateMarkdownReport(model);
      expect(md).toBeDefined();
    });
  });

  describe('API Endpoint GET /api/export', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 400 for missing or malformed runId', async () => {
      const req = new NextRequest('http://localhost:3123/api/export?format=json');
      const res = await GET(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid export request');
    });

    it('returns 400 for path traversal characters in runId', async () => {
      const req = new NextRequest('http://localhost:3123/api/export?runId=../../etc/passwd&format=json');
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 for unsupported format', async () => {
      const req = new NextRequest('http://localhost:3123/api/export?runId=run-1&format=pdf');
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown runId', async () => {
      vi.spyOn(db, 'getAuditRun').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3123/api/export?runId=non-existent-run&format=json');
      const res = await GET(req);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Audit run 'non-existent-run' not found.");
    });

    it('returns 200 with JSON attachment and correct headers', async () => {
      const mockRun = createMockRun();
      vi.spyOn(db, 'getAuditRun').mockResolvedValue(mockRun);

      const req = new NextRequest('http://localhost:3123/api/export?runId=test-run-12345&format=json');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="proofui-audit-test-run-12345.json"');

      const bodyText = await res.text();
      const parsed = JSON.parse(bodyText);
      expect(parsed.audit.runId).toBe('test-run-12345');
    });

    it('returns 200 with Markdown attachment and correct headers', async () => {
      const mockRun = createMockRun();
      vi.spyOn(db, 'getAuditRun').mockResolvedValue(mockRun);

      const req = new NextRequest('http://localhost:3123/api/export?runId=test-run-12345&format=markdown');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="proofui-audit-test-run-12345.md"');

      const bodyText = await res.text();
      expect(bodyText).toContain('# ProofUI UX/UI Audit Report');
    });
  });
});
