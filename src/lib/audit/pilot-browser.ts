import type { Page, CDPSession } from '@playwright/test';
import type { PilotScope } from '@/lib/schema/pilot-metric';
import { extractPilotSnapshot, type PilotSnapshot } from './pilot-extraction';

const POINTER_EVENTS = new Set(['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'contextmenu']);
export const POINTER_DISCOVERY_LIMIT = 1000;

/** Chromium listener inspection avoids injecting or replacing target-page handlers. */
export async function extractPilotFromPage(page: Page, scope?: PilotScope): Promise<PilotSnapshot> {
  const initial = await page.evaluate(extractPilotSnapshot, scope);
  if (initial.scopeError || !initial.scopeSelector) return initial;
  const pointerTargetIndices: number[] = [];
  let incomplete = false;
  let session: CDPSession | undefined;
  try {
    session = await page.context().newCDPSession(page);
    const { result } = await session.send('Runtime.evaluate', {
      expression: `(() => { const root = document.querySelector(${JSON.stringify(initial.scopeSelector)}); return [root, ...root.querySelectorAll('*')]; })()`,
      objectGroup: 'proofui-pilot-pointer',
    });
    if (!result.objectId) throw new Error('UI pointer nodes unavailable.');
    const properties = await session.send('Runtime.getProperties', { objectId: result.objectId, ownProperties: true });
    const nodes = properties.result.filter(property => /^\d+$/.test(property.name) && property.value?.objectId);
    if (nodes.length > POINTER_DISCOVERY_LIMIT) incomplete = true;
    // Batches bound protocol concurrency on larger experimental components.
    for (let start = 0; start < Math.min(nodes.length, POINTER_DISCOVERY_LIMIT); start += 50) {
      const batch = await Promise.allSettled(nodes.slice(start, Math.min(start + 50, POINTER_DISCOVERY_LIMIT)).map(async node => {
        const { listeners } = await session!.send('DOMDebugger.getEventListeners', { objectId: node.value!.objectId! });
        if (listeners.some((listener: { type: string }) => POINTER_EVENTS.has(listener.type))) pointerTargetIndices.push(Number(node.name));
      }));
      if (batch.some(result => result.status === 'rejected')) incomplete = true;
    }
  } catch { incomplete = true; }
  finally {
    if (session) {
      await session.send('Runtime.releaseObjectGroup', { objectGroup: 'proofui-pilot-pointer' }).catch(() => undefined);
      await session.detach().catch(() => undefined);
    }
  }
  const snapshot = await page.evaluate(extractPilotSnapshot, {
    selector: initial.scopeSelector, parentHeadingLevel: scope?.parentHeadingLevel,
    pointerTargetIndices, pointerDiscoveryIncomplete: incomplete,
  });
  if (incomplete) snapshot.limitations.push(`Direct pointer listener discovery was incomplete or exceeded ${POINTER_DISCOVERY_LIMIT} DOM elements.`);
  return snapshot;
}
