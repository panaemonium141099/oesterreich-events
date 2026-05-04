/**
 * Audit gemeinde-coverage gap: which of the ~300 hand-listed Gemeinden
 * (src/lib/scrapers/gemeinden/gemeindeList.ts) have 0 upcoming events
 * even though they have a website + presumably an event calendar?
 *
 * Output: a table grouped by Bundesland with each "empty" Gemeinde's
 * name, PLZ, website, and a guess at the most likely cause based on
 * which scrapers ran and what they wrote.
 *
 * USAGE
 *   source .env.local && npx tsx src/scripts/audit-gemeinde-coverage.ts
 *   --bundesland niederoesterreich     # filter to one BL
 *   --json                              # machine-readable output
 */

import { createClient } from '@supabase/supabase-js';
import { GEMEINDEN as GEMEINDE_LIST } from '../lib/scrapers/gemeinden/gemeindeList';
import { bundeslandToId } from '../lib/bundeslaender';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const blFilter = ((): string | null => {
  const i = args.indexOf('--bundesland');
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
})();
const jsonOut = args.includes('--json');

interface GemeindeAudit {
  name: string;
  plz: string;
  bundesland: string;
  website: string;
  upcoming: number;
  total: number;
  sourcesUsed: string[];
  /** Heuristic guess at the cause when upcoming=0. */
  hint: string;
}

async function main() {
  // Filter the input list if requested
  const list = GEMEINDE_LIST.filter((g) => !blFilter || bundeslandToId(g.bundesland) === blFilter);
  console.log(`Auditing ${list.length} gemeinden${blFilter ? ` in ${blFilter}` : ''}…\n`);

  const audits: GemeindeAudit[] = [];
  // Batch by 25 to keep individual queries small.
  for (let i = 0; i < list.length; i += 25) {
    const slice = list.slice(i, i + 25);
    await Promise.all(
      slice.map(async (g) => {
        const { data, error } = await sb
          .from('events')
          .select('id, source_name, start_date, publish_status')
          .eq('postal_code', g.plz);
        if (error) {
          audits.push({
            name: g.name, plz: g.plz, bundesland: g.bundesland, website: g.website,
            upcoming: 0, total: 0, sourcesUsed: [],
            hint: `query error: ${error.message}`,
          });
          return;
        }
        const total = data.length;
        const now = Date.now();
        const upcoming = data.filter(
          (e) => e.publish_status === 'published' && new Date(e.start_date).getTime() >= now,
        ).length;
        const sourcesUsed = Array.from(new Set(data.map((e) => e.source_name).filter(Boolean))) as string[];

        let hint = '';
        if (total === 0) {
          hint = 'kein einziger Scraper hat hier je was gefunden';
        } else if (upcoming === 0 && total > 0) {
          hint = `${total} historische Events da, aber keine zukünftigen — Calendar-Page leer ODER Scraper liest sie nicht mehr`;
        } else if (upcoming > 0 && upcoming < 3) {
          hint = `nur ${upcoming} Events — Coverage stark unter Schnitt`;
        }

        audits.push({
          name: g.name, plz: g.plz, bundesland: g.bundesland, website: g.website,
          upcoming, total, sourcesUsed, hint,
        });
      }),
    );
  }

  // Sort: zero events first, then 1-2 events, then by bundesland+name.
  audits.sort((a, b) => {
    if (a.upcoming === b.upcoming) return a.bundesland.localeCompare(b.bundesland) || a.name.localeCompare(b.name);
    return a.upcoming - b.upcoming;
  });

  if (jsonOut) {
    console.log(JSON.stringify(audits, null, 2));
    return;
  }

  // Group human-readable summary
  const byBl = new Map<string, GemeindeAudit[]>();
  for (const a of audits) {
    const k = a.bundesland;
    if (!byBl.has(k)) byBl.set(k, []);
    byBl.get(k)!.push(a);
  }

  const totals = {
    listed: audits.length,
    zero: audits.filter((a) => a.upcoming === 0).length,
    low: audits.filter((a) => a.upcoming > 0 && a.upcoming < 3).length,
    healthy: audits.filter((a) => a.upcoming >= 3).length,
  };
  console.log(`SUMMARY: ${totals.listed} gelistet · ${totals.zero} mit 0 events · ${totals.low} mit 1-2 events · ${totals.healthy} gesund (≥3)\n`);

  for (const [bl, rows] of byBl) {
    const empty = rows.filter((r) => r.upcoming === 0);
    const low = rows.filter((r) => r.upcoming > 0 && r.upcoming < 3);
    if (empty.length === 0 && low.length === 0) continue;
    console.log(`── ${bl} ── ${empty.length} mit 0 / ${low.length} mit 1-2`);
    for (const r of [...empty, ...low].slice(0, 25)) {
      const flag = r.upcoming === 0 ? '⛔' : '⚠️ ';
      console.log(`  ${flag} ${r.plz} ${r.name.padEnd(28)} ${String(r.upcoming).padStart(2)} upcoming, ${String(r.total).padStart(3)} total · ${r.website}`);
      console.log(`     ${r.hint}`);
      if (r.sourcesUsed.length > 0) {
        console.log(`     sources gesehen: ${r.sourcesUsed.slice(0, 5).join(', ')}`);
      }
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
