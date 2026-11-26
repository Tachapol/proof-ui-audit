# ProofUI UX/UI Audit Report

## Audit Metadata

- **Run ID**: `pilot-pilot-ui-10-8e21e28a-6c08-4d23-8151-19093a0f55ed`
- **Audit Timestamp**: 2026-11-16T22:12:27.494Z
- **Export Timestamp**: 2026-11-16T22:12:27.503Z
- **Target URL**: http://localhost:3123/fixtures/pilot-ui-10
- **Fixture ID**: `pilot-ui-10`
- **Tested Viewports**: 320×640, 375×812, 1440×900

## Pilot Metric Evidence

Project advisories only. Execution status and applicability are independent of the inspection outcome. null means unmeasured or unavailable, never zero.

### touch-target-spacing v1.0.0 — 320×640

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: CSS px
Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
  "viewport": {
    "width": 320,
    "height": 640
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.",
  "measurements": [
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > label:nth-child(2)",
        "element": "label",
        "accessibleName": "Send updates to",
        "boundingBox": {
          "x": 32,
          "y": 250.171875,
          "width": 116.546875,
          "height": 17
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 48,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "target": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 271.171875,
          "width": 256,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "nearestTarget": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 271.171875,
          "width": 256,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
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
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
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
      "accessibleName": "Notification settings",
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

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: CSS px
Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
  "viewport": {
    "width": 375,
    "height": 812
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.",
  "measurements": [
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > label:nth-child(2)",
        "element": "label",
        "accessibleName": "Send updates to",
        "boundingBox": {
          "x": 32,
          "y": 250.171875,
          "width": 116.546875,
          "height": 17
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 48,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "target": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 271.171875,
          "width": 311,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 315.171875,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "nearestTarget": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 271.171875,
          "width": 311,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
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
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
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
      "accessibleName": "Notification settings",
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

- **Execution**: completed; **Applicability**: applicable; **Outcome**: needsReview; **Unit**: CSS px
Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.

```json
{
  "metricId": "touch-target-spacing",
  "metricVersion": "1.0.0",
  "unit": "CSS px",
  "executionStatus": "completed",
  "applicability": "applicable",
  "basis": "project-advisory",
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "scopeSelector": "#fixture-content",
  "rawParentHeadingLevel": null,
  "outcome": "needsReview",
  "reason": "Nearest target edge distances in the same rendered UI state. The 8 CSS px threshold is a project advisory only.",
  "measurements": [
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > label:nth-child(2)",
        "element": "label",
        "accessibleName": "Send updates to",
        "boundingBox": {
          "x": 32,
          "y": 197.484375,
          "width": 116.546875,
          "height": 17
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 262.484375,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 48,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "pass"
    },
    {
      "target": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 218.484375,
          "width": 1376,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "nearestTarget": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 262.484375,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
    },
    {
      "target": {
        "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
        "element": "button",
        "accessibleName": "Save settings",
        "boundingBox": {
          "x": 32,
          "y": 262.484375,
          "width": 128.0625,
          "height": 44
        },
        "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
      },
      "nearestTarget": {
        "selector": "#notification-email",
        "element": "input",
        "accessibleName": "",
        "boundingBox": {
          "x": 32,
          "y": 218.484375,
          "width": 1376,
          "height": 44
        },
        "actionId": "#notification-email"
      },
      "distance": 0,
      "overlap": false,
      "overlapArea": 0,
      "geometryValid": true,
      "unit": "CSS px",
      "metricVersion": "1.0.0",
      "outcome": "needsReview"
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
  "url": "http://localhost:3123/fixtures/pilot-ui-10",
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
      "accessibleName": "Notification settings",
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
| Total Raw Occurrences | 34 |
| Unique Grouped Issues | 12 |
| Candidate Failures (`candidateFail`) | 0 |
| Needs Human Review (`needsReview`) | 2 |
| Passed Checks (`pass`) | 10 |
| Priority Breakdown | P0: 0 | P1: 0 | P2: 0 | P3: 12 |

## Candidate Failures

No candidate failures identified during this audit run.

## Needs-Review Items

### 1. Touch target spacing requires review

- **Rule ID**: `touch-target-spacing`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `needsReview`
- **Metric**: touch-target-spacing v1.0.0; CSS px; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<input>`

**Target Selector**:
```css
#notification-email
```

**Measured Evidence**:
```json
{
  "target": {
    "selector": "#notification-email",
    "element": "input",
    "accessibleName": "",
    "boundingBox": {
      "x": 32,
      "y": 271.171875,
      "width": 256,
      "height": 44
    },
    "actionId": "#notification-email"
  },
  "nearestTarget": {
    "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
    "element": "button",
    "accessibleName": "Save settings",
    "boundingBox": {
      "x": 32,
      "y": 315.171875,
      "width": 128.0625,
      "height": 44
    },
    "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
  },
  "distance": 0,
  "overlap": false,
  "overlapArea": 0,
  "geometryValid": true,
  "unit": "CSS px",
  "metricVersion": "1.0.0",
  "outcome": "needsReview"
}
```

**Expected Threshold**:
```json
{
  "advisoryMinGap": 8,
  "unit": "CSS px",
  "basis": "project-advisory"
}
```


---

### 2. Touch target spacing requires review

- **Rule ID**: `touch-target-spacing`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `needsReview`
- **Metric**: touch-target-spacing v1.0.0; CSS px; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<button>`
- **Accessible Name**: "Save settings"

**Target Selector**:
```css
#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)
```

**Measured Evidence**:
```json
{
  "target": {
    "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
    "element": "button",
    "accessibleName": "Save settings",
    "boundingBox": {
      "x": 32,
      "y": 315.171875,
      "width": 128.0625,
      "height": 44
    },
    "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
  },
  "nearestTarget": {
    "selector": "#notification-email",
    "element": "input",
    "accessibleName": "",
    "boundingBox": {
      "x": 32,
      "y": 271.171875,
      "width": 256,
      "height": 44
    },
    "actionId": "#notification-email"
  },
  "distance": 0,
  "overlap": false,
  "overlapArea": 0,
  "geometryValid": true,
  "unit": "CSS px",
  "metricVersion": "1.0.0",
  "outcome": "needsReview"
}
```

**Expected Threshold**:
```json
{
  "advisoryMinGap": 8,
  "unit": "CSS px",
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
  "decorativeElementsExcludedCount": 0
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

### 2. Touch target spacing meets project advisory

- **Rule ID**: `touch-target-spacing`
- **WCAG Criterion**: `Project advisory — no automatic WCAG failure`
- **Status**: `pass`
- **Metric**: touch-target-spacing v1.0.0; CSS px; completed; applicable; project advisory
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Pilot project advisory; contextual designer review, not WCAG severity.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<label>`
- **Accessible Name**: "Send updates to"

**Target Selector**:
```css
#fixture-content > div:nth-child(1) > section:nth-child(1) > label:nth-child(2)
```

**Measured Evidence**:
```json
{
  "target": {
    "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > label:nth-child(2)",
    "element": "label",
    "accessibleName": "Send updates to",
    "boundingBox": {
      "x": 32,
      "y": 250.171875,
      "width": 116.546875,
      "height": 17
    },
    "actionId": "#notification-email"
  },
  "nearestTarget": {
    "selector": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)",
    "element": "button",
    "accessibleName": "Save settings",
    "boundingBox": {
      "x": 32,
      "y": 315.171875,
      "width": 128.0625,
      "height": 44
    },
    "actionId": "#fixture-content > div:nth-child(1) > section:nth-child(1) > button:nth-child(4)"
  },
  "distance": 48,
  "overlap": false,
  "overlapArea": 0,
  "geometryValid": true,
  "unit": "CSS px",
  "metricVersion": "1.0.0",
  "outcome": "pass"
}
```

**Expected Threshold**:
```json
{
  "advisoryMinGap": 8,
  "unit": "CSS px",
  "basis": "project-advisory"
}
```


---

### 3. Target size meets 24×24 CSS px (128.1×44 px)

- **Rule ID**: `target-size`
- **WCAG Criterion**: `WCAG 2.2 SC 2.5.8 Target Size (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Target meets or exceeds the 24×24 CSS px minimum requirement.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<button>`
- **Role**: button
- **Accessible Name**: "Save settings"

**Target Selector**:
```css
button
```

**Measured Evidence**:
```json
{
  "width": 128.1,
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

### 4. Text contrast meets 4.5:1 (5.42:1)

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

### 5. Text contrast meets 4.5:1 (15.44:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 15.44:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h1>`
- **Accessible Name**: "UI-10: Notification Settings (High Contrast)"

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

### 6. Text contrast meets 4.5:1 (5.42:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 5.42:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<p>`
- **Accessible Name**: "Form input field with 3:1 border contrast meeting "

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

### 7. Text contrast meets 3:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 3:1 threshold for large text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<h2>`
- **Accessible Name**: "Notification settings"

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

### 8. Text contrast meets 4.5:1 (17.74:1)

- **Rule ID**: `text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.3 Contrast (Minimum)`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Contrast ratio of 17.74:1 satisfies the required 4.5:1 threshold for normal text.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<label>`
- **Accessible Name**: "Send updates to"

**Target Selector**:
```css
label
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
- **Accessible Name**: "Save settings"

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


---

### 10. Non-text contrast meets 3:1 (7.46:1)

- **Rule ID**: `non-text-contrast`
- **WCAG Criterion**: `WCAG 2.2 SC 1.4.11 Non-text Contrast`
- **Status**: `pass`
- **Project Priority**: **P3** (Initial: P3)
- **Priority Rationale**: Project Heuristic P3 (Not WCAG Severity): Non-text contrast ratio of 7.46:1 meets or exceeds the required 3:1 threshold.
- **Occurrence Count**: 3 across 320×640, 375×812, 1440×900
- **Element**: `<input>`
- **Role**: input
- **Accessible Name**: "notification-email"

**Target Selector**:
```css
#notification-email
```

**Measured Evidence**:
```json
{
  "contrastRatio": 7.46,
  "componentType": "ui-component-border",
  "indicatorColor": "rgb(85, 85, 85)",
  "adjacentColor": "#ffffff",
  "isInactiveOrDisabled": false,
  "isStateMeaningUncertain": false
}
```

**Expected Threshold**:
```json
{
  "minRatio": 3,
  "thresholdDescription": "At least 3:1 against adjacent colors for UI components and meaningful graphics"
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
