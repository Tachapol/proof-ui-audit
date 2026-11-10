# Project Metrics Reference — ProofUI Audit

> **Comprehensive reference of all metrics, measurement criteria, and heuristics in the ProofUI Audit system.**  
> Covers WCAG 2.2-informed measurement rules, color science algorithms, audit run aggregation metrics, iteration before/after delta metrics, and software verification quality gates.  
> 🌐 **Language**: English | [ภาษาไทย (Thai Version)](METRICS.md)

---

## 📑 Table of Contents
1. [WCAG 2.2 Audit Measurement Metrics (5 Criteria)](#1-wcag-22-audit-measurement-metrics)
   - [1.1 Text Contrast (SC 1.4.3)](#11-text-contrast-wcag-22-sc-143)
   - [1.2 Non-Text Contrast (SC 1.4.11)](#12-non-text-contrast-wcag-22-sc-1411)
   - [1.3 Target Size (SC 2.5.8)](#13-target-size-wcag-22-sc-258)
   - [1.4 Reflow (SC 1.4.10)](#14-reflow-wcag-22-sc-1410)
   - [1.5 Text Spacing (SC 1.4.12)](#15-text-spacing-wcag-22-sc-1412)
2. [Color Math & Luminance Calculations](#2-color-math--luminance-calculations)
3. [Audit Run & Dashboard Aggregation Metrics](#3-audit-run--dashboard-aggregation-metrics)
4. [Iteration & Optimization Delta Metrics](#4-iteration--optimization-delta-metrics)
5. [Standard Audit Viewports](#5-standard-audit-viewports)
6. [Quality & Verification Metrics](#6-quality--verification-metrics)
7. [Traceability & File Mapping](#7-traceability--file-mapping)

---

## 1. WCAG 2.2 Audit Measurement Metrics

For every finding, the engine records empirical evidence (`measured`) against normative requirements (`expected`):

### 1.1 Text Contrast (WCAG 2.2 SC 1.4.3)
Measures the luminance contrast ratio between foreground text and underlying background surfaces.

| Metric Key | Data Type | Description & Measurement Rules |
|---|---|---|
| `contrastRatio` | `number` | Presentation-rounded contrast ratio (strictly floored to 2 decimal places when failing, ensuring values like 4.496 do not misleadingly round up to 4.50). |
| `rawRatio` | `number` | Full-precision floating-point contrast ratio used exclusively for deterministic `pass` vs `candidateFail` classification. |
| `fontSizePx` | `number` | Computed font size in CSS pixels. |
| `fontWeight` | `number` | Normalized numeric font weight (`bold`/`bolder` $\rightarrow$ 700, `normal` $\rightarrow$ 400). |
| `isLargeText` | `boolean` | Large text classification flag under WCAG SC 1.4.3:<br>• `fontSizePx` $\ge 24\text{px}$ (normal weight)<br>• `fontSizePx` $\ge 18.66\text{px}$ and `fontWeight` $\ge 700$ (bold weight) |
| `hasComplexBackground` | `boolean` | Set when text is rendered over gradients, images, canvas, video, or CSS filters (triggers `needsReview`). |
| `hasAncestorGroupOpacity`| `boolean` | Set when an ancestor element has CSS `opacity < 1`, preventing deterministic flat luminance evaluation (triggers `needsReview`). |
| `hasUnresolvedTransparency` | `boolean` | Set when effective background transparency reaches root without an opaque ancestor surface (triggers `needsReview`). |

#### Thresholds & Priority Heuristics:
- **Normal Text Minimum**: **4.5:1**
- **Large Text Minimum**: **3.0:1**
- **Project Heuristic Priorities**:
  - `P1`: Severe text contrast deficit ($< 3.0:1$ for normal text; high legibility failure risk).
  - `P2`: Moderate text contrast deficit ($3.0:1$ to $4.49:1$).
  - `P3`: Meets threshold (`pass`), or human designer review required (`needsReview`).

---

### 1.2 Non-Text Contrast (WCAG 2.2 SC 1.4.11)
Measures visual contrast for active UI components (input borders, active controls, focus rings) and meaningful graphical objects.

| Metric Key | Data Type | Description & Measurement Rules |
|---|---|---|
| `contrastRatio` | `number` | Contrast ratio between visual indicator (`indicatorColor`) and adjacent surface (`adjacentColor`). |
| `componentType` | `enum` | Classified UI element type: `ui-component-border`, `ui-component-fill`, `graphical-object`, `focus-indicator`. |
| `isInactiveOrDisabled` | `boolean` | Control is disabled or inactive (exempted under SC 1.4.11; records as `pass`). |
| `isDecorativeOrLogo` | `boolean` | Purely decorative element or branding logo (exempted under SC 1.4.11; records as `pass`). |
| `isStateMeaningUncertain`| `boolean` | System cannot deterministically confirm whether visual cue conveys essential interactive state (triggers `needsReview`). |

#### Thresholds & Priority Heuristics:
- **UI Components & Meaningful Graphics Minimum**: **3.0:1**
- **Project Heuristic Priorities**:
  - `P1`: Severe non-text candidate failure ($< 2.0:1$; critical control boundaries virtually imperceptible).
  - `P2`: Moderate non-text candidate failure ($2.0:1$ to $2.99:1$).
  - `P3`: Conforms to $\ge 3.0:1$, or qualifies for statutory exception.

---

### 1.3 Target Size (WCAG 2.2 SC 2.5.8)
Measures the physical bounding box dimensions of touch and pointer interactive controls.

| Metric Key | Data Type | Description & Measurement Rules |
|---|---|---|
| `width` / `height` | `number` | Bounding box dimensions in CSS pixels (rounded to 1 decimal place). |
| `TARGET_SIZE_THRESHOLD` | `24` | Normative minimum dimension: **$24 \times 24\text{ CSS px}$**. |
| `SPACING_CIRCLE_DIAMETER` | `24` | Diameter of the centering circle for spacing exception geometry ($24\text{px}$). |
| `SPACING_CIRCLE_RADIUS` | `12` | Radius of the centering circle ($12\text{px}$). |
| `hasSufficientSpacing` | `boolean` | Whether spacing alternative geometry is satisfied: 24px diameter circle centered on target does not intersect another target or another target's spacing circle (center distance $\ge 24\text{px}$). |
| `isInline` | `boolean` | Interactive control resides inline within a sentence or text block (triggers `needsReview`). |
| `hasEquivalentTarget` | `boolean` | An equivalent control exists on the same page meeting target size (triggers `needsReview`). |
| `isUserAgentDefault` | `boolean` | Target sizing is determined purely by browser user-agent defaults (triggers `needsReview`). |

#### Thresholds & Priority Heuristics:
- **Minimum Target Size**: **$24 \times 24\text{ CSS px}$** (or qualifying spacing alternative).
- **Project Heuristic Priorities**:
  - `P1`: Severe target failure ($< 18\text{px}$ in width or height; acute risk of touchscreen touch errors).
  - `P2`: Moderate target failure ($18\text{px}$ to $23.9\text{px}$).
  - `P3`: Meets $24\text{px}$ threshold, or candidate for human review exception.

---

### 1.4 Reflow (WCAG 2.2 SC 1.4.10)
Measures layout resilience and two-dimensional scrolling avoidance at a compact viewport width of **$320\text{ CSS px}$**.

| Metric Key | Data Type | Description & Measurement Rules |
|---|---|---|
| `scrollWidth` | `number` | Total scrollable document content width (CSS px). |
| `clientWidth` | `number` | Visible document viewport width ($320\text{px}$). |
| `horizontalOverflowPx` | `number` | Net horizontal overflow calculated as $\max(0, \text{scrollWidth} - \text{clientWidth})$. |
| `HORIZONTAL_OVERFLOW_TOLERANCE_PX` | `1.0` | Subpixel rounding tolerance threshold ($1.0\text{px}$; differences $\le 1.0\text{px}$ are discarded as rounding noise). |
| `clipDeficitPx` | `number` | Pixel deficit where content or controls are permanently hidden by ancestor `overflow: hidden` without increasing `document.scrollWidth`. |
| `isEssential2D` | `boolean` | Essential 2-dimensional spatial presentation element (e.g. data tables, maps, diagrams; triggers `needsReview`). |

#### Thresholds & Priority Heuristics:
- **Maximum Permitted Horizontal Overflow**: $\le 1.0\text{ CSS px}$.
- **Project Heuristic Priorities**:
  - `P1`: Severe document overflow ($> 50\text{px}$), hidden ancestor clipping, or interactive controls positioned outside the 320px viewport.
  - `P2`: Moderate document overflow ($\le 50\text{px}$), or unintended nested horizontal scroll strips.
  - `P3`: Clean single-column reflow (`pass`), or essential 2D review items.

---

### 1.5 Text Spacing (WCAG 2.2 SC 1.4.12)
Evaluates content clipping, truncation, and layout breakage under injected WCAG text-spacing stylesheet overrides.

#### Injected Spacing Ratios (WCAG 2.2 SC 1.4.12):
- **Line height**: at least **$1.5 \times \text{fontSize}$**
- **Letter spacing**: at least **$0.12 \times \text{fontSize}$**
- **Word spacing**: at least **$0.16 \times \text{fontSize}$**
- **Paragraph margin-bottom**: at least **$2.0 \times \text{fontSize}$**  
*(Preservation Rule: Author styles exceeding these values are preserved and never reduced).*

#### Measurement Deficit Metrics:
| Metric Key | Data Type | Description & Measurement Rules |
|---|---|---|
| `verticalClipDeficit` | `number` | $\max(0, \text{candidate.scrollHeight} - \text{candidate.clientHeight})$ (hidden vertical text overflow). |
| `horizontalClipDeficit`| `number` | $\max(0, \text{candidate.scrollWidth} - \text{candidate.clientWidth})$ (nowrap/fixed horizontal clipping). |
| `isControlObscured` | `boolean` | Expanding text container overlaps or obscures an adjacent interactive button/input. |
| `isNewDocumentOverflow`| `boolean` | Applying text-spacing overrides triggered horizontal document-level scrolling. |
| `isBoundingBoxEscaped` | `boolean` | Text glyphs spill outside the container's structural bounding box. |
| `hasTextOverlap` | `boolean` | Text elements collide with or overlap adjacent sibling content. |

#### Priority Heuristics:
- `P0 (Critical)`: Interactive control obscured or rendered inoperable by expanded text.
- `P1 (High)`: Newly introduced document overflow, horizontal clipping, or severe vertical clipping ($> 15\text{px}$).
- `P2 (Medium)`: Moderate vertical clipping ($\le 15\text{px}$), or container bounding box escape.
- `P3 (Low)`: Container adapts fluidly, or ambiguous sibling badge collision requiring visual inspection.

---

## 2. Color Math & Luminance Calculations

Implementation: [`color-math.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/audit/color-math.ts)

### 2.1 Relative Luminance ($L$)
Calculated according to the WCAG 2.2 definition for sRGB color spaces ($R, G, B \in [0, 255]$):

1. **Normalize channels to $[0, 1]$**:
   $$C_{\text{srgb}} = \frac{C}{255}$$
2. **Linearize RGB channels**:
   $$C_{\text{linear}} = \begin{cases} \frac{C_{\text{srgb}}}{12.92} & \text{if } C_{\text{srgb}} \le 0.04045 \\ \left(\frac{C_{\text{srgb}} + 0.055}{1.055}\right)^{2.4} & \text{if } C_{\text{srgb}} > 0.04045 \end{cases}$$
3. **Compute Luminance**:
   $$L = 0.2126 \times R_{\text{linear}} + 0.7152 \times G_{\text{linear}} + 0.0722 \times B_{\text{linear}}$$

### 2.2 Contrast Ratio
Evaluates the ratio between the lighter luminance ($L_1$) and darker luminance ($L_2$):
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
*(The $+0.05$ offset accounts for ambient flare/reflection on display glass).*

### 2.3 Alpha Compositing & Layer Blending
Standard Porter-Duff alpha blending used when evaluating semi-transparent foregrounds over opaque backgrounds:
$$\alpha_{\text{out}} = \alpha_{\text{src}} + \alpha_{\text{dst}} \times (1 - \alpha_{\text{src}})$$
$$C_{\text{out}} = \frac{C_{\text{src}} \times \alpha_{\text{src}} + C_{\text{dst}} \times \alpha_{\text{dst}} \times (1 - \alpha_{\text{src}})}{\alpha_{\text{out}}}$$

---

## 3. Audit Run & Dashboard Aggregation Metrics

Defined in [`ux-issue.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/schema/ux-issue.ts) and [`report-schema.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/report/report-schema.ts):

| Metric Key | Data Type | Description |
|---|---|---|
| `totalRawFindings` (`rawFindingCount`) | `integer` | Total un-grouped findings detected across all tested viewports. |
| `totalGroupedIssues` (`groupedIssueCount`) | `integer` | Number of distinct issues after collapsing identical selector fingerprints across viewports. |
| `passCount` | `integer` | Total occurrences meeting normative thresholds. |
| `candidateFailCount` | `integer` | Total occurrences failing deterministic thresholds. |
| `needsReviewCount` | `integer` | Total occurrences requiring human designer verification (translucency, 2D tables, etc.). |
| `priorityCounts.P0` | `integer` | Critical blocker count (loss of interactive control accessibility). |
| `priorityCounts.P1` | `integer` | High priority count (severe deficits, high risk of user task failure). |
| `priorityCounts.P2` | `integer` | Medium priority count (moderate deficits). |
| `priorityCounts.P3` | `integer` | Low priority count (passing checks, statutory review items). |

---

## 4. Iteration & Optimization Delta Metrics

Defined in [`iteration.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/schema/iteration.ts):

| Metric Key | Data Type | Description |
|---|---|---|
| `baselineMeasurement` | `object` | Captured measurements before candidate fix (e.g. `{ width: 16, height: 16 }`). |
| `candidateMeasurement`| `object` | Re-measured values after applying allowlisted CSS override in sandbox (e.g. `{ width: 24, height: 24 }`). |
| `measurementDelta` | `object` | Exact difference between baseline and candidate (e.g. `{ deltaWidth: +8, deltaHeight: +8 }`). |
| `regressionResult` | `enum` | Automated post-fix impact classification:<br>• **`improved`**: Candidate fix satisfies threshold without regressions.<br>• **`unchanged`**: No measurable change produced.<br>• **`regressed`**: Fix caused side-effects or introduced new failures.<br>• **`unable_to_verify`**: Deterministic verification could not be concluded. |

---

## 5. Standard Audit Viewports

Defined in [`browser.ts`](file:///Users/mysteriouz/Projects/proof-ui-audit/src/lib/audit/browser.ts):

| Viewport Name | Width $\times$ Height (CSS px) | Primary Audit Objective |
|---|:---:|---|
| **Small / Reflow** | **$320 \times 667$** | Evaluates SC 1.4.10 Reflow (equivalent to 400% zoom on 1280px display) and small-screen layouts. |
| **Mobile Baseline** | **$375 \times 667$** | Represents standard modern mobile touch viewports (e.g. iPhone SE / standard mobile). |
| **Desktop Baseline** | **$1440 \times 900$** | Represents typical desktop and laptop workstation displays. |

---

## 6. Quality & Verification Metrics

Documented in [`RELEASE_NOTES.md`](file:///Users/mysteriouz/Projects/proof-ui-audit/RELEASE_NOTES.md):

| Verification Category | Result | Conformance Status |
|---|:---:|:---:|
| **Traceability Requirements** | 131 / 131 verified | **100% Conformance** |
| **Prohibited Features Scan** | 20 / 20 absent | **100% Verified** (Zero decorative scope creep) |
| **Vitest Unit Tests** | 175 / 175 passed | **100% Pass** (Hermetic, offline-capable) |
| **Playwright E2E Tests** | 31 / 31 passed | **100% Pass** (Full pipeline validation) |
| **Total Automated Tests** | **206 / 206 passed** | **100% Pass Rate** |
| **TypeScript Strict Check** | 0 errors | **Clean** |
| **ESLint 9 Flat Config** | 0 warnings / 0 errors | **Clean** |
| **Next.js Production Routes** | 9 / 9 routes compiled | **Clean** |

---

## 7. Traceability & File Mapping

| Criterion / Domain | Implementation File | Unit Test File |
|---|---|---|
| **Text Contrast** | [`text-contrast.ts`](src/lib/audit/rules/text-contrast.ts) | [`text-contrast.test.ts`](src/lib/audit/rules/__tests__/text-contrast.test.ts) |
| **Non-Text Contrast**| [`non-text-contrast.ts`](src/lib/audit/rules/non-text-contrast.ts) | [`non-text-contrast.test.ts`](src/lib/audit/rules/__tests__/non-text-contrast.test.ts) |
| **Target Size** | [`target-size.ts`](src/lib/audit/rules/target-size.ts) | [`target-size.test.ts`](src/lib/audit/rules/__tests__/target-size.test.ts) |
| **Reflow** | [`reflow.ts`](src/lib/audit/rules/reflow.ts) | [`reflow.test.ts`](src/lib/audit/rules/__tests__/reflow.test.ts) |
| **Text Spacing** | [`text-spacing.ts`](src/lib/audit/rules/text-spacing.ts) | [`text-spacing.test.ts`](src/lib/audit/rules/__tests__/text-spacing.test.ts) |
| **Color Math Engine**| [`color-math.ts`](src/lib/audit/color-math.ts) | [`color-math.test.ts`](src/lib/audit/__tests__/color-math.test.ts) |
| **Issue Grouping** | [`grouping.ts`](src/lib/audit/grouping.ts) | [`grouping.test.ts`](src/lib/audit/__tests__/grouping.test.ts) |
| **Iteration Sandbox**| [`isolated-preview.ts`](src/lib/iteration/isolated-preview.ts) | [`iteration.test.ts`](src/lib/iteration/__tests__/iteration.test.ts) |
| **Report Export** | [`report-schema.ts`](src/lib/report/report-schema.ts) | [`report-export.test.ts`](src/lib/report/__tests__/report-export.test.ts) |
