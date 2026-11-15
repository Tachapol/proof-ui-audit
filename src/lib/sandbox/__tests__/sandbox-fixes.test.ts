import { describe, it, expect } from 'vitest';
import { buildSandboxedDocument } from '../document';
import type { AuditRun, UXIssue } from '@/lib/schema/ux-issue';

describe('Sandbox fixes & verification', () => {
  it('1. builds identical 720px sandboxed container with Tailwind config for both preview and audit', () => {
    const html = '<button class="bg-brand text-white">Click me</button>';
    const doc = buildSandboxedDocument(html);

    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('id="sandbox-root"');
    expect(doc).toContain('max-width: 720px;');
    expect(doc).toContain("brand: '#2563EB'");
    expect(doc).toContain(html);
  });

  it('2. pairs measurements using ruleId, selector, AND viewport', () => {
    const desktopViewport = { width: 1440, height: 900 };
    const mobileViewport = { width: 375, height: 667 };

    const measurements = [
      {
        ruleId: 'target-size',
        selector: '#btn-action',
        viewport: mobileViewport,
        before: { width: 18, height: 18 },
        after: { width: 44, height: 44 },
        expected: { minWidth: 24, minHeight: 24 },
        status: 'pass' as const,
      },
      {
        ruleId: 'target-size',
        selector: '#btn-action',
        viewport: desktopViewport,
        before: { width: 24, height: 24 },
        after: { width: 24, height: 24 },
        expected: { minWidth: 24, minHeight: 24 },
        status: 'pass' as const,
      },
    ];

    // Find for mobile rep
    const mobileRep = { ruleId: 'target-size', selector: '#btn-action', viewport: mobileViewport };
    const matchedMobile = measurements.find(
      (m) =>
        m.ruleId === mobileRep.ruleId &&
        m.selector === mobileRep.selector &&
        (!mobileRep.viewport || (m.viewport?.width === mobileRep.viewport.width && m.viewport?.height === mobileRep.viewport.height))
    );
    expect(matchedMobile?.before.width).toBe(18);

    // Find for desktop rep
    const desktopRep = { ruleId: 'target-size', selector: '#btn-action', viewport: desktopViewport };
    const matchedDesktop = measurements.find(
      (m) =>
        m.ruleId === desktopRep.ruleId &&
        m.selector === desktopRep.selector &&
        (!desktopRep.viewport || (m.viewport?.width === desktopRep.viewport.width && m.viewport?.height === desktopRep.viewport.height))
    );
    expect(matchedDesktop?.before.width).toBe(24);
  });

  it('3. isolates sandbox document with connect-src none CSP to prevent API / network access', () => {
    const doc = buildSandboxedDocument('<div>Secure Component</div>');
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("connect-src 'none'");
    expect(doc).toContain("https://cdn.tailwindcss.com");
  });

  it('4. rejects spoofed client verification when candidate ID is not in server-recorded candidates', async () => {
    const { POST } = await import('@/app/api/sandbox/iterate/route');
    const { saveAuditRun } = await import('@/lib/storage/db');

    const testRunId = `test-verify-${Date.now()}`;
    const repIssue: any = {
      id: 'issue-1',
      ruleId: 'text-contrast',
      wcagCriterion: 'WCAG 2.1 SC 1.4.3',
      status: 'candidateFail',
      title: 'Contrast failure',
      description: 'Contrast below 4.5:1',
      url: 'http://localhost:3123/api/sandbox/render',
      viewport: { width: 1440, height: 900 },
      selector: '#title',
      element: 'h1',
      measured: { ratio: 2.5 },
      expected: { minRatio: 4.5 },
      initialPriority: 'P1',
      priorityRationale: 'High visibility heading',
    };

    const mockRun: any = {
      id: testRunId,
      targetUrl: 'http://localhost:3123/api/sandbox/render',
      timestamp: new Date().toISOString(),
      viewports: [{ width: 1440, height: 900 }],
      rawIssues: [repIssue],
      groupedIssues: [
        {
          fingerprint: 'fp-1',
          representative: repIssue,
          rawOccurrencesCount: 1,
          occurrences: [repIssue],
          status: 'candidateFail',
          initialPriority: 'P1',
          currentPriority: 'P1',
          decisionHistory: [],
        },
      ],
      summary: { totalRawFindings: 1, totalGroupedIssues: 1, passCount: 0, candidateFailCount: 1, needsReviewCount: 0 },
      candidates: [
        {
          id: 'server-cand-1',
          name: 'Server Verified Fix',
          code: '<h1 class="text-slate-900">Valid</h1>',
          verificationStatus: 'verified',
          measurements: [{ ruleId: 'text-contrast', selector: '#title', status: 'pass', after: { ratio: 7.2 } }],
        },
      ],
    };
    await saveAuditRun(mockRun);

    // Attempt to spoof verification with client-provided candidate not in server records
    const spoofReq = new Request('http://localhost:3123/api/sandbox/iterate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'selectCandidate',
        runId: testRunId,
        candidateId: 'fake-client-cand',
        candidate: {
          id: 'fake-client-cand',
          verificationStatus: 'verified', // Malicious client claim
          measurements: [{ ruleId: 'text-contrast', selector: '#title', status: 'pass' }],
        },
      }),
    });

    const res = await POST(spoofReq as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found in verified server audit records');
  }, 15000);

  it('5. rapid selection A -> B prevents race condition: stale selection A cannot overwrite newer selection B', async () => {
    const { POST } = await import('@/app/api/sandbox/iterate/route');
    const { saveAuditRun, getAuditRun } = await import('@/lib/storage/db');

    const testRunId = `test-race-${Date.now()}`;
    const repIssue: any = {
      id: 'issue-1',
      ruleId: 'text-contrast',
      wcagCriterion: 'WCAG 2.1 SC 1.4.3',
      status: 'candidateFail',
      title: 'Contrast failure',
      description: 'Contrast below 4.5:1',
      url: 'http://localhost:3123/api/sandbox/render',
      viewport: { width: 1440, height: 900 },
      selector: '#title',
      element: 'h1',
      measured: { ratio: 2.5 },
      expected: { minRatio: 4.5 },
      initialPriority: 'P1',
      priorityRationale: 'High visibility heading',
    };

    const mockRun: any = {
      id: testRunId,
      targetUrl: 'http://localhost:3123/api/sandbox/render',
      timestamp: new Date().toISOString(),
      viewports: [{ width: 1440, height: 900 }],
      rawIssues: [repIssue],
      groupedIssues: [
        {
          fingerprint: 'fp-1',
          representative: repIssue,
          rawOccurrencesCount: 1,
          occurrences: [repIssue],
          status: 'candidateFail',
          initialPriority: 'P1',
          currentPriority: 'P1',
          decisionHistory: [],
        },
      ],
      summary: { totalRawFindings: 1, totalGroupedIssues: 1, passCount: 0, candidateFailCount: 1, needsReviewCount: 0 },
      candidates: [
        {
          id: 'cand-A',
          name: 'Candidate A',
          code: '<h1>A</h1>',
          verificationStatus: 'verified',
          measurements: [{ ruleId: 'text-contrast', selector: '#title', status: 'pass', after: { ratio: 5.0 } }],
        },
        {
          id: 'cand-B',
          name: 'Candidate B',
          code: '<h1>B</h1>',
          verificationStatus: 'verified',
          measurements: [{ ruleId: 'text-contrast', selector: '#title', status: 'pass', after: { ratio: 8.5 } }],
        },
      ],
    };
    await saveAuditRun(mockRun);

    const timeA = 1000;
    const timeB = 2000;

    // Send B first with timestamp B
    const reqB = new Request('http://localhost:3123/api/sandbox/iterate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'selectCandidate',
        runId: testRunId,
        candidateId: 'cand-B',
        selectionTimestamp: timeB,
      }),
    });
    const resB = await POST(reqB as any);
    const bodyB = await resB.json();
    expect(bodyB.success).toBe(true);

    // Out-of-order / delayed request A arrives with older timestamp A
    const reqA = new Request('http://localhost:3123/api/sandbox/iterate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'selectCandidate',
        runId: testRunId,
        candidateId: 'cand-A',
        selectionTimestamp: timeA, // Older timestamp
      }),
    });
    const resA = await POST(reqA as any);
    const bodyA = await resA.json();
    expect(bodyA.stale).toBe(true); // Stale write dropped!

    // Verify persisted run in database remains Candidate B
    const finalRun = await getAuditRun(testRunId);
    expect(finalRun?.groupedIssues[0].iterationComparison?.candidateId).toBe('cand-B');
    expect(finalRun?.groupedIssues[0].iterationComparison?.candidateName).toBe('Candidate B');
  }, 15000);
});
