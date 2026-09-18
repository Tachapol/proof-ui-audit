import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runIsolatedIterationProof, recordFinalIterationDecision } from '@/lib/iteration/isolated-preview';
import { DesignerDecisionSchema } from '@/lib/schema/ux-issue';

const IterationRequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  fingerprint: z.string().min(1, 'fingerprint is required'),
  overrideId: z.string().min(1, 'overrideId is required'),
  approvalReason: z.string().optional(),
});

const FinalDecisionRequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  fingerprint: z.string().min(1, 'fingerprint is required'),
  finalDecision: DesignerDecisionSchema,
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = IterationRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid iteration proof request payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { runId, fingerprint, overrideId, approvalReason } = parseResult.data;
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const comparison = await runIsolatedIterationProof({
      runId,
      fingerprint,
      overrideId,
      approvalReason,
      baseUrl,
    });

    return NextResponse.json(
      {
        success: true,
        comparison,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute isolated candidate iteration.',
      },
      { status: error.message?.includes('not found') ? 404 : 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = FinalDecisionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid final candidate decision payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { runId, fingerprint, finalDecision, reason } = parseResult.data;

    const comparison = await recordFinalIterationDecision(runId, fingerprint, finalDecision, reason);

    return NextResponse.json(
      {
        success: true,
        comparison,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to record final candidate decision.',
      },
      { status: error.message?.includes('not found') ? 404 : 400 }
    );
  }
}
