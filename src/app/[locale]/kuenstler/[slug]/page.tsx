/**
 * Künstlerseite /kuenstler/[slug] (2026-11, Folge der Plakatwand): ein
 * Künstler aus dem Verzeichnis (getArtistsDirectoryCached, dieselbe
 * Stunden-Kopie wie /artists), alle Termine in Österreich mit Event-Link
 * und Ticketlink, Künstler derselben Spielart, Folgen als Client-Insel.
 *
 * ISR wie die Event-Detailseite: ohne `revalidate` liefe die Route
 * dynamic und shippt `Cache-Control: private, no-store`. Keine Seite
 * vorgebaut, jeder Slug beim ersten Aufruf; unbekannte Slugs 404.
 * Führt der Feed einen Künstler unter mehreren IDs, vereint `artistBySlug`
 * die Termine. JSON-LD: Person bzw. MusicGroup mit den Terminen als Event.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ArtistPageClient } from '@/components/Artists/v4/ArtistPageClient';
import { artistBySlug, relatedArtists, type DirectoryArtist } from '@/lib/artists/directory';
import { getArtistsDirectoryCached } from '@/lib/artists/get-artists-directory';
import { SITE_URL, bilingualAlternates } from '@/lib/seo/canonical';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { EVENT_TZ } from '@/lib/utils/event-time';

export const revalidate = 3600;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

async function loadArtist(slug: string): Promise<{ artist: DirectoryArtist; all: DirectoryArtist[]; today: string } | null> {
  if (!slug || slug.includes('/') || slug.length > 120) return null;
  const directory = await getArtistsDirectoryCached();
  const artist = artistBySlug(directory.artists, slug);
  return artist ? { artist, all: directory.artists, today: directory.today } : null;
}

function firstDate(artist: DirectoryArtist, locale: string): string {
  const e = artist.events[0];
  if (!e) return '';
  return new Date(e.start_date).toLocaleDateString(locale === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'long', timeZone: EVENT_TZ });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Artists' });
  const result = await loadArtist(slug);
  if (!result) return { title: t('notFound'), robots: { index: false, follow: false } };

  const { artist } = result;
  const count = artist.events.length;
  const first = firstDate(artist, locale);
  const description = count === 1
    ? t('pageMetaDescriptionOne', { name: artist.name, first })
    : t('pageMetaDescription', { name: artist.name, count, first });
  const alternates = bilingualAlternates(`/kuenstler/${artist.slug}`, locale);
  return {
    title: t('pageMetaTitle', { name: artist.name }),
    description,
    alternates,
    openGraph: {
      title: artist.name,
      description,
      type: 'profile',
      url: alternates.canonical,
      ...(artist.image ? { images: [{ url: artist.image }] } : {}),
    },
  };
}

function buildJsonLd(artist: DirectoryArtist): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': artist.kind === 'konzert' || artist.kind === 'klassik' ? 'MusicGroup' : 'Person',
    name: artist.name,
    url: `${SITE_URL}/kuenstler/${artist.slug}`,
    ...(artist.image ? { image: artist.image } : {}),
    event: artist.events.map(e => ({
      '@type': 'Event',
      name: e.title,
      startDate: e.start_date,
      url: `${SITE_URL}${buildEventUrlV2(e)}`,
      ...(e.location_name
        ? {
            location: {
              '@type': 'Place',
              name: e.location_name,
              ...(e.city || e.postal_code
                ? { address: { '@type': 'PostalAddress', ...(e.city ? { addressLocality: e.city } : {}), ...(e.postal_code ? { postalCode: e.postal_code } : {}), addressCountry: 'AT' } }
                : {}),
            },
          }
        : {}),
      ...(e.ticket_url ? { offers: { '@type': 'Offer', url: e.ticket_url, availability: 'https://schema.org/InStock' } } : {}),
    })),
  };
  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}

export default async function ArtistPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Artists' });

  const result = await loadArtist(slug);
  if (!result) notFound();
  const { artist, all, today } = result;
  const related = relatedArtists(all, artist, 6);
  const updated = new Date(`${today}T12:00:00Z`).toLocaleDateString(locale === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });

  return (
    <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(artist) }} />
      <div className="mx-auto max-w-[760px] px-4 pb-24 pt-5 md:px-14 md:pt-7">
        <Link href="/artists" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">
          ‹ {t('pageBack')}
        </Link>
        <div className="mt-5">
          <ArtistPageClient artist={artist} related={related} />
        </div>
        <p className="mt-3 text-[12px] text-[var(--v4-ink-50)]">{t('pageUpdated', { date: updated })}</p>
      </div>
    </main>
  );
}
