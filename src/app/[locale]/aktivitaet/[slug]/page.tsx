import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { resolveActivitySlug } from '@/lib/activities/resolver';
import {
  activityResolverStore,
  getActivityById,
} from '@/lib/activities/activity-detail-loaders';
import { activityCanonicalUrl, isActivityIndexable } from '@/lib/activities/indexability';
import type { PublicActivity } from '@/lib/activities/public-types';
import { getBundeslandById } from '@/lib/bundeslaender';
import { getGemeindeBySlug } from '@/lib/gemeinden/data';
import { ActivityHero } from '@/components/Activities/ActivityHero';
import { ActivityFacts } from '@/components/Activities/ActivityFacts';
import { ActivityMap } from '@/components/Activities/ActivityMap';
import { ActivityExtrasSlot } from '@/components/Activities/ActivityExtrasSlot';
import { OpenNowBadge } from '@/components/Activities/OpenNowBadge';

/**
 * ISR wie die Event-Detailseite (events/[...slug]/page.tsx): ohne
 * `revalidate` liefe die Route dynamic und shippt `Cache-Control:
 * private, no-store` — fatal fuer die Google-Indexierung. POI-Daten
 * aendern sich woechentlich (Ingest-Action), 1h ist grosszuegig frisch.
 */
export const revalidate = 3600;

/** ISR-Opt-in: keine Seite vorgebaut, jeder Slug beim ersten Hit gecacht. */
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

/** Zentrale Aufloesung fuer Page + Metadata (beide Laeufe treffen den
 *  unstable_cache der Loader — kein doppelter DB-Roundtrip). */
async function loadActivity(slugParam: string): Promise<
  | { kind: 'render'; activity: PublicActivity }
  | { kind: 'redirect'; slug: string }
  | { kind: 'not-found' }
> {
  if (!slugParam || slugParam.includes('/')) return { kind: 'not-found' };
  const resolution = await resolveActivitySlug(slugParam, activityResolverStore);
  if (resolution.outcome === 'redirect') return { kind: 'redirect', slug: resolution.slug };
  if (resolution.outcome === 'not-found') return { kind: 'not-found' };
  const activity = await getActivityById(resolution.id);
  return activity ? { kind: 'render', activity } : { kind: 'not-found' };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadActivity(slug);

  if (result.kind !== 'render') {
    return { title: 'Aktivität nicht gefunden', robots: { index: false, follow: false } };
  }

  const { activity } = result;
  const bundesland = getBundeslandById(activity.bundesland);
  const where = activity.town ?? bundesland?.name ?? 'Österreich';

  const rawTitle = `${activity.name} – ${where}`;
  const title = rawTitle.length > 57 ? rawTitle.slice(0, 57).trimEnd() + '…' : rawTitle;

  const descriptionSource = activity.description_short ?? activity.description;
  const description = descriptionSource
    ? descriptionSource.slice(0, 160)
    : `${activity.name} in ${where} — Öffnungszeiten, Karte und Infos auf LassTreffen.at.`;

  // E13: canonical IMMER auf die DE-URL — auch fuer /en/aktivitaet/*
  // (DE-Content auf /en), und bewusst KEIN languages/hreflang-Paar,
  // solange keine EN-Uebersetzung der Aktivitaetsinhalte existiert.
  const canonical = activityCanonicalUrl(activity.slug);

  const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title: activity.name,
      description,
      type: 'website',
      url: canonical,
    },
  };

  // Noindex-Gate (Epic E7): Thin-POIs + dauerhaft geschlossene POIs.
  if (!isActivityIndexable(activity)) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

function buildJsonLd(activity: PublicActivity): string {
  const canonical = activityCanonicalUrl(activity.slug);
  // Einheitlicher Default-Typ (Task-Spec): KEINE Typ-Verzweigung in
  // diesem Slice — deterministisch, SEO-diff-arm; Verfeinerung nach
  // Kategorie ist bewusst Follow-up.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: activity.name,
    url: canonical,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: activity.lat,
      longitude: activity.lng,
    },
    address: {
      '@type': 'PostalAddress',
      ...(activity.town ? { addressLocality: activity.town } : {}),
      addressCountry: 'AT',
    },
  };

  const description = activity.description ?? activity.description_short;
  if (description) jsonLd.description = description.slice(0, 500);

  const imageUrls = (activity.images ?? [])
    .flatMap((img) => img.urls)
    .filter((u) => typeof u === 'string' && u.trim() !== '');
  if (imageUrls.length > 0) jsonLd.image = imageUrls.slice(0, 3);

  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  // fn-17: setRequestLocale ist Pflicht, damit getTranslations im
  // statischen ISR-Pass nicht auf Request-Header zurueckfaellt (die
  // Seite wuerde sonst von static auf dynamic kippen).
  setRequestLocale(hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale);

  const result = await loadActivity(slug);

  if (result.kind === 'redirect') {
    // 301/308 auf den aktuellen kanonischen Slug (Epic E5). Bewusst die
    // DE-URL (naechster Hop des Event-Musters; /en kanonisiert eh auf DE).
    permanentRedirect(`/aktivitaet/${result.slug}`);
  }
  if (result.kind === 'not-found') {
    notFound();
  }

  const { activity } = result;
  const t = await getTranslations('Activity');

  const bundesland = getBundeslandById(activity.bundesland);
  const gemeinde = activity.gemeinde_slug ? getGemeindeBySlug(activity.gemeinde_slug) : null;
  const jsonLd = buildJsonLd(activity);

  const hasOpening = (activity.opening_times?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <ActivityHero
        name={activity.name}
        town={activity.town}
        bundeslandLabel={bundesland?.name ?? null}
        tags={activity.tags}
        images={activity.images}
        closedLabel={activity.is_closed ? t('permanentlyClosed') : null}
        imageCreditPrefix={t('imageCredit')}
      >
        {/* "Jetzt geoeffnet" client-seitig (Europe/Vienna, Epic E8) —
            die ISR-Seite bleibt statisch korrekt. Nicht rendern fuer
            geschlossene POIs oder ohne normalisierte Zeiten. */}
        {hasOpening && !activity.is_closed && (
          <OpenNowBadge
            openingTimes={activity.opening_times}
            labels={{ open: t('openNow'), closed: t('closedNow') }}
          />
        )}
      </ActivityHero>

      <ActivityFacts activity={activity} gemeindeName={gemeinde?.name ?? null} />

      <ActivityMap name={activity.name} lat={activity.lat} lng={activity.lng} />

      {/* Slot-Contract fuer Task 4 (Events in der Naehe) — hier leer. */}
      <ActivityExtrasSlot activity={activity} />
    </div>
  );
}
