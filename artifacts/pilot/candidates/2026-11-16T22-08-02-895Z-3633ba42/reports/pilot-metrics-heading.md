# ProofUI UX/UI Audit Report

## Audit Metadata

- **Run ID**: `pilot-pilot-metrics-heading-b25bdf52-4b86-4437-aaf5-73bedbc5bd53`
- **Audit Timestamp**: 2026-11-16T22:10:00.756Z
- **Export Timestamp**: 2026-11-16T22:10:00.766Z
- **Target URL**: http://localhost:3123/fixtures/pilot-metrics-heading
- **Fixture ID**: `pilot-metrics-heading`
- **Tested Viewports**: 320×640, 375×812, 1440×900

## Pilot Metric Evidence

Project advisories only. Execution status and applicability are independent of the inspection outcome. null means unmeasured or unavailable, never zero.

### touch-target-spacing v1.0.0 — 320×640

- **Execution**: skipped; **Applicability**: not_applicable; **Outcome**: null; **Unit**: CSS px
Fewer than two independent pointer targets; no nearest pair is available.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "skipped",
  "applicability": "not_applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

### heading-hierarchy v1.0.0 — 320×640

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#heading-start",
      "element": "h2",
      "accessibleName": "Overview",
      "boundingBox": {
        "x": 16,
        "y": 288.15625,
        "width": 288,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 0,
      "previousHeading": null,
      "skippedLevels": null,
      "boundaryContextKnown": false,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": null
    },
    {
      "selector": "#heading-skip",
      "element": "h4",
      "accessibleName": "Deeper subsection",
      "boundingBox": {
        "x": 16,
        "y": 263.359375,
        "width": 288,
        "height": 24.796875
      },
      "level": 4,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-start"
      },
      "skippedLevels": 1,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "selector": "#heading-return",
      "element": "h2",
      "accessibleName": "Next overview",
      "boundingBox": {
        "x": 16,
        "y": 238.5625,
        "width": 288,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 2,
      "previousHeading": {
        "level": 4,
        "selector": "#heading-skip"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#aria-heading",
      "element": "div",
      "accessibleName": "ARIA subsection",
      "boundingBox": {
        "x": 16,
        "y": 213.765625,
        "width": 288,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": "3",
      "source": "aria",
      "domIndex": 3,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-return"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#heading-peer",
      "element": "h3",
      "accessibleName": "Peer section",
      "boundingBox": {
        "x": 16,
        "y": 188.96875,
        "width": 288,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 4,
      "previousHeading": {
        "level": 3,
        "selector": "#aria-heading"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    }
  ],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

### touch-target-spacing v1.0.0 — 375×812

- **Execution**: skipped; **Applicability**: not_applicable; **Outcome**: null; **Unit**: CSS px
Fewer than two independent pointer targets; no nearest pair is available.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "skipped",
  "applicability": "not_applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

### heading-hierarchy v1.0.0 — 375×812

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#heading-start",
      "element": "h2",
      "accessibleName": "Overview",
      "boundingBox": {
        "x": 16,
        "y": 288.15625,
        "width": 343,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 0,
      "previousHeading": null,
      "skippedLevels": null,
      "boundaryContextKnown": false,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": null
    },
    {
      "selector": "#heading-skip",
      "element": "h4",
      "accessibleName": "Deeper subsection",
      "boundingBox": {
        "x": 16,
        "y": 263.359375,
        "width": 343,
        "height": 24.796875
      },
      "level": 4,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-start"
      },
      "skippedLevels": 1,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "selector": "#heading-return",
      "element": "h2",
      "accessibleName": "Next overview",
      "boundingBox": {
        "x": 16,
        "y": 238.5625,
        "width": 343,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 2,
      "previousHeading": {
        "level": 4,
        "selector": "#heading-skip"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#aria-heading",
      "element": "div",
      "accessibleName": "ARIA subsection",
      "boundingBox": {
        "x": 16,
        "y": 213.765625,
        "width": 343,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": "3",
      "source": "aria",
      "domIndex": 3,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-return"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#heading-peer",
      "element": "h3",
      "accessibleName": "Peer section",
      "boundingBox": {
        "x": 16,
        "y": 188.96875,
        "width": 343,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 4,
      "previousHeading": {
        "level": 3,
        "selector": "#aria-heading"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    }
  ],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

### touch-target-spacing v1.0.0 — 1440×900

- **Execution**: skipped; **Applicability**: not_applicable; **Outcome**: null; **Unit**: CSS px
Fewer than two independent pointer targets; no nearest pair is available.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "skipped",
  "applicability": "not_applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

### heading-hierarchy v1.0.0 — 1440×900

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-metrics-heading",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#heading-start",
      "element": "h2",
      "accessibleName": "Overview",
      "boundingBox": {
        "x": 16,
        "y": 266.46875,
        "width": 1408,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 0,
      "previousHeading": null,
      "skippedLevels": null,
      "boundaryContextKnown": false,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": null
    },
    {
      "selector": "#heading-skip",
      "element": "h4",
      "accessibleName": "Deeper subsection",
      "boundingBox": {
        "x": 16,
        "y": 241.671875,
        "width": 1408,
        "height": 24.796875
      },
      "level": 4,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-start"
      },
      "skippedLevels": 1,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "selector": "#heading-return",
      "element": "h2",
      "accessibleName": "Next overview",
      "boundingBox": {
        "x": 16,
        "y": 216.875,
        "width": 1408,
        "height": 24.796875
      },
      "level": 2,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 2,
      "previousHeading": {
        "level": 4,
        "selector": "#heading-skip"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#aria-heading",
      "element": "div",
      "accessibleName": "ARIA subsection",
      "boundingBox": {
        "x": 16,
        "y": 192.078125,
        "width": 1408,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": "3",
      "source": "aria",
      "domIndex": 3,
      "previousHeading": {
        "level": 2,
        "selector": "#heading-return"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "selector": "#heading-peer",
      "element": "h3",
      "accessibleName": "Peer section",
      "boundingBox": {
        "x": 16,
        "y": 167.28125,
        "width": 1408,
        "height": 24.796875
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 4,
      "previousHeading": {
        "level": 3,
        "selector": "#aria-heading"
      },
      "skippedLevels": 0,
      "boundaryContextKnown": true,
      "unit": "heading level",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    }
  ],
  "limitations": [
    "One rendered DOM state only; interactions are not opened or combined across states.",
    "Pointer candidates use native controls, interactive roles, direct pointer listeners/handlers and data-audit-pointer-target. Arbitrary delegated JavaScript actions may be missed.",
    "Axis-aligned bounding boxes; shadow DOM, iframe contents and non-rectangular hit areas are outside this pilot."
  ]
}
```

## Scope and Disclaimers

> [!IMPORTANT]  
> Only five selected WCAG-informed criteria were tested (Text Contrast, Non-text Contrast, Target Size, Reflow, Text Spacing).

> [!IMPORTANT]  
> Automated results do not establish complete WCAG conformance.

> [!IMPORTANT]  
> 'candidateFail' is an automated candidate issue and requires human verification.

> [!IMPORTANT]  
> 'needsReview' requires human interpretation and design context validation.

> [!IMPORTANT]  
> P0–P3 is a project heuristic and not a severity scale defined by WCAG.

> [!IMPORTANT]  
> AI-generated explanations and recommendations are advisory decision-support only.

> [!IMPORTANT]  
> The UX/UI designer retains authority and makes the final decision on all items.

> [!IMPORTANT]  
> Touch Target Spacing and Heading Hierarchy are additional pilot project advisories. A gap below 8 CSS px or a heading-level skip is not an automatic WCAG failure. Metric execution and applicability are separate from findings.

## Summary Counts

| Metric | Count |
| :--- | :--- |
| Total Raw Occurrences | 37 |
| Unique Grouped Issues | 13 |
| Candidate Failures (`candidateFail`) | 0 |
| Needs Human Review (`needsReview`) | 1 |
| Passed Checks (`pass`) | 12 |
| Priority Breakdown | P0: 0 | P1: 0 | P2: 0 | P3: 13 |

## Candidate Failures

No candidate failures identified during this audit run.

## Needs-Review Items

### 1. Heading level skip requires context review

- **Rule ID**: `heading-hierarchy`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `needsReview`
- **Metric**: heading-hierarchy v1.0.0; heading level; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h4>`
- **Accessible Name**: "Deeper subsection"

**Target Selector**:
```css
#heading-skip
```

**Measured Evidence**:
```json
{
  "selector": "#heading-skip",
  "element": "h4",
  "accessibleName": "Deeper subsection",
  "boundingBox": {
    "x": 16,
    "y": 263.359375,
    "width": 288,
    "height": 24.796875
  },
  "level": 4,
  "rawAriaLevel": null,
  "source": "native",
  "domIndex": 1,
  "previousHeading": {
    "level": 2,
    "selector": "#heading-start"
  },
  "skippedLevels": 1,
  "boundaryContextKnown": true,
  "unit": "heading level",
  "metricVersion": "1.0.0",
  "outcome": "needsReview"
}
```

**Expected Threshold**:
```json
{
  "maxDeeperStep": 1,
  "upwardTransitionsAllowed": true,
  "basis": "project-advisory"
}
```


## Passed Checks

### 1. Content reflows without 2D scrolling at 320px

- **Rule ID**: `reflow`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.10 Reflow`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Content reflows cleanly without horizontal overflow or clipping at 320 CSS px.
- **Occurrence Count**: 1 across 320×640
- **Element**: `<html>`

**Target Selector**:
```css
#fixture-content
```

**Measured Evidence**:
```json
{
  "scrollWidth": 288,
  "clientWidth": 288,
  "horizontalOverflowPx": 0,
  "overflowingElementsCount": 0,
  "metricVersion": "1.1.0",
  "unit": "CSS px",
  "scopeSelector": "#fixture-content",
  "rawHorizontalOverflowPx": 0,
  "rawDocumentScrollWidth": 320,
  "rawDocumentClientWidth": 320,
  "rawScopeScrollWidth": 288,
  "decorativeElementsExcludedCount": 2
}
```

**Expected Threshold**:
```json
{
  "maxOverflowPx": 1,
  "thresholdDescription": "No horizontal scrolling required at 320 CSS px (overflow <= 1.0px tolerance)"
}
```


---

### 2. Heading transition follows DOM hierarchy advisory

- **Rule ID**: `heading-hierarchy`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `pass`
- **Metric**: heading-hierarchy v1.0.0; heading level; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Next overview"

**Target Selector**:
```css
#heading-return
```

**Measured Evidence**:
```json
{
  "selector": "#heading-return",
  "element": "h2",
  "accessibleName": "Next overview",
  "boundingBox": {
    "x": 16,
    "y": 238.5625,
    "width": 288,
    "height": 24.796875
  },
  "level": 2,
  "rawAriaLevel": null,
  "source": "native",
  "domIndex": 2,
  "previousHeading": {
    "level": 4,
    "selector": "#heading-skip"
  },
  "skippedLevels": 0,
  "boundaryContextKnown": true,
  "unit": "heading level",
  "metricVersion": "1.0.0",
  "outcome": "pass"
}
```

**Expected Threshold**:
```json
{
  "maxDeeperStep": 1,
  "upwardTransitionsAllowed": true,
  "basis": "project-advisory"
}
```


---

### 3. Heading transition follows DOM hierarchy advisory

- **Rule ID**: `heading-hierarchy`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `pass`
- **Metric**: heading-hierarchy v1.0.0; heading level; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<div>`
- **Accessible Name**: "ARIA subsection"

**Target Selector**:
```css
#aria-heading
```

**Measured Evidence**:
```json
{
  "selector": "#aria-heading",
  "element": "div",
  "accessibleName": "ARIA subsection",
  "boundingBox": {
    "x": 16,
    "y": 213.765625,
    "width": 288,
    "height": 24.796875
  },
  "level": 3,
  "rawAriaLevel": "3",
  "source": "aria",
  "domIndex": 3,
  "previousHeading": {
    "level": 2,
    "selector": "#heading-return"
  },
  "skippedLevels": 0,
  "boundaryContextKnown": true,
  "unit": "heading level",
  "metricVersion": "1.0.0",
  "outcome": "pass"
}
```

**Expected Threshold**:
```json
{
  "maxDeeperStep": 1,
  "upwardTransitionsAllowed": true,
  "basis": "project-advisory"
}
```


---

### 4. Heading transition follows DOM hierarchy advisory

- **Rule ID**: `heading-hierarchy`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `pass`
- **Metric**: heading-hierarchy v1.0.0; heading level; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h3>`
- **Accessible Name**: "Peer section"

**Target Selector**:
```css
#heading-peer
```

**Measured Evidence**:
```json
{
  "selector": "#heading-peer",
  "element": "h3",
  "accessibleName": "Peer section",
  "boundingBox": {
    "x": 16,
    "y": 188.96875,
    "width": 288,
    "height": 24.796875
  },
  "level": 3,
  "rawAriaLevel": null,
  "source": "native",
  "domIndex": 4,
  "previousHeading": {
    "level": 3,
    "selector": "#aria-heading"
  },
  "skippedLevels": 0,
  "boundaryContextKnown": true,
  "unit": "heading level",
  "metricVersion": "1.0.0",
  "outcome": "pass"
}
```

**Expected Threshold**:
```json
{
  "maxDeeperStep": 1,
  "upwardTransitionsAllowed": true,
  "basis": "project-advisory"
}
```


---

### 5. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<span>`
- **Accessible Name**: "ProofUI Test Fixture: pilot-metrics"

**Target Selector**:
```css
span
```

**Measured Evidence**:
```json
{
  "contrastRatio": 5.42,
  "fontSizePx": 12,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(103, 103, 103)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 6. Text contrast meets 4.5:1 (15.44:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 15.44:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h1>`
- **Accessible Name**: "Pilot Metrics: heading"

**Target Selector**:
```css
h1
```

**Measured Evidence**:
```json
{
  "contrastRatio": 15.44,
  "fontSizePx": 20,
  "fontWeight": 600,
  "isLargeText": false,
  "color": "rgb(32, 33, 35)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 7. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Controlled heading evidence for the two pilot proj"

**Target Selector**:
```css
p
```

**Measured Evidence**:
```json
{
  "contrastRatio": 5.42,
  "fontSizePx": 14,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(103, 103, 103)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 8. Text contrast meets 4.5:1 (19.06:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 19.06:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Overview"

**Target Selector**:
```css
#heading-start
```

**Measured Evidence**:
```json
{
  "contrastRatio": 19.06,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(9, 9, 11)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 9. Text contrast meets 4.5:1 (19.06:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 19.06:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h4>`
- **Accessible Name**: "Deeper subsection"

**Target Selector**:
```css
#heading-skip
```

**Measured Evidence**:
```json
{
  "contrastRatio": 19.06,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(9, 9, 11)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 10. Text contrast meets 4.5:1 (19.06:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 19.06:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Next overview"

**Target Selector**:
```css
#heading-return
```

**Measured Evidence**:
```json
{
  "contrastRatio": 19.06,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(9, 9, 11)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 11. Text contrast meets 4.5:1 (19.06:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 19.06:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<div>`
- **Role**: heading
- **Accessible Name**: "ARIA subsection"

**Target Selector**:
```css
#aria-heading
```

**Measured Evidence**:
```json
{
  "contrastRatio": 19.06,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(9, 9, 11)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


---

### 12. Text contrast meets 4.5:1 (19.06:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 19.06:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h3>`
- **Accessible Name**: "Peer section"

**Target Selector**:
```css
#heading-peer
```

**Measured Evidence**:
```json
{
  "contrastRatio": 19.06,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(9, 9, 11)",
  "backgroundColor": "rgba(250, 250, 250, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 4.5,
  "thresholdDescription": "At least 4.5:1 for normal text"
}
```


## Designer Decisions

No designer decisions have been recorded for this run yet.

## Decision History

No historical decision events recorded.

## AI / Fallback Provenance

No AI or fallback guidance was requested for this audit run.

## Known Limitations

- Default audit viewports are 1440px, 375px and 320px. Reflow is evaluated at 320 CSS px; explicitly restricted audits may use other viewport sets.
- Dynamic interactive animations, single-page application route transitions, and authenticated states are excluded from automated auditing.
- Text and elements over complex canvas, dynamic video, or multi-layered CSS blend modes require manual designer review.
