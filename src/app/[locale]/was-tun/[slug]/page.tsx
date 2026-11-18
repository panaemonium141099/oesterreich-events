/**
 * „Was kann man in X machen?" — `/was-tun/{slug}`
 *
 * Eine Seite je Gemeinde, Tourismusregion und Bundesland. Sie beantwortet
 * die Frage aus dem Bestand und zeigt ihn GANZ: oben die Antwort, darunter
 * die Regale von /entdecken (Top-Picks, Heute Abend, Wochenende, dazwischen
 * Ausflugsziele, Kategorien), dann alle Veranstaltungen und alle
 * Ausflugsziele je mit Gesamtzahl und Nachladen. Anlass: Search Console 08 bis 11/2026,
 * 158 von 2,29 Mio. Impressionen bei „was kann man in X machen"; die
 * Event-Übersichten (/gemeinde, /{bundesland}) zielen auf „Veranstaltungen X"
 * und bleiben unverändert.
 *
 * - Ortsauflösung und Ortsliste: src/lib/was-tun/places.ts (+ regions.ts)
 * - Texte, Mischung, FAQ, JSON-LD: src/lib/was-tun/content.ts (pur, getestet)
 * - Abfragen: src/lib/was-tun/loaders.ts (gleiche Filter und Reihenfolge wie
 *   /api/events und /api/activities, damit Nachladen dieselbe Menge meint)
 *
 * ISR wie die Gemeinde-Übersicht: kein Vorab-Build, jede Seite rendert beim
 * ersten Aufruf und liegt dann eine Stunde im Cache. Unter drei Einträgen
 * noindex. Nur Deutsch; /en kanonisiert auf die deutsche URL.
 */

import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Event } from '@/types/events';
import { routing, type AppLocale } from '@/i18n/routing';
import { Link as LocaleLink } from '@/i18n/navigation';
import { deOnlyAlternates } from '@/lib/seo/canonical';
import { GemeindeOsmPoisSection } from '@/components/Osm/OsmPoisSection';
import { HubShelves } from '@/components/Hub/HubShelves';
import { HubEventGrid } from '@/components/Hub/HubEventGrid';
import { LoadMoreEvents } from '@/components/Landing/LoadMoreEvents';
import { Shelf } from '@/components/Discover/v4/shelf-ui';
import { ActivityCard } from '@/components/WasTun/ActivityCard';
import { LoadMoreActivities } from '@/components/WasTun/LoadMoreActivities';
import { buildEntdeckenHref } from '@/lib/hubs/hub-links';
import {
  relatedPlaces,
  resolveWasTunPlace,
  wasTunHref,
  wasTunRedirectSlug,
  WAS_TUN_BASE,
  type WasTunLink,
} from '@/lib/was-tun/places';
import {
  buildAnswer,
  buildWasTunFaq,
  buildWasTunJsonLd,
  buildWasTunMeta,
  formatCount,
  scopeSentence,
  wasTunIsIndexable,
  wasTunQuestion,
} from '@/lib/was-tun/content';
import { loadWasTunData, scopeParams } from '@/lib/was-tun/loaders';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Kein Vorab-Build (wie /gemeinde/[slug]): rund 2.200 Seiten mit je drei
  // Abfragen würden den Deploy an die Datenbank hängen.
  return [];
}

function resolveLocale(raw: string): AppLocale {
  return hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = resolveWasTunPlace(slug);
  if (!place) return { title: 'Ort nicht gefunden' };

  const data = await loadWasTunData(place);
  const totals = { events: data.eventTotal, activities: data.activityTotal };
  const { title, description } = buildWasTunMeta(place, totals);
  const alternates = deOnlyAlternates(wasTunHref(place.slug));

  const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates,
    openGraph: { title, description, type: 'website', url: alternates.canonical },
    twitter: { card: 'summary', title, description },
  };
  if (!wasTunIsIndexable(totals)) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}

function LinkChips({ links }: { links: WasTunLink[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <LocaleLink
          key={l.href}
          href={l.href}
          className="rounded-full border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
        >
          {l.name}
        </LocaleLink>
      ))}
    </div>
  );
}

const H2 = 'm-0 mb-2 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]';

export default async function WasTunPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const redirectSlug = wasTunRedirectSlug(slug);
  if (redirectSlug) {
    permanentRedirect(`${locale === routing.defaultLocale ? '' : `/${locale}`}${wasTunHref(redirectSlug)}`);
  }
  const place = resolveWasTunPlace(slug);
  if (!place) notFound();

  const { events, eventTotal, shelfPool, activities, activityTotal, activityCursor, osmPois } =
    await loadWasTunData(place);
  const totals = { events: eventTotal, activities: activityTotal };
  const faq = buildWasTunFaq(place, totals, events, activities);
  const jsonLd = buildWasTunJsonLd(place, totals, events, activities);
  const related = relatedPlaces(place);
  const question = wasTunQuestion(place);
  const scope = scopeSentence(place);
  // Derselbe Ort wie die Server-Abfragen, für das Nachladen beider Listen.
  const apiScope = scopeParams(place);
  const tAct = await getTranslations('Activities');
  const cardLabels = { fallback: tAct('cardFallback'), credit: tAct('imageCredit') };
  // „Alle anzeigen" der Kategorie-Regale: /entdecken mit Bundesland und Kategorie.
  // Eine Region hat dort keinen eigenen Filter, ihre Regale bleiben ohne Link.
  const categoryHref = place.kind === 'region'
    ? undefined
    : (category: string) => buildEntdeckenHref({ bundesland: place.bundeslandId, category });
  const lastEvent = events[events.length - 1];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-8 pb-20">
          <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--v4-ink-50)] mb-4" aria-label="Breadcrumb">
            <LocaleLink href="/" className="hover:text-[var(--v4-ink-70)]">Home</LocaleLink>
            <span>/</span>
            <LocaleLink href={WAS_TUN_BASE} className="hover:text-[var(--v4-ink-70)]">Was tun</LocaleLink>
            {place.kind !== 'bundesland' && (
              <>
                <span>/</span>
                <LocaleLink href={wasTunHref(place.bundeslandId)} className="hover:text-[var(--v4-ink-70)]">
                  {place.bundeslandName}
                </LocaleLink>
              </>
            )}
            <span>/</span>
            <span className="text-[var(--v4-ink-70)]">{place.name}</span>
          </nav>

          <header className="mb-8">
            <h1 className="m-0 text-[30px] md:text-[40px] font-extrabold tracking-[-0.035em] leading-[1.08] text-[var(--v4-ink)]">
              {question}
            </h1>
            <p className="mt-4 mb-0 text-[var(--v4-ink-70)] leading-relaxed max-w-2xl">
              {buildAnswer(place, totals, activities)}
            </p>
            {scope && (
              <p className="mt-2 mb-0 text-sm text-[var(--v4-ink-50)] leading-relaxed max-w-2xl">{scope}</p>
            )}
          </header>

          {/* Regale wie auf /entdecken; die Ausflugsziele stehen als eigenes
              Regal zwischen Wochenende und den Kategorien. */}
          <HubShelves
            events={shelfPool as unknown as Event[]}
            links={{ category: categoryHref }}
            extra={activities.length >= 3 ? (
              <Shelf
                title="Ausflugsziele und Aktivitäten"
                sub={`${formatCount(activityTotal)} ${place.where}`}
                allHref="#ausflugsziele"
              >
                {activities.slice(0, 12).map((a) => <ActivityCard key={a.id} activity={a} labels={cardLabels} />)}
              </Shelf>
            ) : undefined}
          />

          {/* Alle Veranstaltungen des Orts, nächster Termin zuerst. */}
          {events.length > 0 && (
            <HubEventGrid
              id="veranstaltungen"
              title={`Alle Veranstaltungen ${place.where}`}
              sub={formatCount(eventTotal)}
              events={events as unknown as Event[]}
            >
              <LoadMoreEvents
                apiParams={apiScope}
                initialCursor={lastEvent?.id ?? null}
                hasMore={events.length < eventTotal}
              />
            </HubEventGrid>
          )}

          {/* Alle Ausflugsziele und Aktivitäten des Orts. */}
          {activities.length > 0 && (
            <section id="ausflugsziele" className="mt-10 mb-12 scroll-mt-24">
              <div className="flex items-baseline gap-3 pb-4 mb-[22px] border-b border-[var(--v4-hairline-2)]">
                <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">
                  Alle Ausflugsziele und Aktivitäten {place.where}
                </h2>
                <span className="text-[13.5px] text-[var(--v4-ink-50)]">{formatCount(activityTotal)}</span>
              </div>
              <div className="v4-poster-grid">
                {activities.map((a) => <ActivityCard key={a.id} activity={a} labels={cardLabels} grid />)}
              </div>
              <LoadMoreActivities apiParams={apiScope} initialCursor={activityCursor} labels={cardLabels} />
            </section>
          )}

          {/* OpenStreetMap: eigene Sektion mit eigener Attribution (ODbL). */}
          <GemeindeOsmPoisSection pois={osmPois} gemeindeName={place.name} />

          {faq.length > 0 && (
            <section className="mb-12 max-w-3xl">
              <h2 className={H2}>Häufige Fragen</h2>
              <dl className="m-0 mt-4 space-y-5">
                {faq.map((f) => (
                  <div key={f.question}>
                    <dt className="text-[15px] font-bold text-[var(--v4-ink)]">{f.question}</dt>
                    <dd className="m-0 mt-1 text-[14.5px] leading-relaxed text-[var(--v4-ink-70)]">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {related.regions.length > 0 && (
            <section className="mb-10">
              <h2 className={H2}>
                {place.kind === 'bundesland' ? `Regionen ${place.where}` : 'Regionen in der Umgebung'}
              </h2>
              <div className="mt-4"><LinkChips links={related.regions} /></div>
            </section>
          )}

          {related.gemeinden.length > 0 && (
            <section className="mb-10">
              <h2 className={H2}>
                {place.kind === 'gemeinde' ? 'Was tun in der Nachbarschaft' : `Orte ${place.where}`}
              </h2>
              {place.kind === 'bundesland' ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[14px] font-semibold text-[var(--v4-ink-70)]">
                    Alle {related.gemeinden.length} Gemeinden anzeigen
                  </summary>
                  <div className="mt-4"><LinkChips links={related.gemeinden} /></div>
                </details>
              ) : (
                <div className="mt-4"><LinkChips links={related.gemeinden} /></div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
