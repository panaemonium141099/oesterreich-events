import { createClient } from '@supabase/supabase-js';
import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from('events')
    .select('source_url, title')
    .eq('source_name', 'gem2go')
    .gte('start_date', new Date().toISOString())
    .is('address', null)
    .limit(200);
  const urls = (data ?? [])
    .map((r) => r.source_url as string)
    .filter(Boolean)
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);

  for (const url of urls) {
    const html = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' },
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    if (!html) {
      console.log(`FETCH-FAIL: ${url}`);
      continue;
    }
    const out = extractGem2goDetail(html);
    const fields = Object.keys(out).length;
    console.log(`\n=== ${new URL(url).host} (${fields} fields extracted) ===`);
    console.log(`URL: ${url}`);
    console.log(`Extracted:`, JSON.stringify(out, null, 2).slice(0, 400));
    const idx = html.indexOf('</h1>');
    const visible = html
      .slice(idx, idx + 8000)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 600);
    console.log(`Visible text (post-h1): ${visible}`);
  }
}

main().catch(console.error);
