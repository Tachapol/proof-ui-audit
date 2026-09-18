# Implementation Plan

This implementation plan defines the phased execution for `proofui-audit-poc`. Work is executed strictly in small, verifiable phases.

---

## Phase 0: Requirements and Project Skeleton

- **Objective**: Establish the repository foundation, strict TypeScript setup, test runners (Vitest and Playwright), centralized CSS visual tokens, local fixture server mechanism, and verified base configuration.
- **Requirement IDs Covered**:
  - `ARCH-01`, `ARCH-02`, `ARCH-05`, `ARCH-06`, `ARCH-07`, `ARCH-09`
  - `SEC-02`, `SEC-05`
  - `UI-01`, `UI-04`, `UI-05`
  - `TEST-25`
  - `EXCL-01` through `EXCL-20`
- **Files Expected to be Created or Modified**:
  - `package.json`
  - `tsconfig.json`
  - `next.config.mjs`
  - `vitest.config.ts`
  - `playwright.config.ts`
  - `src/app/globals.css` (central visual tokens)
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - `src/app/fixtures/[id]/page.tsx` (or static fixture route)
  - `src/fixtures/fixture-registry.ts`
- **Tests That Must Pass**:
  - Skeleton Vitest smoke test (`src/lib/__tests__/smoke.test.ts`)
  - Playwright smoke test (`tests/smoke.spec.ts`)
- **Manual Verification Steps**:
  - Start dev server: `npm run dev`
  - Verify app loads on `http://localhost:3000` with clean system font, visual tokens, and basic layout shell.
- **Dependencies on Earlier Phases**: None.
- **Exit Criteria**:
  - Vitest runs cleanly with 100% pass rate.
  - Playwright starts and passes smoke test.
  - No extraneous packages installed.

---

## Phase 1: Target Size Vertical Slice (Reference Pattern)

- **Objective**: Implement the complete end-to-end audit slice for Target Size (WCAG 2.2 SC 2.5.8) to establish the architectural reference pattern for measurement, deterministic checks, evidence validation, grouping, UI card, screenshot/bounding-box generation, and designer decision persistence.
- **Requirement IDs Covered**:
  - `ARCH-03`, `ARCH-04`
  - `RULE-01` (Target Size), `RULE-02`, `RULE-04`, `RULE-09`, `RULE-10`, `RULE-15`, `RULE-16`, `RULE-17` (Target Size)
  - `DATA-01`, `DATA-02`, `DATA-03`, `DATA-04`, `DATA-05`, `DATA-06`
  - `SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`, `SEC-05`, `SEC-07`
  - `UI-06`, `UI-07`, `UI-08`, `UI-09`, `UI-10`, `UI-11`, `UI-15`
  - `TEST-06`, `TEST-07`, `TEST-08`, `TEST-14`, `TEST-15`, `TEST-16`, `TEST-17`, `TEST-18`, `TEST-22`
- **Files Expected to be Created or Modified**:
  - `src/lib/schema/ux-issue.ts` (Zod & TS `UXIssue`, `AuditStatus`, `DesignerDecision`)
  - `src/lib/audit/url-validator.ts` (URL normalization, SSRF/private network protection)
  - `src/lib/audit/browser.ts` (Playwright browser orchestration, viewport sizing, screenshots, bounding boxes)
  - `src/lib/audit/rules/target-size.ts` (Deterministic Target Size measurement & tri-state rule)
  - `src/lib/audit/grouping.ts` (Deterministic grouping fingerprint & issue grouping)
  - `src/lib/storage/db.ts` (Local file/SQLite store for runs and decisions)
  - `src/app/api/audit/route.ts` (Audit execution API)
  - `src/app/api/decisions/route.ts` (Decision persistence API)
  - `src/fixtures/pages/target-size.tsx` (Pass, candidateFail, needsReview target size fixture)
  - `src/components/IssueCard.tsx`
  - `src/components/AuditSummary.tsx`
  - `src/components/AuditInput.tsx`
- **Tests That Must Pass**:
  - Unit tests for Target Size rule logic (`src/lib/audit/rules/__tests__/target-size.test.ts`)
  - Unit tests for grouping & fingerprints (`src/lib/audit/__tests__/grouping.test.ts`)
  - Unit tests for URL security & SSRF rejection (`src/lib/audit/__tests__/url-validator.test.ts`)
  - Unit tests for schema validation (`src/lib/schema/__tests__/ux-issue.test.ts`)
  - Playwright integration test for Target Size audit flow (`tests/target-size-slice.spec.ts`)
- **Manual Verification Steps**:
  - Run audit on Target Size fixture in browser UI.
  - Confirm grouped issue card appears with screenshot, bounding box, 24x24px threshold measurement, status `candidateFail` / `needsReview`, and decision controls.
  - Click `Accept` / `Reject` with reason; verify persisted state survives page refresh.
- **Dependencies on Earlier Phases**: Phase 0.
- **Exit Criteria**:
  - Target size vertical slice passes all unit and integration tests.
  - End-to-end data flow operates smoothly from input to storage.

---

## Phase 2: Contrast Rules

- **Objective**: Implement deterministic rules and fixtures for Text Contrast (SC 1.4.3) and Non-text Contrast (SC 1.4.11), following the Phase 1 reference pattern.
- **Requirement IDs Covered**:
  - `RULE-01` (Contrast rules), `RULE-05`, `RULE-06`, `RULE-07`, `RULE-08`, `RULE-17` (Contrast)
  - `TEST-01`, `TEST-02`, `TEST-03`, `TEST-04`, `TEST-05`
- **Files Expected to be Created or Modified**:
  - `src/lib/audit/color-math.ts` (sRGB luminance, contrast ratio calculation per WCAG 2.2)
  - `src/lib/audit/rules/text-contrast.ts` (Normal text 4.5:1, large text 3:1, background image/gradient/transparency -> needsReview)
  - `src/lib/audit/rules/non-text-contrast.ts` (UI components/graphical objects 3:1, ambiguous state -> needsReview)
  - `src/fixtures/pages/contrast.tsx` (Pass, candidateFail, needsReview test cases)
- **Tests That Must Pass**:
  - Vitest for color math and contrast algorithms (`src/lib/audit/__tests__/color-math.test.ts`)
  - Vitest for text contrast rule (`src/lib/audit/rules/__tests__/text-contrast.test.ts`)
  - Vitest for non-text contrast rule (`src/lib/audit/rules/__tests__/non-text-contrast.test.ts`)
  - Playwright contrast fixture integration test (`tests/contrast-rules.spec.ts`)
- **Manual Verification Steps**:
  - Audit the Contrast fixture across viewports.
  - Verify normal text fail, large text pass, and gradient background `needsReview` cards.
- **Dependencies on Earlier Phases**: Phase 1.
- **Exit Criteria**:
  - All contrast tests pass with 100% deterministic accuracy.
  - Fixtures cover all required pass/fail/needsReview conditions.

---

## Phase 3: Layout Rules

- **Objective**: Implement deterministic rules and fixtures for Reflow (SC 1.4.10) at 320 CSS px and Text Spacing (SC 1.4.12) with stylesheet override injection.
- **Requirement IDs Covered**:
  - `RULE-01` (Layout rules), `RULE-02` (320px reflow), `RULE-11`, `RULE-12`, `RULE-13`, `RULE-14`, `RULE-17` (Layout)
  - `TEST-09`, `TEST-10`, `TEST-11`, `TEST-12`, `TEST-13`
- **Files Expected to be Created or Modified**:
  - `src/lib/audit/rules/reflow.ts` (320px viewport, scrollWidth > clientWidth detection, essential scroll detection)
  - `src/lib/audit/rules/text-spacing.ts` (Inject 1.5x line-height, 2x paragraph spacing, 0.12x letter-spacing, 0.16x word-spacing; check clipping/overflow)
  - `src/fixtures/pages/reflow.tsx`
  - `src/fixtures/pages/text-spacing.tsx`
- **Tests That Must Pass**:
  - Vitest for Reflow detection logic (`src/lib/audit/rules/__tests__/reflow.test.ts`)
  - Vitest for Text Spacing injection and clipping checks (`src/lib/audit/rules/__tests__/text-spacing.test.ts`)
  - Playwright integration tests for reflow and text spacing (`tests/layout-rules.spec.ts`)
- **Manual Verification Steps**:
  - Audit Reflow fixture at 320px; verify 2D scroll candidate failures and data-table `needsReview`.
  - Audit Text Spacing fixture; verify clipped container detection.
- **Dependencies on Earlier Phases**: Phase 1, Phase 2.
- **Exit Criteria**:
  - All 5 WCAG-informed rules are fully operational and verified against deterministic fixtures.

---

## Phase 4: Grouping and Review Workflow

- **Objective**: Refine multi-occurrence fingerprint grouping, issue drill-down inspection, designer decision workflow (Accept, Reject, Edit, Reprioritize) with structured reason capture, decision log, and persistence validation.
- **Requirement IDs Covered**:
  - `DATA-03`, `DATA-04`, `DATA-05`, `DATA-06`
  - `UI-09`, `UI-10`, `UI-11`
  - `TEST-14`, `TEST-15`, `TEST-18`
- **Files Expected to be Created or Modified**:
  - `src/lib/audit/grouping.ts`
  - `src/lib/storage/db.ts`
  - `src/components/IssueCard.tsx`
  - `src/components/OccurrenceList.tsx`
  - `src/components/DecisionDialog.tsx`
  - `src/components/DecisionLog.tsx`
- **Tests That Must Pass**:
  - Vitest grouping stability and duplicate collapse tests
  - Vitest decision log storage & persistence retrieval tests
  - Playwright test for decision persistence across page reload (`tests/decision-workflow.spec.ts`)
- **Manual Verification Steps**:
  - Run audit on fixture with 5 identical undersized buttons; verify single grouped card with badge "5 occurrences".
  - Expand card to inspect individual occurrences.
  - Reprioritize from P2 to P1 with reason "Primary checkout CTA"; verify updated card and decision log record.
- **Dependencies on Earlier Phases**: Phase 3.
- **Exit Criteria**:
  - Grouping is deterministic and handles high occurrence counts cleanly.
  - Decisions persist with timestamps, rationale, and user reasons.

---

## Phase 5: AI Explanation Boundary

- **Objective**: Implement the AI explanation and recommendation boundary with strict Zod validation, Gemini API integration, deterministic template fallback, and comprehensive no-key testing.
- **Requirement IDs Covered**:
  - `ARCH-08`, `ARCH-09`
  - `AI-01`, `AI-02`, `AI-03`, `AI-04`, `AI-05`
  - `TEST-21`, `TEST-25`
  - `UI-16` (AI fallback / unavailable states)
- **Files Expected to be Created or Modified**:
  - `src/lib/ai/gemini-adapter.ts` (Gemini API client with structured JSON output and timeout handling)
  - `src/lib/ai/prompt-builder.ts` (Construct prompt containing strictly verified factual evidence)
  - `src/lib/ai/fallback.ts` (Deterministic rule-based templates for all 5 criteria)
  - `src/lib/ai/service.ts` (Orchestrator: try Gemini, fallback cleanly on missing key, timeout, or validation failure)
  - `src/lib/schema/ai-response.ts` (Zod schema for explanation & recommendation)
- **Tests That Must Pass**:
  - Vitest for AI fallback templates and schema validation (`src/lib/ai/__tests__/fallback.test.ts`)
  - Vitest for Gemini prompt construction (verify no unverified data or raw images sent) (`src/lib/ai/__tests__/prompt.test.ts`)
  - Vitest error and timeout handling tests (`src/lib/ai/__tests__/service.test.ts`)
- **Manual Verification Steps**:
  - Run audit without `GEMINI_API_KEY`; verify cards display clear "Deterministic Fallback" indicator with high-quality rule-grounded text.
  - Configure mock/valid key; verify structured AI explanation and recommendation are attached.
- **Dependencies on Earlier Phases**: Phase 4.
- **Exit Criteria**:
  - 100% offline functionality without API keys.
  - Strict input and output boundaries enforced.

---

## Phase 6: Reports and Isolated Iteration Proof

- **Objective**: Implement Markdown and JSON report exports with all required disclaimers and metadata, plus the minimal iteration proof (before/after CSS override on a local fixture without modifying source files).
- **Requirement IDs Covered**:
  - `ARCH-10`
  - `DATA-07`, `DATA-08`
  - `TEST-19`, `TEST-20`, `TEST-23`
- **Files Expected to be Created or Modified**:
  - `src/lib/report/markdown-export.ts`
  - `src/lib/report/json-export.ts`
  - `src/app/api/export/route.ts`
  - `src/lib/iteration/preview-override.ts` (Inject isolated CSS override in Playwright preview)
  - `src/components/ExportModal.tsx`
  - `src/components/IterationProofModal.tsx`
- **Tests That Must Pass**:
  - Vitest for Markdown and JSON report generator (`src/lib/report/__tests__/export.test.ts`)
  - Vitest / Playwright for isolated override re-audit (`tests/iteration-proof.spec.ts`)
- **Manual Verification Steps**:
  - Export Markdown and JSON reports; verify all required sections and disclaimers are present and data matches.
  - Launch Iteration Proof on Target Size fixture: approve 24px min-height override, trigger re-audit, verify before/after measurement comparison and regression status.
- **Dependencies on Earlier Phases**: Phase 5.
- **Exit Criteria**:
  - Both export formats match and contain all required sections.
  - Iteration proof runs safely in isolated preview without touching fixture source files.

---

## Phase 7: UI Completion, Visual Restraint, and Accessibility

- **Objective**: Polish and verify the complete ChatGPT-inspired minimalist aesthetic, desktop navigation rail, mobile drawer, all application states, keyboard operability, visible focus ring, and responsive behavior.
- **Requirement IDs Covered**:
  - `ARCH-07`
  - `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05`, `UI-06`, `UI-07`, `UI-08`, `UI-12`, `UI-13`, `UI-14`, `UI-15`, `UI-16`, `UI-17`, `UI-18`
  - `SEC-08`
- **Files Expected to be Created or Modified**:
  - `src/components/NavigationRail.tsx`
  - `src/components/TopBar.tsx`
  - `src/components/AuditFeed.tsx`
  - `src/components/StateViews.tsx` (Empty, loading skeleton, error, partial, no issues)
  - `src/app/globals.css` (Focus rings, safe text wrap, reduced motion)
- **Tests That Must Pass**:
  - Playwright visual and keyboard accessibility tests (`tests/a11y-ui.spec.ts`)
  - Playwright responsive tests across `320px`, `375px`, `768px`, `1024px`, and `1440px` (`tests/responsive.spec.ts`)
- **Manual Verification Steps**:
  - Tab through the entire application with keyboard; verify visible blue focus indicator on every interactive element.
  - Resize browser to 320px and 375px; verify drawer navigation, stacked controls, and no horizontal overflow.
  - Check contrast of all UI surfaces and status badges against WCAG 2.2 standards.
- **Dependencies on Earlier Phases**: Phase 6.
- **Exit Criteria**:
  - UI strictly adheres to design guidelines (no gradients, no heavy shadows, no marketing patterns).
  - All 15 required UI states render clearly.
  - Verified usable at 320px.

---

## Phase 8: Final Verification and Traceability Audit

- **Objective**: Execute the complete verification suite, perform end-to-end audit, ensure zero unresolved items in traceability, generate desktop & mobile screenshots, and prepare final deliverables.
- **Requirement IDs Covered**:
  - `TEST-24`, `TEST-25`
  - `DONE-01` through `DONE-20`
- **Files Expected to be Created or Modified**:
  - `docs/TRACEABILITY.md` (Update all statuses to `verified` with evidence)
  - `docs/DECISIONS.md` (Confirm all architecture choices documented)
- **Tests That Must Pass**:
  - `npm run lint` (ESLint clean, 0 errors)
  - `npm run typecheck` (TypeScript strict mode, 0 errors)
  - `npm run test` (Vitest: all unit tests passing)
  - `npm run test:e2e` (Playwright: all integration tests passing)
  - `npm run build` (Next.js production build succeeds)
- **Manual Verification Steps**:
  - Run full audit on all fixtures and verify reports.
  - Capture desktop (`1440px`) and mobile (`375px`) screenshots.
  - Audit repository for any prohibited excluded features.
- **Dependencies on Earlier Phases**: Phase 0 through Phase 7.
- **Exit Criteria**:
  - All automated tests and build commands pass.
  - 100% of rows in `TRACEABILITY.md` are marked `verified` with concrete evidence.
  - Full final response requirements satisfied.
