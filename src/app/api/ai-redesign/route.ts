import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runFreeformAiRedesign } from '@/lib/checklist/freeform-redesign';

export const maxDuration = 60;

const FreeformRedesignRequestSchema = z.object({
  html: z.string().min(20).max(500_000),
  context: z
    .object({
      productGoal: z.string().max(500).optional(),
      targetAudience: z.string().max(500).optional(),
      theme: z.string().max(500).optional(),
      customPrompt: z.string().max(2000).optional(),
    })
    .optional(),
  focusMetrics: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        priority: z.string().optional(),
        measuredSummary: z.string().optional(),
        recommendation: z.string().optional(),
        samples: z.array(z.string()).optional(),
      })
    )
    .optional(),
  maxIterations: z.number().int().min(1).max(5).optional(),
  enablePolishPass: z.boolean().optional(),
  startIterationNumber: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = FreeformRedesignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const origin = req.headers.get('origin') || new URL(req.url).origin || 'http://127.0.0.1:3123';
    const result = await runFreeformAiRedesign({
      html: parsed.data.html,
      localOrigin: origin,
      context: parsed.data.context,
      focusMetrics: parsed.data.focusMetrics,
      maxIterations: parsed.data.maxIterations,
      enablePolishPass: parsed.data.enablePolishPass ?? true,
      startIterationNumber: parsed.data.startIterationNumber ?? 1,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'AI Critique & Generate failed',
      },
      { status: 500 }
    );
  }
}
