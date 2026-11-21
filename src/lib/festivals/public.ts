/**
 * Öffentliche Festival-Daten: Lader für Liste und Detail, wie /festivals und
 * /festivals/[slug] sie zeigen. Seiten und App-API lesen über dieselben
 * Funktionen; die Anzeige-Ableitungen stehen pur in `display.ts`.
 *
 * Nur für Server-Code (liest über den Server-Client).
 */
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getFestivalEnrichment } from '@/lib/festivals/enrich';
import { SITE_COUNTRY } from '@/lib/site-country';
import type { Festival, FestivalArtist } from '@/types/festivals';
import overridesJson from '../../../data/festival-overrides.json';
import {
  festivalCategoryFallback,
  parentEventHref,
  type FestivalDetailData,
  type ParentEventRow,
  type UpcomingFestival,
} from './display';

const OVERRIDES = overridesJson as Record<string, { imageUrl?: string | null }>;

type FestivalListRow = Festival & { parent_event: ParentEventRow | ParentEventRow[] | null };

/**
 * Kommende Festivals (Ende nicht vor heute), nach Beginn. Das Haupt-Event
 * liefert Bild und Ziel der Karte; ein ausländisches Haupt-Event kommt als
 * null (Nicht-inner-Einbettung), das Festival bleibt in der Liste.
 */
export async function loadUpcomingFestivals(): Promise<UpcomingFestival[]> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('festivals')
    .select('*, parent_event:events!parent_event_id(id, slug, start_date, postal_code, address, bundesland, location_name, image_url)')
    .gte('ends_at', today)
    // Nicht-inner-Einbettung: ein ausländisches Haupt-Event kommt als null.
    .eq('parent_event.country', SITE_COUNTRY)
    .order('starts_at', { ascending: true });

  return ((data ?? []) as unknown as FestivalListRow[]).map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;
    const href = parentEventHref(parentEvent ?? null) ?? `/festivals/${f.slug}`;
    const override = OVERRIDES[f.slug];
    return {
      ...(rest as Festival),
      image_url:
        parentEvent?.image_url
        ?? f.image_url
        ?? (override?.imageUrl ?? null)
        ?? festivalCategoryFallback(f.id),
      href,
    };
  });
}

const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue',
};
function asciiFoldSlug(slug: string): string {
  return slug.replace(/[äöüßÄÖÜ]/g, c => UMLAUT_MAP[c] ?? c);
}

/**
 * Slug lookup that tolerates Unicode-normalization drift. We try NFC
 * first (matches what the seed registry stores), then NFD, then a
 * pure-ASCII fold (`mörbisch` → `moerbisch`) for legacy rows. The first
 * non-null result wins.
 *
 * Returns the matched festival row or null. NEVER throws — Supabase
 * errors are logged and treated as null so the page can render the 404
 * shell cleanly instead of crashing into the global error boundary.
 */
export async function fetchFestivalRow(slug: string): Promise<Festival | null> {
  const supabase = await createServerSupabaseClient();
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* invalid escape sequence in slug — keep original */
  }
  const variants = Array.from(new Set([
    decoded,
    slug,
    decoded.normalize('NFC'),
    decoded.normalize('NFD'),
    asciiFoldSlug(decoded.normalize('NFC')),
  ]));

  for (const candidate of variants) {
    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('slug', candidate)
        .maybeSingle();
      if (!error && data) return data as unknown as Festival;
    } catch (err) {
      console.error('[festival-detail] lookup threw for', candidate, err);
    }
  }
  // ilike fallback for stored rows with weird whitespace or dash variants
  try {
    const { data } = await supabase
      .from('festivals')
      .select('*')
      .ilike('slug', decoded)
      .limit(1);
    if (data && data.length > 0) return data[0] as unknown as Festival;
  } catch (err) {
    console.error('[festival-detail] ilike fallback threw:', decoded, err);
  }
  return null;
}

export async function fetchParentEvent(parentEventId: string | null): Promise<ParentEventRow | null> {
  if (!parentEventId) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('events')
      .select('id, slug, start_date, postal_code, address, bundesland, location_name, image_url')
      .eq('id', parentEventId)
      .eq('country', SITE_COUNTRY)
      .maybeSingle();
    return (data ?? null) as ParentEventRow | null;
  } catch (err) {
    console.error('[festival-detail] parent event lookup threw:', parentEventId, err);
    return null;
  }
}

export async function fetchFestivalArtists(festivalId: string): Promise<FestivalArtist[]> {
  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('festival_artists') as any)
      .select('*')
      .eq('festival_id', festivalId);
    return (data ?? []) as FestivalArtist[];
  } catch (err) {
    console.error('[festival-detail] artists lookup threw:', festivalId, err);
    return [];
  }
}

/**
 * Alles zu einem Festival: Zeile, Haupt-Event, Line-up und die Anreicherung
 * von der Festival-Website. Kein Lader wirft; null heißt „gibt es nicht".
 *
 * Kuratierte Spalten (data/festivals-upcoming.json, 2026-10) gehen vor:
 * trägt die Zeile Beschreibung, Bild und Preis, entfällt der Website-
 * Abruf komplett (bis zu ~7 s Latenz bei trägen Festival-Seiten).
 */
export async function loadFestivalDetail(slug: string): Promise<FestivalDetailData | null> {
  const festival = await fetchFestivalRow(slug);
  if (!festival) return null;
  const curatedComplete = !!festival.description && !!festival.image_url && !!festival.price_text;
  const [parentEvent, artists, enrichment] = await Promise.all([
    fetchParentEvent(festival.parent_event_id),
    fetchFestivalArtists(festival.id),
    curatedComplete
      ? getFestivalEnrichment(null, festival.slug)
      : getFestivalEnrichment(festival.website_url, festival.slug),
  ]);
  return { festival, parentEvent, artists, enrichment };
}
