import type { Page } from '@playwright/test';
import type { UXIssue } from '@/lib/schema/ux-issue';
import path from 'path';

/** Capture the measured region for every status, including passed checks. */
export async function captureIssueEvidence(
  page: Page,
  issue: UXIssue,
  directory: string,
  enabled = true,
): Promise<void> {
  if (!enabled || !issue.boundingBox) return;
  const box = issue.boundingBox;
  const x = Math.max(0, box.x - 12);
  const y = Math.max(0, box.y - 12);
  const width = box.x + box.width + 12 - x;
  const height = box.y + box.height + 12 - y;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
  const filename = `issue-${issue.viewport.width}-${issue.id}.png`;
  try {
    await page.screenshot({ path: path.join(directory, filename), clip: { x, y, width, height } });
    issue.screenshotPath = `/screenshots/${filename}`;
  } catch {
    // Missing image must not discard deterministic measurements or become a pass.
  }
}
