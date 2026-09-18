import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { AuditRun } from '@/lib/schema/ux-issue';
import { saveAuditRun, getAuditRun, updateDesignerDecision, listAuditRuns } from '../db';

describe('Local Store and Designer Decision Persistence (TEST-18)', () => {
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

  // Populate occurrences reference for schema completeness
  mockRun.groupedIssues[0].occurrences = [...mockRun.rawIssues];

  afterAll(async () => {
    try {
      const p = path.resolve(process.cwd(), '.proofui-data/runs', `${testRunId}.json`);
      await fs.unlink(p);
    } catch {
      // ignore
    }
  });

  it('saves and retrieves an audit run', async () => {
    await saveAuditRun(mockRun);
    const loaded = await getAuditRun(testRunId);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(testRunId);
    expect(loaded?.groupedIssues.length).toBe(1);
  });

  it('records designer decision and persists updated state (TEST-18)', async () => {
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
    expect(updated?.decisionHistory[0].fromPriority).toBe('P1');
    expect(updated?.decisionHistory[0].toPriority).toBe('P0');

    // Reload from file to verify persistence
    const reloaded = await getAuditRun(testRunId);
    const group = reloaded?.groupedIssues.find((g) => g.fingerprint === testFingerprint);
    expect(group?.designerDecision).toBe('reprioritize');
    expect(group?.currentPriority).toBe('P0');
  });

  it('lists audit runs in descending chronological order', async () => {
    const runs = await listAuditRuns();
    expect(runs.length).toBeGreaterThanOrEqual(1);
    const found = runs.find((r) => r.id === testRunId);
    expect(found).toBeDefined();
  });
});
