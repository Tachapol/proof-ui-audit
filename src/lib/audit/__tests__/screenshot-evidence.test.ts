import { describe, it, expect, vi } from 'vitest';
import type { Page } from '@playwright/test';
import type { UXIssue } from '@/lib/schema/ux-issue';
import { captureIssueEvidence } from '../screenshot-evidence';

const makeIssue = (status: UXIssue['status']) => ({
  id: 'evidence-test', status, viewport: { width: 375, height: 667 },
  boundingBox: { x: 20, y: 800, width: 120, height: 30 },
  measured: { contrastRatio: 7 }, expected: { minRatio: 4.5 },
  ruleId: 'text-contrast', wcagCriterion: '1.4.3', title: 'Contrast', description: 'Measured contrast',
  url: 'http://localhost/fixture', selector: '#text', element: 'p',
  initialPriority: 'P3', priorityRationale: 'Test evidence',
}) as UXIssue;

describe('Screenshot evidence', () => {
  it.each(['pass', 'candidateFail', 'needsReview'] as const)('captures %s evidence without changing measurements', async status => {
    const screenshot = vi.fn().mockResolvedValue(Buffer.from('image'));
    const issue = makeIssue(status);
    await captureIssueEvidence({ screenshot } as unknown as Page, issue, '/tmp');
    expect(screenshot).toHaveBeenCalledWith(expect.objectContaining({ clip: { x: 8, y: 788, width: 144, height: 54 } }));
    expect(issue.screenshotPath).toBe('/screenshots/issue-375-evidence-test.png');
    expect(issue.status).toBe(status);
    expect(issue.measured).toEqual({ contrastRatio: 7 });
  });
  it('respects disabled capture', async () => {
    const screenshot = vi.fn();
    await captureIssueEvidence({ screenshot } as unknown as Page, makeIssue('pass'), '/tmp', false);
    expect(screenshot).not.toHaveBeenCalled();
  });
  it('keeps evidence when image capture fails', async () => {
    const issue = makeIssue('candidateFail');
    await captureIssueEvidence({ screenshot: vi.fn().mockRejectedValue(new Error('capture failed')) } as unknown as Page, issue, '/tmp');
    expect(issue.screenshotPath).toBeUndefined();
    expect(issue.measured.contrastRatio).toBe(7);
    expect(issue.status).toBe('candidateFail');
  });
});
