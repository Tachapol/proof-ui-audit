# ProofUI UX/UI Audit Report

## Audit Metadata

- **Run ID**: `pilot-pilot-ui-12-6716d779-dee8-40ad-a379-ac13afa1a645`
- **Audit Timestamp**: 2026-11-16T22:09:58.765Z
- **Export Timestamp**: 2026-11-16T22:09:58.770Z
- **Target URL**: http://localhost:3123/fixtures/pilot-ui-12
- **Fixture ID**: `pilot-ui-12`
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
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
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

- **Execution**: skipped; **Applicability**: unknown; **Outcome**: null; **Unit**: heading level
No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "skipped",
  "applicability": "unknown",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Compare quarterly results",
      "boundingBox": {
        "x": 32,
        "y": 232.859375,
        "width": 256,
        "height": 72
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
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
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

- **Execution**: skipped; **Applicability**: unknown; **Outcome**: null; **Unit**: heading level
No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "skipped",
  "applicability": "unknown",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Compare quarterly results",
      "boundingBox": {
        "x": 32,
        "y": 211.171875,
        "width": 311,
        "height": 36
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
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
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

- **Execution**: skipped; **Applicability**: unknown; **Outcome**: null; **Unit**: heading level
No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "skipped",
  "applicability": "unknown",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-12",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "No comparable heading transition; the first heading needs an explicit component parent level to assess its outer boundary.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Compare quarterly results",
      "boundingBox": {
        "x": 32,
        "y": 158.484375,
        "width": 1376,
        "height": 36
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
| Total Raw Occurrences | 16 |
| Unique Grouped Issues | 6 |
| Candidate Failures (`candidateFail`) | 0 |
| Needs Human Review (`needsReview`) | 1 |
| Passed Checks (`pass`) | 5 |
| Priority Breakdown | P0: 0 | P1: 0 | P2: 0 | P3: 6 |

## Candidate Failures

No candidate failures identified during this audit run.

## Needs-Review Items

### 1. Essential two-dimensional nested scroll requires review (344px overflow)

- **Rule ID**: `reflow`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.10 Reflow`
- **Status**: `needsReview`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Nested scroll container associated with essential 2D component. Designer review required.
- **Occurrence Count**: 1 across 320×640
- **Element**: `<div>`
- **Role**: region
- **Accessible Name**: "Quarterly results"
- **Exception / Review Reason**: Essential two-dimensional presentation exception: WCAG 2.2 SC 1.4.10 permits 2D scrolling where spatial layout is essential.

**Target Selector**:
```css
#fixture-content > div:nth-child(1) > section:nth-child(1) > div:nth-child(3)
```

**Measured Evidence**:
```json
{
  "scrollWidth": 600,
  "isNestedScroll": true,
  "clientWidth": 256,
  "horizontalOverflowPx": 344,
  "isEssential2D": true,
  "computedStyles": {
    "overflowX": "auto",
    "overflowY": "auto",
    "position": "static",
    "display": "block",
    "width": "256px",
    "maxWidth": "none"
  },
  "metricVersion": "1.1.0",
  "unit": "CSS px",
  "scopeSelector": "#fixture-content",
  "rawHorizontalOverflowPx": 0,
  "rawDocumentScrollWidth": 320,
  "rawDocumentClientWidth": 320,
  "rawScopeScrollWidth": 288,
  "decorativeElementsExcludedCount": 0
}
```

**Expected Threshold**:
```json
{
  "maxOverflowPx": 1,
  "thresholdDescription": "Single-column reflow without horizontal scrolling in nested containers unless essential"
}
```


## Passed Checks

### 1. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<span>`
- **Accessible Name**: "Interface study"

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

### 2. Text contrast meets 4.5:1 (15.44:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 15.44:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h1>`
- **Accessible Name**: "UI-12: Quarterly Financial Table (2D Data)"

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

### 3. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Complex two-dimensional financial data table in a "

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

### 4. Text contrast meets 3:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 3:1 threshold for large text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Compare quarterly results"

**Target Selector**:
```css
h2
```

**Measured Evidence**:
```json
{
  "contrastRatio": 17.74,
  "fontSizePx": 24,
  "fontWeight": 400,
  "isLargeText": true,
  "color": "rgb(17, 24, 39)",
  "backgroundColor": "rgba(255, 255, 255, 1)",
  "hasComplexBackground": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 3,
  "thresholdDescription": "At least 3:1 for large text (>= 24px or >= 18.66px bold [weight >= 700])"
}
```


---

### 5. Text contrast meets 4.5:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Compare revenue and costs across quarters."

**Target Selector**:
```css
p
```

**Measured Evidence**:
```json
{
  "contrastRatio": 17.74,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(17, 24, 39)",
  "backgroundColor": "rgba(255, 255, 255, 1)",
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
