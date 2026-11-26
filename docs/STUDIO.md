# ProofUI Critique Studio

Open [http://localhost:3123/studio](http://localhost:3123/studio) while `npm run dev` is running, or click **Open in Critique Studio** directly from any completed audit summary on the home page.

## Workflow
1. **Target & Context**: Choose Website URL and enter a public HTTP(S) page, or select Demo frames / local fixtures. For local development pages, explicitly enable "Allow this localhost target". Enter Product Goal, Brand Keywords, Theme Color, Target Audience, and Additional Context.
2. **Deep Integration with Audit**: When launched from an audit run (`/studio?runId=...`), the studio immediately hydrates the run's findings, screenshots, and product context. Clicking **Back to Audit** returns to the exact review position, preserving scroll coordinates, active issue selection, and review filters.
3. **Select AI Perspectives**: Choose from multiple specialized AI roles:
   - **Lead Coordinator**: Synthesizes the overall agenda and unifies role findings.
   - **User Experience (UX)**: Evaluates user flow, visual hierarchy, clarity, and task success.
   - **Design System**: Evaluates component consistency, token reuse, and spacing discipline.
   - **Accessibility**: Audits conformance against WCAG 2.2 criteria and cognitive load.
   - **Product Manager**: Analyzes feature viability, user conversion, and business impact.
4. **Structured Multi-Agent Debate**: Starts with deterministic DOM/CSS measurement checks, followed by CPE model deliberation. Roles analyze evidence, challenge assumptions, and generate structured design remediation proposals.
5. **Interactive Questioning & Dispositions**: Select findings, inspect evidence metrics, ask questions to individual roles in chat, and record confirmed issue / false positive decisions.
6. **Color & Layout Remediation Proposals**: For contrast issues, the system generates structured hex proposals with live before/after swatch previews, projected contrast ratios, and copyable CSS fix snippets.
7. **Session History & Export**: Sessions are persisted under `.proofui-data/studio/` with full Markdown and JSON export capabilities.

## Scope and Interpretation
- Studio supports public website URLs and explicitly opted-in loopback URLs in local development, focusing on text contrast, target size, and layout ergonomics.
- Multi-viewport capture is performed at 375px, 1440px, and 320px.
- AI roles represent simulated perspective agents powered by Google Gemini (with deterministic template fallback when offline or unconfigured), not independent human experts.
- Preview checks do not establish complete WCAG conformance or legal compliance.
- Original source files are not modified directly by Studio. All proposals are exported or inspected safely in isolation.

## Validation Status
- **313 unit tests passed** across 36 Vitest suites with 100% strict TypeScript compliance.
- Playwright E2E browser verification covers full Studio workflow, deep-link navigation return, state preservation, role questioning, and proposal extraction.
