# Seven-metric Pilot preparation and freeze

The order is: connect Reflow → compare all seven metrics with actual expert annotations → freeze the measured Pilot → consider Accessible Name Coverage in a later iteration. Accessible Name Coverage is not implemented or part of this candidate.

## Current evidence boundaries

Existing `pilot-suite.ts` presets named `expectedGroundTruth` are researcher expectations, not supplied expert judgments. Existing synthetic test reviewers are test fixtures only. Do not use either as expert annotations. The new workflow does not change the legacy three-case package or claim that it has been validated.

The candidate contains UI-01–UI-12 participant stimuli and two additional investigator controls (`pilot-metrics-heading`, `pilot-metrics-context`) to exercise heading transitions and component context. Controls are labelled separately and are not silently added to the participant task set. Touch spacing is exercised by UI-03/UI-04. UI-07/UI-08 now carry the Text Spacing extraction marker; prior runs without that marker do not establish text-spacing coverage.

## Reflow scope

The Browser Audit default viewport set now includes 1440×900, 375×667 and **320×640 CSS px**. Reflow runs only at width 320, before Text Spacing overrides. Custom viewport sets that omit 320 do not produce a Reflow pass. Text Contrast MVP retains its explicitly restricted scope.

Pilot preparation uses its own declared matrix: 320×640, 375×812, 1440×900. Fixture measurements use `#fixture-content` and exclude the fixture header; pasted annotated components use `[data-audit-scope]`, otherwise `#sandbox-root`. Generic pages fall back to `html`. Invalid or non-measurable scopes report an audit error instead of a clean pass.

Extraction records UI and document geometry, horizontal overflow, nested scroll regions, ancestor-clipped content, clipped/off-screen controls, decorative exclusions, units and Reflow metric version `1.1.0`. Essential 2D candidates remain `needsReview`. Contained decoration does not become a clipped-text failure merely because it increases a container's `scrollWidth`. Reflow evidence reaches grouping, cards and JSON/Markdown through the existing issue pipeline.

This pilot tests horizontal reflow of vertically scrolling content. It does not establish complete WCAG conformance, semantic validity of every scroll region, all vertical text-clipping behavior, dynamic state coverage or mobile usability. The 1 CSS px geometry tolerance is an engine tolerance, not a WCAG-defined allowance. [WAI Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) explains the 320 CSS px boundary and essential 2D exceptions.

## Prepare a measured candidate

```sh
npm run pilot:prepare
```

Uses the existing Vite/Vitest TypeScript runner and Playwright installation; no additional package installation is required. The command reuses a reachable local fixture server or starts its own, runs Typecheck, all Vitest tests, and the pilot/Reflow Chromium suites, then measures all fourteen cases at the declared three viewports. It prints progress and the unique artifact directory.

Each candidate records:

- `manifest.json`: candidate state, actual Chromium/OS/Node versions, git HEAD, hashes of relevant tracked and untracked source files, explicit viewport set and metric implementations. Dirty work is included in the hashes without committing or resetting it. No AI is used, so model/prompt are null rather than invented versions.
- `source.tar.gz`: the actual allowlisted source/configuration/test content, including uncommitted and untracked implementation files, so later worktree edits cannot erase the measured implementation. Environment secrets, local production data, `.git` and installed dependencies are excluded; the lockfile and actual runtime versions are retained.
- `runs/` and `reports/`: saved raw runs, normalized JSON and Markdown for the investigator. Measured values and warnings are observations, not expert consensus.
- `images/` and `blind-review.md`: copied page screenshots with neutral case IDs for review before system results are revealed. Do not distribute runs/reports to blinded reviewers. Supervise the session or use a participant deployment to prevent access to researcher material.
- `checks/`: exact commands, execution timestamps, logs and pass receipts.
- `annotations.template.json`: empty independent assessment fields; never prefilled with system judgments.
- `validation.json`: metric coverage and remaining blockers. Missing human annotations produce `expertValidationStatus: pending`, not a zero-accuracy result or a completed validation claim.

Every candidate has a unique directory; preparing another does not overwrite the old one. Source changes during capture invalidate preparation. Copied evidence and source hashes allow later validation to reject stale or altered inputs.

## Expert annotation procedure

1. Copy `annotations.template.json` to a separate reviewed file. Provide real reviewer IDs, roles and self-reported qualifications; the software does not verify professional identity.
2. Review each UI independently before viewing the investigator reports. Record findings the system did not flag as well as those it did. `selector: null` rows are whole-metric assessments for the declared case and viewport. Add element-specific rows with unique IDs for individual findings.
3. Fill `expectedStatus`, `reviewerId`, `rationale`, `reviewedAt` and `adjudicatedBy` for every row. Set `provenance: human_expert` only for real human judgments. Keep `sourceDigest` and `evidenceDigest` unchanged. Do not relabel researcher expectations as expert review.
4. Assess Reflow at 320 only. For Touch Target Spacing and Heading Hierarchy use `needsReview` for advisory warnings, never `candidateFail` as an automatic WCAG label. Use `not_applicable` only when the expert establishes non-applicability, with rationale; a missing machine observation alone is not a pass.
5. Set `inventoryComplete: true` only after inspecting the complete assigned UI, including unflagged issues. Every non-passing system occurrence also needs an element-specific assessment; otherwise it remains visibly unreviewed. Capture independent disagreements before adjudication. The schema does not infer expert consensus or require an invented number of experts.

The workflow compares exact statuses within the recorded case/metric/selector/viewport. It reports unmatched/mismatched assessments, unreviewed findings, per-metric browser coverage and status agreement. Status agreement is not WCAG detection precision. Recall remains null; complete expert false-negative adjudication and an agreed matching policy are needed before reporting recall.

## Validate and freeze

```sh
npm run pilot:validate -- artifacts/pilot/candidates/<candidate> /path/to/annotations.reviewed.json
npm run pilot:freeze -- artifacts/pilot/candidates/<candidate> /path/to/annotations.reviewed.json
```

Freeze requires source/evidence digest matches, all fourteen cases and all declared viewports, observable browser coverage of all seven metrics, complete lifecycle records for both advisory metrics, no partial/error advisory execution or unresolved audit warnings, complete supplied human expert/adjudicated assessments, no unresolved status disagreements and no unreviewed non-passing occurrences. It reruns Typecheck, all Vitest tests and both Chromium suites before writing a frozen snapshot.

The frozen copy includes the actual reviewed annotations and their digest, final check receipts, `freeze-manifest.json` and a timestamp. Existing frozen directories are never overwritten. A failure leaves the candidate unfrozen; preparation or technical tests alone cannot change its state to frozen. Frozen snapshot files are reviewable local artifacts, not a Git commit, deployment, or claim of independent expert identity verification.

Until real annotations have been supplied and the gate passes, report the state as **candidate prepared / expert validation pending / Pilot not frozen**. Only after that gate should the next iteration introduce Accessible Name Coverage.
