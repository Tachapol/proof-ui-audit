import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateDesignerDecision, updateReviewDisposition } from '@/lib/storage/db';
import { DesignerDecisionSchema, PrioritySchema, ReviewDispositionSchema } from '@/lib/schema/ux-issue';

const LegacyDecisionRequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  fingerprint: z.string().min(1, 'fingerprint is required'),
  decision: DesignerDecisionSchema,
  reason: z.string().optional(),
  newPriority: PrioritySchema.optional(),
  editedRecommendation: z.string().optional(),
});

const ReviewRequestSchema = z.object({
  runId: z.string().min(1), fingerprint: z.string().min(1),
  disposition: ReviewDispositionSchema,
  reason: z.string().trim().min(3).max(2000),
  reviewer: z.string().trim().min(1).max(120),
});
const DecisionRequestSchema = z.union([ReviewRequestSchema, LegacyDecisionRequestSchema]);

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    if (rawBody.disposition !== undefined && rawBody.decision !== undefined) {
      return NextResponse.json({ success: false, error: 'Choose one operation: disposition or decision.' }, { status: 400 });
    }
    const parseResult = DecisionRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const issueMsg = parseResult.error.issues.map((i) => i.message).join('; ');
      return NextResponse.json({ success: false, error: issueMsg || 'Invalid decision request payload' }, { status: 400 });
    }

    const { runId, fingerprint } = parseResult.data;

    try {
      const payload = parseResult.data;
      const updated = 'disposition' in payload
        ? await updateReviewDisposition(runId, fingerprint, payload.disposition, payload.reason, payload.reviewer)
        : await updateDesignerDecision(runId, fingerprint, payload.decision, payload.reason, payload.newPriority, payload.editedRecommendation);

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
