import fs from 'node:fs';
import path from 'node:path';
import { getDefaultRecommendation } from '@/lib/audit/recommendation';

export type KnowledgeKind = 'standard' | 'heuristic' | 'style' | 'implementation';

export interface KnowledgeEntry {
  stableKey: string;
  kind: KnowledgeKind;
  source: string;
  category: string;
  title: string;
  body: string;
  recommendation: string;
  codeGood?: string;
  codeBad?: string;
  platforms: string[];
  severity: string;
  docsUrl?: string;
}

/**
 * Parses RFC 4180 CSV text into header-keyed records.
 */
export function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === '') continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = (row[c] ?? '').trim();
    }
    records.push(record);
  }
  return records;
}

function readCsvSafe(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) return [];
  return parseCsv(fs.readFileSync(filePath, 'utf-8'));
}

function normalizePlatform(value: string | undefined): string[] {
  if (!value) return ['web'];
  const items = value
    .split(/[,/|+]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : ['web'];
}

function buildBuiltinProofUIEntries(): KnowledgeEntry[] {
  const rules: Array<{
    ruleId: string;
    kind: KnowledgeKind;
    category: string;
    title: string;
    body: string;
    severity: string;
    docsUrl?: string;
  }> = [
    {
      ruleId: 'target-size',
      kind: 'standard',
      category: 'WCAG 2.2',
      title: 'WCAG 2.2 SC 2.5.8 Target Size',
      body: 'Interactive target ≥ 24×24 CSS px.',
      severity: 'High',
      docsUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    },
    {
      ruleId: 'text-contrast',
      kind: 'standard',
      category: 'WCAG 2.2',
      title: 'WCAG 2.2 SC 1.4.3 Contrast',
      body: 'Normal text ≥ 4.5:1 (large text ≥ 3:1).',
      severity: 'High',
      docsUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    },
    {
      ruleId: 'non-text-contrast',
      kind: 'standard',
      category: 'WCAG 2.2',
      title: 'WCAG 2.2 SC 1.4.11 Non-text Contrast',
      body: 'UI boundaries & focus indicators ≥ 3:1.',
      severity: 'High',
      docsUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',
    },
    {
      ruleId: 'reflow',
      kind: 'standard',
      category: 'WCAG 2.2',
      title: 'WCAG 2.2 SC 1.4.10 Reflow',
      body: 'No 2D horizontal scroll at 320 CSS px.',
      severity: 'High',
      docsUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
    },
    {
      ruleId: 'text-spacing',
      kind: 'standard',
      category: 'WCAG 2.2',
      title: 'WCAG 2.2 SC 1.4.12 Text Spacing',
      body: 'No clipping under custom text spacing.',
      severity: 'Medium',
      docsUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html',
    },
    {
      ruleId: 'touch-target-spacing',
      kind: 'heuristic',
      category: 'Project Advisory',
      title: 'Touch Target Spacing (8 CSS px)',
      body: 'Advisory ≥ 8 CSS px separation between targets.',
      severity: 'Medium',
    },
    {
      ruleId: 'heading-hierarchy',
      kind: 'heuristic',
      category: 'Project Advisory',
      title: 'Heading Hierarchy',
      body: 'Checks deeper skipped heading levels.',
      severity: 'Low',
    },
  ];

  return rules.map((r) => ({
    stableKey: `proofui:${r.ruleId}`,
    kind: r.kind,
    source: 'proofui',
    category: r.category,
    title: r.title,
    body: r.body,
    recommendation: getDefaultRecommendation({ ruleId: r.ruleId, status: 'candidateFail' }),
    platforms: ['web'],
    severity: r.severity,
    docsUrl: r.docsUrl,
  }));
}

/**
 * Collects all ProofUI builtin rules and ui-ux-pro-max CSV catalogs into structured entries.
 */
export function collectKnowledgeEntries(rootDir = process.cwd()): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [...buildBuiltinProofUIEntries()];
  const dataDir = path.join(rootDir, '.agents', 'skills', 'ui-ux-pro-max', 'data');

  for (const r of readCsvSafe(path.join(dataDir, 'ux-guidelines.csv'))) {
    entries.push({
      stableKey: `ux:${r.No || entries.length + 1}`,
      kind: 'heuristic',
      source: 'ux-guidelines.csv',
      category: r.Category || 'General',
      title: r.Issue || '',
      body: r.Description || '',
      recommendation: [r.Do, r["Don't"] ? `Avoid: ${r["Don't"]}` : ''].filter(Boolean).join('\n'),
      codeGood: r['Code Example Good'] || undefined,
      codeBad: r['Code Example Bad'] || undefined,
      platforms: normalizePlatform(r.Platform),
      severity: r.Severity || 'Medium',
    });
  }

  for (const r of readCsvSafe(path.join(dataDir, 'ui-reasoning.csv'))) {
    entries.push({
      stableKey: `reasoning:${r.No || entries.length + 1}`,
      kind: 'heuristic',
      source: 'ui-reasoning.csv',
      category: 'UI Reasoning',
      title: r.UI_Category || '',
      body: [r.Recommended_Pattern, r.Style_Priority].filter(Boolean).join(' · '),
      recommendation: r.Anti_Patterns || '',
      platforms: ['web'],
      severity: r.Severity || 'Medium',
    });
  }

  for (const r of readCsvSafe(path.join(dataDir, 'products.csv'))) {
    entries.push({
      stableKey: `product:${r.No || entries.length + 1}`,
      kind: 'style',
      source: 'products.csv',
      category: 'Product Profile',
      title: r['Product Type'] || '',
      body: [r['Primary Style Recommendation'], r['Landing Page Pattern']].filter(Boolean).join(' · '),
      recommendation: r['Key Considerations'] || '',
      platforms: ['web'],
      severity: 'Info',
    });
  }

  const stacksDir = path.join(dataDir, 'stacks');
  if (fs.existsSync(stacksDir)) {
    const stackFiles = fs.readdirSync(stacksDir).filter((f) => f.endsWith('.csv')).sort();
    for (const file of stackFiles) {
      const stackName = file.replace(/\.csv$/, '');
      for (const r of readCsvSafe(path.join(stacksDir, file))) {
        entries.push({
          stableKey: `${stackName}:${r.No || entries.length + 1}`,
          kind: 'implementation',
          source: `stacks/${file}`,
          category: r.Category || stackName,
          title: r.Guideline || '',
          body: r.Description || '',
          recommendation: [r.Do, r["Don't"] ? `Avoid: ${r["Don't"]}` : ''].filter(Boolean).join('\n'),
          codeGood: r['Code Good'] || undefined,
          codeBad: r['Code Bad'] || undefined,
          platforms: ['web'],
          severity: r.Severity || 'Medium',
          docsUrl: r['Docs URL'] || undefined,
        });
      }
    }
  }

  return entries;
}
