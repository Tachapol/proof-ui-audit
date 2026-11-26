import type { PilotScope } from '@/lib/schema/pilot-metric';
import type { BoundingBox } from '@/lib/schema/ux-issue';

export interface PilotElement {
  selector: string;
  element: string;
  accessibleName: string;
  boundingBox: BoundingBox;
}
export interface PointerTarget extends PilotElement { actionId: string }
export interface HeadingNode extends PilotElement {
  level: number | null;
  rawAriaLevel: string | null;
  source: 'native' | 'aria';
  domIndex: number;
}
export interface PilotSnapshot {
  scopeSelector: string | null;
  scopeError?: string;
  parentHeadingLevel?: number;
  rawParentHeadingLevel?: string | null;
  invalidParentContext?: string;
  pointerDiscoveryIncomplete?: boolean;
  targets: PointerTarget[];
  headings: HeadingNode[];
  limitations: string[];
}

/** Runs in the page. Keep all runtime helpers inside this serializable function. */
export function extractPilotSnapshot(scope?: PilotScope & { pointerTargetIndices?: number[]; pointerDiscoveryIncomplete?: boolean }): PilotSnapshot {
  const selector = scope?.selector || (document.querySelector('#fixture-content') ? '#fixture-content'
    : document.querySelector('[data-audit-scope]') ? '[data-audit-scope]' : '#sandbox-root');
  let roots: NodeListOf<Element>;
  try { roots = document.querySelectorAll(selector); }
  catch { return { scopeSelector: selector, scopeError: 'Invalid UI scope selector.', targets: [], headings: [], limitations: [] }; }
  if (roots.length !== 1) return {
    scopeSelector: roots.length ? selector : null,
    scopeError: roots.length ? 'UI scope must match exactly one element.' : 'No designated experimental UI scope found.',
    targets: [], headings: [], limitations: [],
  };
  const root = roots[0];
  const positiveInteger = (value: string | null) => value !== null && /^\+?\d+$/.test(value.trim())
    && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const parentValue = scope?.parentHeadingLevel?.toString() ?? root.getAttribute('data-audit-parent-heading-level');
  const parent = positiveInteger(parentValue);
  const snapshot: PilotSnapshot = {
    scopeSelector: selector, targets: [], headings: [],
    rawParentHeadingLevel: parentValue,
    pointerDiscoveryIncomplete: scope?.pointerDiscoveryIncomplete,
    ...(parent !== null ? { parentHeadingLevel: parent } : {}),
    ...(parentValue !== null && parent === null ? { invalidParentContext: parentValue } : {}),
    limitations: [
      'One rendered DOM state only; interactions are not opened or combined across states.',
      'Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.',
      'Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot.',
    ],
  };
  function visible(el: Element, accessibility = false): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || el.closest('[hidden], [inert]')) return false;
    if (accessibility && el.closest('[aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || Number(cs.opacity) === 0 || cs.contentVisibility === 'hidden') return false;
      // Closed disclosure content can retain a layout box in Chromium.
      if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector(':scope > summary')?.contains(el)) return false;
      if (node !== el && /(hidden|clip|scroll|auto)/.test(`${cs.overflowX} ${cs.overflowY}`)) {
        const clip = node.getBoundingClientRect();
        if (/(hidden|clip|scroll|auto)/.test(cs.overflowX) && (rect.right <= clip.left || rect.left >= clip.right)) return false;
        if (/(hidden|clip|scroll|auto)/.test(cs.overflowY) && (rect.bottom <= clip.top || rect.top >= clip.bottom)) return false;
      }
    }
    return true;
  }
  function identity(el: Element): PilotElement {
    const parts: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`); break;
      }
      const index = node.parentElement ? Array.from(node.parentElement.children).indexOf(node) + 1 : 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    }
    const r = el.getBoundingClientRect();
    return {
      selector: parts.join(' > '), element: el.tagName.toLowerCase(),
      accessibleName: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 160) || '',
      boundingBox: { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height },
    };
  }
  const native = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, label';
  const roles = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'combobox', 'textbox', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'treeitem', 'scrollbar']);
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  const pointerIndices = new Set(scope?.pointerTargetIndices || []);
  const candidates = all.filter((el, index) => {
    const html = el as HTMLElement;
    const handler = html.onclick || html.onpointerdown || html.onpointerup || html.onmousedown || html.onmouseup || html.ontouchstart || html.ontouchend;
    const labelControl = el instanceof HTMLLabelElement ? el.control : null;
    if (el instanceof HTMLLabelElement && (!labelControl || labelControl.matches(':disabled'))) return false;
    return (el.matches(native) || roles.has(el.getAttribute('role') || '') || !!handler || pointerIndices.has(index) || el.hasAttribute('data-audit-pointer-target'))
      && visible(el) && getComputedStyle(el).pointerEvents !== 'none'
      && !el.matches(':disabled') && !el.closest('[aria-disabled="true"]');
  });
  const candidateSet = new Set(candidates);
  const actionOwner = (el: Element): Element => {
    // Nested icon/handler wrappers inherit the containing action. Distinct nested
    // controls or explicit action IDs remain separate, even when boxes overlap.
    if (el.hasAttribute('data-audit-action-id')) return el;
    if (el.matches(native) || roles.has(el.getAttribute('role') || '')) return el;
    for (let node = el.parentElement; node && root.contains(node); node = node.parentElement) {
      if (candidateSet.has(node)) return node;
    }
    return el;
  };
  const seen = new Set<string>();
  const actionIdFor = (el: Element): string => {
    const owner = actionOwner(el);
    return owner.getAttribute('data-audit-action-id')
      || (owner instanceof HTMLLabelElement && owner.control ? identity(owner.control).selector : identity(owner).selector);
  };
  for (const el of candidates) {
    const actionId = actionIdFor(el);
    // Only nested representations of the same action are collapsed. Distinct
    // controls sharing text, URLs or coordinates must still be compared.
    const duplicate = candidates.some(other => other !== el && other.contains(el)
      && actionIdFor(other) === actionId);
    if (duplicate || seen.has(identity(el).selector)) continue;
    seen.add(identity(el).selector);
    snapshot.targets.push({ ...identity(el), actionId });
  }
  all.filter(el => el.matches('h1,h2,h3,h4,h5,h6,[role="heading"]') && visible(el, true)).forEach((el, domIndex) => {
    const isAria = !/^H[1-6]$/.test(el.tagName);
    const rawAriaLevel = el.getAttribute('aria-level');
    const level = isAria ? positiveInteger(rawAriaLevel) : Number(el.tagName.slice(1));
    snapshot.headings.push({ ...identity(el), level, rawAriaLevel, source: isAria ? 'aria' : 'native', domIndex });
  });
  return snapshot;
}
