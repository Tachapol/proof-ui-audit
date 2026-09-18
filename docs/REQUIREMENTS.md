# Requirements Checklist

This document contains the complete, unabridged, and numbered requirements for `proofui-audit-poc`.

## 1. Architecture & General Principles (`ARCH-*`)

- [ ] **ARCH-01**: Project identity — Create a new, separate, lean Proof of Concept project named `proofui-audit-poc` as a research prototype for "Evidence-Based UX/UI Optimization with UX/UI Designer-in-the-Loop Validation".
- [ ] **ARCH-02**: Preservation of external projects — Do not modify the existing large ProofUI editor project.
- [ ] **ARCH-03**: Core research workflow — Implement the end-to-end pipeline: Rendered URL or local test website → Playwright browser measurements → deterministic WCAG-informed checks → grouped evidence-based issue cards → AI explanation and recommendation grounded only in verified evidence → UX/UI designer decision (accept / reject / edit / reprioritize) → validated report and decision log.
- [ ] **ARCH-04**: Role of the system — Act as decision support for UX/UI designers; do not act as an autonomous redesign tool and do not claim complete WCAG conformance.
- [ ] **ARCH-05**: Technology stack — Next.js with App Router, React, TypeScript in strict mode, Playwright for browser auditing and screenshots, Zod for schema validation, Vitest for unit tests, simple local file or SQLite store for audit runs and decisions.
- [ ] **ARCH-06**: Minimal dependencies — Prefer the smallest reasonable dependency set; do not add large component frameworks, state-management libraries, charting libraries, animation libraries, or external design systems.
- [ ] **ARCH-07**: Iconography — Use one consistent SVG icon library (Lucide); do not use emoji as interface icons.
- [ ] **ARCH-08**: AI provider abstraction — Support only one AI provider abstraction: Google Gemini API when the API key environment variable is available, and deterministic template fallback when no key is configured. No multi-provider fallback.
- [ ] **ARCH-09**: Offline / No-key operability — The complete application and deterministic audit workflow must remain demonstrable and testable without an AI API key.
- [ ] **ARCH-10**: Minimal iteration proof — Implement one safe demonstration of the optimization loop on a local fixture: Baseline audit → issue card + AI recommendation → designer approves predefined/manual CSS override → apply in isolated preview → re-audit page → before/after measurements → selected-check regression result → designer records final decision. Original fixture source must remain unchanged.

## 2. Hard Scope & Audit Rules (`RULE-*`)

- [ ] **RULE-01**: Hard scope boundary — Implement only five WCAG-informed criteria:
  1. Text Contrast (WCAG 2.2 SC 1.4.3)
  2. Non-text Contrast (WCAG 2.2 SC 1.4.11)
  3. Target Size (WCAG 2.2 SC 2.5.8)
  4. Reflow / horizontal overflow (WCAG 2.2 SC 1.4.10)
  5. Text Spacing (WCAG 2.2 SC 1.4.12)
- [ ] **RULE-02**: Audit viewports — Mobile: `375px`, Desktop: `1440px`, Reflow: `320 CSS px`.
- [ ] **RULE-03**: No scope creep — Do not silently introduce additional accessibility or generic UX rules.
- [ ] **RULE-04**: Deterministic tri-state status — Every deterministic rule must return one of `"pass" | "candidateFail" | "needsReview"`.
- [ ] **RULE-05**: Text Contrast threshold — At least `4.5:1` for normal text, or `3:1` for large text (>= 18pt or >= 14pt bold).
- [ ] **RULE-06**: Text Contrast needsReview — Flag text over an image, gradient, canvas, video, or unresolved background transparency as `needsReview`.
- [ ] **RULE-07**: Non-text Contrast threshold — At least `3:1` for required UI components/states and meaningful graphical objects against adjacent colors.
- [ ] **RULE-08**: Non-text Contrast needsReview — Flag uncertain component meaning or interactive state as `needsReview`.
- [ ] **RULE-09**: Target Size threshold — At least `24 × 24 CSS px` for interactive target bounding area, subject to WCAG exceptions.
- [ ] **RULE-10**: Target Size needsReview — Flag potential WCAG exceptions (inline targets, equivalent controls, user-agent-controlled, essential controls, or spacing offset compliance) as `needsReview`.
- [ ] **RULE-11**: Reflow threshold — At `320 CSS px`, detect whether content or functionality requires two-dimensional scrolling (horizontal overflow > 320px).
- [ ] **RULE-12**: Reflow needsReview — Flag possible essential two-dimensional layouts (e.g. data tables, maps, diagrams) as `needsReview`.
- [ ] **RULE-13**: Text Spacing override & detection — Apply WCAG spacing override (line height `1.5×`, paragraph spacing `2×`, letter spacing `0.12×`, word spacing `0.16×`) and detect candidate loss of content or functionality (clipping, truncated text, element overflow).
- [ ] **RULE-14**: Text Spacing needsReview — Flag ambiguous overlap or unresolvable measurement post-override as `needsReview`.
- [ ] **RULE-15**: Clear distinction of layers — Clearly distinguish deterministically measured evidence, candidate failures, cases requiring designer review, AI-generated explanations, and final designer decisions.
- [ ] **RULE-16**: Conformance language discipline — Do not label the entire website as accessible, inaccessible, compliant, or non-compliant. Use phrases such as "candidate issue", "automated evidence", "requires designer review", and "WCAG-informed check".
- [ ] **RULE-17**: Fixtures coverage — Provide deterministic, self-contained local fixture pages covering `pass`, `candidateFail`, and `needsReview` for all five criteria without external network dependencies.

## 3. Evidence Schema & Persistence (`DATA-*`)

- [ ] **DATA-01**: Stable `UXIssue` schema — Define TypeScript interface and Zod schema with: `id`, `ruleId`, `wcagCriterion`, `status`, `title`, `description`, `url`, `viewport` (`width`, `height`), `selector`, `element`, `role?`, `accessibleName?`, `measured`, `expected`, `boundingBox?`, `screenshotPath?`, `exception?`, `initialPriority` (`"P0" | "P1" | "P2" | "P3"`), `priorityRationale`, `aiExplanation?`, `aiRecommendation?`, `designerDecision?`, `designerReason?`.
- [ ] **DATA-02**: Priority heuristic — P0–P3 is a project heuristic and not a severity scale defined by WCAG. Clearly display this distinction.
- [ ] **DATA-03**: Deterministic grouping fingerprint — Compute fingerprint based on: `ruleId + selector + normalized measurement signature`.
- [ ] **DATA-04**: Grouped issue structure — Group duplicate raw findings into unique actionable issue cards. Preserve: number of raw occurrences, representative issue, relevant viewport info, representative screenshot evidence, grouping fingerprint, and underlying occurrences for inspection.
- [ ] **DATA-05**: Local persistence — Persist audit run metadata, target URL/fixture identifier, viewports, raw findings, grouped issues, deterministic evidence, AI/fallback explanation, designer decisions, designer reasons, priority changes, and timestamps using a simple local file store or SQLite database.
- [ ] **DATA-06**: Zod boundary validation — Validate all persisted and loaded data using Zod at application boundaries; reject invalid schema data.
- [ ] **DATA-07**: Export reports — Generate Markdown and JSON report exports containing metadata, deterministic evidence, grouped candidate issues, needs-review items, AI/fallback explanations, initial priorities, designer decisions, reasons, final priorities, and explicit limitation/disclaimer statements.
- [ ] **DATA-08**: Export consistency — Ensure Markdown and JSON exports represent consistent underlying audit and decision data.

## 4. Audit Input & Security (`SEC-*`)

- [ ] **SEC-01**: Public URL input — Provide an input for a public rendered page URL with clear validation and error feedback.
- [ ] **SEC-02**: Local fixture selector — Provide a fixture selector as the default first-run experience.
- [ ] **SEC-03**: Visible audit context — Show visible indication of which URL, fixture, and viewport are being audited.
- [ ] **SEC-04**: URL normalization & scheme restriction — Validate and normalize submitted URLs, allowing only appropriate `http:` or `https:` targets.
- [ ] **SEC-05**: Private network & SSRF protection — Block private networks (e.g., `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local `169.254.0.0/16`), local metadata endpoints, and localhost targets, except for the controlled local fixture mechanism.
- [ ] **SEC-06**: Authentication boundary — Do not access authenticated pages or accept arbitrary internal URLs.
- [ ] **SEC-07**: Timeouts & resilience — Apply reasonable navigation and audit timeouts; handle failed navigations and partial audit results gracefully without crashing.
- [ ] **SEC-08**: Secret sanitization — Do not expose secrets, internal stack traces, or sensitive environment details to the browser.

## 5. Designer-First Audit UI (`UI-*`)

- [ ] **UI-01**: Visual aesthetic & principles — Calm, minimal, content-first, professionally restrained (ChatGPT-inspired restraint without imitating its branding or assets). Neutral light theme default, off-white/soft-gray surfaces (`#f7f7f5`, `#ffffff`, `#f1f1ef`), foreground `#202123`, border `#dededb`.
- [ ] **UI-02**: Restrained color palette — Restrained accent color (`#10a37f`, hover `#0d8f70`); reserve red (`#b42318`), amber (`#b54708`), and green (`#067647`) strictly for audit status. Do not rely on color alone to communicate status or priority.
- [ ] **UI-03**: Prohibited styling — Avoid gradients, glassmorphism, heavy shadows, excessive rounded cards, bright multi-color dashboard styling, decorative charts, large metric tiles, marketing banners, and ornamental animations.
- [ ] **UI-04**: Centralized design tokens — Define visual tokens in CSS variables (`--background`, `--surface`, `--surface-subtle`, `--foreground`, `--border`, `--accent`, `--focus-ring`, `--danger`, `--warning`, `--success`, `--radius-sm`, `--radius-md`, spacing scale). Do not scatter unexplained raw color values.
- [ ] **UI-05**: Typography & spacing — Clean system sans-serif font stack, 4px-based spacing scale, comfortable professional information density, radii 8–12px.
- [ ] **UI-06**: Desktop layout — Slim left navigation rail (fixtures, recent runs, report access), quiet top bar (target, state, essential actions), centered main review column with readable max width, compact horizontal summary, clean vertical feed of grouped issue cards.
- [ ] **UI-07**: Issue card hierarchy — Emphasize information in strict order: (1) Plain-language title, (2) Status and initial priority, (3) Screenshot and bounding-box evidence, (4) Concise explanation, (5) Suggested recommendation, (6) Designer decision controls, (7) Expandable technical evidence (collapsed by default).
- [ ] **UI-08**: Expandable technical evidence — Technical details (selector, element, role, accessible name, measured value, expected threshold, WCAG reference, viewport, exception state, grouping fingerprint) collapsed by default, keyboard operable with accessible disclosure.
- [ ] **UI-09**: Designer decision actions — Provide `Accept`, `Reject`, `Edit`, and `Reprioritize` controls on each issue card.
- [ ] **UI-10**: Designer reason input — Provide required or strongly encouraged reason field for rejection, editing, and reprioritization. Preserve unfinished text if saving fails.
- [ ] **UI-11**: Decision persistence & inline feedback — Provide immediate inline feedback when decisions are saved and persist them to the store.
- [ ] **UI-12**: Mobile layout & responsiveness — Collapsible navigation rail (drawer or compact menu), single-column issue review flow, stacked decision controls when needed, no application-level horizontal scrolling.
- [ ] **UI-13**: Long-content safety — Prevent URLs, selectors, fingerprints, accessible names, and measurements from breaking the layout; use safe wrapping, truncation with disclosure, or scrollable code containers.
- [ ] **UI-14**: Responsive verification widths — UI must be verified and fully usable at `320px`, `375px`, `768px`, `1024px`, and `1440px`.
- [ ] **UI-15**: Application accessibility (A11y) — Audit tool interactive controls must provide at least `44 × 44 CSS px` touch targets. Semantic HTML, keyboard accessibility, persistent visible form labels, accessible names for icons, visible focus ring (`#2563eb`), logical heading hierarchy, zoom/resize resilience, `prefers-reduced-motion` compliance.
- [ ] **UI-16**: Application states — Implement clear states for: First-run empty, fixture selected, URL validation error, audit running, audit completed, audit partially completed, audit failed, no issues found, AI unavailable, AI fallback active, decision saving, decision saved, decision save failed, export success, export failure.
- [ ] **UI-17**: Live region status announcements — Use appropriate ARIA live regions to announce audit status changes without jarringly moving keyboard focus.
- [ ] **UI-18**: Five-second scannability — Users can identify target, current status, issue count, and next action within approximately five seconds.

## 6. AI Explanation Boundary (`AI-*`)

- [ ] **AI-01**: Validated evidence-only input — AI receives only verified factual evidence from the validated `UXIssue` object. No unrestricted screenshots or ungrounded prompts.
- [ ] **AI-02**: Grounded outputs — AI may only explain observed issues in plain language, summarize verified evidence, recommend possible corrections, clarify user impact, state when designer must verify context/exceptions, and acknowledge when evidence is insufficient.
- [ ] **AI-03**: Prohibited AI behaviors — AI must NOT invent measurements, selectors, or WCAG references; invent unsupported user impact; convert `needsReview` into definite failure; produce an overall UX score; make final priority, accept, or reject decisions; autonomously modify source websites; claim complete WCAG conformance; hide uncertainty; or override deterministic evidence.
- [ ] **AI-04**: Structured schema validation — Validate AI responses with Zod before attaching to issues.
- [ ] **AI-05**: Deterministic template fallback — When AI fails, times out, returns invalid data, or no Gemini API key is configured, use a deterministic template explanation, clearly label that a fallback is active, and never block the audit workflow.

## 7. Tests (`TEST-*`)

- [ ] **TEST-01**: Normal text contrast pass and fail tests (Vitest).
- [ ] **TEST-02**: Large text contrast pass and fail tests (Vitest).
- [ ] **TEST-03**: Complex text background marked `needsReview` test (Vitest/Playwright).
- [ ] **TEST-04**: Non-text component contrast candidate fail test (Vitest).
- [ ] **TEST-05**: Non-text uncertainty marked `needsReview` test (Vitest/Playwright).
- [ ] **TEST-06**: Target size pass test (Vitest/Playwright).
- [ ] **TEST-07**: Target size fail test (Vitest/Playwright).
- [ ] **TEST-08**: Target size exception review test (Vitest/Playwright).
- [ ] **TEST-09**: Reflow clean pass test (Vitest/Playwright).
- [ ] **TEST-10**: Reflow overflow candidate fail test (Vitest/Playwright).
- [ ] **TEST-11**: Essential-scroll review test (Vitest/Playwright).
- [ ] **TEST-12**: Text spacing clean pass test (Vitest/Playwright).
- [ ] **TEST-13**: Text spacing clipping candidate fail test (Vitest/Playwright).
- [ ] **TEST-14**: Grouping duplicate findings test (Vitest).
- [ ] **TEST-15**: Stable grouping fingerprint generation test (Vitest).
- [ ] **TEST-16**: Evidence schema validation test (Vitest).
- [ ] **TEST-17**: Invalid evidence rejection test (Vitest).
- [ ] **TEST-18**: Designer-decision persistence test (Vitest).
- [ ] **TEST-19**: Markdown report output test (Vitest).
- [ ] **TEST-20**: JSON report output test (Vitest).
- [ ] **TEST-21**: AI deterministic fallback test (Vitest).
- [ ] **TEST-22**: Audit URL validation and private-network rejection test (Vitest).
- [ ] **TEST-23**: Baseline versus isolated candidate re-audit test (Vitest/Playwright).
- [ ] **TEST-24**: Complete Playwright audit flow through the UI test (Playwright).
- [ ] **TEST-25**: Test independence from API key — Ensure all automated tests run and pass without requiring a Gemini API key.

## 8. Explicitly Excluded Features (`EXCL-*`)

- [ ] **EXCL-01**: Do NOT build a visual drag-and-drop editor.
- [ ] **EXCL-02**: Do NOT build a Monaco code editor.
- [ ] **EXCL-03**: Do NOT build Figma integration.
- [ ] **EXCL-04**: Do NOT build website publishing.
- [ ] **EXCL-05**: Do NOT build user accounts or multi-user collaboration.
- [ ] **EXCL-06**: Do NOT build telemetry, heatmaps, click tracking, or A/B testing.
- [ ] **EXCL-07**: Do NOT build a Universal UX Quality Score.
- [ ] **EXCL-08**: Do NOT build screenshot-only AI evaluation.
- [ ] **EXCL-09**: Do NOT build a full WCAG compliance checker.
- [ ] **EXCL-10**: Do NOT build automatic production source-code editing.
- [ ] **EXCL-11**: Do NOT build generic heuristic categories unrelated to the 5 selected criteria.
- [ ] **EXCL-12**: Do NOT build a marketing landing page.
- [ ] **EXCL-13**: Do NOT build a complex analytics dashboard.
- [ ] **EXCL-14**: Do NOT build real-time multi-user features.
- [ ] **EXCL-15**: Do NOT build a browser extension.
- [ ] **EXCL-16**: Do NOT build a background crawler.
- [ ] **EXCL-17**: Do NOT build an autonomous redesign agent.
- [ ] **EXCL-18**: Do NOT build multi-provider AI fallback.
- [ ] **EXCL-19**: Do NOT build a decorative AI chat assistant unrelated to the audit workflow.
- [ ] **EXCL-20**: Do NOT modify the existing large ProofUI editor project.

## 9. Definition of Done (`DONE-*`)

- [ ] **DONE-01**: Application runs locally using documented commands.
- [ ] **DONE-02**: Local fixture workflow works without an external URL.
- [ ] **DONE-03**: Deterministic audit works without an AI API key.
- [ ] **DONE-04**: All five selected criteria are implemented within their stated boundaries.
- [ ] **DONE-05**: Results use `pass`, `candidateFail`, or `needsReview`.
- [ ] **DONE-06**: Duplicate raw findings are grouped deterministically.
- [ ] **DONE-07**: Screenshot and bounding-box evidence are displayed where available.
- [ ] **DONE-08**: AI receives only validated evidence.
- [ ] **DONE-09**: Fallback explanation works without Gemini.
- [ ] **DONE-10**: Designer decisions can be created and persisted.
- [ ] **DONE-11**: Rejection, editing, and reprioritization can include a reason.
- [ ] **DONE-12**: Markdown and JSON reports can be exported.
- [ ] **DONE-13**: Isolated before/after demonstration works.
- [ ] **DONE-14**: Automated tests pass (Vitest & Playwright).
- [ ] **DONE-15**: Application is usable with a keyboard.
- [ ] **DONE-16**: Application is usable at `320px`.
- [ ] **DONE-17**: Interface visually verified at `320px`, `375px`, `768px`, `1024px`, and `1440px`.
- [ ] **DONE-18**: Long technical values do not break the layout.
- [ ] **DONE-19**: Final UI follows minimal, calm, content-first design direction.
- [ ] **DONE-20**: No explicitly excluded feature has been implemented.
