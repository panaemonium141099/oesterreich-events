/**
 * Un-Merge falscher Duplikat-Zusammenführungen (fn-25 Phase E).
 *
 * Prüft alle künftigen Duplikat-Paare, deren PLZ in verschiedenen
 * PLZ-Regionen liegen oder keine gemeinsame Gemeinde teilen, mit dem
 * aktuellen Scorer (harte Regel seit PR #201). Sagt der Scorer `distinct`,
 * wird die Zusammenführung aufgehoben: `duplicate_of`/`dedup_cluster_id`/
 * `dedup_score` leeren, `publish_status` von `duplicate` zurück auf
 * `published` (der nächste Sync bewertet Ort und Freigabe ohnehin neu),
 * Eintrag `manual_split` im `event_dedup_log`. Bestehende Event-IDs bleiben,
 * es entstehen keine neuen Zeilen.
 *
 * Aufruf: npx tsx --env-file=.env.local src/scripts/location-unmerge-duplicates.ts [--dry-run] [--limit N]
 */
import { createClient } from '@supabase/supabase-js';
import { scorePair } from '../lib/pipeline/dedup-scorer';
import type { EventRow } from '../lib/pipeline/types';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const limitIdx = argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(argv[limitIdx + 1], 10) : Infinity;

const SELECT = 'id,title,description,start_date,end_date,location_name,address,district,postal_code,bundesland,latitude,longitude,source_url,ticket_url,image_url,category,tags,source_id,source_name,venue_id,venue_match_confidence,venue_match_stage,quality_score,publish_status,content_fingerprint,duplicate_of,dedup_score,dedup_cluster_id,organizer,price_text,created_at';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const dups: EventRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('events').select(SELECT).gte('start_date', new Date().toISOString()).not('duplicate_of', 'is', null).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    dups.push(...(data as unknown as EventRow[]));
    if (data.length < 1000) break;
  }
  const canonicalIds = [...new Set(dups.map(d => d.duplicate_of!).filter(Boolean))];
  const canon = new Map<string, EventRow>();
  for (let i = 0; i < canonicalIds.length; i += 200) {
    const { data } = await sb.from('events').select(SELECT).in('id', canonicalIds.slice(i, i + 200));
    for (const r of (data ?? []) as unknown as EventRow[]) canon.set(r.id, r);
  }

  let checked = 0, split = 0, kept = 0, errors = 0, review = 0;
  for (const d of dups) {
    const c = canon.get(d.duplicate_of!);
    if (!c) continue;
    const pa = (d.postal_code ?? '').trim();
    const pb = (c.postal_code ?? '').trim();
    if (!/^\d{4}$/.test(pa) || !/^\d{4}$/.test(pb) || pa === pb) continue;
    checked++;
    if (checked > LIMIT) break;
    const s = scorePair(d, c);
    if (s.decision !== 'distinct') { kept++; continue; }
    // Automatisch nur bei verschiedener PLZ-Region (sicher verschiedene
    // Orte). Gleiche Region, andere Gemeinde kann dieselbe Veranstaltung in
    // zwei Nachbar-Kalendern sein → nur melden (Prüfung), nicht trennen.
    if (pa[0] === pb[0]) { review++; continue; }
    split++;
    console.log(`SPLIT ${d.id.slice(0, 8)} „${(d.title ?? '').slice(0, 40)}" ${pa} ${d.source_name} ← ${c.id.slice(0, 8)} ${pb} ${c.source_name}`);
    if (DRY_RUN) continue;
    const { error } = await sb.from('events').update({ duplicate_of: null, dedup_cluster_id: null, dedup_score: null, publish_status: 'published' }).eq('id', d.id).eq('publish_status', 'duplicate');
    if (error) { errors++; console.error(error.message); continue; }
    await sb.from('event_dedup_log').upsert({
      event_a_id: d.id, event_b_id: c.id, title_score: s.titleScore, datetime_score: s.datetimeScore, venue_score: s.venueScore,
      geo_score: s.geoScore, url_score: s.urlScore, overall_score: s.overallScore, decision: 'manual_split', decided_by: 'fn-25-E-unmerge',
    }, { onConflict: 'event_a_id,event_b_id' });
  }
  console.log(`[unmerge] ${dups.length} Duplikate, ${checked} Paare mit abweichender PLZ geprüft, ${split} aufgehoben (andere PLZ-Region), ${review} zur Prüfung (gleiche Region, andere Gemeinde), ${kept} bleiben, ${errors} Fehler${DRY_RUN ? ' (dry-run)' : ''}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
