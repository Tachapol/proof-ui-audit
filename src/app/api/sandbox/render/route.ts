import { NextRequest, NextResponse } from 'next/server';
import { getSandboxSnippet, saveSandboxSnippet, buildSandboxedDocument } from '@/lib/sandbox/store';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return new NextResponse('Snippet ID required.', { status: 400 });
  }

  const snippet = getSandboxSnippet(id);
  if (!snippet) {
    return new NextResponse('Sandbox snippet not found or expired.', { status: 404 });
  }

  const doc = buildSandboxedDocument(snippet.html);
  return new NextResponse(doc, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = typeof body.html === 'string' ? body.html.trim() : '';

    if (!html) {
      return NextResponse.json({ success: false, error: 'HTML snippet content is required.' }, { status: 400 });
    }

    const snippet = saveSandboxSnippet(html);
    const host = req.headers.get('host') || 'localhost:3123';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const renderUrl = `${protocol}://${host}/api/sandbox/render?id=${snippet.id}`;

    return NextResponse.json({
      success: true,
      id: snippet.id,
      renderUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to register snippet.' },
      { status: 500 }
    );
  }
}

