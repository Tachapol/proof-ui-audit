import type { ReflowMeasurement, OverflowingElementInfo, NestedScrollContainerInfo, AncestorClippedElementInfo, ClippedControlInfo } from './rules/reflow';

/** Browser-side geometry at the actual 320 CSS px viewport, before spacing overrides. */
export function extractReflowMeasurement(input: { viewport: { width: number; height: number }; selector?: string }): ReflowMeasurement {
  const selector = input.selector || (document.querySelector('#fixture-content') ? '#fixture-content'
    : document.querySelector('[data-audit-scope]') ? '[data-audit-scope]'
      : document.querySelector('#sandbox-root') ? '#sandbox-root' : 'html');
  const roots = document.querySelectorAll(selector);
  if (roots.length !== 1) throw new Error('Reflow UI scope must match exactly one element.');
  const root = roots[0] as HTMLElement;
  const bounds = root.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error('Reflow UI scope has no measurable geometry.');
  const viewport = input.viewport;
  const tolerance = 1;
  const overflowingElements: OverflowingElementInfo[] = [];
  const nestedScrollContainers: NestedScrollContainerInfo[] = [];
  const ancestorClippedElements: AncestorClippedElementInfo[] = [];
  const clippedControls: ClippedControlInfo[] = [];
  let decorativeElementsExcludedCount = 0;
  const clientWidth = Math.min(root.clientWidth, viewport.width - Math.max(0, bounds.left));
  const right = Math.min(bounds.left + root.clientLeft + root.clientWidth, viewport.width);
  const left = Math.max(0, bounds.left + root.clientLeft);

  function getSelector(el: Element): string {
    const parts: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
      const index = node.parentElement ? Array.from(node.parentElement.children).indexOf(node) + 1 : 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    }
    return parts.join(' > ');
  }
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
  };
  const essential = (el: Element) => !!el.closest('[data-essential-2d="true"], table, canvas, video, [role="img"][data-diagram]');
  const meaningful = (el: Element) => /\S/.test(el.textContent || '') || el.matches('input,button,select,textarea,img,svg,canvas,video,iframe,[role="button"],[role="link"]');
  const scrolls = (el: Element) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowX) && el.scrollWidth - el.clientWidth > tolerance;
  const visible = (el: Element) => {
    if (el.closest('[hidden], [inert]')) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) === 0) return false;
      if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector(':scope > summary')?.contains(el)) return false;
    }
    return true;
  };
  const controls = 'button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="link"]';
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (!(el instanceof HTMLElement || el instanceof SVGElement) || !visible(el)) continue;
    if (el.closest('[aria-hidden="true"],[data-decorative="true"]')) { decorativeElementsExcludedCount++; continue; }
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const identity = { selector: getSelector(el), element: el.tagName.toLowerCase(), role: el.getAttribute('role') || undefined, accessibleName: el.getAttribute('aria-label') || undefined, boundingBox: box(el) };
    const styles = { overflowX: cs.overflowX, overflowY: cs.overflowY, position: cs.position, display: cs.display, width: cs.width, maxWidth: cs.maxWidth };
    const ancestors: Element[] = [];
    for (let parent = el.parentElement; parent && root.contains(parent); parent = parent.parentElement) ancestors.push(parent);
    const scrollAncestor = ancestors.find(scrolls);
    const essential2D = essential(el);
    if (scrolls(el)) {
      nestedScrollContainers.push({ ...identity, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowPx: el.scrollWidth - el.clientWidth,
        isEssential2D: essential2D || !!el.querySelector('table,canvas,video,[data-essential-2d="true"]'), computedStyles: styles });
    }
    if (!meaningful(el)) continue;
    const clipAncestor = ancestors.find(parent => /^(hidden|clip)$/.test(getComputedStyle(parent).overflowX));
    const clipRect = clipAncestor?.getBoundingClientRect();
    const clipDeficit = clipRect ? Math.max(0, rect.right - clipRect.right, clipRect.left - rect.left) : 0;
    // scrollWidth can include intentionally clipped decorative descendants.
    // For self-clipping, inspect actual direct text fragments; child boxes are
    // handled independently and decorative children are excluded above.
    let selfClip = 0;
    if (/^(hidden|clip)$/.test(cs.overflowX) && el.scrollWidth - el.clientWidth > tolerance) {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE || !/\S/.test(node.textContent || '')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const fragment of Array.from(range.getClientRects())) selfClip = Math.max(selfClip, fragment.right - rect.right, rect.left - fragment.left);
      }
    }
    if (!scrollAncestor && !essential2D && (clipDeficit > tolerance || selfClip > tolerance)) {
      ancestorClippedElements.push({ ...identity, ancestorSelector: clipAncestor ? getSelector(clipAncestor) : identity.selector,
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, clipDeficitPx: Math.max(clipDeficit, selfClip),
        computedStyles: { overflowX: clipAncestor ? getComputedStyle(clipAncestor).overflowX : cs.overflowX, overflowY: clipAncestor ? getComputedStyle(clipAncestor).overflowY : cs.overflowY } });
    }
    if (el !== root && !scrollAncestor && !clipAncestor && (rect.right > right + tolerance || rect.left < left - tolerance)) {
      overflowingElements.push({ ...identity, isEssential2D: essential2D, computedStyles: styles });
    }
    if (el.matches(controls) && !el.matches(':disabled') && !scrollAncestor) {
      const deficit = Math.max(0, rect.right - viewport.width, -rect.left, clipDeficit);
      if (deficit > tolerance) clippedControls.push({ ...identity, violation: clipDeficit > tolerance ? 'outside-clipping-ancestor' : 'outside-viewport', clipDeficitPx: deficit });
    }
  }
  const scopeScrollWidth = scrolls(root) ? clientWidth + Math.max(0, bounds.right - viewport.width, -bounds.left) : root.scrollWidth;
  return {
    viewport, scopeSelector: selector, scopeBoundingBox: box(root),
    scrollWidth: scopeScrollWidth, rawScopeScrollWidth: root.scrollWidth, clientWidth, horizontalOverflowPx: Math.max(0, scopeScrollWidth - clientWidth),
    hasDocumentHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + tolerance,
    rawDocumentScrollWidth: document.documentElement.scrollWidth, rawDocumentClientWidth: document.documentElement.clientWidth,
    overflowingElements, nestedScrollContainers, ancestorClippedElements, clippedControls, decorativeElementsExcludedCount,
  };
}
