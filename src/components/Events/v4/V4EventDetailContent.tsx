/**
 * V4EventDetailContent — the main content column of the event detail.
 *
 * Phase 3 keeps the structure minimal and forward-compatible:
 *   • Description block (h3 "Worum geht's?" + paragraph)
 *   • Tag chips (neutral hairline pills)
 *   • #similar-events anchor + section header (caller renders the actual
 *     similar-event grid; we just provide the landing target for the
 *     soldout box scroll-CTA)
 *
 * Lineup grid + venue map snippet are explicit follow-ups (Phase 3.1)
 * since they need their own data wiring and would balloon this file.
 */

import type { ReactNode } from 'react';

interface V4EventDetailContentProps {
  description: string | null;
  tags?: string[] | null;
  hasSimilar?: boolean;
  similarChildren?: ReactNode;
  /** Scraper provider name (e.g. "burgenland.info") — required by law as
   *  attribution. Renders as plain text if sourceUrl is missing. */
  sourceName?: string | null;
  /** Public-facing URL of the original event page. Some scrapers (e.g.
   *  Feratel-Deskline via the TOSC5 API) have no human-visitable URL —
   *  in that case the source block falls back to the name-only line. */
  sourceUrl?: string | null;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function V4EventDetailContent({ description, tags, hasSimilar, similarChildren, sourceName, sourceUrl }: V4EventDetailContentProps) {
  const tagList = (tags ?? []).filter(Boolean);
  const sourceLabel = sourceName?.trim() || (sourceUrl ? hostnameOf(sourceUrl) : null);
  const showSource = Boolean(sourceLabel);

  return (
    <div className="max-w-[700px]">
      {description && (
        <section className="mt-7">
          <h3 className="m-0 mb-3 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Worum geht&apos;s?
          </h3>
          <p className="m-0 max-w-[640px] text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)]" style={{ textWrap: 'pretty' }}>
            {description}
          </p>
        </section>
      )}

      {tagList.length > 0 && (
        <section className="mt-7 flex flex-wrap gap-2">
          {tagList.map(t => (
            <span
              key={t}
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--v4-hairline-2)] text-[11.5px] font-medium text-[var(--v4-ink-70)]"
            >
              {t}
            </span>
          ))}
        </section>
      )}

      {showSource && (
        <section className="mt-8 pt-5 border-t border-[var(--v4-hairline-1)]">
          <p className="m-0 text-[12px] text-[var(--v4-ink-50)] leading-[1.5]">
            Quelle:{' '}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] underline decoration-[var(--v4-hairline-3)] underline-offset-2 inline-flex items-center gap-1"
              >
                {sourceLabel}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ) : (
              <span className="text-[var(--v4-ink-70)]">{sourceLabel}</span>
            )}
          </p>
        </section>
      )}

      {hasSimilar && (
        <section id="similar-events" className="mt-10">
          <h3 className="m-0 mb-4 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Ähnliche Events
          </h3>
          {similarChildren}
        </section>
      )}
    </div>
  );
}
