import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Event } from '@/types/events';
import { HubShelves, type HubShelvesProps } from '@/components/Hub/HubShelves';
import { HubEventGrid } from '@/components/Hub/HubEventGrid';
import { FilterChips, type FilterChip } from './FilterChips';
import { InternalLinks, type LinkGroup } from './InternalLinks';
import { LoadMoreEvents } from './LoadMoreEvents';

interface LandingPageShellProps {
  /** H1 heading text */
  title: string;
  /** Subtitle, e.g. "42 Veranstaltungen" */
  subtitle: string;
  /** Breadcrumb segments (label + href pairs, last is current page without href) */
  breadcrumbs: { label: string; href?: string }[];
  /** Top events, server-loaded */
  events: Event[];
  /** Total event count for this filter combination */
  totalCount: number;
  /** Filter chips with active state */
  filterChips: FilterChip[];
  /** Internal link groups for SEO */
  internalLinks: LinkGroup[];
  /** JSON-LD structured data object */
  jsonLd: object;
  /** API params for LoadMoreEvents pagination parity */
  paginationParams: Record<string, string>;
  /**
   * Optional editorial intro shown ABOVE the event list. Boosts SEO ranking
   * for aggregator landing pages by adding original editorial content above
   * the filter listings (Search-Engine "thin content" mitigation). Source
   * lives in src/content/landing-intros.ts (curated, not auto-generated).
   */
  intro?: {
    lead: string;
    body: string;
    tips?: string;
  };
  /** Optional hybrid-bridge CTA (e.g. <HubSearchCTA/>) rendered under the
   *  intro — links into /entdecken scoped to this region. */
  searchCta?: ReactNode;
  /** Regale über der Liste (Variante „Regale" wie /entdecken). Ohne: nur das Raster. */
  shelves?: Pick<HubShelvesProps, 'events' | 'links' | 'hide'> | null;
}

/**
 * Shared layout shell for all landing pages (Bundesland + Stadt).
 * Server Component — renders initial events, delegates pagination to client.
 */
export function LandingPageShell({
  title,
  subtitle,
  breadcrumbs,
  events,
  totalCount,
  filterChips,
  internalLinks,
  jsonLd,
  paginationParams,
  intro,
  searchCta,
  shelves,
}: LandingPageShellProps) {
  const t = useTranslations('HubLanding');
  // Cursor for pagination: last event's ID from server batch
  const lastEvent = events[events.length - 1];
  const initialCursor = lastEvent?.id ?? null;
  const hasMore = events.length < totalCount;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>'),
        }}
      />

      <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-8 pb-20">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--v4-ink-50)] mb-4">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[var(--v4-ink-70)] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--v4-ink-70)]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* H1 + Subtitle */}
          <header className="mb-6">
            <h1 className="m-0 text-[34px] md:text-[40px] font-extrabold tracking-[-0.035em] leading-[1.05] text-[var(--v4-ink)]">
              {title}
            </h1>
            <p className="mt-1.5 mb-0 text-[14px] text-[var(--v4-ink-50)]">{subtitle}</p>
          </header>

          {/* Editorial intro — renders only on routes that have a curated
              entry in landing-intros.ts (typically Bundesland + Stadt root
              pages). Sub-filter views (/wien/heute, /wien/musik/heute)
              deliberately don't carry the intro to avoid duplicate content. */}
          {intro && (
            <section className="mb-7 max-w-3xl text-[var(--v4-ink-70)] leading-relaxed text-sm md:text-[15px]">
              <p className="text-base md:text-[17px] text-[var(--v4-ink)] mb-3 font-medium">
                {intro.lead}
              </p>
              <p className="mb-3">{intro.body}</p>
              {intro.tips && (
                <p className="text-[var(--v4-ink-50)] border-l-2 border-[var(--v4-hairline-3)] pl-4 italic">
                  <span className="text-[var(--v4-ink-70)] font-semibold not-italic">{t('insiderTip')} </span>
                  {intro.tips}
                </p>
              )}
            </section>
          )}

          {/* Hybrid bridge → /entdecken scoped to this region (optional). */}
          {searchCta && <div className="mb-7">{searchCta}</div>}

          {/* Filter Chips */}
          <div className="mb-5">
            <FilterChips chips={filterChips} />
          </div>

          {/* Regale */}
          {shelves && <HubShelves {...shelves} />}

          {/* Vollständige Liste */}
          {events.length > 0 ? (
            <HubEventGrid title={t('allEvents')} sub={subtitle} events={events}>
              {/* Load More (Client Component) */}
              <LoadMoreEvents
                apiParams={paginationParams}
                initialCursor={initialCursor}
                hasMore={hasMore}
              />
            </HubEventGrid>
          ) : (
            <div className="text-center py-16">
              <p className="text-[var(--v4-ink-50)] text-sm">
                {t('noEventsForFilter')}
              </p>
            </div>
          )}

          {/* Internal Links */}
          <InternalLinks groups={internalLinks} />
        </div>
      </main>
    </>
  );
}
