import { NextRequest, NextResponse } from 'next/server';
import { runMultiCandidateIteration } from '@/lib/sandbox/iteration';
import { UXIssue } from '@/lib/schema/ux-issue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const issues: UXIssue[] = Array.isArray(body.issues) ? body.issues : [];

    if (!html) {
      return NextResponse.json({ success: false, error: 'HTML snippet is required.' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'localhost:3123';
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : (process.env.PORT || '3123');
    const localOrigin = `http://localhost:${port}`;

    const candidates = await runMultiCandidateIteration(html, issues, localOrigin);

    return NextResponse.json({
      success: true,
      candidates,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Iteration failed.' },
      { status: 500 }
    );
  }
}

