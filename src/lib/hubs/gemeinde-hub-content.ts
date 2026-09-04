/**
 * Mixed-Content-Modell der Gemeinde-Hub-Seite (fn-18 Task 4).
 *
 * Pure Helper fuer /gemeinde/[slug]: seit Aktivitaeten (poi_activities)
 * existieren, hat die Hub-Seite VIER Content-Faelle (verbindlich,
 * Task-Spec):
 *
 *   (a) events   — Events >= 3, Aktivitaeten < 3: Copy/JSON-LD/Experiment
 *                  EXAKT wie vor fn-18 (byte-identische Titles/Descriptions,
 *                  kein SEO-Diff auf bereits indexierten Seiten).
 *   (b) activities — Events < 3, Aktivitaeten >= 3: Aktivitaets-Copy,
 *                  KEIN "Aktuell keine Events"-Empty-State als Hauptinhalt,
 *                  kein event-bezogenes JSON-LD/FAQ. Seite ist indexierbar.
 *   (c) mixed    — beide >= 3: kombinierte Copy, Event- UND Aktivitaeten-
 *                  ItemList, Event-FAQ + Aktivitaets-Frage.
 *   (d) empty    — beide < 3: heutiges Verhalten inkl. noindex.
 *
 * Experiment-Overrides (resolveExperimentForScope('gemeinde', ...)) werden
 * NUR bei Aktivitaeten < 3 angewandt (Faelle a/d = event-only-Copy) —
 * stale event-only-Varianten duerfen die Mixed-Copy nie ueberschreiben.
 *
 * Alles hier ist pur (kein DB/Next-Import ausser Typen/Buildern), damit
 * die 4 Faelle ohne Page-Render testbar sind — und der Page-Diff klein
 * bleibt (fn-13 fasst dieselbe Datei spaeter an).
 */

import { buildEventUrlV2, type EventForUrl } from '@/lib/utils/slugify';
import {
  buildFAQPageSchema,
  faqForGemeinde,
  faqForGemeindeActivities,
  type FAQEntry,
  type FAQTranslator,
} from '@/lib/seo/faq';
import { activityCanonicalUrl } from '@/lib/activities/indexability';
import type { AustrianGemeinde } from '@/lib/gemeinden/data';

export type HubContentMode = 'events' | 'activities' | 'mixed' | 'empty';

/** Schwelle des Low-Content-Gates (galt bisher nur fuer Events). */
export const HUB_MIN_EVENTS = 3;
export const HUB_MIN_ACTIVITIES = 3;

export function hubContentMode(eventCount: number, activityCount: number): HubContentMode {
  const hasEvents = eventCount >= HUB_MIN_EVENTS;
  const hasActivities = activityCount >= HUB_MIN_ACTIVITIES;
  if (hasEvents && hasActivities) return 'mixed';
  if (hasEvents) return 'events';
  if (hasActivities) return 'activities';
  return 'empty';
}

/**
 * Indexierungs-Gate (bewusste SEO-Entscheidung, Task-Spec): indexierbar
 * bei Events >= 3 ODER Aktivitaeten >= 3. Gilt fuer generateMetadata
 * (robots) UND Page-Body — beide Stellen nutzen DIESE Funktion.
 */
export function hubIsIndexable(eventCount: number, activityCount: number): boolean {
  return eventCount >= HUB_MIN_EVENTS || activityCount >= HUB_MIN_ACTIVITIES;
}

/**
 * Experiment-Overrides (resolveExperimentForScope) sind NUR im
 * event-only-Fall (a) erlaubt — nicht in (b)/(c) (Mixed-Copy wuerde
 * ueberschrieben) und auch nicht im empty-Fall (d) (Review-Finding:
 * stale Event-Title-Experimente sollen leere noindex-Hubs nicht
 * umschreiben). generateMetadata UND Page nutzen DIESE Funktion.
 */
export function hubExperimentAllowed(eventCount: number, activityCount: number): boolean {
  return hubContentMode(eventCount, activityCount) === 'events';
}

export function slugifyBundesland(bl: string): string {
  const map: Record<string, string> = {
    'Burgenland': 'burgenland',
    'Kärnten': 'kaernten',
    'Niederösterreich': 'niederoesterreich',
    'Oberösterreich': 'oberoesterreich',
    'Salzburg': 'salzburg',
    'Steiermark': 'steiermark',
    'Tirol': 'tirol',
    'Vorarlberg': 'vorarlberg',
    'Wien': 'wien',
  };
  return map[bl] ?? bl.toLowerCase();
}

/**
 * fn-17: Uebersetzer-Signatur der Hub-Copy. Kompatibel mit dem
 * Rueckgabewert von `getTranslations({ locale, namespace: 'GemeindeHub' })`.
 * Die DE-Messages sind byte-identisch zu den frueher hier inlined
 * gepflegten Strings — die deutschen Hub-Seiten rendern unveraendert.
 */
export type HubTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface HubCopyInput {
  name: string;
  bezirk: string | null;
  plz: string;
  bundesland: string;
  eventCount: number;
  activityCount: number;
  /** true fuer die kuratierten City-Hubs (Linz, Graz, ...). */
  isCityHub: boolean;
  /** Kalenderjahr fuer die City-Titles ("Veranstaltungen in Linz 2026"). */
  year: number;
}

/**
 * Default-Title + Description pro Content-Fall. In den Faellen
 * events/empty byte-identisch zur Vor-fn-18-Logik (siehe Kopfkommentar);
 * die Page legt in diesen Faellen ggf. den Experiment-Title drueber.
 */
export function buildHubMeta(
  input: HubCopyInput,
  t: HubTranslator,
): { title: string; description: string } {
  const { name, bezirk, plz, bundesland, eventCount, activityCount, isCityHub, year } = input;
  const mode = hubContentMode(eventCount, activityCount);
  // Klammer-Zusatz wird fertig uebergeben statt im Message-String
  // zusammengebaut — so bleibt die DE-Ausgabe byte-identisch zur
  // Vor-fn-17-Version, auch wenn kein Bezirk existiert.
  const bezirkSuffix = bezirk ? ` (${bezirk})` : '';

  if (mode === 'activities') {
    return {
      title: t('metaTitleActivities', { name }),
      description: t('metaDescActivities', { activityCount, name, bezirkSuffix }),
    };
  }

  if (mode === 'mixed') {
    return {
      title: t('metaTitleMixed', { name }),
      description: t('metaDescMixed', { eventCount, activityCount, name, bezirkSuffix }),
    };
  }

  const title = isCityHub
    ? (eventCount > 0
        ? t('metaTitleCityWithCount', { name, year, eventCount })
        : t('metaTitleCity', { name, year }))
    : (eventCount > 0
        ? t('metaTitleGemeindeWithCount', { name, plz, eventCount })
        : t('metaTitleGemeinde', { name, plz }));
  const description = eventCount > 0
    ? t('metaDescEvents', { eventCount, name, bezirkSuffix })
    : t('metaDescEmpty', { name, bezirkSuffix, bundesland });
  return { title, description };
}

/** Default-H1 pro Content-Fall (Experiment-Prefix legt die Page drueber — nur a/d). */
export function hubDefaultH1(
  input: Pick<HubCopyInput, 'name' | 'eventCount' | 'activityCount' | 'isCityHub'>,
  t: HubTranslator,
): string {
  const mode = hubContentMode(input.eventCount, input.activityCount);
  if (mode === 'activities') return t('h1Activities', { name: input.name });
  if (mode === 'mixed') return t('h1Mixed', { name: input.name });
  return input.isCityHub ? t('h1City', { name: input.name }) : t('h1Events', { name: input.name });
}

/**
 * Hero-Absatz fuer den activity-only-Fall (b): tritt an die Stelle des
 * "Aktuell keine Events"-Empty-States (der bleibt nur als kleiner
 * Sektionshinweis, nie als Seiten-Empty-State).
 */
export function hubActivityHeroLead(name: string, activityCount: number, t: HubTranslator): string {
  return t('heroActivities', { name, activityCount });
}

/** Hero-Absatz fuer den mixed-Fall (c): kombinierte Copy (Events + Freizeit). */
export function hubMixedHeroLead(
  name: string,
  eventCount: number,
  activityCount: number,
  t: HubTranslator,
): string {
  return t('heroMixed', { name, eventCount, activityCount });
}

// ───────────────────────────────────────────────────────────────────────
// JSON-LD (Mixed-Modell, verbindlich)
// ───────────────────────────────────────────────────────────────────────

/** Event-Teilmenge, die das JSON-LD braucht (URL-faehig + Titel). */
export type HubJsonLdEvent = EventForUrl & { title: string };

export interface HubJsonLdActivity {
  slug: string;
  name: string;
}

/**
 * FAQ-Eintraege pro Content-Fall (gleiche 4 Faelle wie die Meta-Copy):
 * events -> Event-FAQ (wie bisher), activities -> reines Aktivitaets-FAQ
 * (KEIN Event-FAQ mehr), mixed -> Event-FAQ + Aktivitaets-Frage,
 * empty -> kein FAQ.
 */
export function buildHubFaqEntries(input: {
  gemeinde: string;
  bundesland: string;
  plz: string;
  eventCount: number;
  activityCount: number;
  /** Uebersetzer des HubFAQ-Namespace der Seiten-Locale. */
  t: FAQTranslator;
  /** Zahlformat der Seiten-Locale ('de-AT' / 'en-GB'). */
  numberLocale: string;
}): FAQEntry[] {
  const mode = hubContentMode(input.eventCount, input.activityCount);
  if (mode === 'empty') return [];

  const activityEntries = faqForGemeindeActivities({
    gemeinde: input.gemeinde,
    bundesland: input.bundesland,
    plz: input.plz,
    activityCount: input.activityCount,
    t: input.t,
    numberLocale: input.numberLocale,
  });
  if (mode === 'activities') return activityEntries;

  const eventEntries = faqForGemeinde({
    gemeinde: input.gemeinde,
    bundesland: input.bundesland,
    plz: input.plz,
    eventCount: input.eventCount,
    t: input.t,
    numberLocale: input.numberLocale,
  });
  if (mode === 'events') return eventEntries;

  // mixed: Event-Set + die Aktivitaets-Kernfrage.
  return [...eventEntries, activityEntries[0]];
}

/**
 * @graph der Hub-Seite: Place + Breadcrumb immer; Event-ItemList NUR bei
 * vorhandenen Events (nie eine leere ItemList) UND NIE im activity-only-
 * Fall — der darf ueberhaupt kein event-bezogenes JSON-LD emittieren,
 * auch nicht fuer 1-2 Rest-Events (Review-Finding). Aktivitaeten-ItemList
 * ab >= 3 Aktivitaeten (Links auf /aktivitaet/*); FAQ nach den 4 Faellen.
 */
export function buildGemeindeHubJsonLd(
  g: AustrianGemeinde,
  events: HubJsonLdEvent[],
  activities: HubJsonLdActivity[],
  faq: { t: FAQTranslator; numberLocale: string },
): string {
  // Canonical bleibt die DE-URL, auch im JSON-LD der /en-Seite: das
  // @id-Graph beschreibt dieselbe Entitaet, und die Seiten verweisen per
  // hreflang aufeinander.
  const canonicalUrl = `https://lasstreffen.at/gemeinde/${g.slug}`;
  const mode = hubContentMode(events.length, activities.length);

  const place = {
    '@type': 'Place',
    '@id': `${canonicalUrl}#place`,
    name: g.name,
    address: {
      '@type': 'PostalAddress',
      postalCode: g.plz,
      addressLocality: g.name,
      addressRegion: g.bundesland,
      addressCountry: 'AT',
    },
    geo: { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng },
    url: canonicalUrl,
  };

  const eventList = events.length > 0 && mode !== 'activities'
    ? {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        numberOfItems: events.length,
        itemListElement: events.slice(0, 10).map((e, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `https://lasstreffen.at${buildEventUrlV2(e)}`,
          name: e.title,
        })),
      }
    : null;

  const activityList = activities.length >= HUB_MIN_ACTIVITIES
    ? {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#activitylist`,
        numberOfItems: activities.length,
        itemListElement: activities.slice(0, 10).map((a, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: activityCanonicalUrl(a.slug),
          name: a.name,
        })),
      }
    : null;

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: g.bundesland, item: `https://lasstreffen.at/${slugifyBundesland(g.bundesland)}` },
      { '@type': 'ListItem', position: 3, name: g.name, item: canonicalUrl },
    ],
  };

  const faqEntries = buildHubFaqEntries({
    gemeinde: g.name,
    bundesland: g.bundesland,
    plz: g.plz,
    eventCount: events.length,
    activityCount: activities.length,
    t: faq.t,
    numberLocale: faq.numberLocale,
  });
  const faqPage = faqEntries.length > 0 ? buildFAQPageSchema(faqEntries) : null;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      place,
      ...(eventList ? [eventList] : []),
      ...(activityList ? [activityList] : []),
      breadcrumb,
      ...(faqPage ? [faqPage] : []),
    ],
  };

  return JSON.stringify(graph).replace(/<\/script>/gi, '<\\/script>');
}
