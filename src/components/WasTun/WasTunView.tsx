/**
 * Ansicht der Seiten „Was kann man in X machen?": dieselbe für die
 * Grundseite eines Orts (/was-tun/[slug]) und für jedes Thema
 * (/was-tun/[slug]/[thema]). Aufbau wie /entdecken: Frage und Antwort,
 * Themen-Chips, Regale, dann alle Veranstaltungen und alle Ausflugsziele
 * mit Gesamtzahl und Nachladen.
 *
 * `wasTunMetadata` baut die Metadaten beider Routen aus denselben Daten.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { Event } from '@/types/events';
import { Link as LocaleLink } from '@/i18n/navigation';
import { deOnlyAlternates } from '@/lib/seo/canonical';
import { GemeindeOsmPoisSection } from '@/components/Osm/OsmPoisSection';
import { HubShelves } from '@/components/Hub/HubShelves';
import { HubEventGrid } from '@/components/Hub/HubEventGrid';
import { LoadMoreEvents } from '@/components/Landing/LoadMoreEvents';
import { Shelf } from '@/components/Discover/v4/shelf-ui';
import { buildEntdeckenHref } from '@/lib/hubs/hub-links';
import {
  relatedPlaces,
  wasTunHref,
  WAS_TUN_BASE,
  type WasTunLink,
  type WasTunPlace,
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
import { loadWasTunData } from '@/lib/was-tun/loaders';
import { WAS_TUN_THEMES, type WasTunTheme } from '@/lib/was-tun/themes';
import { ActivityCard } from './ActivityCard';
import { LoadMoreActivities } from './LoadMoreActivities';

export async function wasTunMetadata(place: WasTunPlace, theme: WasTunTheme | null): Promise<Metadata> {
  const data = await loadWasTunData(place, theme);
  const totals = { events: data.eventTotal, activities: data.activityTotal };
  const { title, description } = buildWasTunMeta(place, totals, theme);
  const alternates = deOnlyAlternates(wasTunHref(place.slug, theme?.slug));

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

const CHIP =
  'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors';
const CHIP_IDLE = `${CHIP} border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] text-[var(--v4-ink)]`;
const CHIP_ACTIVE = `${CHIP} border-[var(--v4-ink)] bg-[var(--v4-ink)] text-[var(--v4-surface)]`;

function LinkChips({ links }: { links: WasTunLink[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <LocaleLink key={l.href} href={l.href} className={CHIP_IDLE}>{l.name}</LocaleLink>
      ))}
    </div>
  );
}

const H2 = 'm-0 mb-2 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]';

export async function WasTunView({ place, theme }: { place: WasTunPlace; theme: WasTunTheme | null }) {
  const {
    events, eventTotal, shelfPool, activities, activityTotal, activityCursor, osmPois,
    eventApiParams, activityApiParams,
  } = await loadWasTunData(place, theme);
  const totals = { events: eventTotal, activities: activityTotal };
  const faq = buildWasTunFaq(place, totals, events, activities, theme);
  const jsonLd = buildWasTunJsonLd(place, totals, events, activities, theme);
  const question = wasTunQuestion(place, theme);
  const scope = scopeSentence(place);
  const where = theme ? `${place.where} ${theme.phrase}` : place.where;
  const tAct = await getTranslations('Activities');
  const cardLabels = { fallback: tAct('cardFallback'), credit: tAct('imageCredit') };
  // „Alle anzeigen" der Kategorie-Regale: /entdecken mit Bundesland und Kategorie.
  // Eine Region hat dort keinen eigenen Filter, ihre Regale bleiben ohne Link.
  const categoryHref = place.kind === 'region'
    ? undefined
    : (category: string) => buildEntdeckenHref({ bundesland: place.bundeslandId, category });
  const lastEvent = events[events.length - 1];

  // Weiterführende Orte: auf einer Themenseite bleiben die Links beim Thema.
  // Die volle Gemeindeliste eines Bundeslands steht nur auf der Grundseite.
  const base = relatedPlaces(place);
  const withTheme = (links: WasTunLink[]) =>
    theme ? links.map((l) => ({ ...l, href: `${l.href}/${theme.slug}` })) : links;
  const related = {
    regions: withTheme(base.regions),
    gemeinden: theme && place.kind === 'bundesland' ? [] : withTheme(base.gemeinden),
  };

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
            {theme ? (
              <>
                <LocaleLink href={wasTunHref(place.slug)} className="hover:text-[var(--v4-ink-70)]">{place.name}</LocaleLink>
                <span>/</span>
                <span className="text-[var(--v4-ink-70)]">{theme.label}</span>
              </>
            ) : (
              <span className="text-[var(--v4-ink-70)]">{place.name}</span>
            )}
          </nav>

          <header className="mb-6">
            <h1 className="m-0 text-[30px] md:text-[40px] font-extrabold tracking-[-0.035em] leading-[1.08] text-[var(--v4-ink)]">
              {question}
            </h1>
            <p className="mt-4 mb-0 text-[var(--v4-ink-70)] leading-relaxed max-w-2xl">
              {buildAnswer(place, totals, activities, theme)}
            </p>
            {scope && (
              <p className="mt-2 mb-0 text-sm text-[var(--v4-ink-50)] leading-relaxed max-w-2xl">{scope}</p>
            )}
          </header>

          {/* Themen desselben Orts: jede Frage ist eine eigene Seite. */}
          <nav aria-label="Themen" className="mb-8 flex flex-wrap gap-2">
            <LocaleLink href={wasTunHref(place.slug)} className={theme ? CHIP_IDLE : CHIP_ACTIVE} aria-current={theme ? undefined : 'page'}>
              Alles
            </LocaleLink>
            {WAS_TUN_THEMES.map((t) => (
              <LocaleLink
                key={t.slug}
                href={wasTunHref(place.slug, t.slug)}
                className={theme?.slug === t.slug ? CHIP_ACTIVE : CHIP_IDLE}
                aria-current={theme?.slug === t.slug ? 'page' : undefined}
              >
                {t.label}
              </LocaleLink>
            ))}
          </nav>

          {/* Regale wie auf /entdecken; die Ausflugsziele stehen als eigenes
              Regal zwischen Wochenende und den Kategorien. */}
          <HubShelves
            events={shelfPool as unknown as Event[]}
            links={{ category: categoryHref }}
            extra={activities.length >= 3 ? (
              <Shelf
                title="Ausflugsziele und Aktivitäten"
                sub={`${formatCount(activityTotal)} ${where}`}
                allHref="#ausflugsziele"
              >
                {activities.slice(0, 12).map((a) => <ActivityCard key={a.id} activity={a} labels={cardLabels} />)}
              </Shelf>
            ) : undefined}
          />

          {/* Alle Veranstaltungen, nächster Termin zuerst. */}
          {events.length > 0 && eventApiParams && (
            <HubEventGrid
              id="veranstaltungen"
              title={`Alle Veranstaltungen ${where}`}
              sub={formatCount(eventTotal)}
              events={events as unknown as Event[]}
            >
              <LoadMoreEvents
                apiParams={eventApiParams}
                initialCursor={lastEvent?.id ?? null}
                hasMore={events.length < eventTotal}
              />
            </HubEventGrid>
          )}

          {/* Alle Ausflugsziele und Aktivitäten. */}
          {activities.length > 0 && activityApiParams && (
            <section id="ausflugsziele" className="mt-10 mb-12 scroll-mt-24">
              <div className="flex items-baseline gap-3 pb-4 mb-[22px] border-b border-[var(--v4-hairline-2)]">
                <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">
                  Alle Ausflugsziele und Aktivitäten {where}
                </h2>
                <span className="text-[13.5px] text-[var(--v4-ink-50)]">{formatCount(activityTotal)}</span>
              </div>
              <div className="v4-poster-grid">
                {activities.map((a) => <ActivityCard key={a.id} activity={a} labels={cardLabels} grid />)}
              </div>
              <LoadMoreActivities apiParams={activityApiParams} initialCursor={activityCursor} labels={cardLabels} />
            </section>
          )}

          {theme && events.length === 0 && activities.length === 0 && (
            <p className="mb-12 text-[var(--v4-ink-70)]">
              <LocaleLink href={wasTunHref(place.slug)} className="underline underline-offset-4">
                Alles {place.where} ansehen
              </LocaleLink>
            </p>
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
