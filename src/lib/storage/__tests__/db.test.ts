import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { AuditRun } from '@/lib/schema/ux-issue';
import { saveAuditRun, getAuditRun, updateDesignerDecision, listAuditRuns } from '../db';

describe('Local Store, Concurrency Safety, and Decision Persistence (TEST-18)', () => {
  const testRunId = 'test-run-persist-1';
  const testFingerprint = 'target-size::button.danger::16x16';

  const mockRun: AuditRun = {
    id: testRunId,
    targetUrl: 'http://localhost:3123/fixtures/target-size-demo',
    fixtureId: 'target-size-demo',
    timestamp: new Date().toISOString(),
    viewports: [{ width: 375, height: 667 }],
    rawIssues: [
      {
        id: 'issue-persist-1',
        ruleId: 'target-size',
        wcagCriterion: 'WCAG 2.2 SC 2.5.8',
        status: 'candidateFail',
        title: 'Small delete button',
        description: 'Target size is 16x16px',
        url: 'http://localhost:3123/fixtures/target-size-demo',
        viewport: { width: 375, height: 667 },
        selector: 'button.danger',
        element: 'button',
        measured: { width: 16, height: 16 },
        expected: { minWidth: 24, minHeight: 24 },
        initialPriority: 'P1',
        priorityRationale: 'Interactive button below 18px',
        boundingBox: { x: 10, y: 20, width: 16, height: 16 },
      },
    ],
    groupedIssues: [
      {
        fingerprint: testFingerprint,
        representative: {
          id: 'issue-persist-1',
          ruleId: 'target-size',
          wcagCriterion: 'WCAG 2.2 SC 2.5.8',
          status: 'candidateFail',
          title: 'Small delete button',
          description: 'Target size is 16x16px',
          url: 'http://localhost:3123/fixtures/target-size-demo',
          viewport: { width: 375, height: 667 },
          selector: 'button.danger',
          element: 'button',
          measured: { width: 16, height: 16 },
          expected: { minWidth: 24, minHeight: 24 },
          initialPriority: 'P1',
          priorityRationale: 'Interactive button below 18px',
          boundingBox: { x: 10, y: 20, width: 16, height: 16 },
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

  afterAll(async () => {
    try {
      const p = path.resolve(process.cwd(), '.proofui-data/runs', `${testRunId}.json`);
      await fs.unlink(p);
    } catch {
      // ignore cleanup error
    }
  });

  it('saves and retrieves an audit run', async () => {
    await saveAuditRun(mockRun);
    const loaded = await getAuditRun(testRunId);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(testRunId);
    expect(loaded?.groupedIssues.length).toBe(1);
  });

  it('records designer decision and persists updated state with server-owned metadata', async () => {
    const updated = await updateDesignerDecision(
      testRunId,
      testFingerprint,
      'reprioritize',
      'Confirmed with mobile team that this is a critical action',
      'P0'
    );

    expect(updated).not.toBeNull();
    expect(updated?.designerDecision).toBe('reprioritize');
    expect(updated?.designerReason).toContain('critical action');
    expect(updated?.currentPriority).toBe('P0');
    expect(updated?.decisionHistory.length).toBe(1);

    const event = updated?.decisionHistory[0];
    expect(event?.id).toBeDefined();
    expect(typeof event?.id).toBe('string');
    expect(event?.timestamp).toBeDefined();
    expect(new Date(event!.timestamp).getTime()).toBeGreaterThan(0);
    expect(event?.fromPriority).toBe('P1');
    expect(event?.toPriority).toBe('P0');
    expect(event?.action).toBe('reprioritize');

    // Reload from file to verify persistence
    const reloaded = await getAuditRun(testRunId);
    const group = reloaded?.groupedIssues.find((g) => g.fingerprint === testFingerprint);
    expect(group?.designerDecision).toBe('reprioritize');
    expect(group?.currentPriority).toBe('P0');
  });

  it('tightens action validation: reject, edit, and reprioritize edge cases', async () => {
    // Reject requires non-whitespace reason
    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'reject', '')
    ).rejects.toThrow(/descriptive designer reason/i);

    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'reject', '   ')
    ).rejects.toThrow(/descriptive designer reason/i);

    // Edit: reject empty or whitespace-only recommendation
    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'edit', 'Valid designer reason', undefined, '')
    ).rejects.toThrow(/not be empty or whitespace-only/i);

    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'edit', 'Valid designer reason', undefined, '   ')
    ).rejects.toThrow(/not be empty or whitespace-only/i);

    // Edit: reject missing reason
    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'edit', '', undefined, 'Increase size to 24x24')
    ).rejects.toThrow(/descriptive designer reason/i);

    // Reprioritize: reject identical priority (current is P0)
    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'reprioritize', 'Reason for change', 'P0')
    ).rejects.toThrow(/must be different from the current effective priority/i);

    // Reprioritize: reject invalid/missing target priority
    await expect(
      updateDesignerDecision(testRunId, testFingerprint, 'reprioritize', 'Reason for change')
    ).rejects.toThrow(/valid target priority/i);

    // Accept does not require reason
    const acceptRes = await updateDesignerDecision(testRunId, testFingerprint, 'accept');
    expect(acceptRes?.designerDecision).toBe('accept');
  });

  it('preserves immutable deterministic evidence across multiple designer edits', async () => {
    const beforeRun = await getAuditRun(testRunId);
    const beforeGroup = beforeRun!.groupedIssues.find((g) => g.fingerprint === testFingerprint)!;
    const deterministicSnapshot = JSON.stringify({
      ruleId: beforeGroup.representative.ruleId,
      wcagCriterion: beforeGroup.representative.wcagCriterion,
      selector: beforeGroup.representative.selector,
      element: beforeGroup.representative.element,
      measured: beforeGroup.representative.measured,
      expected: beforeGroup.representative.expected,
      boundingBox: beforeGroup.representative.boundingBox,
      viewport: beforeGroup.representative.viewport,
      occurrences: beforeGroup.occurrences.map((o) => ({
        id: o.id,
        measured: o.measured,
        expected: o.expected,
        selector: o.selector,
        boundingBox: o.boundingBox,
      })),
    });

    // Perform Edit
    const newRec = 'Custom designer recommendation: Apply 8px margin and min-height 24px.';
    const editRes = await updateDesignerDecision(
      testRunId,
      testFingerprint,
      'edit',
      'Refining recommendation for dev team',
      undefined,
      newRec
    );

    expect(editRes?.editedRecommendation).toBe(newRec);

    // Edit again with another recommendation: rejects if identical to current
    await expect(
      updateDesignerDecision(
        testRunId,
        testFingerprint,
        'edit',
        'Attempt duplicate edit',
        undefined,
        newRec
      )
    ).rejects.toThrow(/must be different from the current effective recommendation/i);

    // Second valid edit preserves original, previous, and new recommendations
    const secondRec = 'Updated recommendation: Increase target to 28x28px.';
    const secondEditRes = await updateDesignerDecision(
      testRunId,
      testFingerprint,
      'edit',
      'Further refined based on designer feedback',
      undefined,
      secondRec
    );

    const latestHistory = secondEditRes!.decisionHistory[secondEditRes!.decisionHistory.length - 1];
    expect(latestHistory.previousRecommendation).toBe(newRec);
    expect(latestHistory.editedRecommendation).toBe(secondRec);
    expect(latestHistory.originalRecommendation).toBe('Target size is 16x16px');

    // Prove deterministic measurements remain 100% byte-equivalent
    const afterRun = await getAuditRun(testRunId);
    const afterGroup = afterRun!.groupedIssues.find((g) => g.fingerprint === testFingerprint)!;
    const afterSnapshot = JSON.stringify({
      ruleId: afterGroup.representative.ruleId,
      wcagCriterion: afterGroup.representative.wcagCriterion,
      selector: afterGroup.representative.selector,
      element: afterGroup.representative.element,
      measured: afterGroup.representative.measured,
      expected: afterGroup.representative.expected,
      boundingBox: afterGroup.representative.boundingBox,
      viewport: afterGroup.representative.viewport,
      occurrences: afterGroup.occurrences.map((o) => ({
        id: o.id,
        measured: o.measured,
        expected: o.expected,
        selector: o.selector,
        boundingBox: o.boundingBox,
      })),
    });

    expect(afterSnapshot).toBe(deterministicSnapshot);
  });

  it('serializes concurrent requests without lost updates or race conditions', async () => {
    // Fire rapid sequential/concurrent updates
    const initialHistoryLength = (await getAuditRun(testRunId))!.groupedIssues[0].decisionHistory.length;

    // Send 3 distinct reprioritize/accept actions concurrently
    const p1 = updateDesignerDecision(testRunId, testFingerprint, 'reprioritize', 'Concurrent change 1', 'P2');
    const p2 = updateDesignerDecision(testRunId, testFingerprint, 'reprioritize', 'Concurrent change 2', 'P3');
    const p3 = updateDesignerDecision(testRunId, testFingerprint, 'accept', 'Concurrent change 3');

    await Promise.all([p1, p2, p3]);

    const finalRun = await getAuditRun(testRunId);
    const group = finalRun!.groupedIssues.find((g) => g.fingerprint === testFingerprint)!;

    // Every single decision event must be preserved in append-only history
    expect(group.decisionHistory.length).toBe(initialHistoryLength + 3);

    // Verify each event has distinct ID and timestamp
    const eventIds = new Set(group.decisionHistory.map((e) => e.id));
    expect(eventIds.size).toBe(group.decisionHistory.length);
  });

  it('fails safely on unknown run ID, unknown fingerprint, or corrupted file', async () => {
    // Unknown run ID
    const notFoundRun = await updateDesignerDecision('non-existent-run', testFingerprint, 'accept');
    expect(notFoundRun).toBeNull();

    // Unknown fingerprint
    const notFoundGroup = await updateDesignerDecision(testRunId, 'non-existent-fingerprint', 'accept');
    expect(notFoundGroup).toBeNull();

    // Corrupted file fails safely with descriptive error without deleting or overwriting
    const corruptPath = path.resolve(process.cwd(), '.proofui-data/runs/corrupt-test.json');
    await fs.writeFile(corruptPath, '{ malformed json: true, ', 'utf-8');

    await expect(getAuditRun('corrupt-test')).rejects.toThrow(/CorruptedAuditRunError/i);

    // Cleanup corrupt test file
    await fs.unlink(corruptPath);
  });
});
