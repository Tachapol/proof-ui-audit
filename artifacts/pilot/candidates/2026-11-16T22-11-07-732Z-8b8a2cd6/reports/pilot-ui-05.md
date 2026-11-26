# ProofUI UX/UI Audit Report

## Audit Metadata

- **Run ID**: `pilot-pilot-ui-05-7ee85a9e-51ea-4309-a830-e2e035eebf79`
- **Audit Timestamp**: 2026-11-16T22:12:16.120Z
- **Export Timestamp**: 2026-11-16T22:12:16.129Z
- **Target URL**: http://localhost:3123/fixtures/pilot-ui-05
- **Fixture ID**: `pilot-ui-05`
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
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [
    {
      "target": {
        "selector": "#course-card > button:nth-child(3)",
        "element": "button",
        "accessibleName": "Add course",
        "boundingBox": {
          "x": 50,
          "y": 337.171875,
          "width": 112.9375,
          "height": 44
        },
        "actionId": "#course-card > button:nth-child(3)"
      },
      "nearestTarget": null,
      "distance": null,
      "overlap": null,
      "overlapArea": null,
      "geometryValid": true,
      "unit": "CSS px",
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

### heading-hierarchy v1.0.0 — 320×640

- **Execution**: completed; **Applicability**: applicable; **Outcome**: pass; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "pass",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Course details",
      "boundingBox": {
        "x": 32,
        "y": 211.171875,
        "width": 256,
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
    },
    {
      "selector": "#course-card > h3:nth-child(1)",
      "element": "h3",
      "accessibleName": "Introduction to product design",
      "boundingBox": {
        "x": 50,
        "y": 265.171875,
        "width": 424,
        "height": 24
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)"
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
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [
    {
      "target": {
        "selector": "#course-card > button:nth-child(3)",
        "element": "button",
        "accessibleName": "Add course",
        "boundingBox": {
          "x": 50,
          "y": 306.171875,
          "width": 112.9375,
          "height": 44
        },
        "actionId": "#course-card > button:nth-child(3)"
      },
      "nearestTarget": null,
      "distance": null,
      "overlap": null,
      "overlapArea": null,
      "geometryValid": true,
      "unit": "CSS px",
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

### heading-hierarchy v1.0.0 — 375×812

- **Execution**: completed; **Applicability**: applicable; **Outcome**: pass; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "pass",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Course details",
      "boundingBox": {
        "x": 32,
        "y": 180.171875,
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
    },
    {
      "selector": "#course-card > h3:nth-child(1)",
      "element": "h3",
      "accessibleName": "Introduction to product design",
      "boundingBox": {
        "x": 50,
        "y": 234.171875,
        "width": 424,
        "height": 24
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)"
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
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": null,
  "reason": "Fewer than two independent pointer targets; no nearest pair is available.",
  "measurements": [
    {
      "target": {
        "selector": "#course-card > button:nth-child(3)",
        "element": "button",
        "accessibleName": "Add course",
        "boundingBox": {
          "x": 50,
          "y": 284.484375,
          "width": 112.9375,
          "height": 44
        },
        "actionId": "#course-card > button:nth-child(3)"
      },
      "nearestTarget": null,
      "distance": null,
      "overlap": null,
      "overlapArea": null,
      "geometryValid": true,
      "unit": "CSS px",
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

### heading-hierarchy v1.0.0 — 1440×900

- **Execution**: completed; **Applicability**: applicable; **Outcome**: pass; **Unit**: heading level
DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.

```json
{
  "metricId": "heading-hierarchy",
  "metricVersion": "1.0.0",
  "unit": "heading level",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-05",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "pass",
  "reason": "DOM heading order within the designated UI; deeper skips request context review. Returning to a higher rank is allowed.",
  "measurements": [
    {
      "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)",
      "element": "h2",
      "accessibleName": "Course details",
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
    },
    {
      "selector": "#course-card > h3:nth-child(1)",
      "element": "h3",
      "accessibleName": "Introduction to product design",
      "boundingBox": {
        "x": 50,
        "y": 212.484375,
        "width": 424,
        "height": 24
      },
      "level": 3,
      "rawAriaLevel": null,
      "source": "native",
      "domIndex": 1,
      "previousHeading": {
        "level": 2,
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)"
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
| Total Raw Occurrences | 28 |
| Unique Grouped Issues | 10 |
| Candidate Failures (`candidateFail`) | 1 |
| Needs Human Review (`needsReview`) | 0 |
| Passed Checks (`pass`) | 9 |
| Priority Breakdown | P0: 0 | P1: 1 | P2: 0 | P3: 9 |

## Candidate Failures

### 1. Unintended horizontal overflow at 320px (188px overflow)

- **Rule ID**: `reflow`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.10 Reflow`
- **Status**: `candidateFail`
- **Project Priority**: **P1** (Initial: P1)
- **Priority Rationale**: Project Heuristic P1 (Not WCAG Severity): Severe horizontal overflow (&gt;50px) forcing bidirectional scrolling on mobile. Designer reprioritization supported.
- **Occurrence Count**: 1 across 320×640
- **Element**: `<article>`

**Target Selector**:
```css
#course-card
```

**Measured Evidence**:
```json
{
  "scrollWidth": 476,
  "clientWidth": 288,
  "horizontalOverflowPx": 188,
  "computedStyles": {
    "overflowX": "visible",
    "overflowY": "visible",
    "position": "static",
    "display": "block",
    "width": "460px",
    "maxWidth": "none"
  },
  "metricVersion": "1.1.0",
  "unit": "CSS px",
  "scopeSelector": "#fixture-content",
  "rawHorizontalOverflowPx": 188,
  "rawDocumentScrollWidth": 492,
  "rawDocumentClientWidth": 320,
  "rawScopeScrollWidth": 476,
  "decorativeElementsExcludedCount": 0
}
```

**Expected Threshold**:
```json
{
  "maxOverflowPx": 1,
  "thresholdDescription": "Content must reflow without two-dimensional scrolling at 320 CSS px"
}
```


## Needs-Review Items

No items requiring manual designer review were identified.

## Passed Checks

### 1. Heading transition follows DOM hierarchy advisory

- **Rule ID**: `heading-hierarchy`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `pass`
- **Metric**: heading-hierarchy v1.0.0; heading level; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h3>`
- **Accessible Name**: "Introduction to product design"

**Target Selector**:
```css
#course-card > h3:nth-child(1)
```

**Measured Evidence**:
```json
{
  "selector": "#course-card > h3:nth-child(1)",
  "element": "h3",
  "accessibleName": "Introduction to product design",
  "boundingBox": {
    "x": 50,
    "y": 265.171875,
    "width": 424,
    "height": 24
  },
  "level": 3,
  "rawAriaLevel": null,
  "source": "native",
  "domIndex": 1,
  "previousHeading": {
    "level": 2,
    "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > h2:nth-child(1)"
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

### 2. Target size meets 24×24 CSS px (112.9×44 px)

- **Rule ID**: `target-size`
- **WCAG Criterion**: `WCAG 2.2 SC 2.5.8 Target Size (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Target meets or exceeds the 24×24 CSS px minimum requirement.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<button>`
- **Role**: button
- **Accessible Name**: "Add course"

**Target Selector**:
```css
button
```

**Measured Evidence**:
```json
{
  "width": 112.9,
  "height": 44,
  "isInline": false,
  "hasSufficientSpacing": true
}
```

**Expected Threshold**:
```json
{
  "minWidth": 24,
  "minHeight": 24,
  "thresholdDescription": "At least 24 × 24 CSS px or qualifying WCAG 2.2 spacing exception"
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

### 4. Text contrast meets 4.5:1 (15.44:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 15.44:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h1>`
- **Accessible Name**: "UI-05: Course Card (Fixed 460px)"

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

### 5. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Fixed-width container overflowing horizontal viewp"

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

### 6. Text contrast meets 3:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 3:1 threshold for large text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Course details"

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

### 7. Text contrast meets 4.5:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h3>`
- **Accessible Name**: "Introduction to product design"

**Target Selector**:
```css
h3
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


---

### 8. Text contrast meets 4.5:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Learn to plan interfaces, review evidence and expl"

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


---

### 9. Text contrast meets 4.5:1 (8.72:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 8.72:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<button>`
- **Accessible Name**: "Add course"

**Target Selector**:
```css
button
```

**Measured Evidence**:
```json
{
  "contrastRatio": 8.72,
  "fontSizePx": 16,
  "fontWeight": 400,
  "isLargeText": false,
  "color": "rgb(255, 255, 255)",
  "backgroundColor": "rgba(30, 64, 175, 1)",
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
