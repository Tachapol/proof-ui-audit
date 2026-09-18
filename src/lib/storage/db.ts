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

// In-process per-run mutex queue for serialized atomic updates
// Note: This provides serialization within a single Node.js process; it does not provide distributed multi-process locking.
const runLocks = new Map<string, Promise<unknown>>();

export async function withRunLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = runLocks.get(runId) || Promise.resolve();
  let release: () => void;
  const newLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  runLocks.set(
    runId,
    currentLock.then(
      () => newLock,
      () => newLock
    )
  );

  try {
    await currentLock;
    return await fn();
  } finally {
    release!();
    if (runLocks.get(runId) === newLock) {
      runLocks.delete(runId);
    }
  }
}

export async function getAuditRun(id: string): Promise<AuditRun | null> {
  await ensureDirs();
  const filePath = path.join(RUNS_DIR, `${id}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  try {
    const parsed = JSON.parse(raw);
    return AuditRunSchema.parse(parsed);
  } catch (err: any) {
    // Fail safely: throw a descriptive error rather than silently returning null or overwriting corrupt files
    throw new Error(`CorruptedAuditRunError: Audit run '${id}' is corrupted or invalid: ${err.message}`);
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
          // ignore corrupted or unvalidated file in listing
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
  newPriority?: Priority,
  editedRecommendation?: string
): Promise<GroupedUXIssue | null> {
  return withRunLock(runId, async () => {
    const run = await getAuditRun(runId);
    if (!run) return null;

    const targetGroup = run.groupedIssues.find((g) => g.fingerprint === fingerprint);
    if (!targetGroup) return null;

    const trimmedReason = reason?.trim();
    const previousDecision = targetGroup.designerDecision;
    const previousPriority = targetGroup.currentPriority;
    const originalRec = targetGroup.representative.aiRecommendation || targetGroup.representative.description;
    const currentEffectiveRec =
      targetGroup.editedRecommendation || targetGroup.representative.aiRecommendation || targetGroup.representative.description;

    // 1. Validation for Reject
    if (decision === 'reject') {
      if (!trimmedReason || trimmedReason.length < 3) {
        throw new Error("A descriptive designer reason (at least 3 characters) is required for 'reject'.");
      }
    }

    // 2. Validation for Edit
    if (decision === 'edit') {
      const trimmedEdit = editedRecommendation?.trim();
      if (!trimmedEdit || trimmedEdit.length === 0) {
        throw new Error("Edited recommendation must not be empty or whitespace-only.");
      }
      if (trimmedEdit === currentEffectiveRec) {
        throw new Error("Edited recommendation must be different from the current effective recommendation.");
      }
      if (!trimmedReason || trimmedReason.length < 3) {
        throw new Error("A descriptive designer reason (at least 3 characters) is required for 'edit'.");
      }
    }

    // 3. Validation for Reprioritize
    if (decision === 'reprioritize') {
      if (!newPriority || !['P0', 'P1', 'P2', 'P3'].includes(newPriority)) {
        throw new Error("A valid target priority (P0–P3) is required when reprioritizing an issue.");
      }
      if (newPriority === previousPriority) {
        throw new Error("Target priority must be different from the current effective priority.");
      }
      if (!trimmedReason || trimmedReason.length < 3) {
        throw new Error("A descriptive designer reason (at least 3 characters) is required for 'reprioritize'.");
      }
    }

    // Apply mutable designer-authored state
    targetGroup.designerDecision = decision;
    targetGroup.designerReason = trimmedReason || undefined;

    if (decision === 'reprioritize' && newPriority) {
      targetGroup.currentPriority = newPriority;
    }

    if (decision === 'edit' && editedRecommendation !== undefined) {
      const trimmed = editedRecommendation.trim();
      targetGroup.editedRecommendation = trimmed;
      targetGroup.representative.editedRecommendation = trimmed;
    }

    // Append-only decision record with server-owned ID and timestamp
    if (!targetGroup.decisionHistory) {
      targetGroup.decisionHistory = [];
    }

    targetGroup.decisionHistory.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: decision,
      reason: trimmedReason || undefined,
      previousState: previousDecision || undefined,
      newState: decision,
      fromPriority: previousPriority,
      toPriority: targetGroup.currentPriority,
      originalRecommendation: originalRec,
      previousRecommendation: currentEffectiveRec,
      editedRecommendation: decision === 'edit' ? targetGroup.editedRecommendation : undefined,
    });

    // Update representative issue without touching deterministic evidence
    targetGroup.representative.designerDecision = decision;
    targetGroup.representative.designerReason = trimmedReason || undefined;

    await saveAuditRun(run);
    return targetGroup;
  });
}

export async function updateAIExplanation(
  runId: string,
  fingerprint: string,
  aiResult: import('@/lib/schema/ai-response').AIExplanationResult
): Promise<GroupedUXIssue | null> {
  return withRunLock(runId, async () => {
    const run = await getAuditRun(runId);
    if (!run) return null;

    const targetGroup = run.groupedIssues.find((g) => g.fingerprint === fingerprint);
    if (!targetGroup) return null;

    // Ensure generation history exists
    if (!targetGroup.aiGenerationHistory) {
      targetGroup.aiGenerationHistory = [];
    }

    const record: import('@/lib/schema/ai-response').AIGenerationRecord = {
      id: aiResult.id || crypto.randomUUID(),
      timestamp: aiResult.timestamp || new Date().toISOString(),
      provenance: aiResult.provenance,
      isFallback: aiResult.isFallback,
      fallbackReason: aiResult.fallbackReason,
      explanation: aiResult.explanation,
      recommendation: aiResult.recommendation,
      uncertaintyNote: aiResult.uncertaintyNote,
      requiresDesignerReview: aiResult.requiresDesignerReview,
      evidenceFingerprint: fingerprint,
      durationMs: aiResult.durationMs,
    };

    targetGroup.aiGenerationHistory.push(record);

    // Attach validated explanation result (representing the latest/current guidance)
    aiResult.id = record.id;
    aiResult.evidenceFingerprint = fingerprint;
    targetGroup.aiExplanation = aiResult.explanation;
    targetGroup.aiRecommendation = aiResult.recommendation;
    targetGroup.aiExplanationResult = aiResult;

    if (targetGroup.representative) {
      if (!targetGroup.representative.aiGenerationHistory) {
        targetGroup.representative.aiGenerationHistory = [];
      }
      targetGroup.representative.aiGenerationHistory.push(record);
      targetGroup.representative.aiExplanation = aiResult.explanation;
      targetGroup.representative.aiRecommendation = aiResult.recommendation;
      targetGroup.representative.aiExplanationResult = aiResult;
    }

    // Note: If the designer previously edited the recommendation, targetGroup.editedRecommendation is preserved.

    await saveAuditRun(run);
    return targetGroup;
  });
}

