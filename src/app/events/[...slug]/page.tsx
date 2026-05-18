import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Event } from '@/types/events';
import { extractCity } from '@/lib/utils/city';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { V4EventDetail } from '@/components/Events/v4';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import {
  parseSlugArray,
  resolveEvent,
  getEventByShortId,
  getVenue,
  getLineupForEvent,
} from '@/lib/events/event-detail-loaders';

/**
 * ISR revalidation interval.
 *
 * Without this export Next.js renders the page on every request as a pure
 * dynamic route, which makes it ship `Cache-Control: private, no-store,
 * no-cache, max-age=0` — fatal for Google indexing (we observed 9 of 45 656
 * pages actually indexed in Search Console because of this).
 *
 * 3600s (1h) is a safe compromise: event data updates once per scraper-cycle
 * (every few hours), and stale-while-revalidate keeps served pages fast while
 * the first visit after expiry triggers a silent re-render.
 */
export const revalidate = 3600;

/**
 * ISR opt-in for on-demand generation. Empty `generateStaticParams()` plus
 * `dynamicParams = true` is the "ISR" pattern — zero pages pre-built, each
 * unique slug cached on first hit and served from CDN on subsequent hits
 * for `revalidate` seconds. Side-effect: Next.js ships
 * `Cache-Control: public, max-age=0, must-revalidate` + the
 * `X-Nextjs-Prerender: 1` header that Googlebot needs to index the page.
 */
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug: slugArr } = await params;

  // Mirror the page-handler guard: malformed bot URLs return generic
  // metadata so we never feed garbage segments into resolveEvent().
  if (!slugArr || slugArr.length === 0 || slugArr.some(s => !s || s.includes('/'))) {
    return { title: 'Event nicht gefunden', robots: { index: false, follow: false } };
  }

  const event = await resolveEvent(parseSlugArray(slugArr));

  if (!event) {
    return { title: 'Event nicht gefunden' };
  }

  // Suppressed, needs_review, or duplicate events should not be indexable
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed' || event.publish_status === 'duplicate') {
    return {
      title: 'Event nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const description = event.description
    ? event.description.slice(0, 160)
    : `${event.title} — ${event.location_name ?? 'Österreich'}`;

  // Canonical URL always uses the V2 schema — Google consolidates signals on
  // this form regardless of which URL the client originally requested.
  const canonicalPath = buildEventUrlV2(event);
  const canonicalUrl = `https://lasstreffen.at${canonicalPath}`;
  // OG image moved to an API route because Next.js forbids metadata files
  // (like opengraph-image.tsx) inside catch-all route segments. The image
  // is cacheable by the shortId alone — no need to include the full slug.
  const ogImageUrl = `https://lasstreffen.at/api/og/event/${event.id.slice(0, 8)}`;

  // Truncate overly long event titles so Bing/Google don't flag them as
  // "Title too long". Cut at 57 chars (room for " …") so the rendered
  // absolute title stays ≤ 60.
  const titleTrimmed = event.title.length > 57
    ? event.title.slice(0, 57).trimEnd() + '…'
    : event.title;

  const metadata: Metadata = {
    // `absolute` bypasses the layout template " | LassTreffen.at" suffix.
    // Event titles + suffix regularly exceed 60 chars and Bing flags them.
    title: { absolute: titleTrimmed },
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [ogImageUrl],
    },
  };

  // Low-confidence events: noindex
  if (event.publish_status === 'published_low_confidence') {
    metadata.robots = { index: false, follow: false };
  }

  // Quality-gated SEO: noindex events with very low quality score
  if (
    event.quality_score !== undefined &&
    event.quality_score !== null &&
    event.quality_score < 30
  ) {
    metadata.robots = { index: false, follow: false };
  }

  // Non-published events should not be indexed
  if (
    event.publish_status &&
    event.publish_status !== 'published' &&
    event.publish_status !== 'published_low_confidence'
  ) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

/**
 * Extracts a numeric price from free-text like "ab 15 €", "€12,50", "Tickets 25 EUR".
 * Returns '0' for free events (frei/gratis/kostenlos), null when no price is detectable.
 */
function parsePriceText(priceText: string | null | undefined): string | null {
  if (!priceText) return null;
  const lower = priceText.toLowerCase();
  if (/\b(frei|gratis|kostenlos|free|eintritt\s*frei)\b/.test(lower)) return '0';
  const match = priceText.match(/(\d+(?:[.,]\d+)?)/);
  return match ? match[1].replace(',', '.') : null;
}

function buildJsonLd(event: Event): string {
  const canonicalUrl = `https://lasstreffen.at${buildEventUrlV2(event)}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };

  if (event.end_date) {
    jsonLd.endDate = event.end_date;
  }

  if (event.description) {
    jsonLd.description = event.description.slice(0, 500);
  }

  // Use resolver so JSON-LD always has an image (category fallback if needed)
  jsonLd.image = resolvePrimaryEventImage({ imageUrl: event.image_url, category: event.category, title: event.title });

  const locationName = event.location_name ?? event.address ?? 'Österreich';
  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: locationName,
  };

  if (event.address) {
    location.address = {
      '@type': 'PostalAddress',
      streetAddress: event.address,
      ...(event.postal_code ? { postalCode: event.postal_code } : {}),
      addressCountry: 'AT',
    };
  }

  if (event.latitude != null && event.longitude != null) {
    location.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }

  jsonLd.location = location;

  // Organizer — ALWAYS present. Falls back to the site when the scraper
  // didn't capture an explicit organizer. Satisfies Google's Event rich-result
  // field requirement ("fehlende Felder: organizer") even on scraped rows
  // where the source page didn't expose one.
  jsonLd.organizer = {
    '@type': 'Organization',
    name: event.organizer || 'LassTreffen.at',
    url: 'https://lasstreffen.at',
  };

  // Performer — ALWAYS present. Google's Event schema treats `performer` as a
  // recommended field; omitting it triggers the "Ereignisse für strukturierte
  // Daten" warning in Search Console. We use the organizer when known,
  // otherwise fall back to the event title itself as the performing entity.
  jsonLd.performer = {
    '@type': 'PerformingGroup',
    name: event.organizer || event.title,
  };

  // Offers — nur emitten wenn ein Preis bekannt ist. Google's Event-Schema
  // verlangt bei `offers` zwingend ein `price` (oder lowPrice/highPrice).
  // Vorher hatten wir den Offer-Block immer ausgegeben und `price` nur
  // bedingt — das produzierte ~2.280 GSC-Fehler "Feld 'price' fehlt".
  // Lieber kein Offer-Block (Google ignoriert ihn dann) als ein invalider.
  const parsed = parsePriceText(event.price_text);
  const price =
    event.price_min != null ? String(event.price_min) :
    parsed != null ? parsed :
    null;

  if (price != null) {
    const offers: Record<string, unknown> = {
      '@type': 'Offer',
      url: event.ticket_url || canonicalUrl,
      priceCurrency: 'EUR',
      price,
      availability: 'https://schema.org/InStock',
      validFrom: event.created_at || event.start_date,
    };
    if (event.price_text) {
      offers.name = event.price_text;
    }
    jsonLd.offers = offers;
  }

  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: slugArr } = await params;

  // Defensive: Bots/Crawler treffen uns mit URLs deren `/` als `%2F`
  // encoded sind (alle drei V3-Segmente in einem zusammengeschmolzen).
  // Next.js liefert das als slug.length === 1 mit eingebetteten Slashes.
  // Diese URLs gibt es nicht in der DB — 404 statt 500.
  if (!slugArr || slugArr.length === 0 || slugArr.some(s => !s || s.includes('/'))) {
    notFound();
  }

  const event = await resolveEvent(parseSlugArray(slugArr));

  if (!event) {
    notFound();
  }

  // ─── Duplicate redirect — bulletproof chain to the primary ─────────
  //
  // Historical bug: this block used to do
  //   permanentRedirect(`/events/${event.duplicate_of}`)
  // which emits the PRIMARY's UUID URL. On the next hop our canonical
  // redirect kicks the request to `/events/{plz-ort}/{date}/{slug}`.
  // If `getEventBySlugAndDate` returns THIS duplicate row back (common
  // when dedup left both rows with the same score + slug + date), the
  // duplicate redirect fires again → UUID form → loop forever.
  //
  // Fix: resolve duplicate_of to its primary event row here, then
  // redirect directly to the primary's canonical V3 URL. Skipping the
  // UUID hop eliminates the ping-pong entirely.
  if (event.publish_status === 'duplicate' && event.duplicate_of) {
    if (event.duplicate_of === event.id) {
      notFound();
    }
    const primary = await getEventByShortId(event.duplicate_of);
    if (!primary || primary.publish_status === 'duplicate') {
      notFound();
    }
    permanentRedirect(buildEventUrlV2(primary));
  }

  // Hide suppressed/needs_review events from public access
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    notFound();
  }

  // 308 Permanent Redirect to canonical V3 URL whenever the current path
  // isn't canonical. Covers legacy 1-segment, full-UUID, and V2-old URLs.
  // Using 308 (not 307) because Next.js 16 ISR serialises 307 redirects to
  // a `<meta refresh>` rather than a real HTTP status.
  //
  // Past events: skip the redirect chain entirely. If a Google-indexed
  // legacy URL points to a past event whose canonical now differs (e.g.
  // postal_code or start_date got re-scraped), redirecting can land us
  // in a route whose ISR cache holds a stale 500 from the deploy
  // boundary. For events that already happened we just notFound() —
  // Google drops the URL from the index cleanly and we don't keep a
  // 500 alive forever in the edge cache.
  const canonicalPath = buildEventUrlV2(event);
  const currentPath = `/events/${slugArr.join('/')}`;
  const eventEnd = event.end_date || event.start_date;
  const isPast = eventEnd ? new Date(eventEnd).getTime() < Date.now() - 24 * 60 * 60 * 1000 : false;
  if (currentPath !== canonicalPath) {
    if (isPast) {
      notFound();
    }
    permanentRedirect(canonicalPath);
  }

  // Phase 3 (v4 redesign): we no longer load friendsData here — Friends
  // were intentionally removed from the event detail per chat2 brief
  // (Friends belong to Plan context, Phase 5). Venue + lineup still load
  // in parallel because Phase 3.1 will surface them; for now they're
  // unused but the queries are cheap.
  //
  // Personal context (saved/match overlay, matchedArtistName) is NOT
  // loaded here: this page runs as ISR (`revalidate=3600`) so any
  // cookies()-touching call would trigger
  //   "Page changed from static to dynamic at runtime, reason: cookies"
  // and 500 the response (Vercel runtime logs, 17.+18. Mai 2026).
  // The personal overlay is instead fetched client-side by
  // V4EventDetail via /api/events/[id]/personal-context. The server-
  // rendered HTML reflects the anon-view state derivation below.
  await Promise.all([
    event.venue_id ? getVenue(event.venue_id) : Promise.resolve(null),
    getLineupForEvent(event.id),
  ]);

  const state = deriveEventState(event, {
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  });

  // Best-effort ticket meta inferred from event row. The fields are loose
  // strings; V4SideBox falls back to UnknownBox if any are missing.
  const provider = event.source_name ?? undefined;
  const priceFrom =
    event.price_min != null ? `€ ${event.price_min}` :
    event.price_text ?? undefined;
  const priceAtDoor = event.price_text ?? undefined;

  // Only emit JSON-LD for fully published events (skip low confidence)
  const jsonLd = event.publish_status !== 'published_low_confidence' ? buildJsonLd(event) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <V4EventDetail
        event={event}
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        priceAtDoor={priceAtDoor}
      />
    </>
  );
}
