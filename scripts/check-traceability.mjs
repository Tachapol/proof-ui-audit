#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const reqPath = path.join(projectRoot, 'docs/REQUIREMENTS.md');
const tracePath = path.join(projectRoot, 'docs/TRACEABILITY.md');

if (!fs.existsSync(reqPath)) {
  console.error(`Error: Requirements file not found at ${reqPath}`);
  process.exit(1);
}
if (!fs.existsSync(tracePath)) {
  console.error(`Error: Traceability file not found at ${tracePath}`);
  process.exit(1);
}

const reqContent = fs.readFileSync(reqPath, 'utf-8');
const traceContent = fs.readFileSync(tracePath, 'utf-8');

// Match requirement IDs of the form: ARCH-01, RULE-01, DATA-01, SEC-01, UI-01, AI-01, TEST-01, EXCL-01, DONE-01
const ID_REGEX = /\b([A-Z]{2,4}-\d{2})\b/g;

// 1. Extract IDs from REQUIREMENTS.md
const reqMatches = [...reqContent.matchAll(ID_REGEX)].map((m) => m[1]);
const reqIdCounts = new Map();
for (const id of reqMatches) {
  reqIdCounts.set(id, (reqIdCounts.get(id) || 0) + 1);
}
const uniqueReqIds = [...reqIdCounts.keys()].sort();

// 2. Extract IDs from TRACEABILITY.md table rows: | **ID** | ... | status | ... |
const traceLines = traceContent.split('\n');
const traceRows = traceLines.filter((l) => l.trim().startsWith('| **'));
const traceIdCounts = new Map();
const statusCounts = new Map();
const invalidRows = [];

for (const line of traceRows) {
  const cells = line.split('|').map((c) => c.trim());
  // cells[0] is empty before leading pipe, cells[1] is ID, cells[6] is Status
  if (cells.length < 8) {
    invalidRows.push(line);
    continue;
  }
  const idMatch = cells[1].match(/\*\*([A-Z]{2,4}-\d{2})\*\*/);
  if (!idMatch) {
    invalidRows.push(line);
    continue;
  }
  const id = idMatch[1];
  traceIdCounts.set(id, (traceIdCounts.get(id) || 0) + 1);

  const status = cells[6];
  statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
}

const uniqueTraceIds = [...traceIdCounts.keys()].sort();

// 3. Duplicate checks
const duplicateReqIds = [...reqIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
const duplicateTraceIds = [...traceIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

// 4. Set differences
const missingInTrace = uniqueReqIds.filter((id) => !traceIdCounts.has(id));
const extraInTrace = uniqueTraceIds.filter((id) => !reqIdCounts.has(id));

// 5. Verification checks
let hasErrors = false;

console.log('=== Traceability Consistency Audit ===');
console.log(`Unique requirement IDs in REQUIREMENTS.md : ${uniqueReqIds.length}`);
console.log(`Unique requirement IDs in TRACEABILITY.md  : ${uniqueTraceIds.length}`);
console.log(`Total table rows in TRACEABILITY.md       : ${traceRows.length}`);

console.log('\nStatus breakdown in TRACEABILITY.md:');
for (const [status, count] of statusCounts.entries()) {
  console.log(`  - ${status}: ${count}`);
}

if (invalidRows.length > 0) {
  console.error(`\n[FAIL] Found ${invalidRows.length} malformed table rows in TRACEABILITY.md:`);
  invalidRows.forEach((r) => console.error(`  ${r}`));
  hasErrors = true;
}

if (duplicateTraceIds.length > 0) {
  console.error(`\n[FAIL] Found duplicate IDs in TRACEABILITY.md: ${duplicateTraceIds.join(', ')}`);
  hasErrors = true;
}

if (missingInTrace.length > 0) {
  console.error(`\n[FAIL] Requirement IDs in REQUIREMENTS.md missing from TRACEABILITY.md (${missingInTrace.length}):`);
  missingInTrace.forEach((id) => console.error(`  - ${id}`));
  hasErrors = true;
}

if (extraInTrace.length > 0) {
  console.error(`\n[FAIL] Requirement IDs in TRACEABILITY.md not defined in REQUIREMENTS.md (${extraInTrace.length}):`);
  extraInTrace.forEach((id) => console.error(`  - ${id}`));
  hasErrors = true;
}

const nonVerifiedCount = traceRows.length - (statusCounts.get('verified') || 0);
if (nonVerifiedCount > 0) {
  console.error(`\n[FAIL] Found ${nonVerifiedCount} requirement(s) not marked 'verified'.`);
  hasErrors = true;
}

if (hasErrors) {
  console.error('\nTraceability consistency check FAILED.');
  process.exit(1);
} else {
  console.log(`\n[PASS] 100% Traceability verified: ${uniqueReqIds.length} / ${uniqueReqIds.length} requirements verified.`);
  process.exit(0);
}
