import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { V4BackButton } from '@/components/Events/v4/V4BackButton';
import { V4FestivalActions } from '@/components/Festivals/V4FestivalActions';
import {
  BILLING_LABEL,
  deriveFestivalView,
  fetchFestivalRow,
  formatFestivalDateRange,
  loadFestivalDetail,
  ticketProviderOf,
} from '@/lib/festivals/public';

// Dynamic — slug params with non-ASCII (umlauts) were getting served
// stale 404 responses under Next's default revalidation. Forcing the
// page dynamic lets every request re-run the DB lookup against the
// freshly decoded slug.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const festival = await fetchFestivalRow(slug);
  if (!festival) return { title: 'Festival nicht gefunden — lasstreffen.at' };
  const dateRange = formatFestivalDateRange(festival.starts_at, festival.ends_at);
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

export default async function FestivalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadFestivalDetail(slug);
  if (!detail) notFound();
  const { festival, artists } = detail;
  const {
    heroImage, dateRange, place, genreLabel, description, priceText,
    enrichmentArtists, parentEventHref, mapsUrl, grouped, billingKeys,
  } = deriveFestivalView(detail);

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
