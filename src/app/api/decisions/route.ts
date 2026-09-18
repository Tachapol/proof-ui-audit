import { NextResponse } from 'next/server';
import { updateDesignerDecision } from '@/lib/storage/db';
import { DesignerDecisionSchema, PrioritySchema } from '@/lib/schema/ux-issue';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { runId, fingerprint, decision, reason, newPriority } = body;

    if (!runId || typeof runId !== 'string') {
      return NextResponse.json({ success: false, error: 'runId is required' }, { status: 400 });
    }
    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ success: false, error: 'fingerprint is required' }, { status: 400 });
    }

    const decisionParsed = DesignerDecisionSchema.safeParse(decision);
    if (!decisionParsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid decision action' }, { status: 400 });
    }

    let parsedPriority = undefined;
    if (newPriority) {
      const priorityCheck = PrioritySchema.safeParse(newPriority);
      if (priorityCheck.success) {
        parsedPriority = priorityCheck.data;
      }
    }

    const updated = await updateDesignerDecision(
      runId,
      fingerprint,
      decisionParsed.data,
      reason,
      parsedPriority
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Audit run or issue not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedGroup: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save decision' }, { status: 500 });
  }
}
