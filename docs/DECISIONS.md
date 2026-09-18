# Architecture and Implementation Decisions

This document records technical and architectural decisions for `proofui-audit-poc`.

---

## DEC-001: Storage Strategy — Local JSON File Store vs SQLite

* **Date**: 2026-09-18
* **Decision**: Use a structured local JSON file store with atomic file writes (via temporary file rename) in `.proofui-data/` rather than an SQLite database.
* **Reason**:
  - Eliminates native C-bindings and compilation issues across varying Node.js versions and platforms (especially `better-sqlite3` native rebuilds).
  - Matches the requirement for a "simple local file or SQLite database" with the smallest reasonable dependency set.
  - Data volumes for research PoC audit runs and decisions are modest and easily inspected by humans for debugging and grading.
  - Zod schemas directly validate read/write operations at the boundaries.
* **Alternatives Considered**:
  - `better-sqlite3`: Fast and powerful, but introduces native build dependencies and binary lock issues.
  - `sql.js` (WASM): Adds bundle size and asynchronous WASM initialization overhead without substantial benefits for local PoC workloads.
* **Affected Requirement IDs**: `ARCH-05`, `DATA-05`, `DATA-06`

---

## DEC-002: Single AI Provider Abstraction with Deterministic Fallback

* **Date**: 2026-09-18
* **Decision**: Implement a single unified AI interface wrapping Google Gemini API with `@google/genai` (or native fetch to Gemini REST endpoint) and a robust, deterministic rule-based fallback generator when `GEMINI_API_KEY` is not present or calls fail.
* **Reason**:
  - Directly satisfies `ARCH-08`, `ARCH-09`, `AI-05`, and `EXCL-18` (prohibiting multi-provider fallback).
  - Ensures the tool is 100% testable and demonstrable without API keys, network access, or external billing accounts.
* **Alternatives Considered**:
  - OpenAI / Anthropic multi-client router: Explicitly banned by `EXCL-18` and `ARCH-08`.
  - Stub only without structured output: Fails to provide realistic UX recommendations when evaluating designer-in-the-loop workflows.
* **Affected Requirement IDs**: `ARCH-08`, `ARCH-09`, `AI-01`, `AI-02`, `AI-03`, `AI-04`, `AI-05`

---

## DEC-003: Headless Playwright In-Process Browser Auditing

* **Date**: 2026-09-18
* **Decision**: Use Playwright via Next.js API route / backend service to launch headless Chromium, navigate to the target (or local fixture), execute DOM measurements via `page.evaluate()`, take focused screenshots of element bounding boxes, and compute factual evidence.
* **Reason**:
  - Provides genuine rendered browser environment with actual computed styles, subpixel geometry, element bounding boxes, and real font rendering, which static DOM parsers (like JSDOM or Cheerio) cannot do.
  - Supports viewport sizing exactly as required (`375px`, `1440px`, and `320px` reflow).
* **Alternatives Considered**:
  - JSDOM: Cannot compute real layout, text wrapping, client bounding boxes, or reflow.
  - Puppeteer: Heavier and less ergonomic than Playwright for multi-viewport screenshots and isolation.
* **Affected Requirement IDs**: `ARCH-03`, `ARCH-05`, `RULE-02`, `SEC-07`

---

## DEC-004: Strict SSRF and Private Network Protection

* **Date**: 2026-09-18
* **Decision**: Reject all public audit target URLs resolving to RFC 1918 private subnets, loopback addresses (`127.0.0.1`, `localhost`), and cloud metadata IP (`169.254.169.254`), while permitting a dedicated internal fixture protocol (`fixture://<fixture-id>` or internal route `/fixtures/<id>`).
* **Reason**:
  - Satisfies `SEC-04`, `SEC-05`, and `SEC-06` to prevent SSRF vulnerabilities and unauthorized intranet probing.
  - Enforces the local fixture selector as the default, safest first-run experience.
* **Alternatives Considered**:
  - Allowing raw `localhost:3000` URLs: Vulnerable to SSRF and arbitrary internal port scanning.
* **Affected Requirement IDs**: `SEC-01`, `SEC-02`, `SEC-04`, `SEC-05`, `SEC-06`

---

## DEC-005: Visual Tokens & Minimal ChatGPT-Inspired Design Direction

* **Date**: 2026-09-18
* **Decision**: Define pure CSS custom properties in `src/app/globals.css` with off-white surfaces (`#f7f7f5`, `#ffffff`, `#f1f1ef`), restrained dark foreground (`#202123`), single green accent (`#10a37f`), and strict functional-only status colors.
* **Reason**:
  - Satisfies `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05`, avoiding heavyweight UI frameworks (Tailwind, MUI, Chakra) and keeping the codebase ultra-lean and transparent.
  - Avoids decorative distractions (no gradients, no glassmorphism, no marketing tiles), keeping the UX/UI designer focused on evidence.
* **Alternatives Considered**:
  - Tailwind CSS: Adds extra dependencies, complex build configurations, and utility classes that can scatter color values.
  - Component library (Radix/Shadcn): Adds excessive dependency weight when minimal semantic HTML + custom CSS satisfies all requirements with 44px touch targets.
* **Affected Requirement IDs**: `ARCH-06`, `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05`

---

## DEC-006: Local Dev and Playwright Port Configuration (Port 3123)

* **Date**: 2026-09-18
* **Decision**: Configure Next.js dev server and Playwright `baseURL` / `webServer` to use port 3123 instead of the default port 3000.
* **Reason**: Port 3000 was already bound on the host machine by a background Docker service (`Open WebUI`), causing Playwright to connect to the wrong application during initial smoke tests.
* **Alternatives Considered**: Stopping Docker containers on the host machine (disruptive to user's existing work).
* **Affected Requirement IDs**: `ARCH-01`, `ARCH-05`

---

## DEC-007: Scoping 44px Touch Target Reset to Exclude Fixture Content

* **Date**: 2026-09-18
* **Decision**: Target the 44×44 CSS px accessible touch target CSS reset specifically to ProofUI application controls using `#app-root button:not(#fixture-content *), .touch-target` rather than a global `button` selector.
* **Reason**: The ProofUI audit application controls require comfortable >=44×44 px touch targets (`UI-15`), but local test fixtures need to render intentional candidate failures (e.g. 16×16 px buttons) to test the WCAG 24×24 px audit rule (`RULE-09`).
* **Alternatives Considered**: Hosting fixtures on a separate isolated sub-domain or static HTML file (unnecessary complexity; CSS scoping cleanly solves it).
* **Affected Requirement IDs**: `RULE-09`, `UI-15`

---

## DEC-008: Text Contrast Bold-Weight Boundary and Full-Precision Classification

* **Date**: 2026-09-18
* **Decision**: 
  - Define bold font-weight strictly as computed `fontWeight >= 700` (or keywords `'bold'` / `'bolder'`). Weights below 700 (e.g. 400 normal, 500 medium, 600 semi-bold) do not qualify as bold under WCAG 2.2 SC 1.4.3.
  - Large text threshold is defined as: `fontSizePx >= 24` OR (`fontSizePx >= 18.66 && fontWeight >= 700`).
  - Pass/fail classification strictly uses full-precision floating-point contrast ratios (`calculateContrastRatioRaw`), avoiding rounded values causing false passes (e.g., a raw ratio of 4.496:1 is classified as candidateFail, and display formatting floors it to 4.49:1 to prevent confusing UI display).
* **Reason**: Directly complies with WCAG 2.2 SC 1.4.3 specifications and prevents edge-case rounding errors.
* **Affected Requirement IDs**: `RULE-05`, `TEST-01`, `TEST-02`

---

## DEC-009: Multi-Layer Background Compositing and Unresolved Transparency Boundary

* **Date**: 2026-09-18
* **Decision**:
  - Traversal walks up the DOM ancestor chain, stacking background colors and tracking ancestor opacities (`prod(ancestorOpacities)`).
  - Layers are blended downwards using Porter-Duff alpha compositing (`blendColors`) until accumulated alpha reaches 1.0 (opaque).
  - If transparency reaches the document root (`<html>`) with accumulated alpha < 1.0, do NOT assume white. Return `status: 'needsReview'` with `hasUnresolvedTransparency = true` and explicit rationale.
  - If a CSS gradient, background image, SVG, canvas, video, filter, or blend mode is present, return `status: 'needsReview'` with `hasComplexBackground = true`.
  - Inactive/disabled controls under SC 1.4.11 are marked `status: 'pass'` with explicit `exception` indicating "Excluded / Not Applicable", and the UI displays an `Excluded / Not Applicable` badge preserving the underlying tri-state schema.
* **Reason**: Avoids deterministic false passes/fails over complex surfaces and complies with SC 1.4.11 exception semantics.
* **Affected Requirement IDs**: `RULE-04`, `RULE-06`, `RULE-07`, `RULE-08`, `TEST-03`, `TEST-04`, `TEST-05`

---

## DEC-010: CSS Group Opacity Subtree Limitation & NeedsReview Policy

* **Date**: 2026-09-18
* **Decision**:
  - CSS `opacity` applies to the composited rendering result of an entire element subtree (group opacity). Multiplying ancestor opacity directly into text foreground alpha does not accurately reproduce final rendered contrast when text and its local background are inside the same translucent ancestor.
  - For text affected by ancestor group opacity (<1): If group opacity compositing is ambiguous or affects both the text and its backing container, classify the result as `needsReview` with explicit rationale (`hasAncestorGroupOpacity = true`).
  - Prohibit producing a definitive automated pass or candidate failure from an incomplete or assumed compositing model.
* **Reason**: Ensures WCAG 2.2 SC 1.4.3 determinations remain strictly truthful and prevents false passes or false candidate fails caused by flattened subtree opacity assumptions.
* **Affected Requirement IDs**: `RULE-05`, `RULE-06`, `TEST-01`, `TEST-03`

---

## DEC-011: DNS Rebinding and TOCTOU Limitation & Fail-Closed Security Policy

* **Date**: 2026-09-18
* **Decision**:
  - Acknowledge and document that upfront asynchronous DNS resolution plus Playwright network request interception significantly reduces SSRF risk, but does not mathematically eliminate DNS rebinding or Time-of-Check-to-Time-of-Use (TOCTOU) resolution differences between Node.js and the Chromium network stack in all enterprise environments.
  - The PoC must fail closed: if address resolution is ambiguous, resolves to both public and private addresses, or redirects to a blocked destination, the audit aborts immediately.
  - The existing Playwright request interception (`page.route('**')`) and response listener must remain enabled for all navigations and subresource requests.
* **Reason**: Prevents SSRF vulnerabilities and unauthorized internal network reconnaissance.
* **Affected Requirement IDs**: `SEC-04`, `SEC-05`, `SEC-07`

---

## DEC-012: Test Count Reconciliation & Phase 4 Baseline

* **Date**: 2026-09-19
* **Decision**: 
  - Formally reconcile repository test reporting history:
    1. *Phase 3 Initial Report*: 58 Vitest unit tests (11 files) and 6 Playwright E2E tests (4 files).
    2. *Corrective Review Baseline Citation*: Cited an earlier baseline as "48 unit tests (9 files) and 4 E2E tests (2 files)". Repository evidence confirms this was an inadvertent backward reference to an earlier intermediate Phase 2 state before full Reflow and Text Spacing test additions were introduced.
    3. *Phase 3 Corrective Checkpoint (Current Verified State)*: 66 Vitest unit tests (11 files) and 11 Playwright E2E tests (4 files), adding deep test cases for nested scroll containers, ancestor clipping, subpixel bounds, obscured controls, fluid expansion, style restoration, and idempotency.
  - The true verifiable baseline entering Phase 4 is 66 unit tests and 11 Playwright tests.
* **Reason**: Reconciles documentation discrepancy with factual, verifiable repository evidence without inventing results.
* **Affected Requirement IDs**: `TEST-01` through `TEST-25`

---

## DEC-013: Designer Decision Immutability, Mandatory Rationales, and Append-Only History

* **Date**: 2026-09-19
* **Decision**:
  - Deterministic findings (measurements, selectors, bounding boxes, WCAG criteria, and raw occurrences) are strictly immutable; designer actions can never alter or erase them.
  - The `edit` action allows editing only the designer-authored recommendation and notes (`editedRecommendation`), preserving the original automated recommendation alongside the designer-edited text.
  - The `reject`, `edit`, and `reprioritize` actions strictly require a non-empty designer rationale (`designerReason.trim().length >= 3`). The `accept` action allows an optional rationale.
  - All designer actions append an immutable `DecisionRecord` (with UUID, timestamp, action, rationale, priority changes, and edited text) to an append-only `decisionHistory` array, while updating the current effective state on the grouped issue.
* **Reason**: Enforces the "Designer-in-the-Loop" research integrity principle (`ARCH-03`, `ARCH-04`, `DATA-04`, `DATA-05`, `UI-09`, `UI-10`).
* **Affected Requirement IDs**: `ARCH-04`, `DATA-01`, `DATA-04`, `DATA-05`, `UI-09`, `UI-10`, `UI-11`

---

## DEC-014: Aggregate Status Ordering Policy and Transparent Occurrence Exposure

* **Date**: 2026-09-19
* **Decision**:
  - In `groupUXIssues()`, when multiple occurrences share the same deterministic fingerprint across viewports, the aggregate grouped issue status follows the strict precedence: `candidateFail` > `needsReview` > `pass`.
  - **Rationale**: A `candidateFail` represents an objective, deterministic violation of a WCAG threshold on at least one tested viewport (e.g., target < 24x24px or text clipped > 0px). In accessibility evaluation, a failure on any supported viewport is an actionable defect that requires designer remediation or explicit documented rejection. Conversely, `needsReview` represents an advisory check or potential exception (e.g., essential 2D table or complex background), which does not override a confirmed defect.
  - **Contradictory / Mixed-Status Evidence**: When occurrences for the same component differ in status across viewports, `hasMixedStatus` is explicitly set to `true`. No contradictory evidence is hidden: every individual raw occurrence retains its own status (`pass`, `candidateFail`, or `needsReview`), viewport, bounding box, and measurements, inspectable in `OccurrenceList.tsx`.
* **Reason**: Ensures defect visibility while maintaining complete raw evidence transparency (`DATA-03`, `DATA-04`, `RULE-04`, `RULE-15`, `TEST-14`).
* **Affected Requirement IDs**: `DATA-03`, `DATA-04`, `RULE-04`, `RULE-15`, `TEST-14`

---

## DEC-015: Concurrency Safety and Server-Owned Event Provenance

* **Date**: 2026-09-19
* **Decision**:
  - The persistence layer implements an in-process per-run write queue / mutex (`withRunLock`) in `src/lib/storage/db.ts` to serialize concurrent and rapid sequential decision requests targeting the same `runId`.
  - Decision event metadata (`id` as UUID, `timestamp` as ISO-8601 server datetime) is strictly generated by the server. Any client-supplied event IDs or timestamps are discarded.
  - Attempted client mutations to deterministic evidence (`measured`, `expected`, `selector`, `ruleId`, `wcagCriterion`, `boundingBox`, `occurrences`) are strictly ignored and discarded; deterministic fields remain byte-equivalent across updates.
  - Corrupt run files fail safely by throwing `CorruptedAuditRunError`, preventing silent replacement or data loss.
  - Atomic temporary file renaming protects against partial file writes.
  - **Scope Limitation**: This in-process mutex queue serializes writes within the single running Node.js process; it does not provide distributed multi-process locking, which remains excluded per `EXCL-05` and `EXCL-14`.
* **Reason**: Prevents lost updates, race conditions, and accidental data corruption during rapid designer reviews (`DATA-05`, `DATA-06`, `UI-11`, `TEST-18`).
---

## DEC-016: Grounded AI Explanation Boundary, Defense Against Prompt Injection, and Deterministic Fallback Policy

* **Date**: 2026-09-19
* **Decision**:
  - **Evidence-Only Projection**: The AI adapter accepts strictly a minimal projection (`AIExplanationInput`) derived from server persistence. It receives only rule ID, WCAG criterion, status, title, description, element tag, role, accessible name, viewport, measured values, expected values, exception/review reason, and initial priority rationale. It NEVER receives screenshots, DOM HTML, cookies, auth headers, file paths, or designer history (`ARCH-07`, `ARCH-08`).
  - **Untrusted Content & Prompt Injection Quarantine**: All text originating from audited websites (selectors, accessible names, text content, descriptions) is treated as untrusted data, enclosed within delimited blocks (`=== BEGIN UNTRUSTED AUDIT EVIDENCE ===`), with explicit negative constraints barring the model from executing commands found in evidence fields (`ARCH-08`, `TEST-24`).
  - **Deterministic Grounding Checks**: AI responses are validated by Zod and immediately subject to deterministic grounding rules. Responses are rejected and routed to fallback if they invent measurements, cite conflicting WCAG criteria, assert complete compliance, claim source code was modified or tested, conflate P0–P3 with WCAG severity, or convert `needsReview` to definite failure (`ARCH-07`, `TEST-22`).
  - **Provider Architecture**: Implemented one `ExplanationProvider` interface with two implementations: `GeminiExplanationProvider` (server-side only, 8000ms timeout, temperature 0.1, structured JSON) and `DeterministicExplanationProvider` (100% offline coverage for all 5 rule families and all 3 statuses). No multi-provider chaining or complex retry loops (`ARCH-09`, `ARCH-10`).
  - **Deterministic Fallback Policy**: If `GEMINI_API_KEY` is missing, or on timeout, network failure, malformed JSON, schema error, or grounding failure, the system falls back seamlessly to deterministic rule explanations without failing the audit or leaking keys/stack traces (`ARCH-09`, `TEST-21`, `TEST-25`).
  - **Provenance Transparency**: Explanations are visibly badged as `[AI-Generated (Gemini)]` or `[Deterministic Fallback]` with concise fallback reason indicators. When a designer edits a recommendation, `[Designer-Edited Recommendation]` is primary, preserving underlying AI/fallback guidance in an accessible disclosure (`UI-12`, `UI-13`).
  - **Immutability Protection**: AI generation cannot mutate deterministic measurements, selectors, thresholds, WCAG criteria, status, or designer decisions. Generating or regenerating an explanation NEVER overwrites a designer-authored recommendation (`DATA-01`, `DATA-04`).
* **Reason**: Satisfies Phase 5 requirements, guaranteeing verifiable accessibility integrity, prompt injection resistance, and zero offline test failure (`ARCH-07`, `ARCH-08`, `ARCH-09`, `ARCH-10`, `TEST-21`–`TEST-26`).
* **Affected Requirement IDs**: `ARCH-07`, `ARCH-08`, `ARCH-09`, `ARCH-10`, `DATA-01`, `DATA-04`, `UI-12`, `UI-13`, `TEST-21`, `TEST-22`, `TEST-23`, `TEST-24`, `TEST-25`, `TEST-26`

---

## DEC-017: Regeneration History Preservation, Strict Test Offline Guards, and Unconditional NeedsReview Enforcement

* **Date**: 2026-09-19
* **Decision**:
  - **Append-Only Regeneration History**: Every generation and regeneration event appends an immutable `AIGenerationRecord` to `aiGenerationHistory` on both the grouped issue and its representative. Each record captures a server-generated UUID, ISO timestamp, provenance (`gemini` or `fallback`), fallback status and reason, explanation, recommendation, uncertainty note, and evidence fingerprint. Previous generation records are never overwritten, survive page reload, and remain inspectable in a dedicated disclosure.
  - **Identifiable Effective Guidance**: The primary card display surfaces the latest generation result while strictly preserving any designer-authored custom recommendation (`editedRecommendation`), which takes precedence over AI guidance.
  - **Unconditional `needsReview` Enforcement**: For every finding where `status === "needsReview"`, `requiresDesignerReview: true` and a non-empty `uncertaintyNote` are strictly required, regardless of whether `exception` or `reviewReason` happens to be populated in the evidence. Outputs presenting `needsReview` as a definite failure, definite pass, confirmed exception, or confirmed fix are rejected.
  - **Explicit Threshold Grounding**: Grounding checks explicitly enforce WCAG thresholds per rule family: target size (24×24 CSS px), normal text contrast (4.5:1), large text contrast (3:1), non-text contrast (3:1), reflow (320 CSS px), and text spacing (1.5× line height, 2× paragraph spacing, 0.12× letter spacing, 0.16× word spacing). Numbered prose (e.g. "step 1", "2 options") and selector numbers are safely permitted.
  - **Automated Test Offline Guarantee**: Both `ExplanationService` and `GeminiExplanationProvider` enforce environment guards (`process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.PLAYWRIGHT_TEST`) that unconditionally block real Gemini SDK instantiation and network calls, even if `GEMINI_API_KEY` is present in developer environments or CI.
* **Reason**: Fulfills Phase 5 closure checkpoint requirements, ensuring complete audit traceability, verifiable threshold grounding, and offline test reliability (`ARCH-08`, `ARCH-09`, `AI-01`–`AI-05`, `TEST-21`, `TEST-25`).
* **Affected Requirement IDs**: `ARCH-08`, `ARCH-09`, `AI-01`, `AI-02`, `AI-03`, `AI-04`, `AI-05`, `TEST-21`, `TEST-25`

---

## DEC-018: Server-Authoritative Report Export, Shared Normalized Model, and Untrusted-Content Sanitization

* **Date**: 2026-09-19
* **Decision**:
  - **Server-Authoritative Generation**: Reports are generated strictly on the server from persisted, validated audit runs loaded via `getAuditRun(runId)`. The client is permitted to supply only `runId` and `format` (`json` | `markdown` | `md`). No client-supplied issues, titles, templates, file paths, or output directories are accepted.
  - **Shared Normalized Data Model (`ReportModel`)**: Both JSON and Markdown formats derive from a single unified `buildNormalizedReport()` builder and `ReportModelSchema` Zod contract, guaranteeing 100% parity across run identity, summary counts, statuses, priorities, designer decisions, decision history, AI provenance, and required disclaimers.
  - **Absolute Path & Secret Sanitization**: Internal developer machine paths (e.g. `/Users/...`, `C:\...`, `/home/...`) in screenshots or metadata are systematically sanitized to relative web-safe paths (`/screenshots/<filename>`). Environment secrets and API keys are strictly excluded.
  - **Untrusted-Content Defense in Markdown**: Content originating from audited pages, user inputs, or AI outputs is treated as untrusted:
    - Raw HTML tags are entity-escaped (`&lt;`, `&gt;`).
    - Selectors containing backticks are safely wrapped in dynamic code fences with `maxBackticks + 1` (minimum 4 backticks ```` ````) to prevent premature fence closure.
    - Heading injection (`#`, `##`) and horizontal rules (`---`, `===`) are prefixed with backslashes to prevent section impersonation.
    - Spreadsheet formula injection strings (`=`, `+`, `-`, `@`) are prefixed with `'` to render inert if exported data is imported into spreadsheets.
  - **Safe Download Delivery**: Filenames are generated server-side using sanitized alphanumeric characters (`proofui-audit-${safeId}.${ext}`), preventing path traversal. Responses set explicit MIME types (`application/json`, `text/markdown`) and `Content-Disposition: attachment`.
* **Reason**: Satisfies Phase 6A requirements (`DATA-07`, `DATA-08`, `TEST-19`, `TEST-20`), ensuring secure, cross-format consistent, and leak-free report export for both machine consumption and human review.
* **Affected Requirement IDs**: `DATA-07`, `DATA-08`, `TEST-19`, `TEST-20`, `UI-14`, `UI-15`

