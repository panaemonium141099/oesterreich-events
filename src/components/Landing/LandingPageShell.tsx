import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Event } from '@/types/events';
import { EventListCard } from '@/components/Events/EventListCard';
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
}: LandingPageShellProps) {
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

      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-6">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-white/70 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white/60">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* H1 + Subtitle */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {title}
            </h1>
            <p className="text-sm text-white/50">{subtitle}</p>
          </div>

          {/* Editorial intro — renders only on routes that have a curated
              entry in landing-intros.ts (typically Bundesland + Stadt root
              pages). Sub-filter views (/wien/heute, /wien/musik/heute)
              deliberately don't carry the intro to avoid duplicate content. */}
          {intro && (
            <section className="mb-8 max-w-3xl text-white/70 leading-relaxed text-sm md:text-base">
              <p className="text-base md:text-lg text-white/85 mb-4 font-medium">
                {intro.lead}
              </p>
              <p className="mb-4">{intro.body}</p>
              {intro.tips && (
                <p className="text-white/60 border-l-2 border-white/20 pl-4 italic">
                  <span className="text-white/80 font-semibold not-italic">Insider-Tipp: </span>
                  {intro.tips}
                </p>
              )}
            </section>
          )}

          {/* Hybrid bridge → /entdecken scoped to this region (optional). */}
          {searchCta && <div className="mb-8">{searchCta}</div>}

          {/* Filter Chips */}
          <div className="mb-6">
            <FilterChips chips={filterChips} />
          </div>

          {/* Event List */}
          {events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {events.map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-white/40 text-sm">
                Keine Events gefunden fur diesen Filter.
              </p>
            </div>
          )}

          {/* Load More (Client Component) */}
          <LoadMoreEvents
            apiParams={paginationParams}
            initialCursor={initialCursor}
            hasMore={hasMore}
          />

          {/* Internal Links */}
          <InternalLinks groups={internalLinks} />
        </div>
      </main>
    </>
  );
}
