import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuditRun } from '@/lib/storage/db';
import { buildNormalizedReport } from '@/lib/report/report-builder';
import { generateJsonReport } from '@/lib/report/json-export';
import { generateMarkdownReport } from '@/lib/report/markdown-export';

const ExportQuerySchema = z.object({
  runId: z
    .string()
    .min(1, 'runId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'runId contains invalid characters'),
  format: z.enum(['json', 'markdown', 'md']),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = ExportQuerySchema.safeParse({
      runId: searchParams.get('runId'),
      format: searchParams.get('format'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid export request parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { runId, format } = parseResult.data;

    const run = await getAuditRun(runId);
    if (!run) {
      return NextResponse.json(
        {
          success: false,
          error: `Audit run '${runId}' not found.`,
        },
        { status: 404 }
      );
    }

    // Build the server-authoritative normalized report
    const normalized = buildNormalizedReport(run);

    // Sanitize filename to alphanumeric and safe characters
    const safeId = runId.replace(/[^a-zA-Z0-9_-]/g, '');

    if (format === 'json') {
      const jsonContent = generateJsonReport(normalized);
      const filename = `proofui-audit-${safeId}.json`;

      return new NextResponse(jsonContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } else {
      const markdownContent = generateMarkdownReport(normalized);
      const filename = `proofui-audit-${safeId}.md`;

      return new NextResponse(markdownContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate audit report.',
      },
      { status: 500 }
    );
  }
}
