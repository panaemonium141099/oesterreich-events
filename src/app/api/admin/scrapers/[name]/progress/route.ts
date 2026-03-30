import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const progressFile = path.join(DATA_DIR, `scraper-progress-${name}.json`);

  try {
    if (fs.existsSync(progressFile)) {
      const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      return NextResponse.json(data);
    }
    return NextResponse.json({ status: 'idle' });
  } catch {
    return NextResponse.json({ status: 'idle' });
  }
}
