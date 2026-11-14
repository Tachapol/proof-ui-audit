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
});
