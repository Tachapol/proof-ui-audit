import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { POST } from '../route';
import { saveAuditRun, getAuditRun } from '@/lib/storage/db';
import { AuditRun } from '@/lib/schema/ux-issue';

describe('API Route /api/decisions Security & Immutability Tests', () => {
  const testRunId = 'test-run-api-decisions';
  const testFingerprint = 'target-size::button.save::20x20';

  const mockRun: AuditRun = {
    id: testRunId,
    targetUrl: 'http://localhost:3123/fixtures/target-size-demo',
    timestamp: new Date().toISOString(),
    viewports: [{ width: 375, height: 667 }],
    rawIssues: [
      {
        id: 'issue-api-1',
        ruleId: 'target-size',
        wcagCriterion: 'WCAG 2.2 SC 2.5.8',
        status: 'candidateFail',
        title: 'Save button small',
        description: 'Target size is 20x20px',
        url: 'http://localhost:3123/fixtures/target-size-demo',
        viewport: { width: 375, height: 667 },
        selector: 'button.save',
        element: 'button',
        measured: { width: 20, height: 20 },
        expected: { minWidth: 24, minHeight: 24 },
        initialPriority: 'P1',
        priorityRationale: 'Interactive button below 24px',
        boundingBox: { x: 5, y: 10, width: 20, height: 20 },
      },
    ],
    groupedIssues: [
      {
        fingerprint: testFingerprint,
        representative: {
          id: 'issue-api-1',
          ruleId: 'target-size',
          wcagCriterion: 'WCAG 2.2 SC 2.5.8',
          status: 'candidateFail',
          title: 'Save button small',
          description: 'Target size is 20x20px',
          url: 'http://localhost:3123/fixtures/target-size-demo',
          viewport: { width: 375, height: 667 },
          selector: 'button.save',
          element: 'button',
          measured: { width: 20, height: 20 },
          expected: { minWidth: 24, minHeight: 24 },
          initialPriority: 'P1',
          priorityRationale: 'Interactive button below 24px',
          boundingBox: { x: 5, y: 10, width: 20, height: 20 },
        },
        rawOccurrencesCount: 1,
        occurrences: [],
        status: 'candidateFail',
        initialPriority: 'P1',
        currentPriority: 'P1',
        decisionHistory: [],
      },
    ],
    summary: {
      totalRawFindings: 1,
      totalGroupedIssues: 1,
      passCount: 0,
      candidateFailCount: 1,
      needsReviewCount: 0,
    },
  };

  mockRun.groupedIssues[0].occurrences = [...mockRun.rawIssues];

  beforeEach(async () => {
    await saveAuditRun(mockRun);
  });

  afterAll(async () => {
    try {
      const p = path.resolve(process.cwd(), '.proofui-data/runs', `${testRunId}.json`);
      await fs.unlink(p);
    } catch {
      // ignore
    }
  });

  it('rejects unknown or malicious fields and prevents mutation of deterministic evidence', async () => {
    // Malicious request attempting to overwrite measured, expected, selector, ruleId, boundingBox
    const maliciousPayload = {
      runId: testRunId,
      fingerprint: testFingerprint,
      decision: 'accept',
      reason: 'Valid designer reason for accept',
      // Attacker attempts to change deterministic evidence:
      ruleId: 'hacked-rule',
      wcagCriterion: 'WCAG Fake',
      selector: 'button.malicious',
      element: 'div',
      measured: { width: 999, height: 999 },
      expected: { minWidth: 0, minHeight: 0 },
      boundingBox: { x: 0, y: 0, width: 999, height: 999 },
      clientSuppliedId: 'fake-id',
      clientSuppliedTimestamp: '1970-01-01T00:00:00.000Z',
    };

    const req = new Request('http://localhost/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify persisted record in storage
    const reloaded = await getAuditRun(testRunId);
    const group = reloaded?.groupedIssues.find((g) => g.fingerprint === testFingerprint)!;

    // Proves immutable evidence was not modified
    expect(group.representative.ruleId).toBe('target-size');
    expect(group.representative.wcagCriterion).toBe('WCAG 2.2 SC 2.5.8');
    expect(group.representative.selector).toBe('button.save');
    expect(group.representative.element).toBe('button');
    expect(group.representative.measured.width).toBe(20);
    expect(group.representative.expected.minWidth).toBe(24);
    expect(group.representative.boundingBox?.width).toBe(20);

    // Proves server generated event ID and timestamp instead of client-supplied values
    const latestEvent = group.decisionHistory[0];
    expect(latestEvent.id).not.toBe('fake-id');
    expect(latestEvent.timestamp).not.toBe('1970-01-01T00:00:00.000Z');
  });

  it('returns 400 when mandatory reason is missing for reject, edit, or reprioritize', async () => {
    // Missing reason for reject
    const req = new Request('http://localhost/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: testRunId,
        fingerprint: testFingerprint,
        decision: 'reject',
        reason: '   ',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/descriptive designer reason/i);
  });

  it('returns 400 when reprioritizing to identical priority or invalid priority', async () => {
    // Attempt reprioritizing from P1 to P1
    const req = new Request('http://localhost/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: testRunId,
        fingerprint: testFingerprint,
        decision: 'reprioritize',
        reason: 'Change priority',
        newPriority: 'P1',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/must be different/i);
  });

  it('returns 400 when edit recommendation is identical to current recommendation', async () => {
    const currentRec = 'Target size is 20x20px';
    const req = new Request('http://localhost/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: testRunId,
        fingerprint: testFingerprint,
        decision: 'edit',
        reason: 'Duplicate edit attempt',
        editedRecommendation: currentRec,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/must be different/i);
  });

  it('returns 404 when audit run or issue fingerprint is not found', async () => {
    const req = new Request('http://localhost/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: 'unknown-run-id',
        fingerprint: testFingerprint,
        decision: 'accept',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
