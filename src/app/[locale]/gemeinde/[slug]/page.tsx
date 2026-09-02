/**
 * Gemeinde hub page — `/gemeinde/{plz}-{slug}`
 *
 * Part of fn-13 phase 2. Generates one indexable hub page per Austrian
 * municipality (~2 028 URLs from data/gemeinden-registry). Each hub
 * shows upcoming events in a 10 km radius around the village centre,
 * plus links to neighbour municipalities.
 *
 * SEO wiring:
 *   - Full static prerender list via `generateStaticParams` so ISR kicks
 *     in for all 2k slugs without cold-start penalty.
 *   - 1-hour `revalidate` keeps event counts / featured events fresh.
 *   - JSON-LD: `Place` for the gemeinde, `ItemList` for the events,
 *     `BreadcrumbList` for the nav.
 *   - Low-content guard: <3 events → `robots: noindex` + prominent
 *     neighbour-gemeinden list so the page still has some utility for
 *     a human visitor but doesn't pollute Google's index as thin content.
 *
 * fn-18 Task 4 — Mixed-Content-Modell: die Seite zeigt zusätzlich eine
 * "Freizeit & Ausflüge"-Sektion (poi_activities, ≥3 Aktivitäten im
 * Radius). Gate, Copy (4 Fälle) und JSON-LD leben als pure Helper in
 * src/lib/hubs/gemeinde-hub-content.ts; das Indexierungs-Gate ist jetzt
 * (Events ≥ 3 ODER Aktivitäten ≥ 3) — in generateMetadata (robots) UND
 * im Page-Body über dieselbe hubIsIndexable()-Regel.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

import {
  ALL_GEMEINDEN,
  bboxAround,
  findNeighbourGemeinden,
  getGemeindeBySlug,
  haversineKm,
  type AustrianGemeinde,
} from '@/lib/gemeinden/data';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import {
  buildGemeindeHubJsonLd,
  buildHubMeta,
  HUB_MIN_ACTIVITIES,
  hubActivityHeroLead,
  hubContentMode,
  hubDefaultH1,
  hubExperimentAllowed,
  hubIsIndexable,
  hubMixedHeroLead,
  slugifyBundesland,
} from '@/lib/hubs/gemeinde-hub-content';
import { loadNearbyActivitiesCached } from '@/lib/activities/nearby-loaders';
import { TourBox } from '@/components/Affiliate/TourBox';
import { GemeindeActivitiesSection } from '@/components/Activities/NearbyActivitiesSection';
import { loadNearbyOsmPoisCached } from '@/lib/osm/nearby-pois';
import { GemeindeOsmPoisSection } from '@/components/Osm/OsmPoisSection';
import { resolveExperimentForScope } from '@/lib/seo/experiments-server';
import { ExperimentImpressionLogger } from '@/components/SEO/ExperimentImpressionLogger';
import { getHubIntro } from '@/lib/seo/hub-refresh';
import { getCityHub } from '@/lib/hubs/city-hubs';
import { HubSearchCTA } from '@/components/Hub/HubSearchCTA';
import { HubSmartCTA } from '@/components/Hub/HubSmartCTA';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // On-demand ISR — was returning ALL_GEMEINDEN.map(g => ({ slug })),
  // but each of the 2k pre-builds queries Supabase, and a single
  // outage was failing the entire deploy. Empty list = no pre-build,
  // each gemeinde renders + caches on first visit. The slug list is
  // still the universe of VALID URLs (validated inside the page
  // handler via getGemeindeBySlug).
  return [];
}

// ───────────────────────────────────────────────────────────────────────
// Data loading — nearby events inside a bbox, cached per gemeinde
// ───────────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface NearbyEvent {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  image_url: string | null;
  price_text: string | null;
  event_score: number | null;
  _distance_km?: number;
}

const loadNearbyEventsCached = unstable_cache(
  async (lat: number, lng: number, radiusKm: number): Promise<NearbyEvent[]> => {
    const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, latitude, longitude, category, image_url, price_text, event_score')
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .gte('latitude', minLat).lte('latitude', maxLat)
      .gte('longitude', minLng).lte('longitude', maxLng)
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(60);

    if (error || !data) return [];

    // Filter by actual haversine distance (bbox is rectangular, circle
    // is tighter). Keep only within radius.
    return (data as NearbyEvent[])
      .map(e => {
        if (e.latitude == null || e.longitude == null) return null;
        const d = haversineKm(lat, lng, e.latitude, e.longitude);
        if (d > radiusKm) return null;
        return { ...e, _distance_km: d };
      })
      .filter((x): x is NearbyEvent & { _distance_km: number } => x !== null);
  },
  ['gemeinde-nearby-events'],
  { revalidate: 3600, tags: ['event', 'gemeinde'] },
);

async function loadNearbyEvents(g: AustrianGemeinde): Promise<NearbyEvent[]> {
  // Cities sprawl wider than villages — widen the radius for city hubs so a
  // Linz/Graz page actually covers the metro area, not just the centre.
  const radiusKm = getCityHub(g.slug)?.radiusKm ?? 10;
  return loadNearbyEventsCached(g.lat, g.lng, radiusKm);
}

/**
 * fn-18 Task 4 — Aktivitäten im selben Radius wie die Events. WICHTIG:
 * generateMetadata und Page rufen den geteilten unstable_cache-Loader
 * über DIESEN Wrapper mit identischen Args auf — ein DB-Roundtrip pro
 * Gemeinde und Revalidate-Fenster (gleiches Muster wie loadNearbyEvents).
 */
function loadNearbyActivities(g: AustrianGemeinde) {
  const radiusKm = getCityHub(g.slug)?.radiusKm ?? 10;
  return loadNearbyActivitiesCached(g.lat, g.lng, radiusKm);
}

/**
 * fn-18 Task 7 — OSM-Ausflugsziele im selben Radius, ABER strikt getrennt
 * geladen und gerendert (eigene Tabelle, eigene Sektion, eigene ODbL-
 * Attribution; kein Merge/Dedup gegen `activities`). Bewusst NICHT in
 * generateMetadata: Title/Description/Indexierbarkeit des Hubs haengen am
 * eigenen Bestand — ODbL-Fremddaten sollen die Seiten-Signale nicht tragen.
 */
function loadNearbyOsmPois(g: AustrianGemeinde) {
  const radiusKm = getCityHub(g.slug)?.radiusKm ?? 10;
  return loadNearbyOsmPoisCached(g.lat, g.lng, radiusKm);
}

// ───────────────────────────────────────────────────────────────────────
// Metadata
// ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGemeindeBySlug(slug);
  if (!g) return { title: 'Gemeinde nicht gefunden' };

  const [events, activities] = await Promise.all([
    loadNearbyEvents(g),
    loadNearbyActivities(g),
  ]);
  const count = events.length;
  const activityCount = activities.length;

  // Mixed-Content-Copy (fn-18 Task 4, 4 Fälle) — für die Fälle
  // event-only/empty byte-identisch zur bisherigen Copy ("124 Events in
  // Eisenstadt — heute und diese Woche. …"), sonst Aktivitäts- bzw.
  // kombinierte Copy. Logik + Tests: src/lib/hubs/gemeinde-hub-content.ts.
  // City hubs get a search-intent-matched title ("Veranstaltungen in Linz
  // 2026 — N Events"): no PLZ (nobody searches "events linz 4020") and the
  // year baked in (the GSC data shows "<event> 2026" is how people search).
  const cityHub = getCityHub(g.slug);
  const { title: defaultTitle, description } = buildHubMeta({
    name: g.name,
    bezirk: g.bezirk ?? null,
    plz: g.plz,
    bundesland: g.bundesland,
    eventCount: count,
    activityCount,
    isCityHub: !!cityHub,
    year: new Date().getFullYear(),
  });

  // Resolve the A/B experiment (if one is running for 'gemeinde' scope).
  // Override the title ONLY when the variant explicitly provides a
  // title_template — otherwise fall through to the default below. Kept
  // local to generateMetadata so the page component can compute its
  // own variant for the H1 without a second DB call (cache handles it).
  // fn-18: Overrides gelten NUR im event-only-Fall (a) — weder Mixed-/
  // Aktivitäts-Copy (b/c) noch leere noindex-Hubs (d) dürfen von stale
  // Event-Varianten überschrieben werden (Contract-Erweiterung Follow-up).
  const experiment = hubExperimentAllowed(count, activityCount)
    ? await resolveExperimentForScope('gemeinde', {
        name: g.name,
        count,
        plz: g.plz,
        bundesland: g.bundesland,
      })
    : null;
  const title = experiment?.payload.title ?? defaultTitle;
  const canonicalUrl = `https://lasstreffen.at/gemeinde/${g.slug}`;

  const metadata: Metadata = {
    title: { absolute: title.length > 60 ? title.slice(0, 57).trimEnd() + '…' : title },
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: { card: 'summary', title, description },
  };

  // Low-content guard — a silent gemeinde shouldn't bloat the index with
  // thin pages. Keep it crawlable (follow) so Google can still discover
  // links to neighbour gemeinden, but noindex the page. fn-18: kombinierte
  // Regel (Events ≥ 3 ODER Aktivitäten ≥ 3) ⇒ indexierbar — dieselbe
  // hubIsIndexable()-Funktion steuert auch den Page-Body.
  if (!hubIsIndexable(count, activityCount)) {
    metadata.robots = { index: false, follow: true };
  }

  return metadata;
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

// JSON-LD + slugifyBundesland leben seit fn-18 Task 4 als pure Helper in
// src/lib/hubs/gemeinde-hub-content.ts (Mixed-Modell: Event-ItemList nur
// bei Events, Aktivitäten-ItemList ab ≥3, FAQ nach den 4 Content-Fällen).

export default async function GemeindeHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = getGemeindeBySlug(slug);
  if (!g) notFound();

  const [events, activities, osmPois] = await Promise.all([
    loadNearbyEvents(g),
    loadNearbyActivities(g),
    loadNearbyOsmPois(g),
  ]);
  const neighbours = findNeighbourGemeinden(g, 8);
  const jsonLd = buildGemeindeHubJsonLd(g, events, activities);

  // fn-13 phase 10 — A/B title experiment. `resolveExperimentForScope`
  // returns null when no experiment is running for 'gemeinde' scope
  // (normal case), so this call is a zero-cost in-memory lookup for
  // most renders. When a live experiment exists it emits the chosen
  // variant's title + heading_prefix and an impression-logger island
  // that fires once on mount. Time-based variant picking keeps ISR
  // deterministic within a period. See src/lib/seo/experiments.ts.
  // fn-18: wie in generateMetadata NUR im event-only-Fall (a) —
  // Mixed-/Aktivitäts-H1s und leere Hubs bleiben ohne Event-Varianten.
  const experiment = hubExperimentAllowed(events.length, activities.length)
    ? await resolveExperimentForScope('gemeinde', {
        name: g.name,
        count: events.length,
        plz: g.plz,
        bundesland: g.bundesland,
      })
    : null;

  const cityHub = getCityHub(g.slug);
  // Content-Fall der Seite (a/b/c/d) — steuert Hero-Copy + H1 (Review-
  // Finding: Fall (b) mit 1-2 Rest-Events und Fall (c) dürfen nicht im
  // alten Event-Intro landen).
  const mode = hubContentMode(events.length, activities.length);
  const h1Text = experiment?.payload.heading_prefix
    ? `${experiment.payload.heading_prefix} ${g.name}`
    : hubDefaultH1({
        name: g.name,
        eventCount: events.length,
        activityCount: activities.length,
        isCityHub: !!cityHub,
      });

  // fn-13 phase 10 — rotating intro paragraph. The monthly content-
  // refresh cron picks top-traffic hubs and increments their
  // `intro_variant_index`, cycling through the curated pool in
  // `src/lib/seo/intro-pool.ts`. Freshness signal to Google without
  // rewriting everything by hand.
  const { intro: introParagraph } = await getHubIntro('gemeinde', `/gemeinde/${g.slug}`, {
    name: g.name,
    count: events.length,
    plz: g.plz,
    bundesland: g.bundesland,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {experiment && (
        <ExperimentImpressionLogger
          experimentId={experiment.experimentId}
          variant={experiment.variant}
          path={`/gemeinde/${g.slug}`}
        />
      )}
      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white/80">Home</Link>
            <span className="mx-2">›</span>
            <Link href={`/${slugifyBundesland(g.bundesland)}`} className="hover:text-white/80">
              {g.bundesland}
            </Link>
            <span className="mx-2">›</span>
            <span>{g.name}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {h1Text}
            </h1>
            <p className="text-white/60">
              {g.plz} {g.name}
              {g.bezirk ? ` · Bezirk ${g.bezirk}` : ''}
              {' · '}{g.bundesland}
            </p>
            {cityHub ? (
              mode === 'mixed' || mode === 'activities' ? (
                // fn-18 (Review Runde 3): auch City-Hubs folgen dem
                // Content-Fall — die Mixed-/Aktivitäts-Copy ERSETZT das
                // kuratierte Event-Intro als Hauptinhalt (das kuratierte
                // Intro bleibt den event-only/empty-Fällen vorbehalten).
                <p className="mt-3 text-white/80 leading-relaxed max-w-2xl">
                  {mode === 'mixed'
                    ? hubMixedHeroLead(g.name, events.length, activities.length)
                    : hubActivityHeroLead(g.name, activities.length)}
                </p>
              ) : (
                <>
                  <p className="mt-3 text-white/80 leading-relaxed max-w-2xl">
                    {cityHub.intro.lead}
                  </p>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-2xl">
                    {cityHub.intro.body}
                  </p>
                </>
              )
            ) : (
              <p className="mt-3 text-white/80 leading-relaxed max-w-2xl">
                {mode === 'activities' ? (
                  // fn-18 Fall (b) — auch mit 1-2 Rest-Events: Aktivitäts-
                  // Copy als Hauptinhalt; der "keine Events"-Hinweis wird
                  // unten zum kleinen Sektionshinweis, nie zum Empty-State.
                  hubActivityHeroLead(g.name, activities.length)
                ) : mode === 'mixed' ? (
                  // fn-18 Fall (c): kombinierte Copy (Events + Freizeit).
                  hubMixedHeroLead(g.name, events.length, activities.length)
                ) : events.length > 0 ? (
                  introParagraph
                ) : (
                  <>
                    Aktuell keine Events im Umkreis um {g.name} gefunden.
                    Schau in einer Nachbar-Gemeinde nach — eine Liste findest du unten
                    auf der Seite.
                  </>
                )}
              </p>
            )}
          </header>

          {/* Hybrid bridge → open the full /entdecken explorer scoped to this
              place. From there the user can widen the filter and browse all of
              Austria, so a Google visitor isn't trapped on a single list. */}
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <HubSearchCTA
              scope={{
                bundesland: slugifyBundesland(g.bundesland),
                placeName: g.name,
                placePostalCode: g.plz,
              }}
              label={`Alle Veranstaltungen in ${g.name} durchsuchen`}
            />
            <HubSmartCTA
              surface="gemeinde-hub"
              query={`Was kann man in ${g.name} unternehmen?`}
            />
          </div>

          {/* Event grid */}
          {events.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-4">Kommende Veranstaltungen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(e => (
                  <Link
                    key={e.id}
                    href={buildEventUrlV2(e)}
                    className="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block"
                  >
                    <div className="relative w-full aspect-[4/3] bg-white/5">
                      <Image
                        src={resolvePrimaryEventImage({ imageUrl: e.image_url, category: e.category, title: e.title })}
                        alt={e.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                        unoptimized={process.env.NODE_ENV !== 'production'}
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-white/50 mb-1">
                        {formatDateLong(e.start_date)}
                        {formatTime(e.start_date) && ` · ${formatTime(e.start_date)}`}
                      </div>
                      <div className="font-semibold leading-snug line-clamp-2 mb-1">
                        {e.title}
                      </div>
                      <div className="text-xs text-white/50">
                        {e.location_name ?? e.address ?? g.name}
                        {e._distance_km != null && ` · ${e._distance_km.toFixed(1)} km`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* fn-18 Fall (b): kleiner Sektionshinweis statt Seiten-Empty-State,
              wenn zwar keine Events, aber Aktivitäten da sind. */}
          {events.length === 0 && activities.length >= HUB_MIN_ACTIVITIES && (
            <p className="mb-12 text-sm text-white/50">
              Aktuell keine Events im Umkreis um {g.name} — unten findest du
              dauerhafte Freizeitaktivitäten und Nachbar-Gemeinden mit eigener
              Event-Übersicht.
            </p>
          )}

          {/* Freizeit & Ausflüge (fn-18) — rendert nur ab ≥3 Aktivitäten */}
          <GemeindeActivitiesSection activities={activities} gemeindeName={g.name} />

          {/* Weitere Ausflugsziele aus OpenStreetMap (fn-18.7) — bewusst
              EIGENE Sektion mit eigener ODbL-Attribution, nie mit dem
              eigenen Aktivitäten-Bestand verschmolzen. */}
          <GemeindeOsmPoisSection pois={osmPois} gemeindeName={g.name} />

          {/* Neighbour gemeinden */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-3">Nachbar-Gemeinden</h2>
            <p className="text-sm text-white/50 mb-4">
              Events auch in der Umgebung von {g.name} — die 8 nächstgelegenen
              Orte mit eigener Event-Übersicht.
            </p>
            <div className="flex flex-wrap gap-2">
              {neighbours.map(n => (
                <Link
                  key={n.slug}
                  href={`/gemeinde/${n.slug}`}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/25 text-sm text-white/80"
                >
                  {n.name}
                  <span className="text-white/40 ml-1.5">
                    {haversineKm(g.lat, g.lng, n.lat, n.lng).toFixed(1)} km
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* fn-22 — Touren & Aktivitaeten (GetYourGuide). Faellt auf die
              Bundesland-Zielseite zurueck, wenn der Ort keine eigene hat;
              rendert nichts, solange das Flag aus ist. */}
          <TourBox
            layout="inline"
            className="mb-10"
            city={g.name}
            bundesland={g.bundesland}
            placement={`gemeinde-${slug}`}
          />

          {/* SEO text block — additional context Google can extract.
              fn-18: Copy folgt dem Content-Fall — die Event-Boilerplate
              wäre auf activity-only-Seiten faktisch falsch (Review-
              Finding Runde 2); events/empty bleiben wortgleich wie vorher. */}
          <section className="text-sm text-white/50 leading-relaxed border-t border-white/10 pt-6">
            <p className="mb-2">
              <strong className="text-white/70">{g.name}</strong> liegt im Bezirk
              {g.bezirk ? ` ${g.bezirk}` : ''} in {g.bundesland}, Österreich.{' '}
              {mode === 'activities' ? (
                <>
                  Auf LassTreffen.at findest du dauerhafte Freizeitaktivitäten
                  und Ausflugsziele in {g.name} und Umgebung — von Bädern und
                  Museen bis zu Wander-, Rad- und Familienzielen.
                </>
              ) : mode === 'mixed' ? (
                <>
                  Auf LassTreffen.at findest du täglich aktualisierte
                  Veranstaltungen sowie dauerhafte Freizeitaktivitäten in{' '}
                  {g.name} und Umgebung — von Dorffesten, Märkten und Konzerten
                  bis zu Bädern, Museen und Ausflugszielen.
                </>
              ) : (
                <>
                  Auf LassTreffen.at findest du täglich aktualisierte
                  Veranstaltungen in {g.name} und Umgebung — von Dorffesten und
                  Märkten bis zu Konzerten, Festivals und Kulturveranstaltungen.
                </>
              )}
            </p>
            <p>
              {mode === 'activities' ? (
                <>
                  Die Aktivitäts-Liste stammt aus den offiziellen
                  Tourismus-Datenbanken der Regionen; dauerhaft geschlossene
                  Betriebe werden automatisch erkannt und entfernt.
                </>
              ) : (
                <>
                  Die Event-Liste wird automatisch aus offiziellen Gemeinde-Kalendern,
                  Tourismus-Portalen, Ticket-Vendors und Veranstaltungs-Aggregatoren
                  zusammengeführt und dupliziert-gefiltert, damit du keine
                  Ankündigung doppelt liest.
                  {mode === 'mixed' && (
                    <>
                      {' '}Die Freizeitaktivitäten stammen zusätzlich aus den
                      offiziellen Tourismus-Datenbanken der Regionen.
                    </>
                  )}
                </>
              )}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
