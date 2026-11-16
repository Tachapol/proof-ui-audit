# Pilot UI set v2 — researcher guide

Status: draft stimuli; expectations below are hypotheses, not measured ground truth. Keep this file away from participants during blind assessment. Existing frozen pilot package is unchanged.

Open /fixtures/pilot-ui-01 through /fixtures/pilot-ui-12, or select UI-01–UI-12 in the local fixture picker. These fixtures support Audit and Critique. Studio candidate Preview remains restricted to its existing supported fixtures; this set does not expand that support.

| Case | Task / product context | Primary selector | Intended check | Expected observation (not yet browser-verified) |
|---|---|---|---|---|
| UI-01 | Register for a course; read the instructions and enter an email | #registration-note | Text contrast | Low-contrast normal text: #aaa on white |
| UI-02 | Same task | #registration-note | Text contrast | Control: #333 on white |
| UI-03 | Choose November 17 for delivery | #day-17 | Target size | 18×18 controls, 2px gaps; adjacent small targets |
| UI-04 | Same task | #day-17 | Target size | Control: 44×44 targets, 12px gaps |
| UI-05 | Read course details and add the course | #course-card | Reflow | Fixed 460px card should overflow narrow viewports |
| UI-06 | Same task | #course-card | Reflow | Control: fluid card |
| UI-07 | Read the delivery instructions and confirm | #delivery-details | Text spacing | 72px fixed-height text should clip after spacing expansion; check baseline clipping too |
| UI-08 | Same task | #delivery-details | Text spacing | Control: height expands with text |
| UI-09 | Set the email address for notifications | #notification-email | Non-text contrast | Faint input border on white; inspect whether boundary is necessary to identify control |
| UI-10 | Same task | #notification-email | Non-text contrast | Control: dark input border |
| UI-11 | Browse courses after reading the title | #catalog-title | Large text contrast | 28px normal-weight #888 on white; intended large-text threshold control |
| UI-12 | Compare Q2 and Q4 revenue and costs | #quarterly-table | Reflow | Local horizontal table scrolling; human assessment of essential 2D layout required |

## Procedure

1. Use identical product context for paired cases. Do not mention the injected defect or expected result to participants.
2. Record commit SHA, browser version, OS, model, prompt version, viewport and timestamp from the actual run; never substitute assumed versions.
3. Evaluate at 320×640, 375×812 and 1440×900 CSS pixels. Compare reflow at 320px explicitly. Record text-spacing before and after separately.
4. Before recruitment, audit every case and record actual findings, screenshots and unintended issues. A control is not a claim of complete WCAG compliance. Revise any stimulus that does not isolate its intended effect, then freeze a new suite version.
5. For a short pilot, use UI-01, UI-04, UI-05, UI-08, UI-09, UI-12. Use all 12 for broader coverage when session time permits. Keep task wording the same between phases.
6. Phase 1: assess all assigned cases without system results. Record issue, selector, reasoning, confidence and independently assigned project priority. Save answers before Phase 2.
7. Phase 2: reveal the audit evidence and AI critique. Record changed decisions, reasons and helpfulness. Counterbalance case order across participants; keep paired variants apart. A paired repeated task can introduce learning effects, so do not interpret raw time differences as causal AI benefit.
8. Separate ambiguous assessments from confirmed TP/FP. Calculate precision only on adjudicated findings; recall requires complete annotation including missed issues. Do not label the preset expectations expert consensus.

Participant pages intentionally omit expected status, rule category and researcher rationale. The investigator guide and original debug fixtures must not be shown during blind evaluation. Neutral IDs do not constitute access control; use supervised sessions or a separate participant deployment for stricter blinding.

## Recording template

caseId | viewport | runId | selector | actual measurement | automated status | independent assessment | confidence | adjudicated outcome | AI usefulness | notes

These controls are local demonstrations: email inputs accept typing and action buttons show local confirmation. They do not create accounts, send messages, or save real settings.
