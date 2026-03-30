import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers, getScraperByName, runScraper } from '@/lib/scrapers';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPE_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

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
