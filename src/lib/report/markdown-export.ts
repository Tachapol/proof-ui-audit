import { ReportModel, ReportGroupedIssue, ReportOccurrence } from './report-schema';

/**
 * Neutralizes raw HTML tags by converting them to safe entities.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prevents spreadsheet formula injection if report text is copied into Excel/Sheets.
 */
export function sanitizeFormula(str: string): string {
  const trimmed = str.trimStart();
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

/**
 * Neutralizes injected Markdown headings or horizontal rules that could spoof report sections.
 */
export function sanitizeMarkdownProse(str: string): string {
  return str
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('---') ||
        trimmed.startsWith('===') ||
        trimmed.startsWith('___')
      ) {
        return `\\${line}`;
      }
      return sanitizeFormula(line);
    })
    .join('\n');
}

/**
 * Fences code blocks safely using more backticks than any backtick sequence found in the content.
 */
export function safeCodeFence(content: string, lang = ''): string {
  const backtickMatches = content.match(/`+/g) || [];
  let maxBackticks = 3;
  if (backtickMatches.length > 0) {
    maxBackticks = 4;
  }
  for (const match of backtickMatches) {
    if (match.length >= maxBackticks) {
      maxBackticks = match.length + 1;
    }
  }
  const fence = '`'.repeat(maxBackticks);
  return `${fence}${lang}\n${content}\n${fence}`;
}

/**
 * Formats an inline code snippet safely.
 */
export function safeInlineCode(content: string): string {
  if (content.includes('`')) {
    return safeCodeFence(content);
  }
  return `\`${content}\``;
}

function formatIssueSection(issue: ReportGroupedIssue, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${escapeHtml(sanitizeMarkdownProse(issue.title))}`);
  lines.push('');
  lines.push(`- **Rule ID**: ${safeInlineCode(issue.ruleId)}`);
  lines.push(`- **WCAG Criterion**: ${safeInlineCode(issue.wcagCriterion)}`);
  lines.push(`- **Status**: \`${issue.status}\``);
  lines.push(`- **Project Priority**: **${issue.currentPriority}** (Initial: ${issue.initialPriority})`);
  lines.push(`- **Priority Rationale**: ${escapeHtml(sanitizeMarkdownProse(issue.priorityRationale))}`);
  lines.push(`- **Occurrence Count**: ${issue.occurrenceCount} across ${issue.viewports.map((v) => `${v.width}×${v.height}`).join(', ')}`);
  lines.push(`- **Element**: \`<${escapeHtml(issue.element)}>\``);
  if (issue.role) lines.push(`- **Role**: ${escapeHtml(issue.role)}`);
  if (issue.accessibleName) lines.push(`- **Accessible Name**: "${escapeHtml(issue.accessibleName)}"`);
  if (issue.exception) lines.push(`- **Exception / Review Reason**: ${escapeHtml(issue.exception)}`);
  lines.push('');
  lines.push('**Target Selector**:');
  lines.push(safeCodeFence(issue.selector, 'css'));
  lines.push('');
  lines.push('**Measured Evidence**:');
  lines.push(safeCodeFence(JSON.stringify(issue.measured, null, 2), 'json'));
  lines.push('');
  lines.push('**Expected Threshold**:');
  lines.push(safeCodeFence(JSON.stringify(issue.expected, null, 2), 'json'));
  lines.push('');

  // AI & Fallback Guidance
  if (issue.aiExplanation || issue.aiRecommendation) {
    const prov = issue.aiExplanationResult?.isFallback
      ? `Deterministic Fallback (${issue.aiExplanationResult.fallbackReason || 'rule template'})`
      : `AI-Generated (${issue.aiExplanationResult?.provenance || 'Gemini'})`;
    lines.push(`**Guidance (${prov})**:`);
    if (issue.aiExplanation) {
      lines.push(`- *Explanation*: ${escapeHtml(sanitizeMarkdownProse(issue.aiExplanation))}`);
    }
    if (issue.aiRecommendation) {
      lines.push(`- *Recommendation*: ${escapeHtml(sanitizeMarkdownProse(issue.aiRecommendation))}`);
    }
    if (issue.aiExplanationResult?.uncertaintyNote) {
      lines.push(`- *Uncertainty*: ${escapeHtml(sanitizeMarkdownProse(issue.aiExplanationResult.uncertaintyNote))}`);
    }
    lines.push('');
  }

  if (issue.reviewDisposition) {
    lines.push('**Issue Review**:');
    lines.push(`- **Review Status**: ${issue.reviewDisposition}`);
    if (issue.reviewReason) lines.push(`- **Review Rationale**: ${escapeHtml(sanitizeMarkdownProse(issue.reviewReason))}`);
    if (issue.reviewer) lines.push(`- **Reviewer (self-reported)**: ${escapeHtml(sanitizeMarkdownProse(issue.reviewer))}`);
    if (issue.reviewedAt) lines.push(`- **Reviewed At**: ${issue.reviewedAt}`);
    lines.push('- Review decisions do not change automated evidence or verify a candidate fix.');
    lines.push('');
  }
  // Designer Decision
  if (issue.designerDecision) {
    lines.push('**Designer-in-the-Loop Decision**:');
    lines.push(`- **Decision**: \`${issue.designerDecision}\``);
    if (issue.designerReason) {
      lines.push(`- **Reason**: ${escapeHtml(sanitizeMarkdownProse(issue.designerReason))}`);
    }
    if (issue.editedRecommendation) {
      lines.push(`- **Designer-Edited Recommendation**: ${escapeHtml(sanitizeMarkdownProse(issue.editedRecommendation))}`);
    }
    lines.push('');
  }

  // Remediation & Iteration Proof
  if (issue.iterationComparison) {
    const iter = issue.iterationComparison;
    lines.push('#### 🔄 Remediation & Iteration Proof');
    lines.push('');

    const statusLabel =
      iter.verificationStatus === 'verified'
        ? 'Selected checks passed (WCAG 2.5.8 & 1.4.3 only)'
        : iter.verificationStatus === 'unable_to_verify'
        ? 'Unable to verify (Incomplete verification)'
        : iter.verificationStatus === 'failed'
        ? 'Checks failed'
        : iter.regressionResult || 'Evaluated';

    lines.push(`- **Verification Status**: \`${statusLabel}\``);

    if (iter.candidateName) {
      lines.push(`- **Candidate Proposal**: ${escapeHtml(sanitizeMarkdownProse(iter.candidateName))}`);
    } else if (iter.overrideName) {
      lines.push(`- **Applied Override**: ${escapeHtml(sanitizeMarkdownProse(iter.overrideName))}`);
    }

    if (iter.regressionResult) {
      lines.push(`- **Regression Comparison**: \`${iter.regressionResult}\``);
    }
    if (iter.regressionCounts) {
      lines.push(
        `- **Occurrence Counts**: ${iter.regressionCounts.resolved} resolved; ${iter.regressionCounts.persistent} persistent; ${iter.regressionCounts.new} new; ${iter.regressionCounts.unverified} unverified`
      );
    }
    if (iter.plainLanguageSummary) {
      lines.push(`- **Summary**: ${escapeHtml(sanitizeMarkdownProse(iter.plainLanguageSummary))}`);
    }

    // Warnings if unable to verify or errors present
    if (iter.verificationErrors && iter.verificationErrors.length > 0) {
      lines.push('');
      lines.push('> [!WARNING]');
      lines.push('> **Verification Incomplete / ตรวจสอบไม่ได้**:');
      for (const err of iter.verificationErrors) {
        lines.push(`> - ${escapeHtml(sanitizeMarkdownProse(err))}`);
      }
    }

    // Measured comparison table
    lines.push('');
    lines.push('| Evidence Phase | Status | Measurement |');
    lines.push('| :--- | :--- | :--- |');
    lines.push(
      `| **Baseline (Before)** | \`${iter.baselineStatus || issue.status}\` | \`${JSON.stringify(iter.baselineMeasurement)}\` |`
    );
    lines.push(
      `| **Candidate (After)** | \`${iter.candidateStatus || (iter.verificationStatus === 'verified' ? 'pass' : 'unverified')}\` | \`${JSON.stringify(iter.candidateMeasurement)}\` |`
    );
    lines.push('');

    // Code diff / Applied CSS
    if (iter.candidateCode) {
      lines.push('**Candidate Code Snippet**:');
      lines.push(safeCodeFence(iter.candidateCode, 'html'));
      lines.push('');
    } else if (iter.appliedCss) {
      lines.push('**Applied CSS Override**:');
      lines.push(safeCodeFence(iter.appliedCss, 'css'));
      lines.push('');
    }

    if (iter.finalDesignerDecision) {
      lines.push(`- **Final Designer Decision**: \`${iter.finalDesignerDecision}\``);
      if (iter.finalDesignerReason) {
        lines.push(`- **Decision Reason**: ${escapeHtml(sanitizeMarkdownProse(iter.finalDesignerReason))}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function generateMarkdownReport(report: ReportModel): string {
  const sections: string[] = [];

  // 1. Report Title
  sections.push('# ProofUI UX/UI Audit Report');
  sections.push('');

  // 2. Audit Metadata
  sections.push('## Audit Metadata');
  sections.push('');
  sections.push(`- **Run ID**: \`${report.audit.runId}\``);
  sections.push(`- **Audit Timestamp**: ${report.audit.timestamp}`);
  sections.push(`- **Export Timestamp**: ${report.exportTimestamp}`);
  sections.push(`- **Target URL**: ${report.audit.targetUrl}`);
  if (report.audit.fixtureId) {
    sections.push(`- **Fixture ID**: \`${report.audit.fixtureId}\``);
  }
  sections.push(
    `- **Tested Viewports**: ${report.audit.viewports.map((v) => `${v.width}×${v.height}`).join(', ')}`
  );
  sections.push('');

  if (report.audit.productContext && Object.values(report.audit.productContext).some(Boolean)) {
    sections.push('## Product Context', '');
    for (const [key, value] of Object.entries(report.audit.productContext)) {
      if (value) sections.push(`- **${escapeHtml(key)}**: ${escapeHtml(sanitizeMarkdownProse(value))}`);
    }
    sections.push('');
  }

  // 3. Scope and Disclaimers
  sections.push('## Scope and Disclaimers');
  sections.push('');
  for (const disclaimer of report.disclaimers) {
    sections.push(`> [!IMPORTANT]  \n> ${escapeHtml(disclaimer)}`);
    sections.push('');
  }

  // 4. Summary Counts
  sections.push('## Summary Counts');
  sections.push('');
  sections.push('| Metric | Count |');
  sections.push('| :--- | :--- |');
  sections.push(`| Total Raw Occurrences | ${report.summary.rawFindingCount} |`);
  sections.push(`| Unique Grouped Issues | ${report.summary.groupedIssueCount} |`);
  sections.push(`| Candidate Failures (\`candidateFail\`) | ${report.summary.candidateFailCount} |`);
  sections.push(`| Needs Human Review (\`needsReview\`) | ${report.summary.needsReviewCount} |`);
  sections.push(`| Passed Checks (\`pass\`) | ${report.summary.passCount} |`);
  sections.push(
    `| Priority Breakdown | P0: ${report.summary.priorityCounts.P0} | P1: ${report.summary.priorityCounts.P1} | P2: ${report.summary.priorityCounts.P2} | P3: ${report.summary.priorityCounts.P3} |`
  );
  if (report.summary.remediationSummary) {
    sections.push(
      `| Remediation & Iteration | Evaluated: ${report.summary.remediationSummary.totalIterated} | Verified: ${report.summary.remediationSummary.verifiedCount} | Regressed: ${report.summary.remediationSummary.regressedCount} | Unverified: ${report.summary.remediationSummary.unableToVerifyCount} |`
    );
  }
  sections.push('');

  // 5. Candidate Failures
  const failures = report.groupedIssues.filter((i) => i.status === 'candidateFail');
  sections.push('## Candidate Failures');
  sections.push('');
  if (failures.length === 0) {
    sections.push('No candidate failures identified during this audit run.');
  } else {
    sections.push(failures.map((issue, idx) => formatIssueSection(issue, idx)).join('\n\n---\n\n'));
  }
  sections.push('');

  // 6. Needs-Review Items
  const reviews = report.groupedIssues.filter((i) => i.status === 'needsReview');
  sections.push('## Needs-Review Items');
  sections.push('');
  if (reviews.length === 0) {
    sections.push('No items requiring manual designer review were identified.');
  } else {
    sections.push(reviews.map((issue, idx) => formatIssueSection(issue, idx)).join('\n\n---\n\n'));
  }
  sections.push('');

  // 7. Passed Checks
  const passes = report.groupedIssues.filter((i) => i.status === 'pass');
  sections.push('## Passed Checks');
  sections.push('');
  if (passes.length === 0) {
    sections.push('No checks marked as pass in this run.');
  } else {
    sections.push(passes.map((issue, idx) => formatIssueSection(issue, idx)).join('\n\n---\n\n'));
  }
  sections.push('');

  // 8. Designer Decisions
  const decided = report.groupedIssues.filter((i) => Boolean(i.designerDecision || i.reviewDisposition));
  sections.push('## Designer Decisions');
  sections.push('');
  if (decided.length === 0) {
    sections.push('No designer decisions have been recorded for this run yet.');
  } else {
    sections.push('| Issue | Decision | Priority | Reason / Notes |');
    sections.push('| :--- | :--- | :--- | :--- |');
    for (const d of decided) {
      const title = escapeHtml(d.title);
      const dec = `\`${d.reviewDisposition || d.designerDecision}\``;
      const prio = `${d.currentPriority}`;
      const reason = escapeHtml(sanitizeMarkdownProse(d.reviewReason || d.designerReason || '—'));
      sections.push(`| ${title} | ${dec} | ${prio} | ${reason} |`);
    }
  }
  sections.push('');

  // 9. Decision History
  sections.push('## Decision History');
  sections.push('');
  const allHistory = report.groupedIssues.flatMap((i) =>
    (i.decisionHistory || []).map((h) => ({ ...h, issueTitle: i.title, fingerprint: i.fingerprint }))
  );
  if (allHistory.length === 0) {
    sections.push('No historical decision events recorded.');
  } else {
    sections.push('| Timestamp | Action | Issue | From -> To | Reason |');
    sections.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const h of allHistory) {
      const ts = h.timestamp;
      const act = `\`${h.action}\``;
      const title = escapeHtml(h.issueTitle);
      const transition = h.newDisposition ? `${h.previousDisposition || 'none'} &rarr; ${h.newDisposition}` : `${h.previousState || 'none'} &rarr; ${h.newState || 'none'}`;
      const reason = escapeHtml(sanitizeMarkdownProse(`${h.reason || '—'}${h.reviewer ? ` (Reviewer, self-reported: ${h.reviewer})` : ''}`));
      sections.push(`| ${ts} | ${act} | ${title} | ${transition} | ${reason} |`);
    }
  }
  sections.push('');

  // 10. AI/Fallback Provenance
  sections.push('## AI / Fallback Provenance');
  sections.push('');
  const guidanceIssues = report.groupedIssues.filter(
    (i) => i.aiExplanationResult || (i.aiGenerationHistory && i.aiGenerationHistory.length > 0)
  );
  if (guidanceIssues.length === 0) {
    sections.push('No AI or fallback guidance was requested for this audit run.');
  } else {
    sections.push('| Issue | Effective Provider | Fallback? | Reason / Note | History Entries |');
    sections.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const g of guidanceIssues) {
      const title = escapeHtml(g.title);
      const res = g.aiExplanationResult;
      const prov = res ? res.provenance : 'none';
      const fallback = res?.isFallback ? 'Yes' : 'No';
      const note = escapeHtml(res?.fallbackReason || res?.uncertaintyNote || '—');
      const histCount = g.aiGenerationHistory?.length || 0;
      sections.push(`| ${title} | \`${prov}\` | ${fallback} | ${note} | ${histCount} record(s) |`);
    }
  }
  sections.push('');

  // 11. Known Limitations
  sections.push('## Known Limitations');
  sections.push('');
  for (const limit of report.limitations) {
    sections.push(`- ${escapeHtml(limit)}`);
  }
  sections.push('');

  return sections.join('\n');
}
