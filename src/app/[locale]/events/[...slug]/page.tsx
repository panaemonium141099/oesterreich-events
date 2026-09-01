import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import type { Event } from '@/types/events';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { buildJsonLd } from '@/lib/seo/event-jsonld';
import { V4PastEventNotice } from '@/components/Events/v4/V4PastEventNotice';
import { V4EventDetail } from '@/components/Events/v4';
import { V4RelatedEvents, hubLinksFor } from '@/components/Events/v4/V4RelatedEvents';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import {
  parseSlugArray,
  resolveEvent,
  getSuccessorEvent,
  getEventByShortId,
  getVenue,
  getLineupForEvent,
} from '@/lib/events/event-detail-loaders';
import { getOrTranslateEventEn } from '@/lib/i18n/translate-event';

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
// 3600 -> 86400 (2026-08-26): Googlebot crawlt seit dem Sitemap-Fix ~87k
// Event-URLs; jeder ISR-MISS kostet ~7 Queries auf der Micro-Instanz.
// Mit 24 h Cache-Lebensdauer zahlt jede URL das hoechstens 1x/Tag —
// Eventdaten aendern sich langsamer als das.
export const revalidate = 86400;

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
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug: slugArr } = await params;

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

  // ─── fn-17 Slice 3: EN-Metadata NUR aus dem DB-Cache ────────────────
  // generateMetadata übersetzt bewusst NICHT selbst (kein doppelter
  // Gemini-Call pro Request) — beim allerersten /en-Aufruf sind die
  // Meta-Texte noch deutsch; ab dem nächsten ISR-Zyklus (1h) greift der
  // Cache und Titel/Description/hreflang sind englisch.
  const isEn = rawLocale === 'en';
  const enCached = !!event.title_en;
  const displayTitle = isEn && enCached ? event.title_en! : event.title;
  const displayDescriptionSource =
    isEn && enCached ? event.description_en : event.description;

  const description = displayDescriptionSource
    ? displayDescriptionSource.slice(0, 160)
    : `${displayTitle} — ${event.location_name ?? (isEn ? 'Austria' : 'Österreich')}`;

  // Canonical URL always uses the V2 schema — Google consolidates signals on
  // this form regardless of which URL the client originally requested.
  // EN: eigene /en-Canonical NUR wenn die Übersetzung existiert; solange
  // die EN-Seite deutschen Text zeigt, kanonisiert sie auf die DE-URL
  // (kein Duplicate-Content-Signal auf 45k URLs).
  const canonicalPath = buildEventUrlV2(event);
  const deUrl = `https://lasstreffen.at${canonicalPath}`;
  const enUrl = `https://lasstreffen.at/en${canonicalPath}`;
  const canonicalUrl = isEn && enCached ? enUrl : deUrl;
  const languageAlternates = enCached
    ? { 'de-AT': deUrl, en: enUrl, 'x-default': deUrl }
    : undefined;
  // OG image moved to an API route because Next.js forbids metadata files
  // (like opengraph-image.tsx) inside catch-all route segments. The image
  // is cacheable by the shortId alone — no need to include the full slug.
  const ogImageUrl = `https://lasstreffen.at/api/og/event/${event.id.slice(0, 8)}`;

  // Truncate overly long event titles so Bing/Google don't flag them as
  // "Title too long". Cut at 57 chars (room for " …") so the rendered
  // absolute title stays ≤ 60.
  const titleTrimmed = displayTitle.length > 57
    ? displayTitle.slice(0, 57).trimEnd() + '…'
    : displayTitle;

  const metadata: Metadata = {
    // `absolute` bypasses the layout template " | LassTreffen.at" suffix.
    // Event titles + suffix regularly exceed 60 chars and Bing flags them.
    title: { absolute: titleTrimmed },
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: languageAlternates,
    },
    openGraph: {
      title: displayTitle,
      description,
      type: 'article',
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: displayTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale: rawLocale, slug: slugArr } = await params;

  // fn-17: setRequestLocale ist Pflicht, damit die next-intl-RSC-Aufrufe
  // (getTranslations/getLocale in V4RelatedEvents) im statischen ISR-Pass
  // NICHT auf Request-Header zurückfallen — das würde die Seite von
  // static auf dynamic kippen (gleicher Mechanismus wie der cookies()-
  // Kommentar weiter unten; Muster aus src/app/[locale]/layout.tsx).
  setRequestLocale(hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale);

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
    // Vergangene Events: KEIN Redirect (der Kommentar oben erklaert die
    // Loop-/Stale-Gefahr) — aber auch kein notFound() mehr. Messung
    // 2026-09-01: 14 der 47 impressionsstaerksten Event-URLs lieferten
    // 404 (8.800 Impressions/Woche, Positionen 4-6), weil sich ihr
    // kanonischer Pfad nach dem Event geaendert hatte (Bezirks-Mapping,
    // Datums-Korrektur). Wir rendern die Seite jetzt normal; das
    // canonical-Tag zeigt ohnehin auf canonicalPath, also entsteht kein
    // Duplicate-Content-Signal, und der Besucher landet auf Inhalt statt
    // auf einer Sackgasse.
    if (!isPast) {
      permanentRedirect(canonicalPath);
    }
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

  // SEO-Fix 2026-09-01: vergangene Seiten behalten ihr Ranking — statt sie
  // ins Leere laufen zu lassen, suchen wir die naechste Ausgabe (nur dann
  // eine zusaetzliche, indexierte Query).
  const successor = isPast
    ? await getSuccessorEvent(event.slug ?? null, event.title, event.location_name ?? null)
    : null;

  // ─── fn-17 Slice 3: Lazy-Übersetzung für die /en-Ansicht ───────────
  // Cache-Hit aus der DB (title_en/description_en) oder EIN Gemini-Call
  // mit Write-back; jeder Fehler degradiert still auf Deutsch. Die ISR-
  // Variante der /en-URL cached das Ergebnis zusätzlich (revalidate=3600).
  const translation =
    rawLocale === 'en' ? await getOrTranslateEventEn(event) : null;
  const displayEvent: typeof event = translation
    ? {
        ...event,
        title: translation.title_en ?? event.title,
        description: translation.description_en ?? event.description,
      }
    : event;

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

  // Only emit JSON-LD for fully published events (skip low confidence).
  // displayEvent: auf der /en-URL stehen Name/Beschreibung übersetzt im Schema.
  const jsonLd = event.publish_status !== 'published_low_confidence' ? buildJsonLd(displayEvent) : null;

  // BreadcrumbList-Schema: Home → Bundesland-Hub → Gemeinde-Hub → Event.
  // Nutzt dieselben verifizierten Hub-Links wie die sichtbare
  // "Mehr entdecken"-Zeile in V4RelatedEvents (kein Link auf nicht
  // existierende Hubs). Interne Verlinkung für Google (MASTERPLAN §8.1).
  const hubs = hubLinksFor(event);
  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      ...hubs.map((h, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: h.label.replace(/^Events in /, ''),
        item: `https://lasstreffen.at${h.href}`,
      })),
      { '@type': 'ListItem', position: hubs.length + 2, name: displayEvent.title },
    ],
  }).replace(/<\/script>/gi, '<\\/script>');

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      {isPast && (
        <V4PastEventNotice eventEnd={eventEnd!} successor={successor} />
      )}
      <V4EventDetail
        event={displayEvent}
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        priceAtDoor={priceAtDoor}
      />
      <V4RelatedEvents event={event}/>
    </>
  );
}
