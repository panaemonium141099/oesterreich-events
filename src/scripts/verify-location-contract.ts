/**
 * Integrationsprüfung des Ortsvertrags am GESPEICHERTEN Datensatz (fn-25 C6).
 *
 * Prüft gegen die echte Datenbank (Trigger inklusive), dass
 *  1. eine vom Resolver verworfene Koordinate nach dem Upsert wirklich NULL
 *     ist (kein Trigger setzt sie wieder ein),
 *  2. sie nach einem Update NUR auf Titel bzw. Score NULL bleibt,
 *  3. ein zweiter identischer Sync dieselbe Entscheidung liefert (gleicher
 *     input_hash) und keine neue Rohzeile erzeugt,
 *  4. eine belegte Feed-Venue-Position mit Pin/Route gespeichert wird und
 *     ein Titel-Update sie nicht verändert,
 *  5. eine manuelle Korrektur (`event_location_corrections`) beim nächsten
 *     Sync angewendet wird und ein späterer Quellenstand mit anderen
 *     Ortsangaben (Verlegung) sie ablöst statt an ihr zu scheitern,
 *  6. die Quelle für ihre eigene Koordinate maßgeblich bleibt: stuft sie
 *     eine Venue-Koordinate zur Gebietsangabe ab (Feed-Platzhalter), wird
 *     die Zeile abgestuft, auch wenn sich die Koordinate minimal ändert.
 *
 * Schreibt unter der Quelle `fn25-contract-check` und räumt danach auf.
 * Aufruf: npx tsx --env-file=.env.local src/scripts/verify-location-contract.ts
 */
import { createClient } from '@supabase/supabase-js';
import { syncEventsToSupabase } from '../lib/db/supabase-sync';
import { locationBasisHash } from '../lib/location/conservative-resolution';
import { venueMapKey } from '../lib/location/venue-key';
import type { ScrapedEvent } from '../types/events';

const SRC = 'fn25-contract-check';
const COLS = 'id, source_id, title, latitude, longitude, geocoding_confidence, location_status, location_precision, location_resolution, raw_event_id, quality_score, publish_status';

interface Row {
  id: string; source_id: string; title: string; latitude: number | null; longitude: number | null;
  geocoding_confidence: string | null; location_status: string | null; location_precision: string | null;
  location_resolution: { input_hash?: string; allowed?: { pin?: boolean; route?: boolean } } | null;
  raw_event_id: string | null; quality_score: number | null; publish_status: string | null;
}

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ' → ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const read = async (sourceId: string): Promise<Row> => {
    const { data, error } = await sb.from('events').select(COLS).eq('source_name', SRC).eq('source_id', sourceId).single();
    if (error || !data) throw new Error(`read ${sourceId}: ${error?.message}`);
    return data as unknown as Row;
  };

  const start = '2027-12-30T18:00:00+01:00';
  const events: ScrapedEvent[] = [
    // Fall A: Koordinate widerspricht der genannten PLZ (Wien vs. Kärnten) → conflict
    { source_name: SRC, source_id: 'conflict', source_url: 'https://example.invalid/c', title: 'fn25 Vertrag Konflikt',
      start_date: start, location_name: 'Ronacher', address: 'Seilerstätte 9', postal_code: '1010', bundesland: 'wien',
      latitude: 46.733, longitude: 13.717, coords_precision: 'venue' },
    // Fall B: belegte Feed-Venue-Position → venue_confirmed
    { source_name: SRC, source_id: 'venue', source_url: 'https://example.invalid/v', title: 'fn25 Vertrag Venue',
      start_date: start, location_name: 'Tiroler Landestheater', address: 'Rennweg 2', postal_code: '6020', city: 'Innsbruck',
      country: 'AT', latitude: 47.269, longitude: 11.395, coords_precision: 'venue', source_venue_id: 'eventim:contract-check' },
  ];

  try {
    const r1 = await syncEventsToSupabase(events);
    check('Sync 1 ohne Fehler', r1.errors === 0 && r1.upserted === 2, r1);

    let a = await read('conflict');
    check('A: verworfene Koordinate ist nach dem Upsert NULL', a.latitude === null && a.longitude === null, a);
    check('A: Status conflict', a.location_status === 'conflict', a.location_status);
    check('A: nicht veröffentlicht', a.publish_status !== 'published', a.publish_status);
    check('A: Rohzeile verknüpft', !!a.raw_event_id, a.raw_event_id);

    await sb.from('events').update({ title: 'fn25 Vertrag Konflikt (Titel geändert)' }).eq('id', a.id);
    a = await read('conflict');
    check('A: nach Titel-Update weiterhin NULL', a.latitude === null && a.location_status === 'conflict', a);

    await sb.from('events').update({ quality_score: 42 }).eq('id', a.id);
    a = await read('conflict');
    check('A: nach Score-Update weiterhin NULL', a.latitude === null && a.location_status === 'conflict', a);

    let b = await read('venue');
    check('B: venue_confirmed mit Koordinate', b.location_status === 'venue_confirmed' && b.latitude === 47.269, b);
    check('B: Pin und Route erlaubt', b.location_resolution?.allowed?.pin === true && b.location_resolution?.allowed?.route === true, b.location_resolution?.allowed);
    check('B: veröffentlicht', b.publish_status === 'published', b.publish_status);
    const hashB = b.location_resolution?.input_hash;
    await sb.from('events').update({ title: 'fn25 Vertrag Venue (Titel geändert)' }).eq('id', b.id);
    b = await read('venue');
    check('B: Titel-Update lässt Position/Status unverändert', b.latitude === 47.269 && b.location_status === 'venue_confirmed', b);

    const { count: rawBefore } = await sb.from('raw_events').select('id', { count: 'exact', head: true }).eq('source_name', SRC);
    const r2 = await syncEventsToSupabase(events);
    const { count: rawAfter } = await sb.from('raw_events').select('id', { count: 'exact', head: true }).eq('source_name', SRC);
    check('Sync 2 identisch: keine neue Rohzeile', r2.rawWritten === 0 && rawBefore === rawAfter, { rawBefore, rawAfter, r2 });
    b = await read('venue');
    a = await read('conflict');
    check('Sync 2: gleicher input_hash (Wiederholbarkeit)', b.location_resolution?.input_hash === hashB, [hashB, b.location_resolution?.input_hash]);
    check('Sync 2: Konflikt bleibt Konflikt', a.location_status === 'conflict' && a.latitude === null, a);

    // Fall C: manuelle Korrektur mit Geltungsbereich Event. Die Quelle liefert
    // nur Name + PLZ (Gemeinde-Ebene); der Admin belegt die Position.
    const cSource: ScrapedEvent = { source_name: SRC, source_id: 'corr', source_url: 'https://example.invalid/k', title: 'fn25 Vertrag Korrektur',
      start_date: start, location_name: 'Pfarrsaal', postal_code: '7000', bundesland: 'burgenland' };
    await syncEventsToSupabase([cSource]);
    let c = await read('corr');
    check('C: vor der Korrektur nur Gemeinde-Ebene', c.location_status === 'municipality_only' && c.location_resolution?.allowed?.pin === false, c);
    const basis = locationBasisHash({ location_name: cSource.location_name, address: null, postal_code: cSource.postal_code, city: null, bundesland: cSource.bundesland, country: null, latitude: null, longitude: null, coords_precision: null, source_venue_id: null });
    const { error: corrErr } = await sb.from('event_location_corrections').insert({
      scope: 'event', scope_id: c.id, before: { latitude: c.latitude, longitude: c.longitude, location_basis_hash: basis },
      after: { latitude: 47.8457, longitude: 16.5259, precision: 'building' }, reason: 'Vertragsprüfung', corrected_by: 'fn25-contract-check',
    });
    check('C: Korrektur gespeichert', !corrErr, corrErr?.message);
    await syncEventsToSupabase([cSource]);
    c = await read('corr');
    check('C: Sync wendet die Korrektur an (manual, Pin + Route)', c.geocoding_confidence === 'manual' && c.latitude === 47.8457 && c.location_resolution?.allowed?.route === true, c);
    // Verlegung: die Quelle nennt jetzt einen anderen Ort → Korrektur veraltet, neue Entscheidung, alte Position fällt.
    await syncEventsToSupabase([{ ...cSource, location_name: 'Kulturzentrum', postal_code: '7100' }]);
    c = await read('corr');
    check('C: Verlegung löst die Korrektur ab (keine ewige Sperre)', c.geocoding_confidence !== 'manual' && c.latitude !== 47.8457 && c.location_status === 'municipality_only', c);
    check('C: Grund correction_stale protokolliert', ((c.location_resolution as { reasons?: string[] } | null)?.reasons ?? []).some(r => r.startsWith('correction_stale:')), c.location_resolution);

    // Fall D: Feed-Platzhalter. Erst als Venue-Koordinate geliefert (venue_confirmed),
    // dann vom Parser als Gebietsangabe erkannt (municipality) mit minimal anderer Gleitkommazahl.
    const dSource: ScrapedEvent = { source_name: SRC, source_id: 'placeholder', source_url: 'https://example.invalid/p', title: 'fn25 Vertrag Platzhalter',
      start_date: start, location_name: 'Royal Vienna Hall', address: 'Mariahilfer Straße 1', postal_code: '1060', city: 'WIEN', country: 'AT',
      latitude: 48.2089999946173, longitude: 16.3700000256988, coords_precision: 'venue', source_venue_id: 'eventim:contract-placeholder' };
    await syncEventsToSupabase([dSource]);
    let d = await read('placeholder');
    check('D: Venue-Koordinate der Quelle → venue_confirmed', d.location_status === 'venue_confirmed' && d.geocoding_confidence === 'scraper', d);
    await syncEventsToSupabase([{ ...dSource, latitude: 48.209, longitude: 16.37, coords_precision: 'municipality' }]);
    d = await read('placeholder');
    check('D: Abstufung durch die Quelle wird übernommen (municipality_only, gemeinde-centroid, kein Pin)',
      d.location_status === 'municipality_only' && d.geocoding_confidence === 'gemeinde-centroid' && d.latitude === 48.209 && d.location_resolution?.allowed?.pin === false, d);

    // Fall E: Konflikt erst durch den Freigabevertrag (deklariertes Bundesland
    // widerspricht der Koordinate, PLZ unbekannt → keine dritte Stimme). Die
    // Zeile muss OHNE Position ankommen, sonst scheitert der ganze Batch am
    // DB-Check events_location_conflict_no_position.
    const eSource: ScrapedEvent = { source_name: SRC, source_id: 'admission-conflict', source_url: 'https://example.invalid/e', title: 'fn25 Vertrag Vertragskonflikt',
      start_date: start, location_name: 'Kulturhaus', postal_code: '9999', bundesland: 'kaernten', country: 'AT',
      latitude: 48.2082, longitude: 16.3738, coords_precision: 'venue', source_venue_id: 'x:contract-e' };
    const rE = await syncEventsToSupabase([eSource]);
    check('E: Sync ohne Schreibfehler (kein Check-Verstoß)', rE.errors === 0, rE);
    const ev = await read('admission-conflict');
    check('E: Vertragskonflikt ohne Position, verworfene Position protokolliert',
      ev.location_status === 'conflict' && ev.latitude === null && (ev.location_resolution as { revoked?: { latitude?: number } } | null)?.revoked?.latitude === 48.2082, ev);

    // Fall F: bestätigte Spielstätten-Zuordnung über den Namensschlüssel (Admin
    // „Spielstätte zuordnen"): Quelle nennt nur Name + PLZ, die Bestätigung gilt
    // für alle Events der Gruppe.
    const fSource: ScrapedEvent = { source_name: SRC, source_id: 'venue-map', source_url: 'https://example.invalid/f', title: 'fn25 Vertrag Namenszuordnung',
      start_date: start, location_name: 'Kulturhaus Musterstadt', postal_code: '7000', bundesland: 'burgenland' };
    await syncEventsToSupabase([fSource]);
    let f = await read('venue-map');
    check('F: vor der Zuordnung nur Gemeinde-Ebene', f.location_status === 'municipality_only', f);
    const fKey = venueMapKey({ source_name: SRC, location_name: fSource.location_name, postal_code: fSource.postal_code });
    const { error: mapErr } = await sb.from('source_venue_map').upsert({ source_venue_id: fKey, venue_id: null, latitude: 47.8457, longitude: 16.5259, precision: 'building', confirmed_by: 'fn25-contract-check', evidence: 'Vertragsprüfung' }, { onConflict: 'source_venue_id' });
    check('F: Zuordnung gespeichert', !mapErr, mapErr?.message);
    await syncEventsToSupabase([fSource]);
    f = await read('venue-map');
    check('F: Sync wendet die Namenszuordnung an (venue_confirmed, Pin + Route)', f.location_status === 'venue_confirmed' && f.latitude === 47.8457 && f.location_resolution?.allowed?.route === true, f);

    // Fall G: verworfene Seitenadresse. Erst kam eine Adresse (geocodiert →
    // address_confirmed), dann erkennt der Abruf sie als Seitenadresse: die
    // gespeicherte Adresse und die daraus geocodierte Position fallen weg.
    const gSource: ScrapedEvent = { source_name: SRC, source_id: 'shared-address', source_url: 'https://example.invalid/g', title: 'fn25 Vertrag Seitenadresse',
      start_date: start, location_name: 'Schloss Musterhof', address: 'Hauptplatz 1', postal_code: '7000', city: 'Eisenstadt', bundesland: 'burgenland', country: 'AT' };
    const { error: cacheErr } = await sb.from('geocode_cache').upsert({ query: 'addr:v1:hauptplatz 1|7000|eisenstadt', latitude: 47.8455, longitude: 16.5251, status: 'ok', precision: 'building', provider: 'fn25-contract-check', cached_at: new Date().toISOString() }, { onConflict: 'query' });
    check('G: Geocode-Cache-Eintrag gesetzt', !cacheErr, cacheErr?.message);
    await syncEventsToSupabase([gSource]);
    let g = await read('shared-address');
    check('G: Adresse geocodiert → address_confirmed', g.location_status === 'address_confirmed' && g.latitude === 47.8455, g);
    await syncEventsToSupabase([{ ...gSource, address: undefined, address_rejected: 'page_boilerplate' }]);
    g = await read('shared-address');
    const gRow = await sb.from('events').select('address').eq('id', g.id).single();
    check('G: verworfene Seitenadresse entfernt Adresse und geocodierte Position (Gemeinde-Ebene)',
      g.location_status === 'municipality_only' && g.latitude !== 47.8455 && gRow.data?.address === null, { ...g, address: gRow.data?.address });
  } finally {
    await sb.from('geocode_cache').delete().eq('provider', 'fn25-contract-check');
    await sb.from('source_venue_map').delete().eq('confirmed_by', 'fn25-contract-check');
    await sb.from('event_location_corrections').delete().eq('corrected_by', 'fn25-contract-check');
    const { data: del } = await sb.from('events').delete().eq('source_name', SRC).select('id');
    await sb.from('raw_events').delete().eq('source_name', SRC);
    await sb.from('scrape_runs').delete().eq('source_name', SRC);
    console.log(`Aufgeräumt: ${del?.length ?? 0} Events`);
  }
  console.log(failures === 0 ? '\nALLE PRÜFUNGEN BESTANDEN' : `\n${failures} PRÜFUNG(EN) FEHLGESCHLAGEN`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
