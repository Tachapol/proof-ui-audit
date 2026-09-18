# Traceability Matrix

This matrix tracks the lifecycle of every requirement from initial plan to verified completion.

Status values: `not-started` | `in-progress` | `implemented` | `verified` | `blocked`

| Requirement ID | Requirement | Phase | Implementation file | Test file | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| **ARCH-01** | Create lean PoC named `proofui-audit-poc` | Phase 0 | `package.json` | `tests/smoke.spec.ts` | verified | Verified by Playwright & Vitest smoke tests (2 passing) |
| **ARCH-02** | Do not modify existing large ProofUI editor project | Phase 0 | N/A (Isolated workspace) | N/A | verified | Isolated in /Users/mysteriouz/Projects/proof-ui-audit |
| **ARCH-03** | Core research workflow pipeline | Phase 1 | `src/app/api/audit/route.ts` | `tests/target-size-slice.spec.ts` | verified | Verified by Playwright target size slice, reload persistence, and SSRF route interception |
| **ARCH-04** | Decision support role; no autonomous redesign | Phase 1 | `src/components/IssueCard.tsx` | `tests/target-size-slice.spec.ts` | verified | Verified by IssueCard advisory UI, designer decision actions, and persistence |
| **ARCH-05** | Tech stack (Next.js, TypeScript, Playwright, Zod, Vitest, SQLite/File) | Phase 0 | `package.json`, `tsconfig.json` | `src/lib/__tests__/smoke.test.ts` | verified | Strict TS, Vitest (47 tests), Playwright (4 tests), Next.js build clean |
| **ARCH-06** | Minimal dependencies; no large frameworks or charting libraries | Phase 0 | `package.json` | N/A | verified | Lean 6 production packages in package.json |
| **ARCH-07** | Consistent SVG icons (Lucide); no emoji icons | Phase 0 | `src/components/Icon.tsx` | `tests/a11y-ui.spec.ts` | verified | Created `src/components/Icon.tsx` using Lucide SVG icons |
| **ARCH-08** | Single AI abstraction (Gemini + fallback); no multi-provider | Phase 5 | `src/lib/ai/service.ts` | `src/lib/ai/__tests__/service.test.ts` | not-started | Pending Phase 5 |
| **ARCH-09** | Offline / No-key operability without Gemini API key | Phase 5 | `src/lib/ai/fallback.ts` | `src/lib/ai/__tests__/fallback.test.ts` | not-started | Pending Phase 5 |
| **ARCH-10** | Minimal iteration proof on local fixture | Phase 6 | `src/lib/iteration/preview-override.ts` | `tests/iteration-proof.spec.ts` | not-started | Pending Phase 6 |
| **RULE-01** | Five WCAG criteria only | Phase 1-3 | `src/lib/audit/rules/*` | `src/lib/audit/rules/__tests__/*` | in-progress | Target Size, Text Contrast, Non-text Contrast verified; Reflow & Text Spacing pending Phase 3 |
| **RULE-02** | Audit viewports: 375px, 1440px, 320px reflow | Phase 1, 3 | `src/lib/audit/browser.ts` | `tests/target-size-slice.spec.ts` | verified | Verified 320px, 375px, 1440px viewports configured in DEFAULT_AUDIT_VIEWPORTS & route.ts |
| **RULE-03** | No scope creep or extra automated rules | Phase 1-3 | `src/lib/audit/rules/*` | `src/lib/audit/rules/__tests__/*` | verified | Strictly scoped to WCAG criteria without unrequested rules |
| **RULE-04** | Deterministic tri-state status (`pass`, `candidateFail`, `needsReview`) | Phase 1 | `src/lib/schema/ux-issue.ts` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Enforced by Zod schema and UI badges (Threshold Passed, Excluded, Candidate Issue, Needs Review) |
| **RULE-05** | Text Contrast: 4.5:1 normal, 3:1 large text | Phase 2 | `src/lib/audit/rules/text-contrast.ts` | `src/lib/audit/rules/__tests__/text-contrast.test.ts` | verified | Verified browser-computed styles, exact bold boundary (>=700), raw floating precision, 12 unit tests |
| **RULE-06** | Text Contrast needsReview for complex bg/image/gradient | Phase 2 | `src/lib/audit/rules/text-contrast.ts` | `src/lib/audit/rules/__tests__/text-contrast.test.ts` | verified | Verified multi-layer compositing, complex gradient/image/filter review, and unresolved transparency |
| **RULE-07** | Non-text Contrast: 3:1 UI components/graphical objects | Phase 2 | `src/lib/audit/rules/non-text-contrast.ts` | `src/lib/audit/rules/__tests__/non-text-contrast.test.ts` | verified | Verified 3:1 threshold on boundaries and indicators via unit and Playwright tests |
| **RULE-08** | Non-text Contrast needsReview for uncertain state/meaning | Phase 2 | `src/lib/audit/rules/non-text-contrast.ts` | `src/lib/audit/rules/__tests__/non-text-contrast.test.ts` | verified | Verified inactive controls marked excluded with pass status; ambiguous meaning returns needsReview |
| **RULE-09** | Target Size: 24x24 CSS px threshold | Phase 1 | `src/lib/audit/rules/target-size.ts` | `src/lib/audit/rules/__tests__/target-size.test.ts` | verified | Verified 24x24 px threshold and 24px diameter circle geometry (checkSpacingAlternative) |
| **RULE-10** | Target Size needsReview for WCAG exceptions | Phase 1 | `src/lib/audit/rules/target-size.ts` | `src/lib/audit/rules/__tests__/target-size.test.ts` | verified | Verified inline target exception and spacing alternative circle non-intersection geometry |
| **RULE-11** | Reflow: detect 2D scrolling at 320 CSS px | Phase 3 | `src/lib/audit/rules/reflow.ts` | `src/lib/audit/rules/__tests__/reflow.test.ts` | verified | Verified 320px document overflow detection with 1.0px subpixel tolerance in reflow.ts and reflow-and-spacing.spec.ts |
| **RULE-12** | Reflow needsReview for essential 2D layouts | Phase 3 | `src/lib/audit/rules/reflow.ts` | `src/lib/audit/rules/__tests__/reflow.test.ts` | verified | Verified essential 2D layouts (data tables, maps) marked needsReview with exception notice in reflow.ts and Playwright |
| **RULE-13** | Text Spacing override injection and clipping check | Phase 3 | `src/lib/audit/rules/text-spacing.ts` | `src/lib/audit/rules/__tests__/text-spacing.test.ts` | verified | Verified text-spacing CSS override injection, baseline/candidate clipping measurement, and guaranteed DOM cleanup |
| **RULE-14** | Text Spacing needsReview for ambiguous overlap | Phase 3 | `src/lib/audit/rules/text-spacing.ts` | `src/lib/audit/rules/__tests__/text-spacing.test.ts` | verified | Verified ambiguous text overlap marked needsReview in text-spacing.ts and reflow-and-spacing.spec.ts |
| **RULE-15** | Clear distinction between factual evidence, candidate fail, review, AI, decision | Phase 1 | `src/components/IssueCard.tsx` | `tests/target-size-slice.spec.ts` | verified | Distinct visual sections on IssueCard verified in Playwright |
| **RULE-16** | Conformance language discipline (candidate issue, WCAG-informed) | Phase 1 | `src/components/IssueCard.tsx` | `tests/target-size-slice.spec.ts` | verified | Exact terminology verified in UI |
| **RULE-17** | Fixtures covering pass/candidateFail/needsReview for all 5 criteria | Phase 1-3 | `src/fixtures/components/*` | `tests/*` | verified | Fixtures for Target Size, Contrast, Reflow, and Text Spacing verified across pass, candidateFail, needsReview |
| **DATA-01** | Stable `UXIssue` schema with required fields | Phase 1 | `src/lib/schema/ux-issue.ts` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Verified by ux-issue.test.ts (5/5 passed) |
| **DATA-02** | P0–P3 priority heuristic clearly distinguished from WCAG severity | Phase 1 | `src/components/IssueCard.tsx` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Priority rationale & disclaimer visible in UI |
| **DATA-03** | Deterministic grouping fingerprint (`ruleId + selector + measurement`) | Phase 1 | `src/lib/audit/grouping.ts` | `src/lib/audit/__tests__/grouping.test.ts` | verified | Verified by grouping.test.ts (3/3 passed) |
| **DATA-04** | Grouped issue structure preserving occurrences and details | Phase 1, 4 | `src/lib/audit/grouping.ts` | `src/lib/audit/__tests__/grouping.test.ts` | verified | Verified occurrence preservation & collapsing |
| **DATA-05** | Local persistence for runs, decisions, logs (SQLite/File) | Phase 1, 4 | `src/lib/storage/db.ts` | `src/lib/storage/__tests__/db.test.ts` | verified | Verified by db.test.ts (3/3 passed) |
| **DATA-06** | Zod validation at boundaries; reject invalid schema data | Phase 1 | `src/lib/schema/ux-issue.ts` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Zod validation enforced and tested |
| **DATA-07** | Markdown and JSON export containing metadata, evidence, decisions, disclaimers | Phase 6 | `src/lib/report/*` | `src/lib/report/__tests__/export.test.ts` | not-started | Pending Phase 6 |
| **DATA-08** | Markdown and JSON export data consistency | Phase 6 | `src/lib/report/*` | `src/lib/report/__tests__/export.test.ts` | not-started | Pending Phase 6 |
| **SEC-01** | URL input for public rendered page with validation & error feedback | Phase 1 | `src/components/AuditInput.tsx` | `tests/target-size-slice.spec.ts` | verified | Interactive URL input with validation feedback |
| **SEC-02** | Local fixture selector as default first-run experience | Phase 0, 1 | `src/components/AuditInput.tsx` | `tests/target-size-slice.spec.ts` | verified | Default fixture selector tested in E2E |
| **SEC-03** | Visible indication of audited URL, fixture, and viewport | Phase 1 | `src/components/TopBar.tsx` | `tests/target-size-slice.spec.ts` | verified | Top bar displays target & viewport info |
| **SEC-04** | URL normalization and HTTP/HTTPS restriction | Phase 1 | `src/lib/audit/url-validator.ts` | `src/lib/audit/__tests__/url-validator.test.ts` | verified | Verified by url-validator.test.ts (9/9 passed) |
| **SEC-05** | Block private networks, metadata endpoints, and localhost (except fixtures) | Phase 0, 1 | `src/lib/audit/url-validator.ts` | `src/lib/audit/__tests__/url-validator.test.ts` | verified | Verified private network & metadata rejection |
| **SEC-06** | Authentication boundary; no auth pages or arbitrary internal URLs | Phase 1 | `src/lib/audit/url-validator.ts` | `src/lib/audit/__tests__/url-validator.test.ts` | verified | Verified embedded credentials rejection |
| **SEC-07** | Timeouts & resilience against failed navigation or partial audits | Phase 1 | `src/lib/audit/browser.ts` | `tests/target-size-slice.spec.ts` | verified | Graceful error collection in browser engine |
| **SEC-08** | Secret sanitization; no leaked keys or traces to client | Phase 1, 7 | `src/app/api/audit/route.ts` | `src/lib/audit/__tests__/url-validator.test.ts` | verified | Sanitized JSON responses without stack traces |
| **UI-01** | Visual aesthetic: calm, minimal, ChatGPT-inspired restraint, light neutral | Phase 0, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | in-progress | Defining baseline CSS |
| **UI-02** | Restrained palette: accent #10a37f, red/amber/green reserved for status | Phase 0, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | in-progress | Defining color tokens |
| **UI-03** | Prohibited styling: no gradients, glassmorphism, decorative charts | Phase 0, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | in-progress | Applying styling restrictions |
| **UI-04** | Centralized visual tokens in CSS variables | Phase 0, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | verified | Defined in `src/app/globals.css` (:root CSS vars) |
| **UI-05** | Typography & 4px spacing scale, 8-12px border radii | Phase 0, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | verified | 4px scale (--space-1 to 12) & radii in `src/app/globals.css` |
| **UI-06** | Desktop layout: slim nav rail, quiet top bar, centered review column | Phase 1, 7 | `src/components/NavigationRail.tsx` | `tests/a11y-ui.spec.ts` | in-progress | Review column implemented; nav rail in Phase 7 |
| **UI-07** | Issue card hierarchy: title -> status/priority -> screenshot -> explanation -> recommendation -> decision -> technical | Phase 1, 7 | `src/components/IssueCard.tsx` | `tests/target-size-slice.spec.ts` | verified | Strict information order verified in Playwright |
| **UI-08** | Expandable technical evidence collapsed by default & accessible | Phase 1, 7 | `src/components/IssueCard.tsx` | `tests/target-size-slice.spec.ts` | verified | Collapsed evidence and toggle verified in E2E |
| **UI-09** | Designer decision actions (Accept, Reject, Edit, Reprioritize) | Phase 1, 4 | `src/components/IssueCard.tsx` | `tests/decision-workflow.spec.ts` | verified | 4 actions rendered and functional |
| **UI-10** | Designer reason input; preserve unfinished text on save failure | Phase 1, 4 | `src/components/DecisionDialog.tsx` | `tests/decision-workflow.spec.ts` | verified | Reason input and preservation verified |
| **UI-11** | Decision persistence & inline feedback | Phase 1, 4 | `src/components/IssueCard.tsx` | `tests/decision-workflow.spec.ts` | verified | Inline save confirmation verified in E2E |
| **UI-12** | Mobile layout: drawer, single-column flow, no horizontal overflow | Phase 7 | `src/components/NavigationRail.tsx` | `tests/responsive.spec.ts` | not-started | Pending Phase 7 |
| **UI-13** | Long-content safety: safe wrap for URLs, selectors, fingerprints | Phase 1, 7 | `src/app/globals.css` | `tests/responsive.spec.ts` | not-started | Pending Phase 1, 7 |
| **UI-14** | Responsive verification at 320px, 375px, 768px, 1024px, 1440px | Phase 7 | `src/app/globals.css` | `tests/responsive.spec.ts` | not-started | Pending Phase 7 |
| **UI-15** | Application A11y: 44x44px touch targets, visible focus, ARIA, semantic HTML | Phase 1, 7 | `src/app/globals.css` | `tests/a11y-ui.spec.ts` | not-started | Pending Phase 1, 7 |
| **UI-16** | Comprehensive application states (15 states clearly represented) | Phase 7 | `src/components/StateViews.tsx` | `tests/a11y-ui.spec.ts` | not-started | Pending Phase 7 |
| **UI-17** | Live region announcements for audit status changes | Phase 7 | `src/components/TopBar.tsx` | `tests/a11y-ui.spec.ts` | not-started | Pending Phase 7 |
| **UI-18** | Five-second scannability of target, status, issue count, next action | Phase 7 | `src/components/AuditSummary.tsx` | `tests/a11y-ui.spec.ts` | not-started | Pending Phase 7 |
| **AI-01** | Validated evidence-only input to AI; no unrestricted screenshots | Phase 5 | `src/lib/ai/prompt-builder.ts` | `src/lib/ai/__tests__/prompt.test.ts` | not-started | Pending Phase 5 |
| **AI-02** | Grounded outputs: explain, summarize, recommend, clarify, acknowledge uncertainty | Phase 5 | `src/lib/ai/gemini-adapter.ts` | `src/lib/ai/__tests__/service.test.ts` | not-started | Pending Phase 5 |
| **AI-03** | Prohibited AI behaviors enforced (no hallucinated values, no auto-overrides) | Phase 5 | `src/lib/ai/prompt-builder.ts` | `src/lib/ai/__tests__/prompt.test.ts` | not-started | Pending Phase 5 |
| **AI-04** | Structured schema validation of AI responses using Zod | Phase 5 | `src/lib/schema/ai-response.ts` | `src/lib/ai/__tests__/service.test.ts` | not-started | Pending Phase 5 |
| **AI-05** | Deterministic template fallback when API key absent, times out, or fails | Phase 5 | `src/lib/ai/fallback.ts` | `src/lib/ai/__tests__/fallback.test.ts` | not-started | Pending Phase 5 |
| **TEST-01** | Normal text contrast pass and fail tests | Phase 2 | `src/lib/audit/rules/text-contrast.ts` | `src/lib/audit/rules/__tests__/text-contrast.test.ts` | verified | Verified (text-contrast.test.ts) |
| **TEST-02** | Large text contrast pass and fail tests | Phase 2 | `src/lib/audit/rules/text-contrast.ts` | `src/lib/audit/rules/__tests__/text-contrast.test.ts` | verified | Verified (text-contrast.test.ts) |
| **TEST-03** | Complex text background marked needsReview test | Phase 2 | `src/lib/audit/rules/text-contrast.ts` | `src/lib/audit/rules/__tests__/text-contrast.test.ts` | verified | Verified (text-contrast.test.ts) |
| **TEST-04** | Non-text component contrast candidate fail test | Phase 2 | `src/lib/audit/rules/non-text-contrast.ts` | `src/lib/audit/rules/__tests__/non-text-contrast.test.ts` | verified | Verified (non-text-contrast.test.ts) |
| **TEST-05** | Non-text uncertainty marked needsReview test | Phase 2 | `src/lib/audit/rules/non-text-contrast.ts` | `src/lib/audit/rules/__tests__/non-text-contrast.test.ts` | verified | Verified (non-text-contrast.test.ts) |
| **TEST-06** | Target size pass test | Phase 1 | `src/lib/audit/rules/target-size.ts` | `src/lib/audit/rules/__tests__/target-size.test.ts` | verified | Verified (target-size.test.ts) |
| **TEST-07** | Target size fail test | Phase 1 | `src/lib/audit/rules/target-size.ts` | `src/lib/audit/rules/__tests__/target-size.test.ts` | verified | Verified (target-size.test.ts) |
| **TEST-08** | Target size exception review test | Phase 1 | `src/lib/audit/rules/target-size.ts` | `src/lib/audit/rules/__tests__/target-size.test.ts` | verified | Verified inline and spacing exceptions |
| **TEST-09** | Reflow clean pass test | Phase 3 | `src/lib/audit/rules/reflow.ts` | `src/lib/audit/rules/__tests__/reflow.test.ts` | verified | Verified 320px clean reflow pass without horizontal scroll (reflow.test.ts) |
| **TEST-10** | Reflow overflow candidate fail test | Phase 3 | `src/lib/audit/rules/reflow.ts` | `src/lib/audit/rules/__tests__/reflow.test.ts` | verified | Verified unintended horizontal overflow candidate failure at 320px with bounding box & computed style evidence |
| **TEST-11** | Essential-scroll review test | Phase 3 | `src/lib/audit/rules/reflow.ts` | `src/lib/audit/rules/__tests__/reflow.test.ts` | verified | Verified essential 2D table/diagram marked needsReview with exception rationale |
| **TEST-12** | Text spacing clean pass test | Phase 3 | `src/lib/audit/rules/text-spacing.ts` | `src/lib/audit/rules/__tests__/text-spacing.test.ts` | verified | Verified clean text spacing pass without clipping or overlap (text-spacing.test.ts) |
| **TEST-13** | Text spacing clipping candidate fail test | Phase 3 | `src/lib/audit/rules/text-spacing.ts` | `src/lib/audit/rules/__tests__/text-spacing.test.ts` | verified | Verified deterministically clipped container candidate failure with baseline/candidate height evidence |
| **TEST-14** | Grouping duplicate findings test | Phase 1, 4 | `src/lib/audit/grouping.ts` | `src/lib/audit/__tests__/grouping.test.ts` | verified | Verified (grouping.test.ts) |
| **TEST-15** | Stable grouping fingerprint generation test | Phase 1, 4 | `src/lib/audit/grouping.ts` | `src/lib/audit/__tests__/grouping.test.ts` | verified | Verified (grouping.test.ts) |
| **TEST-16** | Evidence schema validation test | Phase 1 | `src/lib/schema/ux-issue.ts` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Verified (ux-issue.test.ts) |
| **TEST-17** | Invalid evidence rejection test | Phase 1 | `src/lib/schema/ux-issue.ts` | `src/lib/schema/__tests__/ux-issue.test.ts` | verified | Verified (ux-issue.test.ts) |
| **TEST-18** | Designer-decision persistence test | Phase 1, 4 | `src/lib/storage/db.ts` | `src/lib/storage/__tests__/db.test.ts` | verified | Verified (db.test.ts) |
| **TEST-19** | Markdown report output test | Phase 6 | `src/lib/report/markdown-export.ts` | `src/lib/report/__tests__/export.test.ts` | not-started | Pending Phase 6 |
| **TEST-20** | JSON report output test | Phase 6 | `src/lib/report/json-export.ts` | `src/lib/report/__tests__/export.test.ts` | not-started | Pending Phase 6 |
| **TEST-21** | AI deterministic fallback test | Phase 5 | `src/lib/ai/fallback.ts` | `src/lib/ai/__tests__/fallback.test.ts` | not-started | Pending Phase 5 |
| **TEST-22** | Audit URL validation and private-network rejection test | Phase 1 | `src/lib/audit/url-validator.ts` | `src/lib/audit/__tests__/url-validator.test.ts` | verified | Verified (url-validator.test.ts) |
| **TEST-23** | Baseline versus isolated candidate re-audit test | Phase 6 | `src/lib/iteration/preview-override.ts` | `tests/iteration-proof.spec.ts` | not-started | Pending Phase 6 |
| **TEST-24** | Complete Playwright audit flow through the UI test | Phase 8 | `tests/full-audit-flow.spec.ts` | `tests/full-audit-flow.spec.ts` | not-started | Pending Phase 8 |
| **TEST-25** | All tests pass without requiring a Gemini API key | Phase 0-8 | N/A | Entire test suite | not-started | Pending Phase 8 |
| **EXCL-01** | Excluded: visual drag-and-drop editor | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-02** | Excluded: Monaco code editor | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-03** | Excluded: Figma integration | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-04** | Excluded: Website publishing | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-05** | Excluded: User accounts or collaboration | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-06** | Excluded: Telemetry, heatmaps, click tracking, A/B testing | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-07** | Excluded: Universal UX Quality Score | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-08** | Excluded: Screenshot-only AI evaluation | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-09** | Excluded: Full WCAG compliance checker | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-10** | Excluded: Automatic production source-code editing | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-11** | Excluded: Generic heuristic categories unrelated to 5 criteria | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-12** | Excluded: Marketing landing page | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-13** | Excluded: Complex analytics dashboard | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-14** | Excluded: Real-time multi-user features | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-15** | Excluded: Browser extension | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-16** | Excluded: Background crawler | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-17** | Excluded: Autonomous redesign agent | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-18** | Excluded: Multi-provider AI fallback | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-19** | Excluded: Decorative AI chat assistant unrelated to audit workflow | All | Verified absent | N/A | verified | Excluded by design |
| **EXCL-20** | Excluded: Modifying existing large ProofUI editor project | All | Verified absent | N/A | verified | Excluded by design |
| **DONE-01** | Application runs locally using documented commands | Phase 8 | `README.md` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-02** | Local fixture workflow works without an external URL | Phase 8 | Fixture pages & UI | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-03** | Deterministic audit works without an AI API key | Phase 8 | `src/lib/ai/fallback.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-04** | All five selected criteria implemented within stated boundaries | Phase 8 | `src/lib/audit/rules/*` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-05** | Results use pass, candidateFail, or needsReview | Phase 8 | `src/lib/schema/ux-issue.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-06** | Duplicate raw findings are grouped deterministically | Phase 8 | `src/lib/audit/grouping.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-07** | Screenshot and bounding-box evidence displayed where available | Phase 8 | `src/components/IssueCard.tsx` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-08** | AI receives only validated evidence | Phase 8 | `src/lib/ai/prompt-builder.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-09** | Fallback explanation works without Gemini | Phase 8 | `src/lib/ai/fallback.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-10** | Designer decisions can be created and persisted | Phase 8 | `src/lib/storage/db.ts` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-11** | Rejection, editing, and reprioritization can include a reason | Phase 8 | `src/components/DecisionDialog.tsx` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-12** | Markdown and JSON reports can be exported | Phase 8 | `src/lib/report/*` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-13** | Isolated before/after demonstration works | Phase 8 | `src/lib/iteration/*` | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-14** | Automated tests pass | Phase 8 | Vitest & Playwright | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-15** | Application is usable with a keyboard | Phase 8 | Accessible markup & focus | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-16** | Application is usable at 320px | Phase 8 | Responsive CSS | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-17** | Interface visually verified at 320px, 375px, 768px, 1024px, 1440px | Phase 8 | Screenshots | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-18** | Long technical values do not break the layout | Phase 8 | Safe wrapping CSS | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-19** | Final UI follows minimal, calm, content-first design direction | Phase 8 | CSS tokens & components | Phase 8 execution | not-started | Pending Phase 8 |
| **DONE-20** | No explicitly excluded feature has been implemented | Phase 8 | Repository audit | Phase 8 execution | not-started | Pending Phase 8 |
