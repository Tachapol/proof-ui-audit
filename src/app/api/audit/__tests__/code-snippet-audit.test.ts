import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import { getAuditRun } from '@/lib/storage/db';

describe('Audit API - HTML Code Snippet & Pre-Deployment Audit', () => {
  it('renders pasted HTML in sandboxed browser, computes DOM measurements, and persists code version & viewports', async () => {
    const sampleHtml = `<div class="p-6 bg-white font-sans">
      <h1 id="title" style="color: #94a3b8; font-size: 16px;">Muted Heading</h1>
      <button id="action-btn" style="width: 18px; height: 18px; background: #2563eb; color: #ffffff;">Go</button>
    </div>`;

    const req = new Request('http://localhost:3123/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: sampleHtml,
        productContext: {
          productGoal: 'Pre-deployment widget audit',
        },
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.run).toBeDefined();

    const run = body.run;
    expect(run.targetUrl).toContain('/api/sandbox/render?id=');
    expect(run.codeSnippet).toBe(sampleHtml);
    expect(run.codeVersion).toMatch(/^snip-[a-f0-9-]+$/i);
    expect(run.viewports).toEqual([
      { width: 1440, height: 900 },
      { width: 375, height: 667 },
    ]);

    // Verify deterministic DOM measurements from real browser render
    expect(run.rawIssues.length).toBeGreaterThan(0);
    const targetSizeIssue = run.rawIssues.find((i: any) => i.ruleId === 'target-size');
    expect(targetSizeIssue).toBeDefined();
    expect(targetSizeIssue.measured?.width).toBeCloseTo(18, 0);

    // Verify atomic local persistence in database
    const persisted = await getAuditRun(run.id);
    expect(persisted).toBeDefined();
    expect(persisted?.codeSnippet).toBe(sampleHtml);
    expect(persisted?.codeVersion).toBe(run.codeVersion);
  }, 60000);
});
