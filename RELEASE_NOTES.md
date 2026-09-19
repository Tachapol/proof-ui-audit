# Release Notes — ProofUI Audit PoC v1.0.0 (`proofui-audit-poc-v1`)

> **Evidence-Based UX/UI Optimization with Designer-in-the-Loop Validation**  
> *Research proof-of-concept for deterministic accessibility measurements, grounded AI recommendations, and isolated iteration verification.*

---

## 🎯 Overview

**ProofUI Audit PoC** is an evidence-first research tool designed to bridge the gap between automated accessibility evaluation and real-world design decisions. Rather than generating opaque "health scores" or claiming full WCAG conformance, ProofUI delivers **deterministic bounding-box measurements**, groups repeated issues across viewports, offers **hallucination-guarded AI explanations**, supports structured designer decisions, and provides an **isolated CSS sandbox** to verify proposed candidate fixes before touching production code.

---

## 🚀 Key Features

### 1. Deterministic Multi-Rule Audit Engine (5 WCAG 2.2-Informed Criteria)
- **Target Size (SC 2.5.8)**: Evaluates clickable elements against the 24×24 CSS px threshold with spacing/inline context.
- **Text Contrast (SC 1.4.3)**: Computes exact relative luminance ratios for normal (4.5:1) and large text (3:1). Detects complex/gradient backgrounds and marks them for manual review.
- **Non-Text Contrast (SC 1.4.11)**: Audits active UI components and graphical indicators against the 3:1 ratio. Recognizes disabled/inactive controls as excluded.
- **Reflow (SC 1.4.10)**: Detects 2D scrolling and horizontal page overflows at 320 CSS px. Excludes intentional 2D data tables and decorative bleeds.
- **Text Spacing (SC 1.4.12)**: Evaluates layout resilience under WCAG text-spacing overrides (line height, paragraph spacing, letter spacing, word spacing), detecting vertical/horizontal clipping and obscured controls.

### 2. Multi-Viewport Grouping & Fingerprinting
- Simultaneously audits across three key viewports: **320px** (reflow threshold), **375px** (mobile baseline), and **1440px** (desktop).
- Uses stable DOM selector fingerprinting to aggregate identical raw issues into cohesive grouped cards, tracking distinct occurrences across viewports.

### 3. Designer-in-the-Loop Decision Workflow
- Every finding is classified into clear tri-state semantics: `pass`, `candidateFail`, or `needsReview`.
- Designers can record decisions (**Accept**, **Reject**, **Edit**, **Reprioritize**) with mandatory rationale validation.
- All decisions persist to an atomic, single-process local file store (`.proofui-data/`).

### 4. AI-Assisted Explanations with Strict Provenance & Grounding
- Powered by Google Gemini with deterministic template fallbacks when no API key is present.
- Enforces strict grounding validation against verified audit measurements: prevents hallucinated ratios, coordinates, or criteria claims.
- Explicit provenance labels clearly distinguish AI-generated insights from deterministic template output.

### 5. Isolated Before/After Iteration Proof (Sandbox Verification)
- Allows designers to preview candidate CSS remedies (such as expanding target sizes to 24×24 px) in a sandboxed, isolated browser context.
- Guarantees **baseline immutability**: the original source code and fixtures remain 100% untouched.
- Deterministically evaluates candidate fixes into: `[IMPROVED]`, `[UNCHANGED]`, `[REGRESSED]`, or `[UNABLE_TO_VERIFY]`.

### 6. Standardized Report Export
- **JSON Export (Schema v1.0.0)**: Machine-readable payload containing complete audit metadata, measurements, bounding boxes, decision history, and disclaimers.
- **Markdown Export**: Formatted, auditable documentation ready for issue trackers and pull request descriptions.
- **Privacy Guaranteed**: Path sanitization ensures absolute system paths (e.g., `/Users/...`, `/home/...`) are completely stripped from exported reports.

### 7. Accessible & Responsive Workspace Shell
- Responsive layout supporting **320px to 1440px+** viewports with zero horizontal document scrolling.
- Navigation rail with accessible mobile drawer, keyboard focus trapping, and Escape key dismissal.
- High-contrast, wrapped status filter bar (~44px touch targets) optimized for touch devices.

---

## 📊 Quality & Verification Metrics

Every requirement, test, and quality gate has been validated through automated verification:

| Metric | Result | Status |
|---|:---:|:---:|
| **Traceability Requirements** | **131 / 131** | **100% Verified** |
| **Prohibited Features Scan** | **20 / 20** | **100% Absent** (Zero scope creep) |
| **Vitest Unit Tests** | **175 / 175 passed** | **100% Pass** (Hermetic / Network-independent) |
| **Playwright E2E Tests** | **31 / 31 passed** | **100% Pass** (Full user pipeline) |
| **Total Automated Tests** | **206 / 206 passed** | **100% Pass** |
| **TypeScript Strict Check** | `0 errors` | **Clean** |
| **ESLint 9 Flat Config** | `0 warnings / 0 errors` | **Clean** |
| **Next.js Production Build** | `9/9 routes compiled` | **Clean** |

---

## 📦 Getting Started

### Installation
```bash
git clone https://github.com/Tachapol/proof-ui-audit.git
cd proof-ui-audit
npm install
npx playwright install chromium
```

### Running Locally
```bash
# Development server (port 3123)
npm run dev

# Production build & start
npm run build
npm start
```
Open [http://localhost:3123](http://localhost:3123). The default view immediately loads the **Local Fixture Selector** with pre-built test cases ready to audit without network dependencies.

### Verification Commands
```bash
npm run typecheck            # TypeScript compiler check
npm run lint                 # ESLint check
npm run test                 # Hermetic unit test suite (175 tests)
npm run test:e2e             # Playwright end-to-end suite (31 tests)
npm run check:traceability   # Deterministic 131/131 requirements parity check
```

---

## ⚠️ Known Limitations & Scope Boundaries

1. **PoC Scope**: Strictly limited to the 5 selected WCAG criteria. Automated measurements provide decision support and do not constitute legal or full WCAG conformance certification.
2. **Light Theme**: The current UI PoC is designed with a light-theme aesthetic.
3. **Persistence Model**: Uses atomic JSON file storage designed for single-process research environments.
4. **Public URL Audits**: Audits of external URLs depend on live network/DNS conditions (SSRF protection active with documented DNS TOCTOU boundary). Local fixtures require zero network connectivity.
