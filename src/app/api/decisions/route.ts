import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateDesignerDecision } from '@/lib/storage/db';
import { DesignerDecisionSchema, PrioritySchema } from '@/lib/schema/ux-issue';

const DecisionRequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  fingerprint: z.string().min(1, 'fingerprint is required'),
  decision: DesignerDecisionSchema,
  reason: z.string().optional(),
  newPriority: PrioritySchema.optional(),
  editedRecommendation: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parseResult = DecisionRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const issueMsg = parseResult.error.issues.map((i) => i.message).join('; ');
      return NextResponse.json({ success: false, error: issueMsg || 'Invalid decision request payload' }, { status: 400 });
    }

    const { runId, fingerprint, decision, reason, newPriority, editedRecommendation } = parseResult.data;

    try {
      const updated = await updateDesignerDecision(
        runId,
        fingerprint,
        decision,
        reason,
        newPriority,
        editedRecommendation
      );

      if (!updated) {
        return NextResponse.json({ success: false, error: `Audit run '${runId}' or issue '${fingerprint}' not found.` }, { status: 404 });
      }

      return NextResponse.json({ success: true, updatedGroup: updated });
    } catch (domainErr: any) {
      // Domain validation errors thrown by db.ts (e.g. reason requirements, identical priority/rec)
      return NextResponse.json({ success: false, error: domainErr.message || 'Validation error' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Malformed request' }, { status: 500 });
  }
}
