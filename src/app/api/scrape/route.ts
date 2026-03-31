import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers, getScraperByName, runScraper } from '@/lib/scrapers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Authenticate the request. Accepts either:
 * 1. A valid x-api-key header matching SCRAPE_API_KEY env var, OR
 * 2. A logged-in user with admin or god role (via Supabase session cookie)
 *
 * Returns null if authorized, or a NextResponse error if not.
 */
async function authenticateScrapeRequest(request: NextRequest): Promise<NextResponse | null> {
  // Path 1: API key authentication (for CI/cron jobs)
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPE_API_KEY;
  if (expectedKey && apiKey === expectedKey) {
    return null; // authorized
  }

  // Path 2: Session-based authentication (admin/god role)
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert — Login oder API-Key erforderlich' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['god', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Nicht berechtigt — Admin- oder God-Rolle erforderlich' }, { status: 403 });
    }

    return null; // authorized
  } catch {
    return NextResponse.json({ error: 'Authentifizierung fehlgeschlagen' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await authenticateScrapeRequest(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const sourceName = body.source as string | undefined;

  try {
    if (sourceName) {
      const scraper = getScraperByName(sourceName);
      if (!scraper) {
        return NextResponse.json({ error: `Unbekannter Scraper: ${sourceName}` }, { status: 400 });
      }
      await runScraper(scraper);
    } else {
      await runAllScrapers();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Scrape Error:', err);
    return NextResponse.json(
      { error: 'Scraping fehlgeschlagen' },
      { status: 500 }
    );
  }
}
