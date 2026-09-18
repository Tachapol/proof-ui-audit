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



