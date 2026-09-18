import { describe, it, expect } from 'vitest';
import { FIXTURES } from '@/fixtures/fixture-registry';

describe('Project Skeleton Smoke Test', () => {
  it('loads the fixture registry with all 4 criteria suites', () => {
    expect(FIXTURES).toBeDefined();
    expect(FIXTURES.length).toBeGreaterThanOrEqual(4);
    const categories = FIXTURES.map((f) => f.category);
    expect(categories).toContain('target-size');
    expect(categories).toContain('contrast');
    expect(categories).toContain('reflow');
    expect(categories).toContain('text-spacing');
  });

  it('runs without requiring any environment variables', () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
  });
});
