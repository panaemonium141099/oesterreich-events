/**
 * fn-21 — Beherbergungs-POIs aus OpenStreetMap nach `stay_pois`.
 *
 *   npx tsx src/scripts/import-stay-pois.ts             # fetch + upsert
 *   npx tsx src/scripts/import-stay-pois.ts --dry-run   # nur zählen/reporten
 *
 * Holt alle BENANNTEN Beherbergungs-Objekte Österreichs
 * (tourism=hotel|guest_house|apartment|hostel|alpine_hut|camp_site|chalet|motel)
 * per Overpass und upsertet sie nach stay_pois. Volumen ~20-30k Objekte —
 * eine einzelne Overpass-Query pro Tag-Wert reicht (kein Sharding nötig).
 *
 * Konventionen aus fn-18 (import-osm-pois.ts) übernommen:
 *   - Write-Batches <= 500 Rows
 *   - Endpoint-Rotation + Backoff bei 429/504
 *   - ODbL: Daten (c) OpenStreetMap contributors; eigener Bestand ohne
 *     Join-/Merge-Schreibpfad zu venues/osm_pois/poi_activities.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const KINDS = ['hotel', 'guest_house', 'apartment', 'hostel', 'alpine_hut', 'camp_site', 'chalet', 'motel'] as const;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface StayRow {
  osm_id: number;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  city: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchKind(kind: string): Promise<OverpassElement[]> {
  // area 3600016239 = Österreich (Relation 16239)
  const query = `[out:json][timeout:180];
area(3600016239)->.at;
nwr["tourism"="${kind}"]["name"](area.at);
out center tags;`;

  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Ohne Bot-UA + Accept antwortet overpass-api.de mit HTTP 406
          // (Betriebs-Lehre fn-18, import-osm-pois.ts)
          'User-Agent':
            'OesterreichEventsBot/1.0 (+https://lasstreffen.at; stay-poi-import; contact via website)',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429 || res.status === 504) {
        console.log(`  ${kind}: HTTP ${res.status} von ${endpoint} — Backoff ${15 * (attempt + 1)}s`);
        await sleep(15000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements: OverpassElement[] };
      return json.elements;
    } catch (e) {
      console.log(`  ${kind}: ${(e as Error).message} — retry`);
      await sleep(10000 * (attempt + 1));
    }
  }
  throw new Error(`${kind}: alle Overpass-Versuche verbraucht`);
}

function transform(kind: string, elements: OverpassElement[]): StayRow[] {
  const rows: StayRow[] = [];
  for (const el of elements) {
    const name = el.tags?.name?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    rows.push({
      // Way-/Relation-IDs können mit Node-IDs kollidieren — Typ-Offset wie üblich
      osm_id: el.type === 'node' ? el.id : el.type === 'way' ? el.id + 1e15 : el.id + 2e15,
      name: name.slice(0, 200),
      kind,
      lat,
      lng,
      city: el.tags?.['addr:city']?.trim().slice(0, 100) || null,
    });
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen');
    process.exit(1);
  }
  const supabase = dryRun ? null : createClient(url!, key!, { auth: { persistSession: false } });

  let total = 0;
  for (const kind of KINDS) {
    console.log(`Overpass: tourism=${kind} …`);
    const elements = await fetchKind(kind);
    const rows = transform(kind, elements);
    console.log(`  ${elements.length} Elemente -> ${rows.length} Rows`);
    total += rows.length;

    if (!dryRun && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase!.from('stay_pois').upsert(batch, { onConflict: 'osm_id' });
        if (error) throw new Error(`Upsert ${kind} batch ${i}: ${error.message}`);
      }
      console.log(`  upserted.`);
    }
    // Overpass Fair-Use
    await sleep(5000);
  }
  console.log(`FERTIG: ${total} Unterkünfte${dryRun ? ' (dry-run, nichts geschrieben)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
