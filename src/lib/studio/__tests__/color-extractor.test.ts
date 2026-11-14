import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractProposedColors, resolveColorAttribution, toHex6 } from '../color-extractor';
import { formatStudioMarkdown } from '../markdown';
import type { AgendaItem, ChatMessage, StudioSession } from '../types';
import type { UXIssue } from '@/lib/schema/ux-issue';

describe('Studio Color Extractor & Attribution', () => {
  const dummyRepresentative: UXIssue = {
    id: 'rep-1',
    ruleId: 'text-contrast',
    wcagCriterion: '1.4.3',
    status: 'candidateFail',
    title: 'Text contrast failure',
    description: 'Contrast is too low',
    url: 'http://localhost:3123/fixtures/mvp-contrast-demo',
    viewport: { width: 375, height: 667 },
    selector: '#normal-fail',
    element: 'p',
    measured: {
      color: '#aaaaaa',
      backgroundColor: '#ffffff',
      contrastRatio: 2.32,
    },
    expected: {
      minRatio: 4.5,
    },
    initialPriority: 'P1',
    priorityRationale: 'Heuristic',
  };

  const dummyAgendaItem: AgendaItem = {
    id: 'agenda-item-1',
    runId: 'run-1',
    fingerprint: 'fp-1',
    title: 'Text contrast failure',
    status: 'candidateFail',
    notes: [
      {
        role: 'engineering',
        comment: 'Element has low contrast',
        recommendation: 'Baseline #aaaaaa fails on #ffffff; consider #4b5563 instead.',
        tradeoff: '',
      },
    ],
  };

  const dummyMessages: ChatMessage[] = [
    {
      id: 'msg-user',
      issueId: 'agenda-item-1',
      sender: 'user',
      text: 'Can we try #999999 or #3b82f6?',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-eng',
      issueId: 'agenda-item-1',
      sender: 'engineering',
      text: 'Suggested change: #normal-fail { color: #595959; } which satisfies 7:1 ratio.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-ux',
      issueId: 'agenda-item-1',
      sender: 'ux',
      text: 'A softer gray like #cccccc is too light and fails.',
      timestamp: new Date().toISOString(),
    },
  ];

  it('1. extracts colors proposed in discussion chat replies from AI roles', () => {
    const options = extractProposedColors({
      item: dummyAgendaItem,
      messages: dummyMessages,
      representative: dummyRepresentative,
    });

    const colors = options.map(o => o.color);
    expect(colors).toContain('#595959');

    const engChat = options.find(o => o.color === '#595959');
    expect(engChat).toBeDefined();
    expect(engChat?.source).toBe('ai_discussion');
    expect(engChat?.roleName).toBe('Engineering');
    expect(engChat?.sourceLabel).toContain('Engineering (Chat: #595959)');
    expect(engChat?.contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('2. filters out baseline foreground, background color, and low-contrast proposals', () => {
    const options = extractProposedColors({
      item: dummyAgendaItem,
      messages: dummyMessages,
      representative: dummyRepresentative,
    });

    const colors = options.map(o => o.color);
    // Baseline foreground (#aaaaaa / #aaa) must NOT be included as a proposed fix
    expect(colors).not.toContain('#aaaaaa');
    // Background color (#ffffff) must NOT be included as a proposed fix
    expect(colors).not.toContain('#ffffff');
    // Failing low-contrast color (#cccccc ratio < 4.5) must NOT be included
    expect(colors).not.toContain('#cccccc');
    // User suggestion (#999999 fails contrast anyway, and user messages are excluded)
    expect(colors).not.toContain('#999999');
  });

  it('3. dynamically attributes custom designer edits without retaining AI role or Brand label', () => {
    const options = extractProposedColors({
      item: dummyAgendaItem,
      messages: dummyMessages,
      themeColor: '#2563eb',
      representative: dummyRepresentative,
    });

    // Known option matches
    expect(resolveColorAttribution('#595959', options)).toBe('Engineering (Chat: #595959)');
    expect(resolveColorAttribution('#2563eb', options)).toBe('Brand theme token (#2563eb)');
    expect(resolveColorAttribution('#111827', options)).toBe('System slate (#111827)');

    // Custom user edits (e.g. #334155, #1e293b, #ff0000)
    const customAttr1 = resolveColorAttribution('#334155', options);
    expect(customAttr1).toBe('Custom designer selection (#334155)');
    expect(customAttr1).not.toContain('Engineering');
    expect(customAttr1).not.toContain('Brand');

    const customAttr2 = resolveColorAttribution('#000000', options);
    expect(customAttr2).toBe('Custom designer selection (#000000)');
  });

  it('4. verifies against the real session 71156839-ec1f-4510-8baf-d15c16707f35', () => {
    const filePath = path.resolve(process.cwd(), '.proofui-data/studio/71156839-ec1f-4510-8baf-d15c16707f35.json');
    if (!fs.existsSync(filePath)) {
      console.warn('Real session file not present, skipping real fixture test');
      return;
    }

    const session: StudioSession = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const item = session.agenda[0];
    const run = session.runs.find(r => r.id === item.runId)!;
    const group = run.groupedIssues.find(g => g.fingerprint === item.fingerprint)!;
    const rep = group.representative;

    const options = extractProposedColors({
      item,
      messages: session.messages,
      themeColor: run.productContext?.themeColor,
      representative: rep,
    });

    // 1. Must extract #595959 from Engineering chat
    const engOption = options.find(o => o.color === '#595959');
    expect(engOption).toBeDefined();
    expect(engOption?.sourceLabel).toContain('Engineering');
    expect(engOption?.contrastRatio).toBe(7);

    // 2. Discards baseline #aaaaaa and #ffffff
    const allColors = options.map(o => o.color);
    expect(allColors).not.toContain('#aaaaaa');
    expect(allColors).not.toContain('#ffffff');

    // 3. Attribution of custom selection
    const customBadge = resolveColorAttribution('#444444', options);
    expect(customBadge).toBe('Custom designer selection (#444444)');
  });

  it('5. counts and formats finding scope consistently across 2 frames in export markdown', () => {
    const session: StudioSession = {
      id: 'session-multi-frame-test',
      createdAt: new Date().toISOString(),
      model: 'test-model',
      roles: ['ux', 'engineering'],
      runs: [
        {
          id: 'run-1',
          targetUrl: 'http://localhost:3123/fixtures/mvp-contrast-demo',
          fixtureId: 'mvp-contrast-demo',
          timestamp: new Date().toISOString(),
          viewports: [{ width: 375, height: 667 }],
          rawIssues: [],
          groupedIssues: [],
          summary: { totalRawFindings: 5, totalGroupedIssues: 5, passCount: 0, candidateFailCount: 5, needsReviewCount: 0 },
        },
        {
          id: 'run-2',
          targetUrl: 'http://localhost:3123/fixtures/text-contrast-demo',
          fixtureId: 'text-contrast-demo',
          timestamp: new Date().toISOString(),
          viewports: [{ width: 1280, height: 800 }],
          rawIssues: [],
          groupedIssues: [],
          summary: { totalRawFindings: 6, totalGroupedIssues: 6, passCount: 0, candidateFailCount: 6, needsReviewCount: 0 },
        },
      ],
      agenda: [],
      candidates: {},
      messages: [],
      roleSummaries: { ux: 'UX Summary', engineering: 'Eng Summary' },
      roleErrors: {},
      findingStats: {
        totalCandidateFindings: 11,
        analyzedCount: 8,
        omittedCount: 3,
        maxCap: 8,
        frameCount: 2,
        selectionStrategy: 'priority_order',
      },
    };

    const markdown = formatStudioMarkdown(session);
    expect(markdown).toContain('- **Audited Frame(s)**:');
    expect(markdown).toContain('`mvp-contrast-demo (Local Fixture)`');
    expect(markdown).toContain('`text-contrast-demo (Local Fixture)`');
    expect(markdown).toContain('- **Finding Scope**: Analyzed 8 of 11 findings across 2 frames (Priority P0–P3 sorted) — 3 lower-priority findings omitted');
  });
});
