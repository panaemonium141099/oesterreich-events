/**
 * Präzisions-Stichprobe (fn-25 O1, Review §10): Passen die veröffentlichten
 * präzisen Positionen zu den Ortsangaben der Quelle?
 *
 * Zieht eine Zufallsstichprobe künftiger Events mit `venue_confirmed` bzw.
 * `address_confirmed` und prüft jede Position per Nominatim-Reverse-Lookup
 * (≤ 1 Anfrage/s) gegen die genannte PLZ und den Ortsnamen. Das ist eine
 * PRÜFUNG, kein Beleg: Reverse-Geocoding schreibt nichts und entscheidet
 * nichts (Review §5). Abweichungen sind Prüfaufträge, keine Korrekturen.
 *
 * Aufruf: npx tsx --env-file=.env.local src/scripts/location-precision-sample.ts [--n 50] [--status venue_confirmed|address_confirmed]
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeGemeindeName } from '../lib/location/gemeinde-index';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : undefined; };
const N = parseInt(arg('--n') ?? '50', 10);
const STATUSES = arg('--status') ? [arg('--status')!] : ['venue_confirmed', 'address_confirmed'];
const USER_AGENT = 'lasstreffen.at Ortsdaten-Stichprobe (kontakt@lasstreffen.at)';

interface Row { id: string; title: string; source_name: string; location_name: string | null; postal_code: string | null; city_raw: string | null; address_raw: string | null; latitude: number; longitude: number; location_status: string; geocoding_confidence: string | null }

async function reverse(lat: number, lng: number): Promise<{ postcode: string | null; town: string | null; display: string } | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18', addressdetails: '1' });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' } });
  if (!res.ok) return null;
  const j = await res.json() as { display_name?: string; address?: Record<string, string> };
  const a = j.address ?? {};
  return { postcode: a.postcode ?? null, town: a.city ?? a.town ?? a.village ?? a.municipality ?? null, display: j.display_name ?? '' };
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();
  const summary: Record<string, { n: number; plz_ok: number; plz_mismatch: number; plz_unknown: number; town_ok: number }> = {};
  for (const status of STATUSES) {
    // Zufall über einen zufälligen ID-Startpunkt (stabile ID-Pagination, keine breite Sortierung).
    const start = Math.random().toString(16).slice(2, 10).padEnd(8, '0') + '-0000-0000-0000-000000000000';
    const { data, error } = await sb.from('events')
      .select('id, title, source_name, location_name, postal_code, city_raw, address_raw, latitude, longitude, location_status, geocoding_confidence')
      .gte('start_date', nowIso).eq('publish_status', 'published').eq('location_status', status).gt('id', start)
      .not('postal_code', 'is', null).order('id').limit(N);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Row[];
    const s = { n: 0, plz_ok: 0, plz_mismatch: 0, plz_unknown: 0, town_ok: 0 };
    for (const r of rows) {
      const rev = await reverse(r.latitude, r.longitude);
      await new Promise(res => setTimeout(res, 1100));
      s.n++;
      if (!rev || !rev.postcode) { s.plz_unknown++; continue; }
      const townKey = rev.town ? normalizeGemeindeName(rev.town) : null;
      const cityKey = r.city_raw ? normalizeGemeindeName(r.city_raw) : null;
      if (townKey && cityKey && townKey === cityKey) s.town_ok++;
      if (rev.postcode === r.postal_code) { s.plz_ok++; continue; }
      // Gleiche PLZ-Region (erste zwei Stellen) ist plausibel bei Stadt-PLZ-Blöcken; alles andere melden.
      const sameBlock = rev.postcode.slice(0, 2) === (r.postal_code ?? '').slice(0, 2);
      s.plz_mismatch++;
      console.log(`${sameBlock ? 'PRÜFEN ' : 'ABWEICHUNG'} ${status} ${r.source_name} ${r.id.slice(0, 8)} „${r.title.slice(0, 40)}" Quelle PLZ ${r.postal_code} ${r.city_raw ?? ''} · Position: ${rev.postcode} ${rev.town ?? ''} (${r.geocoding_confidence}) ${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`);
    }
    summary[status] = s;
  }
  console.log('\nZusammenfassung:');
  for (const [k, s] of Object.entries(summary)) {
    console.log(`  ${k}: ${s.n} geprüft, PLZ passt ${s.plz_ok}, abweichend ${s.plz_mismatch}, ohne PLZ-Antwort ${s.plz_unknown}, Ortsname passt ${s.town_ok}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
