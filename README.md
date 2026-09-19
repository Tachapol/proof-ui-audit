# ProofUI Audit PoC

A research proof-of-concept for **Evidence-Based UX/UI Optimization with Designer-in-the-Loop Validation**.

This tool provides deterministic, WCAG-informed measurements for five selected criteria, presents grouped evidence-based issue cards, offers AI-assisted explanations grounded in verified evidence, and supports structured designer decisions — all without claiming full WCAG conformance.

## Scope

Five WCAG 2.2-informed criteria only:

1. **Text Contrast** (SC 1.4.3) — 4.5:1 normal text, 3:1 large text
2. **Non-text Contrast** (SC 1.4.11) — 3:1 UI components and graphical objects
3. **Target Size** (SC 2.5.8) — 24×24 CSS px minimum
4. **Reflow** (SC 1.4.10) — No 2D scrolling at 320 CSS px
5. **Text Spacing** (SC 1.4.12) — Content resilience under WCAG spacing overrides

All results use a deterministic tri-state status: `pass`, `candidateFail`, or `needsReview`.

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

1. Select a local fixture or enter a public URL
2. Run the audit — the tool launches headless Chromium at configured viewports (320px, 375px, 1440px)
3. Review grouped evidence-based issue cards with deterministic measurements
4. Request AI/fallback explanations grounded in verified evidence
5. Record designer decisions (Accept, Reject, Edit, Reprioritize) with rationale
6. Optionally launch an isolated CSS preview on local fixtures to verify candidate fixes
7. Export Markdown or JSON reports with all evidence, decisions, and disclaimers

## Architecture

- **Next.js** with App Router and TypeScript strict mode
- **Playwright** for headless browser auditing, screenshots, and bounding-box evidence
- **Zod** for schema validation at all boundaries
- **Vitest** for unit tests
- **Local JSON file store** for audit runs and decisions (`.proofui-data/`)
- **Lucide** for consistent SVG iconography

## Known Limitations

- Light-theme only
- Recent-run navigation represents the current session, not a complete history
- Public URL audits depend on network and DNS availability (documented DNS TOCTOU limitation)
- Persistence and locking are designed for single-process PoC deployment
- Failure and uncommon preview states are verified using controlled API responses
- Color and focus treatments were visually reviewed and behaviorally tested, but not certified by an external accessibility conformance audit
- This is a research PoC — it does not claim complete WCAG conformance

## Documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — Complete requirements checklist
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — Phased execution plan
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architecture and implementation decisions
- [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) — Requirement traceability matrix

## License

This is a research prototype. No license is specified.
