import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { chromium } from '@playwright/test';
import { runBrowserAudit } from '../src/lib/audit/browser';
import { groupUXIssues, calculateAuditSummary } from '../src/lib/audit/grouping';
import { AuditRunSchema, type AuditRun } from '../src/lib/schema/ux-issue';
import { saveAuditRun } from '../src/lib/storage/db';
import { buildNormalizedReport } from '../src/lib/report/report-builder';
import { generateMarkdownReport } from '../src/lib/report/markdown-export';
import { comparePilotAnnotations, createPilotAnnotationTemplate, PILOT_CASES, PILOT_VIEWPORTS, PILOT_RULE_IDS, PILOT_SUITE_VERSION, type PilotRun } from '../src/lib/research/pilot-validation';

const sha = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const origin = 'http://localhost:3123';
async function sourceSnapshot() {
  const scopes = ['src', 'tests', 'scripts', 'docs/research', 'package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'vitest.config.ts', 'playwright.config.ts', 'tailwind.config.mjs'];
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...scopes], { encoding: 'utf8' }).trim().split('\n').filter(Boolean))].sort();
  const hashes: Record<string, string> = {};
  for (const file of files) hashes[file] = sha(await fs.readFile(file));
  return {
    digest: sha(json(hashes)), files: hashes,
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: !!execFileSync('git', ['status', '--porcelain', '--', ...scopes], { encoding: 'utf8' }).trim(),
  };
}
async function ensureServer(): Promise<ChildProcess | undefined> {
  try { if ((await fetch(`${origin}/fixtures/pilot-ui-01`)).ok) return; } catch { /* Start only our own server. */ }
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3123'], { stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('Pilot fixture server failed to start.');
    await new Promise(resolve => setTimeout(resolve, 500));
    try { if ((await fetch(`${origin}/fixtures/pilot-ui-01`)).ok) return child; } catch { /* Wait for server. */ }
  }
  child.kill('SIGTERM');
  throw new Error('Pilot fixture server did not become ready.');
}
async function runChecks(directory: string) {
  const checks = [
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['unit-tests', 'npm', ['run', 'test']],
    ['chromium', 'npx', ['playwright', 'test', 'tests/pilot-metrics.spec.ts', 'tests/reflow-integration.spec.ts']],
  ] as const;
  const receipts = [];
  await fs.mkdir(path.join(directory, 'checks'), { recursive: true });
  for (const [name, command, args] of checks) {
    console.log(`Checking ${name}…`);
    const startedAt = new Date().toISOString();
    let output: string;
    try { output = execFileSync(command, [...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } }); }
    catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      await fs.writeFile(path.join(directory, 'checks', `${name}.log`), String(failure.stdout || '') + String(failure.stderr || ''));
      throw new Error(`${name} failed; see ${directory}/checks/${name}.log`);
    }
    await fs.writeFile(path.join(directory, 'checks', `${name}.log`), output);
    receipts.push({ name, command: `${command} ${args.join(' ')}`, startedAt, completedAt: new Date().toISOString(), passed: true });
    console.log(`${name}: passed`);
  }
  await fs.writeFile(path.join(directory, 'checks', 'receipts.json'), json(receipts));
}
async function prepare() {
  const directory = path.resolve('artifacts/pilot/candidates', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  await fs.mkdir(directory, { recursive: true });
  const server = await ensureServer();
  try {
    await runChecks(directory);
    const source = await sourceSnapshot();
    const browser = await chromium.launch({ headless: true });
    const browserVersion = browser.version();
    await browser.close();
    const runs: PilotRun[] = [];
    const files: Record<string, string> = {};
    const writeEvidence = async (name: string, value: string | Buffer) => {
      await fs.mkdir(path.dirname(path.join(directory, name)), { recursive: true });
      await fs.writeFile(path.join(directory, name), value); files[name] = sha(value);
    };
    for (const { caseId } of PILOT_CASES) {
      console.log(`Measuring ${caseId} at 320, 375 and 1440 CSS px…`);
      const audit = await runBrowserAudit({ url: `${origin}/fixtures/${caseId}`, localOrigin: origin, viewports: PILOT_VIEWPORTS, captureIssueScreenshots: false });
      const groupedIssues = groupUXIssues(audit.issues);
      const run: AuditRun = {
        id: `pilot-${caseId}-${randomUUID()}`, fixtureId: caseId, targetUrl: `${origin}/fixtures/${caseId}`,
        timestamp: new Date().toISOString(), viewports: PILOT_VIEWPORTS, rawIssues: audit.issues, groupedIssues,
        summary: calculateAuditSummary(audit.issues, groupedIssues), metricResults: audit.metricResults,
        pageScreenshots: audit.pageScreenshots, auditWarnings: audit.errors.length ? audit.errors : undefined,
      };
      for (const image of audit.pageScreenshots) {
        const content = await fs.readFile(path.resolve('public', image.path.replace(/^\//, '')));
        await writeEvidence(`images/${caseId}-${image.width}.png`, content);
      }
      await saveAuditRun(run);
      await writeEvidence(`runs/${caseId}.json`, json(run));
      await writeEvidence(`reports/${caseId}.json`, json(buildNormalizedReport(run)));
      await writeEvidence(`reports/${caseId}.md`, generateMarkdownReport(buildNormalizedReport(run)));
      runs.push({ caseId, run });
    }
    // Preserve actual dirty/untracked implementation content, not just hashes.
    // The allowlisted source paths exclude .env, local data, .git and dependencies.
    const sourceArchive = execFileSync('tar', ['-czf', '-', '--', ...Object.keys(source.files)], { maxBuffer: 64 * 1024 * 1024 });
    await writeEvidence('source.tar.gz', sourceArchive);
    const after = await sourceSnapshot();
    if (after.digest !== source.digest) throw new Error('Source changed during measurement; regenerate the candidate.');
    const blind = ['# Independent Pilot Review', '', 'Review the UI and screenshots before opening reports/ or runs/. These contain automated findings.',
      'Record your own findings, including anything the system may miss. Do not treat intended fixture behavior as expert ground truth.', ''];
    for (const { caseId, audience } of PILOT_CASES) {
      blind.push(`## ${caseId} (${audience})`, '', `${origin}/fixtures/${caseId}`, '');
      for (const viewport of PILOT_VIEWPORTS) blind.push(`- ${viewport.width}×${viewport.height}: [Screenshot](images/${caseId}-${viewport.width}.png)`);
      blind.push('');
    }
    await writeEvidence('blind-review.md', blind.join('\n'));
    for (const file of ['typecheck.log', 'unit-tests.log', 'chromium.log', 'receipts.json']) {
      const name = `checks/${file}`; files[name] = sha(await fs.readFile(path.join(directory, name)));
    }
    const evidenceDigest = sha(json({ sourceDigest: source.digest, files }));
    const manifest = {
      schemaVersion: '1.0.0', suiteVersion: PILOT_SUITE_VERSION, freezeState: 'candidate_pending_expert_review',
      createdAt: new Date().toISOString(), source, evidenceDigest, files, cases: PILOT_CASES, rules: PILOT_RULE_IDS, viewports: PILOT_VIEWPORTS,
      environment: { browser: `Chromium ${browserVersion}`, platform: os.platform(), release: os.release(), node: process.version, model: null, promptVersion: null, aiUsed: false },
      metricImplementations: Object.fromEntries(PILOT_RULE_IDS.map(rule => [rule, {
        version: rule === 'reflow' ? '1.1.0' : rule === 'touch-target-spacing' || rule === 'heading-hierarchy' ? '1.0.0' : 'source-sha256',
        implementationDigest: source.files[`src/lib/audit/rules/${rule}.ts`] || source.files['src/lib/audit/pilot-metrics.ts'],
      }])),
      deferredMetrics: ['accessible-name-coverage'],
    };
    await fs.writeFile(path.join(directory, 'manifest.json'), json(manifest));
    await fs.writeFile(path.join(directory, 'annotations.template.json'), json(createPilotAnnotationTemplate(source.digest, evidenceDigest)));
    const validation = comparePilotAnnotations({ runs, sourceDigest: source.digest, evidenceDigest });
    await fs.writeFile(path.join(directory, 'validation.json'), json(validation));
    console.log(json({ directory, freezeState: manifest.freezeState, coverage: validation.coverage, blockers: validation.blockers }));
  } finally { server?.kill('SIGTERM'); }
}
async function validate(directory: string, annotationsFile?: string) {
  const manifest = await readJson(path.join(directory, 'manifest.json'));
  const source = await sourceSnapshot();
  if (source.digest !== manifest.source.digest) throw new Error('Source differs from the measured candidate. Prepare a new candidate before freeze.');
  for (const [file, hash] of Object.entries(manifest.files)) {
    const resolved = path.resolve(directory, file);
    if (!resolved.startsWith(path.resolve(directory) + path.sep)) throw new Error('Invalid evidence path.');
    if (sha(await fs.readFile(resolved)) !== hash) throw new Error(`Evidence changed: ${file}`);
  }
  if (sha(json({ sourceDigest: manifest.source.digest, files: manifest.files })) !== manifest.evidenceDigest) throw new Error('Evidence digest mismatch.');
  const runs: PilotRun[] = [];
  for (const { caseId } of PILOT_CASES) runs.push({ caseId, run: AuditRunSchema.parse(await readJson(path.join(directory, 'runs', `${caseId}.json`))) });
  const annotations = annotationsFile ? await readJson(annotationsFile) : undefined;
  const report = comparePilotAnnotations({ annotations, runs, sourceDigest: source.digest, evidenceDigest: manifest.evidenceDigest });
  await fs.writeFile(path.join(directory, 'validation.json'), json(report));
  console.log(json({ freezeEligible: report.freezeEligible, expertValidationStatus: report.expertValidationStatus,
    coverage: report.coverage, comparisonCount: report.comparisons.length, statusAgreementRate: report.statusAgreementRate,
    unreviewedFindingCount: report.unreviewedFindings.length, blockerCount: report.blockers.length,
    firstBlockers: report.blockers.slice(0, 10), report: path.join(directory, 'validation.json') }));
  return { report, manifest, annotations };
}
async function freeze(directory: string, annotationsFile: string) {
  const { report, manifest, annotations } = await validate(directory, annotationsFile);
  if (!report.freezeEligible) throw new Error('Pilot remains a candidate: resolve validation blockers before freeze.');
  const server = await ensureServer();
  try {
    const checksDirectory = await fs.mkdtemp(path.resolve('artifacts/pilot/freeze-checks-'));
    await runChecks(checksDirectory);
    if ((await sourceSnapshot()).digest !== manifest.source.digest) throw new Error('Source changed during final checks.');
    const target = path.resolve('artifacts/pilot/frozen', manifest.evidenceDigest.slice(0, 16));
    try { await fs.access(target); throw new Error('This frozen snapshot already exists; it will not be overwritten.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await fs.mkdir(path.dirname(target), { recursive: true });
    const stage = await fs.mkdtemp(path.join(path.dirname(target), '.preparing-'));
    await fs.cp(directory, stage, { recursive: true });
    await fs.cp(checksDirectory, path.join(stage, 'final-checks'), { recursive: true });
    await fs.writeFile(path.join(stage, 'annotations.reviewed.json'), json(annotations));
    await fs.writeFile(path.join(stage, 'freeze-manifest.json'), json({
      ...manifest, freezeState: 'frozen', frozenAt: new Date().toISOString(), expertValidation: report,
      annotationsDigest: sha(json(annotations)), finalCheckReceipts: await readJson(path.join(checksDirectory, 'checks', 'receipts.json')),
    }));
    await fs.rename(stage, target);
    console.log(`Frozen Pilot: ${target}`);
  } finally { server?.kill('SIGTERM'); }
}

const [action, directory, annotationsFile] = process.argv.slice(2);
if (action === 'prepare') await prepare();
else if (action === 'validate' && directory) {
  const { report } = await validate(path.resolve(directory), annotationsFile && path.resolve(annotationsFile));
  if (!report.freezeEligible) process.exitCode = 2;
} else if (action === 'freeze' && directory && annotationsFile) await freeze(path.resolve(directory), path.resolve(annotationsFile));
else throw new Error('Usage: pilot-workflow.ts prepare | validate <candidate> [annotations.json] | freeze <candidate> <annotations.json>');
