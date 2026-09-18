import fs from 'fs/promises';
import path from 'path';
import { AuditRun, AuditRunSchema, DesignerDecision, GroupedUXIssue, Priority } from '@/lib/schema/ux-issue';

const DATA_DIR = path.resolve(process.cwd(), '.proofui-data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tempPath, data, 'utf-8');
  await fs.rename(tempPath, filePath);
}

export async function saveAuditRun(run: AuditRun): Promise<void> {
  await ensureDirs();
  const validated = AuditRunSchema.parse(run);
  const filePath = path.join(RUNS_DIR, `${validated.id}.json`);
  await atomicWriteFile(filePath, JSON.stringify(validated, null, 2));
}

export async function getAuditRun(id: string): Promise<AuditRun | null> {
  await ensureDirs();
  const filePath = path.join(RUNS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return AuditRunSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function listAuditRuns(): Promise<
  Array<{ id: string; targetUrl: string; fixtureId?: string; timestamp: string; summary: AuditRun['summary'] }>
> {
  await ensureDirs();
  try {
    const files = await fs.readdir(RUNS_DIR);
    const runs = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const raw = await fs.readFile(path.join(RUNS_DIR, file), 'utf-8');
          const run = AuditRunSchema.parse(JSON.parse(raw));
          runs.push({
            id: run.id,
            targetUrl: run.targetUrl,
            fixtureId: run.fixtureId,
            timestamp: run.timestamp,
            summary: run.summary,
          });
        } catch {
          // ignore corrupted or unvalidated file
        }
      }
    }

    return runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

export async function getLatestAuditRun(): Promise<AuditRun | null> {
  const list = await listAuditRuns();
  if (list.length === 0) return null;
  return getAuditRun(list[0].id);
}

export async function updateDesignerDecision(
  runId: string,
  fingerprint: string,
  decision: DesignerDecision,
  reason?: string,
  newPriority?: Priority
): Promise<GroupedUXIssue | null> {
  const run = await getAuditRun(runId);
  if (!run) return null;

  const targetGroup = run.groupedIssues.find((g) => g.fingerprint === fingerprint);
  if (!targetGroup) return null;

  const previousPriority = targetGroup.currentPriority;
  targetGroup.designerDecision = decision;
  targetGroup.designerReason = reason;

  if (decision === 'reprioritize' && newPriority) {
    targetGroup.currentPriority = newPriority;
  }

  targetGroup.decisionHistory.push({
    timestamp: new Date().toISOString(),
    action: decision,
    reason,
    fromPriority: previousPriority,
    toPriority: targetGroup.currentPriority,
  });

  // Also update representative issue
  targetGroup.representative.designerDecision = decision;
  targetGroup.representative.designerReason = reason;

  await saveAuditRun(run);
  return targetGroup;
}
