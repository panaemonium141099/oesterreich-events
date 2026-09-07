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
import { useTranslations } from 'next-intl';

interface V4EventDetailContentProps {
  description: string | null;
  /** Primäre Kategorie der Veranstaltung. Stand bisher in keiner Zeile der
   *  Detailseite, obwohl sie bei jedem Event gepflegt ist und bei Inseraten
   *  vom Veranstalter selbst gewählt wurde. Läuft als erster Chip vor den
   *  Tags mit. */
  category?: string | null;
  tags?: string[] | null;
  /** Veranstaltungsort und Anschrift. Der Hero zeigt nur "Venue · Bundesland";
   *  die Strasse fehlte damit auf der ganzen Seite, obwohl sie in der Zeile
   *  steht — für die Entscheidung "fahre ich hin?" ist sie die wichtigste
   *  Angabe nach dem Termin. */
  locationName?: string | null;
  address?: string | null;
  /** Veranstalter laut Zeile. Wird nur gezeigt, wenn er nicht ohnehin schon
   *  als Quelle unter dem Text steht — sonst stünde derselbe Name zweimal. */
  organizer?: string | null;
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

export function V4EventDetailContent({
  description, category, tags, locationName, address, organizer,
  hasSimilar, similarChildren, sourceName, sourceUrl,
}: V4EventDetailContentProps) {
  const t = useTranslations('EventDetail');
  // Kategorie zuerst, danach die Tags — ohne Dublette, falls die Kategorie
  // zufällig auch als Tag gepflegt ist.
  const chips = [...new Set([category, ...(tags ?? [])].filter((c): c is string => Boolean(c)))];

  const venueLine = locationName?.trim() || null;
  // Die Anschrift nur zeigen, wenn sie mehr sagt als der Venue-Name.
  const addressLine =
    address?.trim() && address.trim() !== venueLine ? address.trim() : null;
  const showVenue = Boolean(venueLine || addressLine);

  const organizerLine =
    organizer?.trim() && organizer.trim() !== sourceName?.trim()
      ? organizer.trim()
      : null;
  const sourceLabel = sourceName?.trim() || (sourceUrl ? hostnameOf(sourceUrl) : null);
  const showSource = Boolean(sourceLabel);

  return (
    <div className="max-w-[700px]">
      {description && (
        <section className="mt-7">
          <h3 className="m-0 mb-3 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            {t('aboutHeading')}
          </h3>
          {/* whitespace-pre-line: Beschreibungen tragen ihre Absätze als
              echte Zeilenumbrüche. HTML wirft die sonst weg und macht aus
              einem gegliederten Text (Line-up, Uhrzeiten, Preise) eine
              Textwand — genau so erschien am 2026-09-07 ein freigegebenes
              Inserat, obwohl die Umbrüche in der DB standen.
              `pre-line` (nicht `pre-wrap`) ist richtig: Umbrüche bleiben,
              Leerzeichen-Ketten aus der Extraktion werden weiter
              zusammengefasst. Gemessen: 13.669 künftige Events tragen
              Umbrüche, davon nur 27 mit drei oder mehr am Stück — es
              entstehen also keine klaffenden Lücken.
              EventDetailV2 macht das seit jeher so; hier fehlte es. */}
          <p
            className="m-0 max-w-[640px] whitespace-pre-line text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)]"
            style={{ textWrap: 'pretty' }}
          >
            {description}
          </p>
        </section>
      )}

      {showVenue && (
        <section className="mt-7">
          <h3 className="m-0 mb-3 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            {t('venueHeading')}
          </h3>
          <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)]">
            {venueLine && <span className="text-[var(--v4-ink)] font-medium">{venueLine}</span>}
            {venueLine && addressLine && <br />}
            {addressLine}
          </p>
          {organizerLine && (
            <p className="m-0 mt-2 text-[13px] text-[var(--v4-ink-50)]">
              {t('organizerLabel')} <span className="text-[var(--v4-ink-70)]">{organizerLine}</span>
            </p>
          )}
        </section>
      )}

      {chips.length > 0 && (
        <section className="mt-7 flex flex-wrap gap-2">
          {chips.map(t => (
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
            {t('sourceLabel')}{' '}
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
            {t('similarEvents')}
          </h3>
          {similarChildren}
        </section>
      )}
    </div>
  );
}
