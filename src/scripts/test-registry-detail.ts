import { createClient } from '@supabase/supabase-js';
import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';

const FIELDS = ['description', 'location_name', 'address', 'postal_code', 'image_url', 'price_text', 'organizer'] as const;

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('events')
    .select('source_url')
    .eq('source_name', 'gemeinde-registry')
    .gte('start_date', new Date().toISOString())
    .not('source_url', 'is', null)
    .limit(60);
  const urls = (data ?? []).map(r => r.source_url as string).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 15);

  const counts: Record<string, number> = {};
  for (const f of FIELDS) counts[f] = 0;
  let fetched = 0;
  for (const url of urls) {
    const host = new URL(url).host;
    process.stdout.write(`→ ${host}: `);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.log(`HTTP ${res.status}`); continue; }
      const html = await res.text();
      fetched++;
      const out = extractGem2goDetail(html);
      const got = FIELDS.filter(f => out[f]);
      for (const f of got) counts[f]++;
      console.log(`${got.length}/${FIELDS.length} — ${got.join(',')}`);
    } catch (e) {
      console.log(`ERR ${(e as Error).message?.slice(0, 40)}`);
    }
  }
  console.log(`\nCoverage on ${fetched} fetched URLs:`);
  for (const f of FIELDS) {
    const pct = fetched ? ((counts[f] / fetched) * 100).toFixed(0) : '0';
    console.log(`  ${f.padEnd(20)} ${counts[f]}/${fetched}  (${pct}%)`);
  }
}
main().catch(console.error);
