# Pilot advisory metrics v1.0.0

These two metrics extend the existing five checks. They do not change Target Size's WCAG 2.5.8 circle-based spacing alternative. No result from either metric is an automatic WCAG failure. Warnings use `needsReview`; a measured clean transition/pair uses `pass` only within the project advisory scope.

## UI scope and component context

Extraction selects exactly one experimental UI root: `#fixture-content` for known fixtures, otherwise an explicit `[data-audit-scope]` marker, otherwise `#sandbox-root` for snippets. Fixture headings and descriptions outside `#fixture-content` are excluded from these two metrics. There is no whole-document fallback. Existing five extractors retain their existing scopes.

Both `/api/audit` and `/api/sandbox/audit` accept an optional explicit configuration:

```json
{
  "pilotScope": {
    "selector": "#component-under-study",
    "parentHeadingLevel": 2
  }
}
```

Alternatively put `data-audit-parent-heading-level="2"` on the selected root. For a pasted component, mark its container with both `data-audit-scope` and `data-audit-parent-heading-level`. An explicit API value takes precedence. Raw parent context is retained even when invalid. The fixture header is never used to infer a parent. With no declared parent, the first heading's outer transition is unknown; later DOM transitions can still be assessed. One root is one component context; audit independently scoped components separately with their own parent declarations.

Text Contrast MVP intentionally retains its original text-only scope; pilot metric execution is recorded as skipped. Old runs without `metricResults` remain readable.

## Touch Target Spacing

Pointer candidates include native controls (including associated labels), interactive ARIA roles, direct pointer handlers/listeners, and explicit `data-audit-pointer-target` elements. Chromium's `DOMDebugger.getEventListeners` discovers direct `addEventListener` handlers without modifying page JavaScript. Removed listeners do not create candidates. Disabled, inert, hidden, transparent, pointer-events-none and closed-disclosure descendants are excluded. Visually present `aria-hidden` actions are still pointer candidates.

Nested wrappers for the same action are collapsed. Native/ARIA controls that express separate nested actions remain independent. Use distinct `data-audit-action-id` values to disambiguate custom nested actions; sharing a value explicitly declares one action. Associated labels and controls share an action ID and are not compared against one another. Distinct controls with identical text, URLs or bounding boxes are not deduplicated.

For rectangles A and B:

```text
dx = max(A.left - B.right, B.left - A.right, 0)
dy = max(A.top - B.bottom, B.top - A.bottom, 0)
distance = hypot(dx, dy)       // CSS px; no threshold rounding
overlap = overlapWidth > 0 && overlapHeight > 0
```

Each target retains its nearest independent target, both element identities/bounding boxes, raw distance, overlap flag and overlap area (CSS px squared). Contact gives distance 0 with overlap false; actual overlap gives distance 0 with overlap true. For ties, overlap takes precedence, then larger overlap area, then selector order. Pairs may occur twice, once per target. `< 8` CSS px is `needsReview`; exactly 8 is a measured advisory pass. No available pair gives `nearestTarget: null`, `distance: null`, `overlap: null`, `overlapArea: null`, never a fabricated zero.

This uses axis-aligned bounding boxes, not WCAG's 24 CSS px spacing circles or a full pointer hit-area model. The existing `target-size` results remain separate. The snapshot is collected before Text Spacing overrides, without opening other interaction states.

## Heading Hierarchy

Read native h1–h6 and ARIA headings with a valid positive integer `aria-level` (ARIA levels above 6 are supported). Preserve DOM order even when CSS visual order differs. Hidden/aria-hidden headings and fixture chrome are excluded.

Deeper jumps greater than one level request context review: H2 → H4 gives `needsReview`. Returning to a higher-ranked section, e.g. H4 → H2, or staying at the same rank does not produce a skip warning. A component with parent level 2 can start at H3. No H1-per-component or single-H1 policy is inferred.

Missing/invalid ARIA levels remain in raw evidence with `level: null`. They make execution partial and interrupt the comparison sequence; no transition is invented across an unknown heading. Invalid parent context is also partial. This metric does not establish semantic section correctness or complete WCAG conformance.

## Data contract and lifecycle

`AuditRun.metricResults` stores one result per metric/viewport, including URL, UI scope, parent context, `metricVersion`, `unit`, raw measurements, reason and limitations. Applicable issue occurrences also retain `metric` metadata through grouping, normalized JSON and Markdown. Exports retain the full result even when there are no issue cards.

| Execution | Meaning | Example |
| --- | --- | --- |
| completed | Supported extraction and comparisons finished | Two independently actionable targets with valid geometry |
| partial | Some inputs or discovery coverage are unavailable | Invalid ARIA heading, invalid parent context, missing target box, incomplete pointer listener discovery |
| skipped | No comparison was attempted or possible | No scope, no headings, one target, restricted MVP scope |
| error | Extraction/browser execution failed | Invalid/ambiguous selector, navigation failure, browser failure |

`applicability` is independently `applicable`, `not_applicable`, or `unknown`. `outcome` is independently `pass`, `needsReview`, or `null`. Skipped/error/incomplete input must not become an inferred pass. A partial heading result may retain pass observations for known local transitions while the metric's overall outcome remains null. An already observed advisory warning remains a warning even if other data is partial.

Evidence UI displays lifecycle, applicability and outcome separately on Audit and Sandbox. Raw evidence is expandable. These pilot metrics use deterministic project guidance; the existing five-rule AI explanation schema and automatic patch support are not expanded.

## Fixtures and verification

Additional investigator fixtures are `pilot-metrics-spacing`, `heading`, `context`, `exceptions`, `invalid`, `single`, and `empty` (all use the `pilot-metrics-` prefix). They do not renumber or replace the existing UI-01–UI-12 stimuli.

```sh
npm run typecheck
npm run test
npx playwright test tests/pilot-metrics.spec.ts
```

The Chromium suite checks actual CSS geometry, 8/7.5/0 boundaries, overlap/contact ties, same-action nesting, distinct nested actions, direct/removed listeners, labels, hidden/disabled/closed states, DOM versus CSS order, ARIA levels, component parents, missing/invalid scopes, partial discovery, navigation errors, and both metrics through real API audit → grouping → persistence → evidence UI → JSON/Markdown export. Unit tests additionally exercise missing geometry, fractional threshold boundaries and schema compatibility.

Verification on 2026-11-17, working tree based on commit `981dae4` (uncommitted changes retained): TypeScript passed; all 304 tests in 35 Vitest files passed; all 11 pilot Chromium tests passed on Chromium `153.0.8010.12`. Spacing geometry was verified at 320×640, 375×812 and 1440×900 CSS px. Actual API audit/export tests retained the existing default audit viewports (1440×900 and 375×667); these defaults were not silently replaced by the fixture test sizes. This is local verification, not a production deployment claim.

Subsequent Reflow integration adds 320×640 to the default API audit matrix, while retaining the original desktop/mobile sizes. The historical verification above describes the earlier revision. See [Pilot preparation and freeze](pilot-freeze-workflow.md) for the current seven-metric validation workflow and required expert evidence.

## Limits not established by these tests

- Arbitrary delegated JavaScript handlers cannot reliably identify their semantic action targets. Annotate custom prototypes with roles or `data-audit-pointer-target`/`data-audit-action-id` as appropriate. Listener inspection is limited to 1,000 DOM elements per scope; exceeded or failed discovery is partial.
- Cross-frame and shadow DOM content, non-rectangular/transformed hit regions, occlusion by overlays, pseudo-element hit areas, authenticated flows and unvisited interactive states are not fully verified.
- Nearest bounding-box spacing does not establish actual touch error rates. Heading order does not establish whether headings describe content correctly. Human review remains necessary.
- A missing component parent leaves its outer heading boundary unassessed; it is never inferred from fixture chrome.

## References

- [WAI heading ranks and closing subsections](https://www.w3.org/WAI/tutorials/page-structure/headings/)
- [WAI ARIA12 heading role](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA12)
- [WAI-ARIA aria-level](https://www.w3.org/TR/wai-aria-1.2/#aria-level)
- [Chromium DOMDebugger.getEventListeners](https://chromedevtools.github.io/devtools-protocol/tot/DOMDebugger/#method-getEventListeners)
