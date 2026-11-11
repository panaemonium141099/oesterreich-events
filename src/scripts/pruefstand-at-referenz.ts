/**
 * AT-Referenzwerte für den DE-Prüfstand (fn-29.3): misst den Prod-Bestand der
 * österreichischen Gemeinde-Scraper mit derselben Funktion, die der
 * Prüfstand auf DE-Adapter anwendet (`measureRows`). Nur lesend.
 *
 * Grundmenge je Quelle: künftige Zeilen (start_date ab jetzt), die die Quelle
 * zuletzt in den letzten 7 Tagen geliefert hat (`last_seen_at`), ohne
 * Dubletten-Markierung des Dedups (`publish_status <> 'duplicate'`). So zählt
 * der aktuell gelieferte Stand, nicht verwaister Altbestand.
 *
 * Aufruf: npx tsx --env-file=.env.local src/scripts/pruefstand-at-referenz.ts
 * Ausgabe: data/pruefstand/at-referenz.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from '../lib/db/fetch-all';
import { measureRows, poolMetrics, type PruefRow } from '../lib/pruefstand/metrics';
import type { AtReferenz } from '../lib/pruefstand/schwellen';

const SOURCES = ['gem2go', 'gemeinde-registry', 'gemeinden-generic'];
const COLUMNS = 'source_id,source_url,title,start_date,end_date,location_name,postal_code,latitude,longitude,location_precision,publish_status,location_resolution';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^https:\/\/api\.lasstreffen\.at/.test(url)) throw new Error(`Ziel ist nicht die Prod-DB api.lasstreffen.at: ${url.replace(/\/\/.*@/, '//')}`);
  const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const now = new Date();
  const seenSince = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const bySource: AtReferenz['bySource'] = {};
  for (const source of SOURCES) {
    const rows = await fetchAllRows<PruefRow>(
      (from, to) => sb.from('events').select(COLUMNS)
        .eq('source_name', source)
        .eq('country', 'AT')
        .gte('start_date', now.toISOString())
        .gte('last_seen_at', seenSince)
        .neq('publish_status', 'duplicate')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: PruefRow[] | null; error: { message: string } | null }>,
      { label: source },
    );
    bySource[source] = measureRows(rows);
    console.log(source, rows.length);
  }
  const out: AtReferenz = { measured_at: now.toISOString(), sources: SOURCES, pooled: poolMetrics(Object.values(bySource)), bySource };
  mkdirSync(join(process.cwd(), 'data', 'pruefstand'), { recursive: true });
  writeFileSync(join(process.cwd(), 'data', 'pruefstand', 'at-referenz.json'), JSON.stringify(out, null, 2) + '\n');
  for (const [k, m] of Object.entries(bySource)) console.log(k, m.n, JSON.stringify(m.rates));
  console.log('gepoolt', out.pooled.n, JSON.stringify(out.pooled.rates));
}

main().catch(e => { console.error(e); process.exit(1); });
