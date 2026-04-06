import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  // Auth check
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name } = await params;
  // Sanitize name to prevent path traversal
  const safeName = name.replace(/[/\\. ]/g, '_');
  const progressFile = path.join(DATA_DIR, `scraper-progress-${safeName}.json`);
  if (!progressFile.startsWith(DATA_DIR)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

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
