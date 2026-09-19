import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const SAFE_SCREENSHOT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  if (!SAFE_SCREENSHOT_NAME.test(filename)) {
    return NextResponse.json({ error: 'Screenshot not found.' }, { status: 404 });
  }

  const screenshotDirectory = path.resolve(process.cwd(), 'public', 'screenshots');
  const screenshotPath = path.resolve(screenshotDirectory, filename);
  if (path.dirname(screenshotPath) !== screenshotDirectory) {
    return NextResponse.json({ error: 'Screenshot not found.' }, { status: 404 });
  }

  try {
    const image = await readFile(screenshotPath);
    return new NextResponse(image, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Screenshot not found.' }, { status: 404 });
  }
}
