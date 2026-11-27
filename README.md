# ProofUI Audit PoC

A research proof-of-concept for **Evidence-Based UX/UI Optimization with Designer-in-the-Loop Validation**.

This tool provides deterministic, WCAG-informed measurements for five selected criteria and two pilot advisory metrics, presents grouped evidence-based issue cards, offers an interactive Visual Canvas Overlay with zero-gutter live viewport rendering, multi-role AI critique in Critique Studio, in-browser automated remediation in the Component Sandbox, and structured designer review decisions — all without claiming full WCAG conformance.

## Scope

### Five WCAG 2.2-Informed Criteria:
1. **Text Contrast** (SC 1.4.3) — 4.5:1 normal text, 3:1 large text
2. **Non-text Contrast** (SC 1.4.11) — 3:1 UI components and graphical objects
3. **Target Size** (SC 2.5.8) — 24×24 CSS px minimum
4. **Reflow** (SC 1.4.10) — No 2D scrolling at 320 CSS px
5. **Text Spacing** (SC 1.4.12) — Content resilience under WCAG spacing overrides

All audit criteria use a deterministic tri-state status: `pass`, `candidateFail`, or `needsReview`.

### Two Pilot Advisory Metrics:
1. **Touch Target Spacing** — Nearest neighbor distance (8 px threshold) and overlap detection using real pointer hit-areas.
2. **Heading Hierarchy** — Sequential heading depth and skip detection (e.g. H2 → H4) with parent component context.

Advisory findings are surfaced with human-readable language (e.g. *Email field and Continue button overlap distance: 0 px*) and an explicit **Project advisory** badge.

## Core Features & Subsystems

- **Audit Workspace (`/`)**: URL-first evidence layout (`?runId=...`) prioritizing actionable review items first, status counter filter badges (*Candidate fail*, *Needs review*), folded pass checks, unified finding review status, and single-click jump to Critique Studio.
- **36-Metric Self-Audit (`/checklist`)**: Deterministic 36-metric evaluation (18 UX + 18 UI across 6 pillars: 7 `audit-rule` + 29 `dom-check`) grounded in WCAG 2.2, Nielsen's Heuristics, Apple HIG, and Material Design 3. Features a 3-stage stateful stepper (*Input & Context → Audit & Prioritize → Optimize & Approve*), source code upload (HTML/CSS/JS files & folders), read-only **Multi-Page Batch Audit** (`report.json` & `feedback.json` with `page_hint`), Designer confirmation for `needsReview` findings, AI-assisted JSON-patch auto-iteration (`gpt-6-luna` gateway → `gemini-2.5-flash` → deterministic fallback; capped at 6 issues/round, max 5 iterations, default 3), and a full-screen Figma-style `FigmaReviewCanvas` (pan/zoom, resizable frames, smooth Before/After slider).
- **Visual Canvas Overlay**: Zero-gutter flush live iframe preview across Desktop (1440px), Mobile (375px), and Reflow (320px) viewports; interactive pin badges with 44×44px hit areas, leader lines, smart auto-focus, and a floating resizable Inspector Drawer (320px–680px) with stacked before/after comparison cards and live suggested fix preview.
- **Multi-Role Critique Studio (`/studio`)**: Multi-role AI critique engine (Lead Coordinator, User Experience, Design System, Accessibility, Product Manager), CPE gateway integration, structured design & color proposals with live swatch previews, and round-trip navigation back to Audit evidence with preserved filters and scroll position.
- **Component Sandbox (`/sandbox`)**: In-browser remediation playground with automated candidate generation, Playwright browser re-audit verification, regression checks, and a 4-state verification workflow (`Unverified`, `Verified`, `Suboptimal`, `Error`).
- **Research & Pilot Benchmarks (`docs/research/`)**: Standardized UI-01 through UI-12 benchmark test cases, two-phase blind evaluation protocol, precision metrics, and PostgreSQL knowledge base schema proposal (`docs/KNOWLEDGE_BASE.md`).

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers (required for auditing and E2E tests)
npx playwright install chromium
```

## Development

```bash
# Start the development server on port 3123
npm run dev
```

Open [http://localhost:3123](http://localhost:3123) in your browser. The default view presents the local fixture selector for immediate use without an external URL.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server (port 3123) |
| `npm run build` | Production build |
| `npm start` | Start production server (port 3123) |
| `npm run typecheck` | TypeScript strict mode check |
| `npm run lint` | ESLint check |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |

## Production Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No | Google Gemini API key for AI-assisted explanations. When absent, the tool uses deterministic template fallback with full functionality. |

Copy `.env.example` to `.env.local` and configure as needed.

## Local Fixtures

The default first-run experience uses local fixture pages that demonstrate all five criteria with pass, candidateFail, and needsReview cases. No external network access is required.

Available fixture categories:
- **Target Size** — Buttons and links at various dimensions
- **Contrast** — Normal text, large text, UI components, complex backgrounds
- **Reflow** — Fluid layout, fixed overflow, essential 2D tables, nested scrolling
- **Text Spacing** — Fluid containers, fixed-height clipping, horizontal clipping, obscured controls

## Workflow

1. **Select Target**: Choose a public website URL, local test fixture, or paste an HTML/CSS code snippet.
2. **Execute Audit**: Headless Chromium evaluates the 5 WCAG criteria and 2 pilot metrics across Desktop (1440px), Mobile (375px), and Reflow (320px).
3. **Inspect Evidence**: View prioritized findings on the URL-first audit dashboard (`?runId=...`) and inspect pins with zero-gutter live viewport rendering on the **Visual Canvas Overlay**.
4. **Multi-Role AI Critique**: Open Critique Studio (`/studio`) to run multi-agent design evaluations across UX, Design System, Accessibility, and Product Management perspectives.
5. **Component Remediation**: Jump directly into the **Component Sandbox** (`/sandbox`) to generate fixes, run automated in-browser re-audit verification, and check for layout regressions.
6. **Record Review Dispositions**: Assign review status (**Confirmed Issue**, **False Positive**, **Needs Review**, **Accepted Risk**) with reviewer rationale, separate from Edit Scope or Reprioritize actions.
7. **Export & Report**: Generate complete JSON and Markdown audit reports containing verified measurements, screenshot evidence, sandbox iteration proof, and full decision trails.

## Architecture

- **Next.js 15 (App Router)** with TypeScript strict mode
- **Playwright** for headless browser execution, subpixel DOM geometry, and runtime screenshots
- **Zod** for schema validation at all network and data boundaries
- **Vitest** for fast unit and integration testing (320 tests across 37 suites)
- **Local JSON Storage** with atomic file writing (`.proofui-data/`)
- **Lucide Icons** for consistent accessible iconography

## Documentation

- [`docs/STUDIO.md`](docs/STUDIO.md) — Critique Studio workflow and multi-role AI design debate reference
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — Complete requirements checklist
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — Phased execution plan
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ([ภาษาไทย](docs/ARCHITECTURE.th.md)) — System architecture, use case, and user flow diagrams
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Technical and architectural decision log
- [`docs/KNOWLEDGE_BASE.md`](docs/KNOWLEDGE_BASE.md) — PostgreSQL editorial design knowledge catalog proposal
- [`docs/research/pilot-metrics.md`](docs/research/pilot-metrics.md) — Pilot advisory metrics specification
- [`docs/research/pilot-freeze-workflow.md`](docs/research/pilot-freeze-workflow.md) — Pilot benchmark freeze and validation workflow
- [`docs/METRICS.md`](docs/METRICS.md) ([English](docs/METRICS.en.md)) — Comprehensive metrics and measurement reference

## License

This is a research prototype. No license is specified.

## Issue review dispositions

Issue cards support an independent review status: **Confirmed Issue**, **False
Positive**, **Needs Review**, or **Accepted Risk**. Accepted risk acknowledges a
real issue that remains unfixed; it does not mark the automated check as passed.
Every new issue review requires a rationale and a self-reported reviewer/risk
approver name. This PoC has no authenticated reviewer identity.

Review transitions are appended to the decision log and included in JSON and
Markdown exports. Editing recommendations and reprioritizing preserve the review
status. Existing accept/reject events remain readable as confirmed issue/false
positive; legacy actions without a reviewer are not attributed to an earlier
reviewer. Candidate fix approval remains separate from issue review.

Run `npx playwright test tests/issue-review.spec.ts` to verify review transitions,
reload persistence, exports, failed-save draft preservation, and mobile layout
through the UI. The test uses a controlled saved audit with the real decision and
export APIs; it does not invoke an external AI provider.
