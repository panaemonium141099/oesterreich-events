// src/scripts/probe-adapter.ts
//
// Diagnostic CLI: pulls N sample events of a source (with source_url and
// no address), fetches each detail HTML, runs the current extraction stack,
// and prints what was found vs. what's still missing — plus a list of
// candidate CSS classes that an adapter could exploit.
//
// Run: npx tsx --env-file=.env.local src/scripts/probe-adapter.ts --source meinbezirk --sample 5

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { enrichFromDetailHtml } from '../lib/scrapers/detail-extract/extract';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

async function main() {
  const source = arg('source');
  const sample = parseInt(arg('sample', '5')!, 10);
  if (!source) {
    console.error('Usage: --source <name> [--sample N]');
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await sb
    .from('events')
    .select('id,title,source_url,address,location_name,description,price_text,postal_code')
    .eq('source_name', source)
    .gte('start_date', today)
    .is('address', null)
    .not('source_url', 'is', null)
    .limit(sample);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!events || events.length === 0) {
    console.log(`No address-less future events with source_url for "${source}".`);
    return;
  }

  console.log(`\n=== PROBING ${source} (${events.length} samples) ===\n`);

  const stats = { jsonld: 0, vtable: 0, og: 0, regex: 0, adapter: 0, none: 0,
                  addr: 0, desc: 0, price: 0, loc: 0 };

  for (const e of events) {
    console.log(`\n— ${(e.title ?? '').slice(0, 60)} —`);
    console.log(`  url=${e.source_url}`);
    let html: string;
    try {
      const r = await fetch(e.source_url!, {
        headers: { 'User-Agent': 'osterreich-events-probe/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        console.log(`  HTTP ${r.status} — skipped`);
        continue;
      }
      html = await r.text();
    } catch (err) {
      console.log(`  fetch failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const result = enrichFromDetailHtml(source, e.source_url!, html);
    console.log(`  layers:    [${result.layersHit.join(', ') || 'none'}]`);
    console.log(`  address:   ${result.address ?? '∅'} (conf=${result.address_confidence ?? '-'})`);
    console.log(`  loc_name:  ${result.location_name ?? '∅'}`);
    console.log(`  desc len:  ${result.description?.length ?? 0}`);
    console.log(`  price:     ${result.price_text ?? '∅'}`);

    for (const l of ['jsonld', 'adapter', 'vtable', 'og', 'regex'] as const) {
      if (result.layersHit.includes(l)) (stats as Record<string, number>)[l]++;
    }
    if (result.layersHit.length === 0) stats.none++;
    if (result.address) stats.addr++;
    if (result.description) stats.desc++;
    if (result.price_text) stats.price++;
    if (result.location_name) stats.loc++;

    // Diagnostic: which CSS classes does this page expose that a future adapter
    // could exploit? Restricted to classes that match address-ish hints.
    const $ = cheerio.load(html);
    const candidates: string[] = [];
    $('[class*="adresse"], [class*="address"], [class*="ort"], [class*="venue"], [class*="location"], [itemprop]').each((_, el) => {
      const cls = $(el).attr('class') ?? '';
      const itemprop = $(el).attr('itemprop') ?? '';
      const txt = $(el).text().trim().slice(0, 60);
      if ((cls || itemprop) && txt) {
        const sel = itemprop ? `[itemprop="${itemprop}"]` : `.${cls.split(/\s+/)[0]}`;
        candidates.push(`  ${sel.padEnd(40)} = "${txt}"`);
      }
    });
    if (candidates.length) {
      const unique = Array.from(new Set(candidates)).slice(0, 8);
      console.log(`  candidate selectors:`);
      for (const c of unique) console.log(c);
    }
  }

  console.log(`\n=== STATS (n=${events.length}) ===`);
  console.log(`  layers hit:    jsonld=${stats.jsonld}  adapter=${stats.adapter}  vtable=${stats.vtable}  og=${stats.og}  regex=${stats.regex}  none=${stats.none}`);
  console.log(`  fields found:  address=${stats.addr}  description=${stats.desc}  price=${stats.price}  location_name=${stats.loc}`);
  const cov = Math.round((100 * stats.addr) / events.length);
  console.log(`  ⇒ address coverage: ${cov}%`);
  if (cov < 80) console.log(`  ⇒ Adapter recommended (coverage < 80%)`);
  else console.log(`  ⇒ Coverage acceptable; adapter optional`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
