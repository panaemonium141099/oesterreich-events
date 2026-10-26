import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { V4BackButton } from '@/components/Events/v4/V4BackButton';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { getFestivalEnrichment } from '@/lib/festivals/enrich';
import type { Festival, FestivalArtist } from '@/types/festivals';
import { V4FestivalActions } from '@/components/Festivals/V4FestivalActions';
import { EVENT_TZ, toViennaDate } from '@/lib/utils/event-time';
import { SITE_COUNTRY } from '@/lib/site-country';

// Dynamic — slug params with non-ASCII (umlauts) were getting served
// stale 404 responses under Next's default revalidation. Forcing the
// page dynamic lets every request re-run the DB lookup against the
// freshly decoded slug.
export const dynamic = 'force-dynamic';

const FESTIVAL_FALLBACK_COUNT = 30;
function festivalCategoryFallback(festivalId: string): string {
  let h = 0;
  for (let i = 0; i < festivalId.length; i++) {
    h = (h * 31 + festivalId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(h) % FESTIVAL_FALLBACK_COUNT) + 1;
  return `/images/categories/musik-${idx}.jpg`;
}

function formatDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return 'Termin offen';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  if (!end || toViennaDate(end) === toViennaDate(start)) return startStr;
  const sameYear = toViennaDate(start).slice(0, 4) === toViennaDate(end).slice(0, 4);
  const startShort = start.toLocaleDateString('de-AT', sameYear
    ? { day: 'numeric', month: 'long', timeZone: EVENT_TZ }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  const endStr = end.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  return `${startShort} – ${endStr}`;
}

const GENRE_LABELS: Record<string, string> = {
  K: 'Klassik',
  J: 'Jazz',
  P: 'Pop/Rock',
  E: 'Elektronik',
  H: 'Hip-Hop',
  G: 'Global',
  N: 'Neue Musik',
  I: 'Interdisziplinär',
};
function expandGenres(raw: string | null): string {
  if (!raw) return '';
  return raw
    .split(/[,/]/)
    .map(g => g.trim())
    .filter(Boolean)
    .map(g => GENRE_LABELS[g.toUpperCase()] ?? g)
    .join(' · ');
}

type ParentEventRow = {
  id: string;
  slug: string | null;
  start_date: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  location_name: string | null;
  image_url: string | null;
};

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
async function fetchFestivalRow(slug: string): Promise<Festival | null> {
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

async function fetchParentEvent(parentEventId: string | null): Promise<ParentEventRow | null> {
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

async function fetchArtists(festivalId: string): Promise<FestivalArtist[]> {
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const festival = await fetchFestivalRow(slug);
  if (!festival) return { title: 'Festival nicht gefunden — lasstreffen.at' };
  const dateRange = formatDateRange(festival.starts_at, festival.ends_at);
  const base = festival.city
    ? `${festival.canonical_name} in ${festival.city}: ${dateRange}.`
    : `${festival.canonical_name}: ${dateRange}.`;
  // Kuratierte Beschreibung (erster Satz) hebt das Snippet über die reine
  // Termin-Zeile; Preis dazu, wenn bekannt.
  const firstSentence = festival.description?.match(/^[^.!?]{20,180}[.!?]/)?.[0] ?? null;
  const desc = [base, firstSentence, festival.price_text ? `Tickets: ${festival.price_text}.` : null]
    .filter(Boolean).join(' ').slice(0, 300);
  return {
    title: `${festival.canonical_name} ${dateRange} — lasstreffen.at`,
    description: desc,
  };
}

/** Ticket-Anbieter aus dem Link für das Klick-Tracking (data-track-provider). */
function ticketProviderOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/oeticket|eventim/.test(host)) return 'eventim';
    if (/ticketmaster/.test(host)) return 'ticketmaster';
    if (/ntry\.at/.test(host)) return 'ntry';
    return host;
  } catch {
    return 'unknown';
  }
}

const BILLING_ORDER: Record<string, number> = {
  headliner: 0,
  sub_headliner: 1,
  support: 2,
  opener: 3,
  unknown: 4,
};

const BILLING_LABEL: Record<string, string> = {
  headliner: 'Headliner',
  sub_headliner: 'Sub-Headliner',
  support: 'Support',
  opener: 'Opener',
  unknown: 'Line-up',
};

export default async function FestivalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const festival = await fetchFestivalRow(slug);
  if (!festival) notFound();

  // Parallel: parent event, artists, runtime enrichment from the
  // official festival website. All three swallow errors → page never
  // crashes if any data source is unhappy.
  //
  // Kuratierte Spalten (data/festivals-upcoming.json, 2026-10) gehen vor:
  // trägt die Zeile Beschreibung, Bild und Preis, entfällt der Website-
  // Abruf komplett (bis zu ~7 s Latenz bei trägen Festival-Seiten).
  const curatedComplete = !!festival.description && !!festival.image_url && !!festival.price_text;
  const [parentEvent, artists, enrichment] = await Promise.all([
    fetchParentEvent(festival.parent_event_id),
    fetchArtists(festival.id),
    curatedComplete
      ? getFestivalEnrichment(null, festival.slug)
      : getFestivalEnrichment(festival.website_url, festival.slug),
  ]);

  const heroImage =
    parentEvent?.image_url
    ?? festival.image_url
    ?? enrichment.imageUrl
    ?? festivalCategoryFallback(festival.id);
  const dateRange = (festival.date_status === 'expected' ? 'voraussichtlich ' : '')
    + formatDateRange(festival.starts_at, festival.ends_at);
  const place = [festival.city, festival.state].filter(Boolean).join(' · ');
  const genreLabel = expandGenres(festival.genres);

  const description = festival.description ?? enrichment.description;
  const priceText = festival.price_text ?? enrichment.priceText;
  const enrichmentArtists = artists.length === 0 ? enrichment.artists : [];

  const parentEventHref = parentEvent && parentEvent.slug && parentEvent.start_date
    ? buildEventUrlV2({
        id: parentEvent.id,
        slug: parentEvent.slug,
        start_date: parentEvent.start_date,
        postal_code: parentEvent.postal_code,
        address: parentEvent.address,
        bundesland: parentEvent.bundesland,
        location_name: parentEvent.location_name,
      })
    : null;

  // Google Maps directions URL. Prefer parent event's address; fall back
  // to festival city + state so the Route button still has a target on
  // festivals without a linked event.
  const mapsDest = parentEvent?.address
    ? [parentEvent.address, parentEvent.location_name, parentEvent.bundesland].filter(Boolean).join(', ')
    : [festival.city, festival.state].filter(Boolean).join(', ');
  const mapsUrl = mapsDest
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDest)}`
    : null;

  // Group DB artists by billing for visual hierarchy.
  const grouped = new Map<string, FestivalArtist[]>();
  for (const a of artists) {
    const key = (a.billing as string) ?? 'unknown';
    const arr = grouped.get(key) ?? [];
    arr.push(a);
    grouped.set(key, arr);
  }
  const billingKeys = Array.from(grouped.keys()).sort(
    (a, b) => (BILLING_ORDER[a] ?? 99) - (BILLING_ORDER[b] ?? 99),
  );

  return (
    <div className="bg-[var(--v4-surface)] min-h-screen text-[var(--v4-ink)]">
      <section className="relative h-[320px] md:h-[480px] overflow-hidden">
        <V4BackButton fallback="/festivals" className="top-4 left-4 md:top-5 md:left-5"/>
        <Image
          src={heroImage}
          alt={festival.canonical_name}
          fill
          priority
          sizes="100vw"
          unoptimized
          style={{ objectFit: 'cover' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(10,10,12,0.40) 0%, rgba(10,10,12,0.10) 35%, rgba(10,10,12,0.92) 100%)',
          }}
        />
        <div className="absolute left-0 right-0 bottom-0">
          <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-5 md:py-9 flex flex-col items-start gap-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)]">
              Festival
            </p>
            <h1
              className="m-0 text-[30px] md:text-[52px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.02] max-w-[760px]"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
            >
              {festival.canonical_name}
            </h1>
            <div className="flex flex-wrap gap-3 items-center text-[13.5px] md:text-[16px] font-medium text-[var(--v4-ink-70)]">
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {dateRange}
              </span>
              {place && (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {place}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[1fr_400px] gap-8 md:gap-12">
        <div className="flex flex-col gap-10">
          {description && (
            <section>
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] mb-2">
                Worum geht&apos;s
              </h2>
              <p className="text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)] whitespace-pre-line">
                {description}
              </p>
            </section>
          )}

          {artists.length > 0 ? (
            <section>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-4">
                Line-up
              </h2>
              <div className="flex flex-col gap-6">
                {billingKeys.map(key => {
                  const list = grouped.get(key) ?? [];
                  return (
                    <div key={key}>
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] mb-2">
                        {BILLING_LABEL[key] ?? 'Line-up'}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {list.map(a => (
                          <li
                            key={a.id}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] text-[13px] text-[var(--v4-ink)]"
                          >
                            <span>{a.artist_name_raw}</span>
                            {a.day_label && (
                              <span className="text-[11px] text-[var(--v4-ink-50)]">· {a.day_label}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : enrichmentArtists.length > 0 ? (
            <section>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-3">
                Line-up
              </h2>
              <p className="text-[12px] text-[var(--v4-ink-50)] mb-3">
                Auszug von der Festival-Seite — vollständige Liste auf der offiziellen Website.
              </p>
              <ul className="flex flex-wrap gap-2">
                {enrichmentArtists.slice(0, 80).map((name, idx) => (
                  <li
                    key={`${name}-${idx}`}
                    className="inline-flex items-center rounded-full px-3 py-1.5 border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] text-[13px] text-[var(--v4-ink)]"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-3">
                Line-up
              </h2>
              <p className="text-[14px] text-[var(--v4-ink-70)]">
                Das Line-up wurde noch nicht eingelesen.
                {festival.website_url && (
                  <>
                    {' '}Schau auf der{' '}
                    <a
                      href={festival.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-[var(--v4-ink-50)] underline-offset-[3px] hover:decoration-[var(--v4-ink)]"
                    >
                      offiziellen Festival-Seite
                    </a>{' '}
                    nach.
                  </>
                )}
              </p>
            </section>
          )}
        </div>

        <aside className="order-first md:order-last md:sticky md:top-[88px] md:self-start">
          <div className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
            <div className="p-[20px_22px_22px] flex flex-col gap-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
                Festival-Info
              </p>
              <dl className="flex flex-col gap-2 text-[13.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--v4-ink-50)]">Termin</dt>
                  <dd className="text-[var(--v4-ink)] text-right">{dateRange}</dd>
                </div>
                {place && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--v4-ink-50)]">Ort</dt>
                    <dd className="text-[var(--v4-ink)] text-right">{place}</dd>
                  </div>
                )}
                {genreLabel && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--v4-ink-50)]">Genre</dt>
                    <dd className="text-[var(--v4-ink)] text-right">{genreLabel}</dd>
                  </div>
                )}
                {(artists.length > 0 || enrichmentArtists.length > 0) && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--v4-ink-50)]">Acts</dt>
                    <dd className="text-[var(--v4-ink)] text-right">
                      {artists.length > 0 ? artists.length : `~${enrichmentArtists.length}`}
                    </dd>
                  </div>
                )}
                {priceText && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--v4-ink-50)]">Preis</dt>
                    <dd className="text-[var(--v4-ink)] text-right">{priceText}</dd>
                  </div>
                )}
              </dl>

              {festival.ticket_url && (
                <a
                  href={festival.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  data-track="ticket_click"
                  data-track-id={festival.id}
                  data-track-provider={ticketProviderOf(festival.ticket_url)}
                  className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ticket)] text-[#1a1208] text-sm font-semibold"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
                  Tickets{priceText ? ` · ${priceText.replace(/^(Festivalpass|Tickets?|Eintritt)\s*/i, '')}` : ''}
                </a>
              )}

              <V4FestivalActions
                mapsUrl={mapsUrl}
                prefill={{
                  name: festival.city
                    ? `${festival.canonical_name} in ${festival.city}`
                    : festival.canonical_name,
                  plan_date: festival.starts_at ?? undefined,
                  accommodation_city: festival.city ?? '',
                }}
              />

              {festival.website_url && (
                <a
                  href={festival.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
                >
                  Offizielle Website
                </a>
              )}

              {parentEventHref && (
                <Link
                  href={parentEventHref}
                  className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]"
                >
                  Event-Detail öffnen
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
