import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuditRun, updateAIExplanation } from '@/lib/storage/db';
import { AIExplanationInputSchema, AIExplanationInput } from '@/lib/schema/ai-response';
import { defaultExplanationService } from '@/lib/ai/service';

// Strict schema: reject any extra fields (e.g., custom prompts, models, client-supplied evidence)
const ExplainRequestSchema = z
  .object({
    runId: z.string().min(1, 'runId is required'),
    fingerprint: z.string().min(1, 'fingerprint is required'),
  })
  .strict();

// In-flight concurrency lock to prevent duplicate simultaneous generation
const inFlightRequests = new Set<string>();

export async function POST(req: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    const parseResult = ExplainRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issueMsg = parseResult.error.issues.map((i) => i.message).join('; ');
      return NextResponse.json(
        { success: false, error: issueMsg || 'Invalid explain request payload' },
        { status: 400 }
      );
    }

    const { runId, fingerprint } = parseResult.data;
    const inflightKey = `${runId}:${fingerprint}`;

    if (inFlightRequests.has(inflightKey)) {
      return NextResponse.json(
        { success: false, error: 'Explanation generation already in progress for this issue' },
        { status: 409 }
      );
    }

    inFlightRequests.add(inflightKey);

    try {
      // 1. Fetch persisted run and issue on server
      const run = await getAuditRun(runId);
      if (!run) {
        return NextResponse.json(
          { success: false, error: `Audit run '${runId}' not found.` },
          { status: 404 }
        );
      }

      const targetGroup = run.groupedIssues.find((g) => g.fingerprint === fingerprint);
      if (!targetGroup) {
        return NextResponse.json(
          { success: false, error: `Issue with fingerprint '${fingerprint}' not found in run '${runId}'.` },
          { status: 404 }
        );
      }

      const rep = targetGroup.representative;

      // 2. Project minimal, safe evidence from server persistence only
      const rawInput = {
        productContext: run.productContext,
        ruleId: rep.ruleId,
        wcagCriterion: rep.wcagCriterion,
        status: targetGroup.status,
        title: rep.title,
        description: rep.description,
        selector: rep.selector,
        element: rep.element,
        role: rep.role,
        accessibleName: rep.accessibleName,
        viewport: rep.viewport,
        measured: rep.measured ?? {},
        expected: rep.expected ?? {},
        exception: rep.exception,
        reviewReason: targetGroup.status === 'needsReview' ? rep.exception : undefined,
        initialPriority: rep.initialPriority ?? targetGroup.initialPriority,
        priorityRationale: rep.priorityRationale,
      };

      const validatedInput: AIExplanationInput = AIExplanationInputSchema.parse(rawInput);

      // 3. Generate explanation (either Gemini or Deterministic fallback)
      const aiResult = await defaultExplanationService.explain(validatedInput);

      // 4. Persist result
      const updatedGroup = await updateAIExplanation(runId, fingerprint, aiResult);

      return NextResponse.json({
        success: true,
        aiResult,
        updatedGroup,
      });
    } finally {
      inFlightRequests.delete(inflightKey);
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
