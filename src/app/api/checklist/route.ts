import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAutoIterationLoop } from '@/lib/checklist/auto-iterate';
import { listUXBenchBookingPages, loadUXBenchBookingHtml } from '@/lib/checklist/uxbench-baseline';

const APPROVALS_FILE = path.resolve(process.cwd(), '.proofui-data', 'checklist-approvals.json');

interface SavedApproval {
  page: string;
  iteration: number;
  label: string;
  score: string;
  html: string;
  approvedAt: string;
}

async function readApprovals(): Promise<Record<string, SavedApproval>> {
  try {
    const raw = await fs.readFile(APPROVALS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeApprovals(data: Record<string, SavedApproval>): Promise<void> {
  await fs.mkdir(path.dirname(APPROVALS_FILE), { recursive: true });
  await fs.writeFile(APPROVALS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const ChecklistRequestSchema = z.object({
  html: z.string().trim().min(1, 'HTML source code is required.').max(250_000),
  mode: z.enum(['audit', 'iterate']).default('iterate'),
  maxIterations: z.number().int().min(1).max(5).default(3),
  context: z
    .object({
      productGoal: z.string().max(500).optional(),
      targetAudience: z.string().max(500).optional(),
      theme: z.string().max(500).optional(),
      customPrompt: z.string().max(2000).optional(),
    })
    .optional(),
  prioritizedMetricIds: z.array(z.string()).optional(),
});

const ApproveSchema = z.object({
  page: z.string().min(1),
  iteration: z.number().int().min(0),
  label: z.string().min(1),
  score: z.string().min(1),
  html: z.string().min(1).max(250_000),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') || 'index.html';
  const pages = listUXBenchBookingPages();
  const html = loadUXBenchBookingHtml(page);
  if (!html) {
    return NextResponse.json(
      { success: false, error: `Baseline page "${page}" not found.` },
      { status: 404 }
    );
  }
  const approvals = await readApprovals();
  return NextResponse.json({
    success: true,
    page,
    pages,
    html,
    savedApproval: approvals[page] || null,
  });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = ChecklistRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const localOrigin = new URL(req.url).origin;
    const result = await runAutoIterationLoop({
      html: parsed.data.html,
      localOrigin,
      mode: parsed.data.mode,
      maxIterations: parsed.data.maxIterations,
      context: parsed.data.context,
      prioritizedMetricIds: parsed.data.prioritizedMetricIds,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checklist audit failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const json = await req.json();
    const parsed = ApproveSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid approval payload' },
        { status: 400 }
      );
    }
    const approvals = await readApprovals();
    const entry: SavedApproval = {
      ...parsed.data,
      approvedAt: new Date().toISOString(),
    };
    approvals[parsed.data.page] = entry;
    await writeApprovals(approvals);
    return NextResponse.json({ success: true, approval: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save approval';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
